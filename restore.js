// ==============================
//   FINAL restore.js (WITH PROGRESS)
// ==============================

const fs = require("fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const supabase = require("./db");

const RESTORE_PASSWORD = "faizanyounus";

module.exports = async function restoreBackup(req, res, progressRef) {
  try {
    // PASSWORD CHECK
    const pass = req.body.password;
    if (pass !== RESTORE_PASSWORD) {
      return res.status(403).json({
        ok: false,
        message: "❌ Restore password incorrect",
      });
    }

    // FILE CHECK
    const file = req.file;
    if (!file) {
      return res.json({ ok: false, message: "❌ No backup file provided" });
    }

    const zipPath = file.path;
    const outDir = path.join(os.tmpdir(), "restore_" + Date.now());

    fs.mkdirSync(outDir);

    // ==================================
    // UNZIP BACKUP
    // ==================================
    await fs
      .createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: outDir }))
      .promise();

    const TABLES = [
      "sales",
      "purchases",
      "items",
      "customers",
      "app_users",
      "sale_returns",
    ];

    let step = 0;
    const totalSteps = TABLES.length;

    // ==================================
    // RESTORE EACH TABLE
    // ==================================
    for (const table of TABLES) {
      const csvPath = path.join(outDir, `${table}.csv`);
      if (!fs.existsSync(csvPath)) continue;

      // DELETE OLD DATA
      await supabase.from(table).delete().neq("id", 0);

      // READ CSV
      const raw = fs.readFileSync(csvPath, "utf8").trim().split("\n");
      const headers = raw[0].split(",");

      for (let i = 1; i < raw.length; i++) {
        const cols = raw[i].split(",");
        const obj = {};

        headers.forEach((h, j) => {
          let val = cols[j];

          // Cleanup quotes
          if (val?.startsWith(`"`)) val = val.slice(1);
          if (val?.endsWith(`"`)) val = val.slice(0, -1);

          obj[h] = val;
        });

        await supabase.from(table).insert(obj);
      }

      // 🔥 UPDATE PROGRESS
      step++;
      progressRef.value = Math.floor((step / totalSteps) * 100);
    }

    progressRef.value = 100;

    return res.json({
      ok: true,
      message: "✔ Restore completed successfully",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: "❌ Restore Failed: " + e.message,
    });
  }
};
