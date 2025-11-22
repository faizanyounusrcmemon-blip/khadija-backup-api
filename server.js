require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const doBackup = require("./backup");
const listBackups = require("./listBackups");
const restoreFromBucket = require("./restoreFromBucket");

// ⭐ NEW import (Very important)
const getInvoiceItems = require("./get-invoice-items");

const app = express();

// ⭐ CORS allow
app.use(cors());

// ❌ DO NOT USE JSON BODY HERE (Backup/Restore use FormData)
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// ⭐ File upload for restore
const upload = multer({ storage: multer.memoryStorage() });

// ===========================
// TEST ROUTE
// ===========================
app.get("/", (req, res) => res.json({ ok: true }));

// ===========================
// BACKUP
// ===========================
app.post("/api/backup", async (req, res) => {
  try {
    const result = await doBackup();
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===========================
// LIST BACKUPS
// ===========================
app.get("/api/list-backups", async (req, res) => {
  try {
    const files = await listBackups();
    res.json({ success: true, files });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===========================
// RESTORE
// ===========================
app.post("/api/restore-from-bucket", upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const response = await restoreFromBucket({ body });
    res.json(response);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// =====================================================
// ⭐⭐ NEW ROUTE — FULL INVOICE BARCODE PRINT API ⭐⭐
// =====================================================
app.get("/api/get-invoice-items", async (req, res) => {
  try {
    await getInvoiceItems(req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ===========================
// START SERVER (when local)
// ===========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
