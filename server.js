require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

// Correct imports
const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();

app.use(cors());
app.use(express.json());

// FormData handling
const upload = multer({ storage: multer.none() });

// Health check
app.get("/", (req, res) => res.json({ ok: true }));

// Backup
app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

// List Backups
app.get("/api/list-backups", async (req, res) => {
  const result = await listBackups();
  res.json({ success: true, files: result });
});

// Restore
app.post("/api/restore-from-bucket", upload.none(), async (req, res) => {
  const result = await restoreFromBucket(req);
  res.json(result);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
