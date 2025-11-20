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
app.use(express.urlencoded({ extended: true }));

// FIX: using memoryStorage instead of .none()
const upload = multer({ storage: multer.memoryStorage() });

// -------------------------------
// Health
// -------------------------------
app.get("/", (req, res) => res.json({ ok: true }));

// -------------------------------
// BACKUP
// -------------------------------
app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

// -------------------------------
// LIST BACKUPS
// -------------------------------
app.get("/api/list-backups", async (req, res) => {
  const files = await listBackups();
  res.json({ success: true, files });
});

// -------------------------------
// RESTORE
// -------------------------------
app.post("/api/restore-from-bucket", upload.any(), async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const result = await restoreFromBucket({ body: req.body });

    res.json(result);
  } catch (err) {
    console.log(err);
    res.json({ success: false, error: err.message });
  }
});

// -------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
