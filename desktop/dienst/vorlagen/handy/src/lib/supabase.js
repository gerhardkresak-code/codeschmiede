// Datenbank (Supabase): Adresse und öffentlicher Schlüssel kommen aus den Umgebungsvariablen
// VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY (Cloudflare Pages › Einstellungen). Ohne sie läuft die App ohne Datenbank.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
