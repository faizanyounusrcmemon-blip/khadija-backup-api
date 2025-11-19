// restore-from-bucket.js
const supabase = require("./db");
const fs = require("fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const dayjs = require("dayjs");
const formidable = require("formidable");

// Allowed tables
const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

module.exports = async function restoreFromBucket(req, res) {
  try {
    // Parse form-data (Fix!)
    const form = formidable({});
    form.parse(req, async (err, fields) => {
      if (err) {
        return res.json({ success: false, error: "Form parsing failed" });
      }

      const password = fields.password;
      const fileName = fields.fileName;
      const mode = fields.mode;
      const table = fields.table;

      if (password !== "faizanyounus") {
        return res.json({ success: false, error: "Invalid password" });
      }

      if (!fileName) {
        return res.json({ success: false, error: "File name missing" });
      }

      const BUCKET = "backups";

      // Download backup ZIP
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(fileName);

      if (error || !data) {
        return res.json({
          success: false,
          error: "Download failed",
        });
      }

      // Save ZIP locally
      const tmp = os.tmpdir();
      const zipPath = path.join(tmp, fileName);
      fs.writeFileSync(zipPath, Buffer.from(await data.arrayBuffer()));

      const extractPath = path.join(tmp, "restore_" + Date.now());
      fs.mkdirSync(extractPath, { recursive: true });

      await fs
        .createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .promise();

      // FULL RESTORE
      if (mode === "full") {
        for (const tbl of TABLES) {
          const file = path.join(extractPath, `${tbl}.csv`);
          if (fs.existsSync(file)) {
            await restoreTable(tbl, file);
          }
        }
      }

      // SINGLE TABLE RESTORE
      if (mode === "table") {
        const file = path.join(extractPath, `${table}.csv`);
        if (!fs.existsSync(file)) {
          return res.json({
            success: false,
            error: "Table not found inside zip",
          });
        }

        await restoreTable(table, file);
      }

      return res.json({ success: true });
    });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
};

// ----------------------------
// Restore Table Function
// ----------------------------
async function restoreTable(table, filePath) {
  console.log("Restoring:", table);

  const content = fs.readFileSync(filePath, "utf8").split("\n");
  const header = content[0].split(",");

  const rows = content
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = splitCSV(line);
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = values[i] || null;
      });
      return obj;
    });

  // Delete old rows
  await supabase.from(table).delete().neq("id", 0);

  // Insert new rows
  const { error } = await supabase.from(table).insert(rows);

  if (error) {
    console.log("Insert error:", error.message);
    throw new Error(error.message);
  }

  console.log("✔ Restore done:", table);
}

// ----------------------------
// CSV Splitting Helper
// ----------------------------
function splitCSV(str) {
  const arr = [];
  let cur = "";
  let inside = false;

  for (let ch of str) {
    if (ch === '"' && !inside) {
      inside = true;
      continue;
    }
    if (ch === '"' && inside) {
      inside = false;
      continue;
    }
    if (ch === "," && !inside) {
      arr.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  arr.push(cur);
  return arr;
}
