// db.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment.");
  // Do not throw here so function can still start locally (but will log)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
