// backup.js
const { createClient } = require("@supabase/supabase-js");
const archiver = require("archiver");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

const fs = require("fs");
const path = require("path");

// --------------------------------------------------
// 🔐 Load ENV
// --------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --------------------------------------------------
// 📌 Backup Tables List
// --------------------------------------------------
const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

// --------------------------------------------------
// 📦 MAIN BACKUP FUNCTION
// --------------------------------------------------
async function backup() {
  try {
    console.log("🔵 Starting Backup...");

    // --------------------------------------------------
    // ⏰ Correct Pakistan Time (UTC+5)
    // --------------------------------------------------
    const nowUTC = dayjs().utc();
    const timestamp = nowUTC.add(5, "hour").format("YYYY-MM-DD_HH-mm-ss");
    console.log("⏰ Timestamp:", timestamp);

    const folder = `/tmp/backup_${timestamp}`;
    fs.mkdirSync(folder, { recursive: true });

    const csvFiles = [];

    // --------------------------------------------------
    // 📄 Convert Each Table to CSV
    // --------------------------------------------------
    for (const table of TABLES) {
      console.log("➡ Exporting table:", table);

      const { data, error } = await supabase.from(table).select("*");
      if (error) {
        console.error("❌ Error reading:", table, error.message);
        continue;
      }

      const filePath = path.join(folder, `${table}.csv`);
      fs.writeFileSync(filePath, convertToCSV(data), "utf8");
      csvFiles.push(filePath);
    }

    // --------------------------------------------------
    // 🗜 Create ZIP
    // --------------------------------------------------
    const zipPath = `/tmp/backup_${timestamp}.zip`;
    await zipFiles(csvFiles, zipPath);
    console.log("📦 ZIP created:", zipPath);

    // --------------------------------------------------
    // ☁ Upload to Supabase Storage (Bucket: backups)
    // --------------------------------------------------
    const fileBuffer = fs.readFileSync(zipPath);
    const uploadName = `backup_${timestamp}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(uploadName, fileBuffer, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    console.log("☁ Uploaded:", uploadName);

    return {
      success: true,
      filename: uploadName,
    };
  } catch (err) {
    console.error("❌ Backup Failed:", err.message);
    return { success: false, error: err.message };
  }
}

// --------------------------------------------------
// 📄 Convert JSON → CSV
// --------------------------------------------------
function convertToCSV(rows) {
  if (!rows || rows.length === 0) return "";

  const keys = Object.keys(rows[0]);
  let csv = keys.join(",") + "\n";

  rows.forEach((row) => {
    csv += keys.map((k) => JSON.stringify(row[k] ?? "")).join(",") + "\n";
  });

  return csv;
}

// --------------------------------------------------
// 🗜 ZIP HELPER
// --------------------------------------------------
function zipFiles(files, outputZip) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZip);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    output.on("close", resolve);
    archive.on("error", reject);

    files.forEach((file) => {
      archive.file(file, { name: path.basename(file) });
    });

    archive.finalize();
  });
}

module.exports = backup;
