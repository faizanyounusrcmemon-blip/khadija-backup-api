require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

// API Modules
const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();
app.use(cors());
app.use(express.json());

// Required for FormData
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------
// Health Check
// ---------------------------
app.get("/", (req, res) => res.json({ ok: true }));

// ---------------------------
// Manual Backup
// ---------------------------
app.post("/api/backup", async (req, res) => {
  try {
    const result = await doBackup();
    res.json({ success: true, file: result.file });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ---------------------------
// LIST BACKUPS
// ---------------------------
app.get("/api/list-backups", async (req, res) => {
  try {
    const files = await listBackups();
    res.json({ success: true, files });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ---------------------------
// RESTORE FULL / TABLE
// ---------------------------
app.post("/api/restore-from-bucket", upload.none(), async (req, res) => {
  try {
    const result = await restoreFromBucket(req);
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
