const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const dayjs = require("dayjs");
const supabase = require("./db");

// DELETE OLD BACKUPS (15 DAYS)
async function deleteOldBackups() {
  const BUCKET = "backups";

  const { data } = await supabase.storage.from(BUCKET).list("", { limit: 100 });

  if (!data) return;

  const now = Date.now();
  const LIMIT = 15 * 24 * 60 * 60 * 1000;

  for (const file of data) {
    const fileTime = new Date(file.created_at).getTime();
    if (now - fileTime > LIMIT) {
      await supabase.storage.from(BUCKET).remove([file.name]);
      console.log("🗑 Deleted old backup:", file.name);
    }
  }
}

module.exports = async function doBackup() {
  try {
    const BUCKET = "backups";

    // Correct Pakistan Time
    const timestamp = dayjs().add(5, "hour").format("YYYY-MM-DD_HH-mm-ss");

    const tmp = os.tmpdir();
    const folder = path.join(tmp, `backup_${timestamp}`);

    fs.mkdirSync(folder, { recursive: true });

    const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

    const csvFiles = [];

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");

      if (error || !data) continue;

      const filePath = path.join(folder, `${table}.csv`);
      const keys = Object.keys(data[0] || {});
      const header = keys.join(",") + "\n";
      const rows = data
        .map((r) => keys.map((k) => JSON.stringify(r[k] || "")).join(","))
        .join("\n");

      fs.writeFileSync(filePath, header + rows);
      csvFiles.push(filePath);
    }

    // CREATE ZIP
    const zipPath = path.join(tmp, `backup_${timestamp}.zip`);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);

      archive.pipe(output);
      csvFiles.forEach((file) =>
        archive.file(file, { name: path.basename(file) })
      );
      archive.finalize();
    });

    // UPLOAD ZIP
    const zipData = fs.readFileSync(zipPath);

    const uploadRes = await supabase.storage
      .from(BUCKET)
      .upload(`backup_${timestamp}.zip`, zipData, {
        contentType: "application/zip",
      });

    if (uploadRes.error) throw new Error(uploadRes.error.message);

    await deleteOldBackups();

    return { success: true, file: `backup_${timestamp}.zip` };
  } catch (e) {
    console.log("❌ Backup Error:", e.message);
    return { success: false, error: e.message };
  }
};
