#!/usr/bin/env python3
"""Funktionsverzeichnis -> Programmierumgebung (Tabelle ws_features).

Liest docs/product/FEATURE-REGISTRY.md und schreibt SQL, das jede Funktion (F-Nummer) in die
richtige Gruppe der Programmierumgebung einträgt bzw. ihren Stand aktualisiert.
- Neue Funktionen bekommen 7 Tage das Abzeichen „Neu“ (neu_bis).
- Von Hand ausgeblendete/ausgebaute Features und von Hand geänderte Gruppen bleiben unangetastet
  (nur Name, Beschreibung und Stand werden nachgeführt).
- Funktionen, die im Verzeichnis fehlen, bekommen „fehlt_im_verzeichnis“ (nie gelöscht); tauchen sie wieder auf, wird es zurückgesetzt.
  „ausgebaut“ setzt nur ein Ausbau-Auftrag.

Aufruf:  python3 tools/werkstatt/features_import.py > supabase/dev-data/20261022_programmierumgebung_features.sql
Keine Personendaten; läuft auch im GitHub-Ablauf nach jeder Änderung an main.
"""
import re
import sys
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[2] / "docs" / "product" / "FEATURE-REGISTRY.md"

# Abschnitt-Nummer im Funktionsverzeichnis -> Gruppe der Programmierumgebung
SECTION_GROUP = {
    1: "einst", 2: "kalender", 3: "kader", 4: "training", 5: "spiele", 6: "taktik", 7: "komm",
    8: "ausruestung", 9: "finanzen", 10: "kantine", 11: "vorstand", 12: "handbuch", 13: "erp",
    14: "website", 15: "einst", 16: "altlast",
}
# Feinzuordnung über Stichwörter im Funktionsnamen (erste passende Regel gewinnt)
KEYWORDS = [
    (11, r"sportlich|scouting|kaderplanung|vertr[äa]g|zu- und abg|leihe", "sportlich"),
    (11, r"nachwuchs|leistungstest|jahrgangswechsel|trainerbewertung|trainergespr", "nachwuchs"),
    (11, r"versammlung|wahl|protokoll|schriftf|beschluss", "schrift"),
    (11, r"beir[äa]t", "beirat"),
    (11, r"sponsor", "sponsoring"),
    (11, r"rolle|rechte|funktion|benutzer|mitglied", "mitglieder"),
    (12, r"design", "design"),
    (7, r"kalender|termin", "kalender"),
    (1, r"mehrere vereine", "kader"),
]


def stand_von(text: str, section: int) -> str:
    t = text.lower()
    if section == 16:
        return "altlast"
    if "offen" in t:
        return "arbeit"
    if t.startswith("live"):
        return "live"
    return "geplant"


def q(s):
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def parse():
    section = 0
    rows = []
    for line in REGISTRY.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (\d+)\.", line)
        if m:
            section = int(m.group(1))
            continue
        if not line.startswith("| F-"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        fid, name = cells[0], cells[1]
        status = cells[3] if len(cells) > 3 else ""
        gruppe = SECTION_GROUP.get(section, "einst")
        for sec, pattern, grp in KEYWORDS:
            if sec == section and re.search(pattern, name, re.I):
                gruppe = grp
                break
        # Name kurz halten: Klammerzusatz wird zur Beschreibung
        kurz, beschreibung = name, None
        mm = re.match(r"^(.*?)\s*\((.*)\)\s*$", name)
        if mm and len(mm.group(1)) >= 4:
            kurz, beschreibung = mm.group(1), mm.group(2)
        kurz = kurz.replace("**", "").strip()
        rows.append((fid, gruppe, kurz[:120], (beschreibung or "")[:300] or None, stand_von(status.replace("**", ""), section)))
    return rows


def main():
    rows = parse()
    if len(rows) < 50:
        sys.exit(f"Funktionsverzeichnis sieht unvollständig aus ({len(rows)} Zeilen) – Abbruch")
    out = ["-- Erzeugt von tools/werkstatt/features_import.py aus docs/product/FEATURE-REGISTRY.md – nicht von Hand ändern",
           "begin;",
           "create temp table _reg (id text primary key, gruppe_id text, name text, beschreibung text, stand text) on commit drop;"]
    for r in rows:
        out.append("insert into _reg values (" + ", ".join(q(x) for x in r) + ") on conflict (id) do nothing;")
    out += [
        "insert into public.ws_features (id, gruppe_id, name, beschreibung, stand, quelle, neu_bis)",
        "select id, gruppe_id, name, beschreibung, stand, 'registry',",
        "       case when exists (select 1 from public.ws_features where quelle = 'registry') then now() + interval '7 days' end",
        "from _reg",
        "on conflict (id) do update set name = excluded.name, beschreibung = excluded.beschreibung,",
        "  stand = case when public.ws_features.ausgebaut then public.ws_features.stand else excluded.stand end,",
        "  fehlt_im_verzeichnis = false, geaendert = now()",
        "where public.ws_features.quelle = 'registry';",
        "update public.ws_features f set fehlt_im_verzeichnis = true, geaendert = now()",
        "where f.quelle = 'registry' and not f.fehlt_im_verzeichnis and not exists (select 1 from _reg r where r.id = f.id);",
        "commit;",
        "select stand, count(*) from public.ws_features group by stand order by stand;",
    ]
    print("\n".join(out))


if __name__ == "__main__":
    main()
