// backup.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const { Parser } = require("json2csv");
const dayjs = require("dayjs");
const { createClient } = require("@supabase/supabase-js");

const TABLES = ["sales","purchases","items","customers","app_users"];
const BUCKET = process.env.BACKUP_BUCKET || "backups"; // supabase bucket name

function rowsToCsv(rows) {
  const parser = new Parser({ flatten: true });
  return parser.parse(rows || []);
}

async function deleteOldBackups(supabase) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
    if (error) {
      console.warn("List bucket error:", error.message || error);
      return;
    }
    const FIFTEEN = 15 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const f of data) {
      // supabase storage list returns { name, id, updated_at, created_at, ... }
      const t = f.updated_at || f.created_at;
      if (!t) continue;
      const created = new Date(t).getTime();
      if (now - created > FIFTEEN) {
        await supabase.storage.from(BUCKET).remove([f.name]);
        console.log("Deleted old backup:", f.name);
      }
    }
  } catch (e) {
    console.warn("deleteOldBackups error:", e.message || e);
  }
}

module.exports = async function doBackup() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const tmp = os.tmpdir();
  const stamp = dayjs().format("YYYY-MM-DD_HH-mm-ss");
  const folder = path.join(tmp, `backup_${stamp}`);
  fs.mkdirSync(folder, { recursive: true });

  try {
    // export each table to CSV
    for (const table of TABLES) {
      const q = await supabase.from(table).select("*");
      if (q.error) {
        console.warn("Supabase select error", table, q.error.message || q.error);
        fs.writeFileSync(path.join(folder, `${table}.csv`), ""); // write empty file
        continue;
      }
      const rows = q.data || [];
      const csv = rowsToCsv(rows);
      fs.writeFileSync(path.join(folder, `${table}.csv`), csv, "utf8");
    }

    // zip them
    const zipName = `backup_${stamp}.zip`;
    const zipPath = path.join(tmp, zipName);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      TABLES.forEach(t => {
        const p = path.join(folder, `${t}.csv`);
        if (fs.existsSync(p)) archive.file(p, { name: `${t}.csv` });
      });
      archive.finalize();
    });

    // upload zip to supabase storage
    const fileBuffer = fs.readFileSync(zipPath);
    const remoteName = zipName; // you can include folder if you want: `backups/${zipName}`

    const { data, error } = await supabase.storage.from(BUCKET).upload(remoteName, fileBuffer, {
      contentType: "application/zip",
      upsert: false // false => won't overwrite same name; set true if you want overwrite
    });
    if (error) throw error;

    // cleanup local tmp folder files
    try { fs.rmSync(folder, { recursive: true, force: true }); } catch (e){}

    // delete old backups older than 15 days
    await deleteOldBackups(supabase);

    return {
      success: true,
      file: data,
      uploadedName: remoteName
    };
  } catch (e) {
    // cleanup
    try { fs.rmSync(folder, { recursive: true, force: true }); } catch (err){}
    throw e;
  }
};
