// backup.js
const fs = require("fs");
const path = require("path");
const os = require("os"); // Vercel-safe temp directory
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");
const archiver = require("archiver");
const { Parser } = require("json2csv");
const dayjs = require("dayjs");

// ----------------------------
// GOOGLE AUTH LOADER (BASE64)
// ----------------------------
async function loadGoogleAuth() {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT || "";

  let jsonString;
  try {
    jsonString = Buffer.from(base64, "base64").toString("utf8");
  } catch (err) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT base64 decode error: " + err.message);
  }

  let key;
  try {
    key = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT JSON: " + err.message);
  }

  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata",
    ],
  });

  await auth.authorize();
  return google.drive({ version: "v3", auth });
}

// ----------------------------
// Convert rows → CSV file
// ----------------------------
async function rowsToCsv(rows, outPath) {
  const parser = new Parser({ flatten: true });
  const csv = parser.parse(rows || []);
  fs.writeFileSync(outPath, csv, "utf8");
}

// ----------------------------
// Upload ZIP to Google Drive
// ----------------------------
async function uploadToDrive(drive, filePath, folderId) {
  const fileName = path.basename(filePath);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      body: fs.createReadStream(filePath),
    },
    fields: "id,name",
  });

  return res.data;
}

// ----------------------------
// MAIN BACKUP FUNCTION
// ----------------------------
module.exports = async function doBackup() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;

  if (!SUPABASE_URL || !SUPABASE_KEY)
    throw new Error("❌ Missing Supabase environment variables");

  if (!DRIVE_FOLDER_ID)
    throw new Error("❌ Missing DRIVE_FOLDER_ID");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Authenticate Google
  const drive = await loadGoogleAuth();

  // ----------------------------
  // use Vercel writable temp directory
  // ----------------------------
  const tmp = os.tmpdir(); // "/tmp"
  const stamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const tempFolder = path.join(tmp, `backup_${stamp}`);

  fs.mkdirSync(tempFolder, { recursive: true });

  // Supabase tables
  const TABLES = [
    "sales",
    "purchases",
    "items",
    "customers",
    "app_users",
  ];

  const csvFiles = [];

  // Export each table into CSV
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");

    if (error) {
      console.warn(`⚠ Error loading table ${table}:`, error.message);
      continue;
    }

    const filePath = path.join(tempFolder, `${table}.csv`);
    await rowsToCsv(data, filePath);
    csvFiles.push(filePath);
  }

  // ----------------------------
  // Create ZIP file
  // ----------------------------
  const zipPath = path.join(tmp, `backup_${stamp}.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);

    for (const csv of csvFiles) {
      archive.file(csv, { name: path.basename(csv) });
    }

    archive.finalize();
  });

  // ----------------------------
  // Upload ZIP to Google Drive
  // ----------------------------
  const uploaded = await uploadToDrive(drive, zipPath, DRIVE_FOLDER_ID);

  return {
    success: true,
    message: "Backup completed successfully",
    drive_file: uploaded,
  };
};
