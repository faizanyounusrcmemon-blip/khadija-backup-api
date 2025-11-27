// ================================================
//   UPDATED listBackups.js (Size + Karachi Time)
// ================================================

const supabase = require("./db");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

module.exports = async function listBackups() {
  const { data, error } = await supabase.storage
    .from("backups")
    .list("", { sortBy: { column: "name", order: "desc" } });

  if (error || !data) return [];

  return data.map((file) => ({
    name: file.name,
    date: dayjs.utc(file.created_at).tz("Asia/Karachi").format("MM/DD/YYYY, hh:mm:ss A"),
    size: formatSize(file.metadata?.size || 0),
  }));
};

// Convert Bytes → KB/MB
function formatSize(bytes) {
  if (bytes >= 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  if (bytes >= 1024)
    return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
}
