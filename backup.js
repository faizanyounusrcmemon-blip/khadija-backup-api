const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const supabase = require("./db");

// delete 15 day old backups
async function deleteOldBackups() {
  const BUCKET = "backups";

  const { data, error } = await supabase.storage.from(BUCKET).list("");

  if (!data) return;

  const now = Date.now();
  const limit = 15 * 24 * 60 * 60 * 1000;

  data.forEach(async (file) => {
    const fileTime = new Date(file.created_at).getTime();
    if (now - fileTime > limit) {
      await supabase.storage.from(BUCKET).remove([file.name]);
    }
  });
}

module.exports = async function doBackup() {
  try {
    const BUCKET = "backups";

    // ✔ REAL Pakistan Time
    const timestamp = dayjs().tz("Asia/Karachi").format("YYYY-MM-DD_hh-mm-ss_A");

    const tmp = os.tmpdir();
    const folder = path.join(tmp, `backup_${timestamp}`);
    fs.mkdirSync(folder, { recursive: true });

    const TABLES = ["sales", "purchases", "items", "customers", "app_users"];
    const csvFiles = [];

    for (const table of TABLES) {
      const { data } = await supabase.from(table).select("*");
      if (!data) continue;

      const filePath = path.join(folder, `${table}.csv`);

      const keys = Object.keys(data[0] || {});
      const header = keys.join(",") + "\n";

      const rows = data
        .map((row) => keys.map((k) => JSON.stringify(row[k] ?? "")).join(","))
        .join("\n");

      fs.writeFileSync(filePath, header + rows);
      csvFiles.push(filePath);
    }

    const zipPath = path.join(tmp, `backup_${timestamp}.zip`);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);

      archive.pipe(output);

      csvFiles.forEach((f) =>
        archive.file(f, { name: path.basename(f) })
      );

      archive.finalize();
    });

    const zipData = fs.readFileSync(zipPath);

    await supabase.storage
      .from(BUCKET)
      .upload(`backup_${timestamp}.zip`, zipData, {
        contentType: "application/zip",
      });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
