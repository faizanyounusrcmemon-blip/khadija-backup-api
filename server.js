require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();
app.use(cors());

// ❌ remove express.json()
// ❌ remove express.urlencoded()
// FormData allows body without them

const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => res.json({ ok: true }));

app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

app.get("/api/list-backups", async (req, res) => {
  const files = await listBackups();
  res.json({ success: true, files });
});

app.post("/api/restore-from-bucket", upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const result = await restoreFromBucket({ body });
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(5000, () => console.log("🚀 Running on port 5000"));
