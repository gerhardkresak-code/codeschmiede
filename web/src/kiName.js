import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Welcher KI-Anbieter ist für eine Aufgabe eingestellt? (Gerhard 2026-10-23 21:45: „Es soll immer der KI-Anbieter drinstehen, der eingestellt ist“)
// Erster Eintrag der Zuständigkeit (Seite KI-Anbieter); ohne Einstellung Claude. Übernimmt bei vollem Limit der nächste,
// zeigt die Antwort ihren tatsächlichen Anbieter (Spalte ki, z. B. „chatgpt/gpt-5“).
const EINGEBAUT = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini" };
let eigene = null; let eigeneZeit = 0;
async function eigeneNamen() {
  if (eigene && Date.now() - eigeneZeit < 60000) return eigene;
  const { data } = await supabase.from("ws_ki_anbieter").select("id, name");
  eigene = Object.fromEntries((data || []).map((a) => [a.id, a.name])); eigeneZeit = Date.now();
  return eigene;
}
export function kiAnzeigename(kennung, namen = {}) {
  const id = String(kennung || "").split("/")[0];
  return EINGEBAUT[id] || namen[id] || (id ? id : "Claude");
}
export function useKiName(projektId, aufgabe) {
  const [name, setName] = useState("Claude"); const [namen, setNamen] = useState({});
  useEffect(() => {
    let aus = false;
    (async () => {
      const [{ data }, n] = await Promise.all([
        supabase.from("ws_ki_zustaendigkeit").select("reihe").eq("projekt_id", projektId || "").eq("aufgabe", aufgabe).maybeSingle(),
        eigeneNamen().catch(() => ({})),
      ]);
      if (aus) return;
      setNamen(n);
      setName(kiAnzeigename(Array.isArray(data?.reihe) && data.reihe[0]?.anbieter ? data.reihe[0].anbieter : "claude", n));
    })().catch(() => {});
    return () => { aus = true; };
  }, [projektId, aufgabe]);
  return { name, von: (ki) => (ki ? kiAnzeigename(ki, namen) : name) };
}
