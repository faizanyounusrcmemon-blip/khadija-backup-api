require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();
app.use(cors());

// ❌ REMOVE: express.json() & urlencoded()
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// Health
app.get("/", (req, res) => res.json({ ok: true }));

// Backup
app.post("/api/backup", async (req, res) => {
  res.json(await doBackup());
});

// List
app.get("/api/list-backups", async (req, res) => {
  res.json({ success: true, files: await listBackups() });
});

// Restore
app.post("/api/restore-from-bucket", upload.any(), async (req, res) => {
  const body = req.body;
  const result = await restoreFromBucket({ body });
  res.json(result);
});

app.listen(5000, () => console.log("🚀 Server running on 5000"));
