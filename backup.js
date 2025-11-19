// backup.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const dayjs = require("dayjs");
const supabase = require("./db");

// Delete old backups (15 days)
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

    const stamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
    const tmp = os.tmpdir();
    const folder = path.join(tmp, `backup_${stamp}`);

    fs.mkdirSync(folder, { recursive: true });

    const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

    const csvFiles = [];

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");

      if (error) continue;

      const filePath = path.join(folder, `${table}.csv`);
      const header = Object.keys(data[0] || {}).join(",") + "\n";
      const rows = data.map((r) => Object.values(r).join(",")).join("\n");

      fs.writeFileSync(filePath, header + rows);

      csvFiles.push(filePath);
    }

    // Create ZIP
    const zipPath = path.join(tmp, `backup_${stamp}.zip`);

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

    // Upload ZIP to Supabase Storage
    const zipData = fs.readFileSync(zipPath);

    const uploadRes = await supabase.storage
      .from(BUCKET)
      .upload(`backup_${stamp}.zip`, zipData, {
        contentType: "application/zip",
      });

    if (uploadRes.error) {
      throw new Error(uploadRes.error.message);
    }

    // Delete old backups
    await deleteOldBackups();

    return { success: true, file: `backup_${stamp}.zip` };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
