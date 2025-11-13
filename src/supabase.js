import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Debug (boleh dihapus nanti)
console.log("🔌 Supabase URL:", SUPABASE_URL);
console.log("🔑 Supabase Key loaded:", !!SUPABASE_ANON_KEY);
