// ===============================
//   FINAL SERVER.JS (FULL)
// ===============================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();

app.use(cors());
app.use(express.json());

const supabase = require("./db");

const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => res.json({ ok: true }));

// ---------------------------------------------------
// 1) CREATE BACKUP  (ZIP upload to bucket)
// ---------------------------------------------------
app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

// ---------------------------------------------------
// 2) LIST ALL BACKUPS (For Restore Screen)
// ---------------------------------------------------
app.get("/api/list-backups", async (req, res) => {
  const files = await listBackups();
  res.json({ success: true, files });
});

// ---------------------------------------------------
// 3) RESTORE FROM BUCKET (full + table restore)
// ---------------------------------------------------
app.post("/api/restore-from-bucket", upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const result = await restoreFromBucket({ body });
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------
// 4) DOWNLOAD BACKUP ZIP
// ---------------------------------------------------
app.get("/api/download-backup/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const { data, error } = await supabase.storage
      .from("backups")
      .download(name);

    if (error || !data) {
      return res.status(404).send("File not found");
    }

    // convert data to buffer
    const buffer =
      typeof data.arrayBuffer === "function"
        ? Buffer.from(await data.arrayBuffer())
        : Buffer.from(data);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).send("Download failed");
  }
});

// ---------------------------------------------------
// 5) DELETE BACKUP ZIP (Password Protected)
// ---------------------------------------------------
app.post("/api/delete-backup", async (req, res) => {
  try {
    const { fileName } = req.body;
    const { password } = req.body;

    if (!fileName)
      return res.json({ success: false, error: "Missing file" });

    // Password check
    if (password !== "faizanyounus") {
      return res.json({ success: false, error: "Invalid delete password" });
    }

    const { error } = await supabase.storage
      .from("backups")
      .remove([fileName]);

    if (error) {
      return res.json({ success: false, error: error.message });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("🚀 Server running on port " + PORT)
);
