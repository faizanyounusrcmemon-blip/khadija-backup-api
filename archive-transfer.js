// ===============================================
// 3) ARCHIVE TRANSFER  (SUMMARY → opening_stock)
// ===============================================
app.post("/api/archive-transfer", async (req, res) => {
  try {
    const { rows, start_date, end_date } = req.body;

    if (!rows || !start_date || !end_date)
      return res.json({ success: false, error: "Invalid data" });

    const batch = rows.map(r => ({
      item_code: r.item_code,
      item_name: r.item_name,
      purchase_qty: r.purchase_qty,
      sale_qty: r.sale_qty,
      return_qty: r.return_qty,
      start_date,
      end_date
    }));

    const { error } = await supabase.from("opening_stock").insert(batch);

    if (error)
      return res.json({ success: false, error: error.message });

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});
