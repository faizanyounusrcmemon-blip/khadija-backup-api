// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const doBackup = require('./backup');
const nodeCron = require('node-cron');

const PORT = process.env.PORT || 5000;
const ENABLE_AUTO = (process.env.ENABLE_AUTO_BACKUP || 'false').toLowerCase() === 'true';
const CRON = process.env.DAILY_CRON || '0 0 * * *'; // default midnight

const app = express();
app.use(express.json());
app.use(cors());

// simple health
app.get('/', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// POST /api/backup  -> trigger a backup now
app.post('/api/backup', async (req, res) => {
  try {
    const result = await doBackup();
    return res.json({ ok: true, message: 'Backup completed', result });
  } catch (e) {
    console.error('Backup failed', e);
    return res.status(500).json({ ok: false, message: e.message || 'Backup failed', error: String(e) });
  }
});

// schedule daily
if (ENABLE_AUTO) {
  try {
    nodeCron.schedule(CRON, async () => {
      console.log('[cron] running backup at', new Date().toISOString());
      try {
        const r = await doBackup();
        console.log('[cron] backup done', r.driveFileName);
      } catch (e) {
        console.error('[cron] backup error', e);
      }
    }, { timezone: 'Asia/Karachi' });
    console.log('Auto-backup scheduled:', CRON);
  } catch (e) {
    console.warn('Cron schedule failed:', e.message || e);
  }
}

app.listen(PORT, () => {
  console.log('Backup API running on port', PORT);
});
