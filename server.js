const express = require("express");
const cors = require("cors");
const multer = require("multer");
const backup = require("./backup");
const restore = require("./restore");

const app = express();
app.use(cors());
app.use(express.json());

// ⭐ Vercel Allowed Storage → MEMORY
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => {
  res.send("Backup API is running...");
});

// ----------------------
// 🔥 TAKE BACKUP
// ----------------------
app.post("/api/backup", async (req, res) => {
  try {
    const result = await backup();
    return res.json({ success: true, file: result });
  } catch (e) {
    return res.json({ success: false, error: e.message });
  }
});

// ----------------------
// 🔥 RESTORE BACKUP (with Password)
// ----------------------
app.post("/api/restore", upload.single("file"), async (req, res) => {
  try {
    const { password } = req.body;

    if (password !== process.env.RESTORE_PASSWORD) {
      return res.json({ success: false, error: "Wrong password!" });
    }

    if (!req.file) {
      return res.json({ success: false, error: "No file received" });
    }

    const buffer = req.file.buffer;

    const result = await restore(buffer);

    res.json({ success: true, restored: result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Export for Vercel
module.exports = app;
