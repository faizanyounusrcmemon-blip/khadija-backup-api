// restore-from-bucket.js
const supabase = require("./db");
const fs = require("fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const formidable = require("formidable");

// Vercel config (important)
module.exports.config = {
  api: {
    bodyParser: false, // disable default body parsing for FormData
  },
};

// Allowed tables
const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

module.exports = async function restoreFromBucket(req, res) {
  try {
    // --------- Parse FormData properly ---------
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields) => {
      if (err) {
        return res.json({ success: false, error: "Form parse error" });
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

      // Download ZIP from Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(fileName);

      if (error || !data) {
        return res.json({
          success: false,
          error: "Failed to download backup zip",
        });
      }

      // Save ZIP temporarily
      const tmp = os.tmpdir();
      const zipPath = path.join(tmp, fileName);
      fs.writeFileSync(zipPath, Buffer.from(await data.arrayBuffer()));

      const extractPath = path.join(tmp, "restore_" + Date.now());
      fs.mkdirSync(extractPath, { recursive: true });

      // Extract ZIP
      await fs
        .createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractPath }))
        .promise();

      // -------- FULL RESTORE --------
      if (mode === "full") {
        for (const tbl of TABLES) {
          const file = path.join(extractPath, `${tbl}.csv`);
          if (!fs.existsSync(file)) continue;

          await restoreTable(tbl, file);
        }
      }

      // -------- SINGLE TABLE RESTORE --------
      if (mode === "table") {
        const file = path.join(extractPath, `${table}.csv`);
        if (!fs.existsSync(file)) {
          return res.json({
            success: false,
            error: "Table file not found in backup",
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

// ------------------------------------------
// Restore Single Table
// ------------------------------------------
async function restoreTable(table, filePath) {
  console.log("Restoring:", table);

  const content = fs.readFileSync(filePath, "utf8").split("\n");
  const header = content[0].split(",");

  const rows = content
    .slice(1)
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const values = splitCSV(line);
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = values[i] || null;
      });
      return obj;
    });

  // Delete old data
  await supabase.from(table).delete().neq("id", 0);

  // Insert new data
  const { error } = await supabase.from(table).insert(rows);

  if (error) {
    console.log("Restore error in table:", table, error.message);
    throw new Error(error.message);
  }

  console.log("Restore completed for:", table);
}

// ------------------------------------------
// Helper: Proper CSV splitting
// ------------------------------------------
function splitCSV(str) {
  const arr = [];
  let cur = "";
  let inside = false;

  for (let ch of str) {
    if (ch === `"` && inside) {
      inside = false;
      continue;
    }
    if (ch === `"` && !inside) {
      inside = true;
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
