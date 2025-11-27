// ===============================
//  FINAL SERVER.JS (WITH PROGRESS)
// ===============================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const doBackup = require("./backup");
const restoreBackup = require("./restore");

const app = express();
app.use(cors());
app.use(express.json());

// Multer for file upload (restore)
const upload = multer({ dest: "uploads/" });

// ===============================
//   PROGRESS VARIABLES (GLOBAL)
// ===============================
let backupProgress = { value: 0 };
let restoreProgress = { value: 0 };

// ===============================
//   BACKUP (START BACKUP)
// ===============================
app.post("/api/backup", async (req, res) => {
  try {
    backupProgress.value = 0; // reset progress
    const result = await doBackup(backupProgress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===============================
//   BACKUP PROGRESS (SSE STREAM)
// ===============================
app.get("/api/backup-progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const timer = setInterval(() => {
    res.write(`data: ${backupProgress.value}\n\n`);

    if (backupProgress.value >= 100) {
      clearInterval(timer);
      res.end();
    }
  }, 200);
});

// ===============================
//   RESTORE (START RESTORE)
// ===============================
app.post("/api/restore", upload.single("file"), async (req, res) => {
  try {
    restoreProgress.value = 0; // reset progress

    const result = await restoreBackup(req, res, restoreProgress);
    return result;
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err.message || "Restore failed" });
  }
});

// ===============================
//   RESTORE PROGRESS (SSE STREAM)
// ===============================
app.get("/api/restore-progress", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const timer = setInterval(() => {
    res.write(`data: ${restoreProgress.value}\n\n`);

    if (restoreProgress.value >= 100) {
      clearInterval(timer);
      res.end();
    }
  }, 200);
});

// ===============================
//   SERVER START
// ===============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✔ Server running on port ${PORT}`));

module.exports = app;
