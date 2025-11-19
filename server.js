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

// ⛔ Vercel میں کوئی folder write نہیں ہوتا → multer.memoryStorage()
const upload = multer({ storage: multer.memoryStorage() });

// ----------------------------------------
// HEALTH CHECK
// ----------------------------------------
app.get("/", (req, res) => res.json({ ok: true }));

// ----------------------------------------
// 📌 TRIGGER MANUAL BACKUP
// ----------------------------------------
app.post("/api/backup", async (req, res) => {
  try {
    const result = await doBackup();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------
// 📁 LIST BACKUP FILES FROM SUPABASE BUCKET
// ----------------------------------------
app.get("/api/list-backups", async (req, res) => {
  try {
    const files = await listBackups();
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------
// ♻ RESTORE FROM SUPABASE BUCKET
// ----------------------------------------
// ❗IMPORTANT → upload.none() required for FormData
app.post("/api/restore-from-bucket", upload.none(), async (req, res) => {
  try {
    const result = await restoreFromBucket(req);

    if (!result.success) {
      return res.json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
