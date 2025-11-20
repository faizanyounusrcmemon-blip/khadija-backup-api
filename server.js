require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();

app.use(cors());

// ❌ IMPORTANT: DO NOT USE express.json() or express.urlencoded()
// These break FormData body.
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// multer for FormData
const upload = multer({ storage: multer.memoryStorage() });

// ------------------------------
// Health Check
// ------------------------------
app.get("/", (req, res) => res.json({ ok: true }));

// ------------------------------
// BACKUP
// ------------------------------
app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

// ------------------------------
// LIST BACKUPS
// ------------------------------
app.get("/api/list-backups", async (req, res) => {
  const files = await listBackups();
  res.json({ success: true, files });
});

// ------------------------------
// RESTORE FULL / TABLE
// ------------------------------
app.post("/api/restore-from-bucket", upload.any(), async (req, res) => {
  try {
    // FormData fields come in req.body
    const body = req.body;

    const result = await restoreFromBucket({ body });

    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
