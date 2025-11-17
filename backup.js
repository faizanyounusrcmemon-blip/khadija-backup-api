import { createClient } from "@supabase/supabase-js";
import archiver from "archiver";
import fs from "fs";
import os from "os";
import path from "path";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "POST only" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const tmp = os.tmpdir();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = path.join(tmp, `backup_${stamp}`);

    fs.mkdirSync(folder, { recursive: true });

    const TABLES = ["sales", "purchases", "items", "customers", "app_users"];
    const csvFiles = [];

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select("*");
      if (error) continue;

      const csvPath = path.join(folder, `${table}.csv`);
      const header = Object.keys(data[0] || {}).join(",") + "\n";
      const rows = data.map(r => Object.values(r).join(",")).join("\n");

      fs.writeFileSync(csvPath, header + rows, "utf8");
      csvFiles.push(csvPath);
    }

    // ZIP FILE CREATE
    const zipPath = path.join(tmp, `backup_${stamp}.zip`);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.on("error", reject);
      output.on("close", resolve);

      archive.pipe(output);
      csvFiles.forEach(f =>
        archive.file(f, { name: path.basename(f) })
      );
      archive.finalize();
    });

    // UPLOAD ZIP TO SUPABASE STORAGE
    const zipBuffer = fs.readFileSync(zipPath);
    const uploadPath = `backups/backup_${stamp}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(uploadPath, zipBuffer, {
        contentType: "application/zip",
      });

    if (uploadError) throw uploadError;

    return res.json({
      ok: true,
      message: "Backup saved in Supabase Storage",
      file: uploadPath,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err.message,
    });
  }
}
