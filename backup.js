// ==============================
//   FINAL backup.js (WITH PROGRESS)
// ==============================

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

module.exports = async function doBackup(progressRef) {
  try {
    const BUCKET = "backups";

    const timestamp = dayjs().tz("Asia/Karachi").format("YYYY-MM-DD_HH-mm-ss");
    const tmp = os.tmpdir();
    const folder = path.join(tmp, `backup_${timestamp}`);

    // Create temp folder
    fs.mkdirSync(folder, { recursive: true });

    const TABLES = [
      "sales",
      "purchases",
      "items",
      "customers",
      "app_users",
      "sale_returns",
    ];

    let step = 0;
    const totalSteps = TABLES.length + 2; // +zip +upload

    const csvFiles = [];

    // EXPORT EACH TABLE
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.log("Export error:", error.message);
        continue;
      }

      const filePath = path.join(folder, `${table}.csv`);
      const keys = Object.keys(data[0] || {});
      const header = keys.join(",") + "\n";

      const rows = data
        .map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))
        .join("\n");

      fs.writeFileSync(filePath, header + rows);
      csvFiles.push(filePath);

      // 🔥 UPDATE PROGRESS
      step++;
      progressRef.value = Math.floor((step / totalSteps) * 100);
    }

    // ==========================
    // CREATE ZIP FILE
    // ==========================
    const zipPath = path.join(tmp, `backup_${timestamp}.zip`);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);

      archive.pipe(output);
      csvFiles.forEach((f) => archive.file(f, { name: path.basename(f) }));
      archive.finalize();
    });

    step++;
    progressRef.value = Math.floor((step / totalSteps) * 100);

    // ==========================
    // UPLOAD ZIP TO SUPABASE
    // ==========================
    const zipData = fs.readFileSync(zipPath);
    await supabase.storage
      .from(BUCKET)
      .upload(`backup_${timestamp}.zip`, zipData, {
        contentType: "application/zip",
        upsert: true,
      });

    progressRef.value = 100;

    return { success: true, message: "Backup completed successfully" };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
