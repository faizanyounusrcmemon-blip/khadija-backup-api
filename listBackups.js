const supabase = require("./db");

module.exports = async function listBackups() {
  try {
    const { data, error } = await supabase.storage
      .from("backups")
      .list("", { sortBy: { column: "name", order: "desc" } });

    if (error) return [];

    return data.map((file) => ({
      name: file.name,
      date: new Date(file.created_at).toLocaleString(),
      size: file.metadata?.size || 0
    }));
  } catch (err) {
    return [];
  }
};
