require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();

app.use(cors());

// ❌ REMOVE BOTH — THEY BREAK FORMDATA
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => res.json({ ok: true }));

app.post("/api/backup", async (req, res) => {
  res.json(await doBackup());
});

app.get("/api/list-backups", async (req, res) => {
  res.json({ success: true, files: await listBackups() });
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
