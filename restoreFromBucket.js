const supabase = require("./db");
const fs = require("fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");

const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

module.exports = async function restoreFromBucket(req) {
  try {
    const { password, fileName, mode, table } = req.body;

    if (password !== "faizanyounus") {
      return { success: false, error: "Invalid password" };
    }

    if (!fileName) return { success: false, error: "Missing file name" };

    const BUCKET = "backups";

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(fileName);

    if (error || !data)
      return { success: false, error: "Failed to download file" };

    const buffer =
      typeof data.arrayBuffer === "function"
        ? Buffer.from(await data.arrayBuffer())
        : Buffer.from(data);

    const tmp = os.tmpdir();
    const zipPath = path.join(tmp, fileName);

    fs.writeFileSync(zipPath, buffer);

    const extractPath = path.join(tmp, "restore_" + Date.now());
    fs.mkdirSync(extractPath, { recursive: true });

    await fs
      .createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    if (mode === "full") {
      for (const tbl of TABLES) {
        const file = path.join(extractPath, `${tbl}.csv`);
        if (fs.existsSync(file)) await restoreTable(tbl, file);
      }
    }

    if (mode === "table") {
      if (!table) return { success: false, error: "Table required" };

      const file = path.join(extractPath, `${table}.csv`);
      if (!fs.existsSync(file))
        return { success: false, error: "Table not found in backup" };

      await restoreTable(table, file);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

async function restoreTable(table, filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const header = lines[0].split(",");

  const rows = lines
    .slice(1)
    .filter((v) => v.trim() !== "")
    .map((line) => {
      const values = splitCSV(line);
      const obj = {};
      header.forEach((h, i) => (obj[h] = values[i] || null));
      return obj;
    });

  await supabase.from(table).delete().neq("id", 0);
  await supabase.from(table).insert(rows);
}

function splitCSV(str) {
  const arr = [];
  let cur = "";
  let q = false;

  for (let ch of str) {
    if (ch === '"' && q) {
      q = false;
      continue;
    }
    if (ch === '"' && !q) {
      q = true;
      continue;
    }
    if (ch === "," && !q) {
      arr.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  arr.push(cur);
  return arr;
}
