import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Baustein-Verzeichnis aus docs/BAUSTEINE.md (JSON-Block) – kommt über den Projekt-Abgleich
export function useVerzeichnis(projektId) {
  const [v, setV] = useState(null);
  useEffect(() => {
    supabase.from("ws_dokumente").select("inhalt, aktualisiert").eq("projekt_id", projektId).eq("pfad", "docs/BAUSTEINE.md").maybeSingle().then(({ data }) => {
      const m = /```json\s*([\s\S]+?)```/.exec(data?.inhalt || "");
      try { setV(m ? { ...JSON.parse(m[1]), aktualisiert: data.aktualisiert } : { fehlt: true }); } catch { setV({ fehlt: true }); }
    });
  }, [projektId]);
  return v;
}

