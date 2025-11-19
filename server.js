// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const doBackup = require("./backup");
const restoreBackup = require("./restore");
const cron = require("node-cron");

const upload = multer({ dest: "uploads/" });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ ok: true }));

app.post("/api/backup", async (req, res) => {
  const result = await doBackup();
  res.json(result);
});

app.post("/api/restore", upload.single("file"), restoreBackup);

// Auto backup daily 12 AM
cron.schedule("0 0 * * *", async () => {
  console.log("⏳ Auto Backup Running…");
  await doBackup();
});

app.listen(5000, () => console.log("Server running…"));
