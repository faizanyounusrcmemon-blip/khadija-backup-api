// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const doBackup = require("./backup");
const nodeCron = require("node-cron");

const PORT = process.env.PORT || 5000;

// Auto-backup ON/OFF (default OFF)
const ENABLE_AUTO = (process.env.ENABLE_AUTO_BACKUP || "false").toLowerCase() === "true";

// Default = daily at midnight
const CRON = process.env.DAILY_CRON || "0 0 * * *";

const app = express();
app.use(express.json());
app.use(cors());

// Health check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backup API running",
    time: new Date().toISOString(),
  });
});

// Manual Backup Route
app.post("/api/backup", async (req, res) => {
  try {
    const result = await doBackup();

    return res.json({
      ok: true,
      message: "Backup completed successfully",
      backup: result,
    });
  } catch (err) {
    console.error("❌ Backup failed:", err.message || err);

    return res.status(500).json({
      ok: false,
      message: "Backup failed",
      error: err.message || String(err),
    });
  }
});

// Auto-backup (daily)
if (ENABLE_AUTO) {
  try {
    nodeCron.schedule(
      CRON,
      async () => {
        console.log("[CRON] Scheduled backup started:", new Date().toISOString());

        try {
          const result = await doBackup();
          console.log("[CRON] Backup completed:", result.file?.name);
        } catch (err) {
          console.error("[CRON] Backup failed:", err.message || err);
        }
      },
      { timezone: "Asia/Karachi" }
    );

    console.log("⏳ Auto-backup enabled | CRON:", CRON);
  } catch (e) {
    console.warn("⚠️ Cron scheduling error:", e.message || e);
  }
}

// Start API server
app.listen(PORT, () => {
  console.log("🚀 Backup API running on port", PORT);
});
