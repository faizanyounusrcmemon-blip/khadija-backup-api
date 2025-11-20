require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Routes
const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
// ✔ VERY IMPORTANT → FormData + password + mode + table parse ہوگا

// Health Check
app.get("/", (req, res) => res.json({ ok: true }));

// -------------------------------
// 📌 RUN BACKUP
// -------------------------------
app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

// -------------------------------
// 📁 LIST BACKUPS
// -------------------------------
app.get("/api/list-backups", async (req, res) => {
  try {
    const result = await listBackups();
    res.json({ success: true, files: result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// -------------------------------
// ♻ RESTORE FROM SUPABASE BUCKET
// -------------------------------
app.post("/api/restore-from-bucket", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body); // Debug

    const result = await restoreFromBucket(req);
    if (!result.success) {
      return res.json({ success: false, error: result.error });
    }

    return res.json({ success: true });

  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
