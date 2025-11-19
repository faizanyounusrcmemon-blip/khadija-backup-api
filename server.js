require("dotenv").config();
const express = require("express");
const cors = require("cors");
const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => res.json({ ok: true }));

// --- Trigger Manual Backup ---
app.post("/api/backup", async (req, res) => {
  try {
    const result = await doBackup();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- LIST BACKUP FILES FROM SUPABASE BUCKET ---
app.get("/api/list-backups", async (req, res) => {
  try {
    const files = await listBackups();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- RESTORE FROM SUPABASE BUCKET ---
app.post("/api/restore-from-bucket", async (req, res) => {
  try {
    const result = await restoreFromBucket(req);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
