// restore.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const unzipper = require("unzipper");
const { createClient } = require("@supabase/supabase-js");
const { parse } = require("csv-parse/sync"); // csv-parse

const TABLES = ["sales","purchases","items","customers","app_users"];
const RESTORE_PASSWORD = process.env.RESTORE_PASSWORD || "faizanyounus";

function csvToObjects(csvText) {
  // csv-parse sync returns array of records with header mapping
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true
  });
  return records;
}

module.exports = async function doRestore(filePath, options = {}) {
  // filePath = local path to uploaded zip
  // options: { mode: 'full' or 'selected', selected: { sales:true, items:false, ... }, supabase }
  if (!options.supabase) throw new Error("supabase client required");

  // extract zip to temp dir
  const tmp = os.tmpdir();
  const restoreDir = path.join(tmp, `restore_${Date.now()}`);
  fs.mkdirSync(restoreDir, { recursive: true });

  await fs.createReadStream(filePath).pipe(unzipper.Extract({ path: restoreDir })).promise();

  const supabase = options.supabase;
  const mode = options.mode || "full";
  const selected = options.selected || {};

  // For each table -> if present in zip, then restore according to mode/selected
  for (const table of TABLES) {
    const csvPath = path.join(restoreDir, `${table}.csv`);
    if (!fs.existsSync(csvPath)) {
      console.log("No csv for", table);
      continue;
    }
    if (mode === "full" || selected[table]) {
      const csvText = fs.readFileSync(csvPath, "utf8");
      const rows = csvToObjects(csvText); // array of objects
      // delete all existing rows (use condition that works for your DB keys)
      // using delete().neq('id', 0) assumes ids are positive and not 0
      const del = await supabase.from(table).delete().neq("id", 0);
      if (del.error) {
        console.warn("Warning deleting table", table, del.error.message || del.error);
      }

      // insert in chunks to avoid payload limits
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const ins = await supabase.from(table).insert(chunk);
        if (ins.error) {
          console.error("Insert error table", table, ins.error.message || ins.error);
          throw new Error(`Insert failed for ${table}: ${ins.error.message || ins.error}`);
        }
      }
      console.log(`Restored ${table} (${rows.length} rows)`);
    }
  }

  // cleanup
  try { fs.rmSync(restoreDir, { recursive: true, force: true }); } catch (e) {}
  return { ok: true, message: "Restore completed" };
};
