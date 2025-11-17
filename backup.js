const fs = require("fs");
const path = require("path");
const os = require("os");
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");
const archiver = require("archiver");
const { Parser } = require("json2csv");
const dayjs = require("dayjs");

async function loadGoogleAuth() {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT || "";
  let key;

  try {
    const json = Buffer.from(base64, "base64").toString("utf8");
    key = JSON.parse(json);
  } catch (e) {
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT JSON: " + e.message);
  }

  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata"
    ]
  });

  await jwtClient.authorize();
  return google.drive({ version: "v3", auth: jwtClient });
}

async function rowsToCsvFile(rows, outPath) {
  const parser = new Parser({ flatten: true });
  const csv = parser.parse(rows || []);
  fs.writeFileSync(outPath, csv, "utf8");
}

async function uploadFileToDrive(drive, filePath, folderId) {
  const fileName = path.basename(filePath);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/zip",
      parents: [String(folderId)]
    },
    media: {
      mimeType: "application/zip",
      body: fs.createReadStream(filePath)
    },
    fields: "id,name,parents"
  });

  return res.data;
}

async function doBackup() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;

  if (!SUPABASE_URL || !SUPABASE_KEY)
    throw new Error("Supabase env vars missing");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const drive = await loadGoogleAuth();

  const tmpRoot = os.tmpdir();
  const stamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");

  const folder = path.join(tmpRoot, `backup_${stamp}`);
  fs.mkdirSync(folder, { recursive: true });

  const TABLES = ["sales", "purchases", "items", "customers", "app_users"];
  const csvPaths = [];

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) continue;

    const out = path.join(folder, `${table}.csv`);
    await rowsToCsvFile(data, out);
    csvPaths.push(out);
  }

  // ZIP file create
  const zipPath = path.join(tmpRoot, `backup_${stamp}.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    csvPaths.forEach(f => archive.file(f, { name: path.basename(f) }));
    archive.finalize();
  });

  // Upload to Google Drive
  const uploaded = await uploadFileToDrive(drive, zipPath, DRIVE_FOLDER_ID);

  return {
    success: true,
    file: uploaded
  };
}

//  🔥 IMPORTANT EXPORT
module.exports = doBackup;
