// backup.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const archiver = require('archiver');
const { Parser } = require('json2csv');
const dayjs = require('dayjs');
const mkdirp = require('mkdirp');

async function loadGoogleAuth() {
  // Accept either base64 JSON in env or path to file
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  const pathToJson = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || '';

  let key;
  if (base64) {
    try {
      const json = Buffer.from(base64, 'base64').toString('utf8');
      key = JSON.parse(json);
    } catch (e) {
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT (base64) JSON: ' + e.message);
    }
  } else if (pathToJson && fs.existsSync(pathToJson)) {
    key = JSON.parse(fs.readFileSync(pathToJson, 'utf8'));
  } else {
    throw new Error('No Google service account provided. Set GOOGLE_SERVICE_ACCOUNT (base64) or GOOGLE_SERVICE_ACCOUNT_PATH.');
  }

  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata'],
  });

  await jwtClient.authorize();
  const drive = google.drive({ version: 'v3', auth: jwtClient });
  return drive;
}

function makeFilename(prefix) {
  return `${prefix}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`;
}

async function rowsToCsvFile(rows, outPath) {
  // rows may be array of objects
  const parser = new Parser({ flatten: true });
  const csv = parser.parse(rows || []);
  fs.writeFileSync(outPath, csv, 'utf8');
}

async function uploadFileToDrive(drive, filePath, folderId) {
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : [],
    },
    media: {
      body: fs.createReadStream(filePath),
    },
    fields: 'id, name',
  });

  return res.data;
}

module.exports = async function doBackup(opts = {}) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
  const TABLES = (process.env.TABLES_TO_BACKUP || 'sales,purchases,items,customers,app_users').split(',').map(t => t.trim()).filter(Boolean);

  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vars not set.');
  if (!DRIVE_FOLDER_ID) throw new Error('DRIVE_FOLDER_ID not set.');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const drive = await loadGoogleAuth();

  // temp folders
  const tmpRoot = opts.tmpRoot || path.join(__dirname, 'tmp_backups');
  mkdirp.sync(tmpRoot);
  const stamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
  const folder = path.join(tmpRoot, `backup_${stamp}`);
  mkdirp.sync(folder);

  const csvPaths = [];

  for (const table of TABLES) {
    try {
      const q = supabase.from(table).select('*');
      const res = await q;
      if (res.error) {
        console.warn(`Warning: error fetching ${table}:`, res.error.message || res.error);
        continue;
      }
      const rows = res.data || [];
      const out = path.join(folder, `${table}.csv`);
      if (rows.length === 0) {
        // write an empty file with headers? we'll write an empty CSV
        fs.writeFileSync(out, '');
      } else {
        await rowsToCsvFile(rows, out);
      }
      csvPaths.push(out);
    } catch (e) {
      console.error('Error export table', table, e.message || e);
    }
  }

  // create zip
  const zipName = `backup_${stamp}.zip`;
  const zipPath = path.join(tmpRoot, zipName);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', err => reject(err));

    archive.pipe(output);
    for (const p of csvPaths) {
      archive.file(p, { name: path.basename(p) });
    }
    archive.finalize();
  });

  // upload zip
  const uploaded = await uploadFileToDrive(drive, zipPath, DRIVE_FOLDER_ID);

  // cleanup local folder older than 7 days (optional)
  try {
    const files = fs.readdirSync(tmpRoot);
    const now = Date.now();
    for (const f of files) {
      const full = path.join(tmpRoot, f);
      const stat = fs.statSync(full);
      if ((now - stat.mtimeMs) > (7 * 24 * 60 * 60 * 1000)) {
        // delete file / folder
        if (stat.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
      }
    }
  } catch (e) {
    console.warn('Cleanup error', e.message || e);
  }

  return {
    zipName,
    zipPath,
    driveFileId: uploaded.id,
    driveFileName: uploaded.name,
    uploaded
  };
};
