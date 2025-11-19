const supabase = require("./db");
const os = require("os");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");

const PASSWORD = "faizanyounus";

module.exports = async function restoreFromBucket(req) {
  return new Promise(async (resolve, reject) => {
    try {
      const busboy = require("busboy");
      const bb = busboy({ headers: req.headers });

      let password = "";
      let fileName = "";
      let mode = "full";
      let table = "";

      bb.on("field", (name, val) => {
        if (name === "password") password = val;
        if (name === "fileName") fileName = val;
        if (name === "mode") mode = val;
        if (name === "table") table = val;
      });

      bb.on("finish", async () => {
        if (password !== PASSWORD) {
          return reject(new Error("Invalid restore password"));
        }

        // STEP 1 → Download file from bucket
        const { data, error } = await supabase.storage
          .from("backups")
          .download(fileName);

        if (error) return reject(error);

        const tmpZipPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(tmpZipPath, Buffer.from(await data.arrayBuffer()));

        // STEP 2 → Unzip files
        const extractPath = path.join(os.tmpdir(), "restore_" + Date.now());
        fs.mkdirSync(extractPath);

        await fs
          .createReadStream(tmpZipPath)
          .pipe(unzipper.Extract({ path: extractPath }))
          .promise();

        // STEP 3 → Restore logic
        const TABLES = ["sales", "purchases", "items", "customers", "app_users"];

        async function restoreTable(tbl) {
          const csvPath = path.join(extractPath, `${tbl}.csv`);
          if (!fs.existsSync(csvPath)) return;

          const csv = fs.readFileSync(csvPath, "utf8");
          const rows = csv
            .split("\n")
            .map((l) => l.trim())
            .filter((x) => x.length > 0);

          // delete old data
          await supabase.from(tbl).delete().neq("id", 0);

          // insert rows
          for (const row of rows) {
            const cols = row.split(",");
            await supabase.from(tbl).insert({
              ...Object.fromEntries(cols.map((v, i) => [`col${i}`, v])),
            });
          }
        }

        if (mode === "full") {
          for (const tbl of TABLES) await restoreTable(tbl);
        } else if (mode === "table") {
          await restoreTable(table);
        }

        resolve({ restored: mode === "full" ? "ALL" : table });
      });

      req.pipe(bb);
    } catch (err) {
      reject(err);
    }
  });
};
