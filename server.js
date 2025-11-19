// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");
const nodeCron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

const doBackup = require("./backup");
const doRestore = require("./restore");

const PORT = process.env.PORT || 5000;
const ENABLE_AUTO = (process.env.ENABLE_AUTO_BACKUP || "false").toLowerCase() === "true";
const CRON = process.env.DAILY_CRON || "0 0 * * *"; // default midnight
const RESTORE_PASSWORD = process.env.RESTORE_PASSWORD || "faizanyounus";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. API may not work.");
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// multer setup (store in tmp)
const upload = multer({ dest: os.tmpdir() });

// health
app.get("/", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// POST /api/backup
app.post("/api/backup", async (req, res) => {
  try {
    const r = await doBackup();
    return res.json({ ok: true, result: r });
  } catch (e) {
    console.error("Backup failed", e);
    return res.status(500).json({ ok: false, message: e.message || "Backup failed", error: String(e) });
  }
});

// POST /api/restore  (multipart form-data: file + password + mode + selected table flags)
app.post("/api/restore", upload.single("file"), async (req, res) => {
  try {
    const password = req.body.password;
    if (password !== RESTORE_PASSWORD) {
      return res.status(403).json({ ok: false, message: "Wrong password" });
    }
    if (!req.file) return res.status(400).json({ ok: false, message: "No file uploaded" });

    const mode = req.body.mode || "full"; // 'full' or 'selected'
    const selected = {};
    // if mode === 'selected', expect body flags like selected_sales = 'on' or 'true'
    if (mode === "selected") {
      const TABLES = ["sales","purchases","items","customers","app_users"];
      for (const t of TABLES) {
        selected[t] = req.body[`selected_${t}`] === "true" || req.body[`selected_${t}`] === "on" || req.body[`selected_${t}`] === "1";
      }
    }

    const filePath = req.file.path;
    const result = await doRestore(filePath, { supabase, mode, selected });

    // cleanup uploaded file
    try { fs.unlinkSync(filePath); } catch (e) {}

    return res.json({ ok: true, result });
  } catch (e) {
    console.error("Restore failed", e);
    return res.status(500).json({ ok: false, message: e.message || "Restore failed", error: String(e) });
  }
});

// schedule daily backup
if (ENABLE_AUTO) {
  try {
    nodeCron.schedule(CRON, async () => {
      console.log("[cron] running backup at", new Date().toISOString());
      try {
        const r = await doBackup();
        console.log("[cron] backup done", r.uploadedName || r.file);
      } catch (e) {
        console.error("[cron] backup error", e.message || e);
      }
    }, { timezone: "Asia/Karachi" });
    console.log("Auto-backup scheduled:", CRON);
  } catch (e) {
    console.warn("Cron schedule failed:", e.message || e);
  }
}

app.listen(PORT, () => {
  console.log("Backup API running on port", PORT);
});
