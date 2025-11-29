// ===============================================
// 1) ARCHIVE PREVIEW API  (SUMMARY OF PERIOD)
// ===============================================
app.post("/api/archive-preview", async (req, res) => {
  try {
    const { start_date, end_date } = req.body;

    if (!start_date || !end_date)
      return res.json({ success: false, error: "Missing dates" });

    // -----------------------------
    // Purchases
    // -----------------------------
    const { data: pur } = await supabase
      .from("purchases")
      .select("item_code, item_name, qty, is_deleted")
      .gte("purchase_date", start_date)
      .lte("purchase_date", end_date)
      .eq("is_deleted", false);

    // -----------------------------
    // Sales
    // -----------------------------
    const { data: sal } = await supabase
      .from("sales")
      .select("item_code, item_name, qty, is_deleted")
      .gte("sale_date", start_date)
      .lte("sale_date", end_date)
      .eq("is_deleted", false);

    // -----------------------------
    // Return
    // -----------------------------
    const { data: ret } = await supabase
      .from("sale_returns")
      .select("item_code, item_name, return_qty, created_at")
      .gte("created_at", start_date)
      .lte("created_at", end_date);

    // ==========================
    // Build Summary
    // ==========================
    const map = {};

    // Purchases
    pur?.forEach((p) => {
      if (!map[p.item_code])
        map[p.item_code] = { item_code: p.item_code, item_name: p.item_name, purchase_qty: 0, sale_qty: 0, return_qty: 0 };

      map[p.item_code].purchase_qty += Number(p.qty || 0);
    });

    // Sales
    sal?.forEach((s) => {
      if (!map[s.item_code])
        map[s.item_code] = { item_code: s.item_code, item_name: s.item_name, purchase_qty: 0, sale_qty: 0, return_qty: 0 };

      map[s.item_code].sale_qty += Number(s.qty || 0);
    });

    // Returns
    ret?.forEach((r) => {
      if (!map[r.item_code])
        map[r.item_code] = { item_code: r.item_code, item_name: r.item_name, purchase_qty: 0, sale_qty: 0, return_qty: 0 };

      map[r.item_code].return_qty += Number(r.return_qty || 0);
    });

    res.json({
      success: true,
      rows: Object.values(map),
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});
