// backup.js
const { createClient } = require("@supabase/supabase-js");
const archiver = require("archiver");
const dayjs = require("dayjs");
const fs = require("fs");
const path = require("path");

// ✅ Load env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ✅ Backup tables list
const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

async function backup() {
  try {
    console.log("📦 Starting backup...");

    // --------------------------------------------------
    // ⏰ Correct Pakistan Time (UTC+5)
    // --------------------------------------------------
    const timestamp = dayjs()
      .add(5, "hour") // ← Pakistan Time Fix
      .format("YYYY-MM-DD_HH-mm-ss");

    const tmpFolder = "/tmp/backup_" + timestamp;
    fs.mkdirSync(tmpFolder, { recursive: true });

    const csvFiles = [];

    // --------------------------------------------------
    // 🎯 Convert tables to CSV
    // --------------------------------------------------
    for (const table of TABLES) {
      console.log("➡ Exporting", table);

      const { data, error } = await supabase.from(table).select("*");

      if (error) {
        console.error("❌ Error reading table:", table, error.message);
        continue;
      }

      const filePath = path.join(tmpFolder, `${table}.csv`);
      const csvData = convertToCSV(data);

      fs.writeFileSync(filePath, csvData, "utf8");

      csvFiles.push(filePath);
    }

    // --------------------------------------------------
    // 📦 Create ZIP file
    // --------------------------------------------------
    const zipPath = `/tmp/backup_${timestamp}.zip`;

    await zipFiles(csvFiles, zipPath);

    console.log("✅ ZIP generated:", zipPath);

    // --------------------------------------------------
    // ☁ Upload ZIP to Supabase bucket
    // --------------------------------------------------
    const fileBuffer = fs.readFileSync(zipPath);

    const uploadName = `backup_${timestamp}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(uploadName, fileBuffer, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      throw new Error("Upload failed: " + uploadError.message);
    }

    console.log("☁ Uploaded:", uploadName);

    return {
      success: true,
      filename: uploadName,
    };
  } catch (err) {
    console.error("❌ Backup error:", err.message);
    return { success: false, error: err.message };
  }
}

// --------------------------------------------------
// CSV Converter
// --------------------------------------------------
function convertToCSV(rows) {
  if (!rows || rows.length === 0) return "";

  const keys = Object.keys(rows[0]);
  const header = keys.join(",") + "\n";

  const body = rows
    .map((row) => keys.map((k) => JSON.stringify(row[k] || "")).join(","))
    .join("\n");

  return header + body;
}

// --------------------------------------------------
// ZIP helper
// --------------------------------------------------
function zipFiles(filePaths, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);

    filePaths.forEach((file) => {
      archive.file(file, { name: path.basename(file) });
    });

    archive.finalize();
  });
}

module.exports = backup;
