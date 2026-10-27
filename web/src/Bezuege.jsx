import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAutoHoehe } from "./autoHoehe";
import { Link2, X, Plus, RefreshCw, Check, Loader2, Hash } from "lucide-react";
import { supabase } from "./supabase";

// Feature-Bezüge (KONZEPT-FEATURE-BEZUEGE.md, Entscheidungen Gerhard 2026-10-22 22:31): @Liga setzt einen festen Bezug „Vorlage“,
// nur im selben Projekt. Ändert sich die Vorlage (live), kommt am abhängigen Feature „nachziehen?“.

const fehler = (e) => (e?.message || "Unbekannter Fehler").replace(/^.*?ERROR:\s*/, "");
const ghost = "inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50";

/** Features, die im Text mit @Name erwähnt sind (längste Namen zuerst, Groß/Klein egal). */
export function erwaehnte(text, features) {
  const t = ` ${String(text || "").toLowerCase()}`;
  return [...features].sort((a, b) => b.name.length - a.name.length).filter((f) => t.includes(`@${f.name.toLowerCase()}`));
}

/** Gruppen, die im Text mit #Name erwähnt sind (Chat 2.0, Entwurf 1.1). */
export function erwaehnteGruppen(text, gruppen) {
  const t = ` ${String(text || "").toLowerCase()}`;
  return [...gruppen].sort((a, b) => b.name.length - a.name.length).filter((g) => t.includes(`#${g.name.toLowerCase()}`));
}

/** Eingabefeld mit @-Auswahl der Features und (wenn übergeben) #-Auswahl der Gruppen des Projekts. */
export const MitErwaehnung = React.forwardRef(function MitErwaehnung({ value, onChange, features, gruppen = null, minHoehe, className, ...rest }, aussen) {
  const ref = useRef(null); const [treffer, setTreffer] = useState(null); const [aktiv, setAktiv] = useState(0);
  React.useImperativeHandle(aussen, () => ({
    // Knopf „@ Feature“ / „# Gruppe“: Zeichen an der Schreibmarke einfügen und die Auswahl öffnen
    zeichen: (z) => {
      const el = ref.current; if (!el) return;
      const p = el.selectionStart ?? value.length; const v = `${value.slice(0, p)}${z}${value.slice(el.selectionEnd ?? p)}`;
      onChange(v); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(p + 1, p + 1); pruefe(v, p + 1); });
    },
    fokus: () => ref.current?.focus(),
  }));
  const pruefe = (v, pos) => {
    const m = v.slice(0, pos).match(gruppen ? /([@#])([^\s@#]{0,40})$/ : /(@)([^\s@]{0,40})$/);
    if (!m) { setTreffer(null); return; }
    const q = m[2].toLowerCase(); const art = m[1] === "#" ? "gruppe" : "feature";
    const quelle = art === "gruppe" ? gruppen : features;
    const l = quelle.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
    setTreffer(l.length ? { start: pos - m[0].length, pos, liste: l, art } : null); setAktiv(0);
  };
  const waehle = (f) => {
    const z = treffer.art === "gruppe" ? "#" : "@";
    const v = `${value.slice(0, treffer.start)}${z}${f.name} ${value.slice(treffer.pos)}`;
    onChange(v); setTreffer(null);
    requestAnimationFrame(() => { const el = ref.current; if (el) { const p = treffer.start + f.name.length + 2; el.focus(); el.setSelectionRange(p, p); } });
  };
  useAutoHoehe(ref, value, minHoehe ? { min: minHoehe } : undefined);
  return (
    <div className="relative">
      <textarea ref={ref} value={value} className={`${className || ""} resize-none`} {...rest}
        onChange={(e) => { onChange(e.target.value); pruefe(e.target.value, e.target.selectionStart); }}
        onBlur={(e) => { setTimeout(() => setTreffer(null), 120); rest.onBlur?.(e); }}
        onKeyDown={(e) => {
          if (treffer) {
            if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((aktiv + 1) % treffer.liste.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((aktiv - 1 + treffer.liste.length) % treffer.liste.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); waehle(treffer.liste[aktiv]); return; }
            if (e.key === "Escape") { setTreffer(null); return; }
          }
          rest.onKeyDown?.(e);
        }} />
      {treffer && (
        <ul role="listbox" aria-label={treffer.art === "gruppe" ? "Gruppe wählen" : "Feature wählen"} className="absolute z-20 left-0 bottom-full mb-1 w-80 max-w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-1 text-sm">
          <li className="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500" aria-hidden="true">{treffer.art === "gruppe" ? "Gruppen" : "Features"}</li>
          {treffer.liste.map((f, i) => (
            <li key={f.id} role="option" aria-selected={i === aktiv}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); waehle(f); }} className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${i === aktiv ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}>
                {treffer.art === "gruppe" ? <Hash className="w-3.5 h-3.5 text-amber-600" /> : <Link2 className="w-3.5 h-3.5 text-emerald-700" />}<span className="truncate">{f.name}</span>
                <span className="ml-auto text-[11px] text-slate-400 font-mono truncate max-w-[45%]">{treffer.art === "gruppe" ? (f.bereich || "") : f.id}</span></button></li>))}
        </ul>)}
    </div>);
});

/** Bezüge und Hinweise eines Features (Kurzinfo / Arbeitsplatz). */
export function FeatureBezuege({ f, d, darfAuftrag, toast, ich }) {
  const [bez, setBez] = useState([]); const [hin, setHin] = useState([]); const [tick, setTick] = useState(0); const [neu, setNeu] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let aus = false;
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from("ws_feature_bezuege").select("*").or(`von_feature.eq.${f.id},zu_feature.eq.${f.id}`),
        supabase.from("ws_feature_hinweise").select("*").eq("feature_id", f.id).eq("stand", "offen").order("id", { ascending: false }),
      ]);
      if (!aus) { setBez(a.data || []); setHin(b.data || []); }
    })();
    const k = supabase.channel(`bez-${f.id}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_feature_bezuege" }, () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "ws_feature_hinweise" }, () => setTick((t) => t + 1)).subscribe();
    return () => { aus = true; supabase.removeChannel(k); };
  }, [f.id, tick]);
  const name = (id) => d.features.find((x) => x.id === id)?.name || id;
  const vorlagen = bez.filter((b) => b.von_feature === f.id); const nutzer = bez.filter((b) => b.zu_feature === f.id);
  const andere = d.features.filter((x) => x.id !== f.id && !x.ausgebaut && !vorlagen.some((b) => b.zu_feature === x.id));
  const setzen = async () => {
    if (!neu) return; setBusy(true);
    const { error } = await supabase.rpc("ws_bezug_setzen", { p_von: f.id, p_zu: neu }); setBusy(false);
    if (error) toast(fehler(error)); else { toast(`Vorlage gesetzt: ${name(neu)}`); setNeu(""); setTick((t) => t + 1); }
  };
  const loeschen = async (b) => { const { error } = await supabase.rpc("ws_bezug_loeschen", { p_id: b.id }); if (error) toast(fehler(error)); else setTick((t) => t + 1); };
  const erledigen = async (h, stand) => {
    if (stand === "nachgezogen") {
      // Auftrag fürs Nachziehen anlegen (mit eigenen Rechten), dann Hinweis schließen
      const t = `Nachziehen: ${h.text}`;
      const { data, error } = await supabase.from("ws_auftraege").insert({ gruppe_id: f.gruppe_id, feature_id: f.id, titel: t.slice(0, 80), art: "aendern", erstellt_von: ich.id }).select().single();
      if (error) { toast(fehler(error)); return; }
      await supabase.from("ws_nachrichten").insert({ auftrag_id: data.id, von: ich.id, art: "text", text: `${h.text}\nÜbernimm die Änderung der Vorlage „${name(h.vorlage_feature)}“${h.auftrag_id ? ` (Auftrag #${h.auftrag_id})` : ""} sinngemäß für dieses Feature.`, kanal: "codeschmiede" });
      toast(`Auftrag #${data.id} zum Nachziehen angelegt`);
    }
    const { error } = await supabase.rpc("ws_hinweis_erledigen", { p_id: h.id, p_stand: stand }); if (error) toast(fehler(error)); else setTick((x) => x + 1);
  };
  return (
    <div className="flex flex-col gap-2">
      {hin.map((h) => (
        <div key={h.id} className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs flex flex-col gap-1.5">
          <span className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />{h.text}</span>
          {darfAuftrag && <div className="flex gap-1.5"><button type="button" className={ghost} onClick={() => erledigen(h, "nachgezogen")}><Check className="w-3.5 h-3.5" />Nachziehen (Auftrag)</button><button type="button" className={ghost} onClick={() => erledigen(h, "nicht_noetig")}>Nicht nötig</button></div>}
        </div>))}
      {(vorlagen.length > 0 || nutzer.length > 0) && <div className="flex flex-wrap gap-1.5 text-xs">
        {vorlagen.map((b) => <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 font-semibold"><Link2 className="w-3 h-3" />Referenz: {name(b.zu_feature)}
          {darfAuftrag && <button type="button" onClick={() => loeschen(b)} title="Bezug entfernen" className="ml-0.5"><X className="w-3 h-3" /></button>}</span>)}
        {nutzer.map((b) => <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5">Vorlage für: {name(b.von_feature)}</span>)}
      </div>}
      {darfAuftrag && <div className="flex gap-1.5">
        <select className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs" value={neu} onChange={(e) => setNeu(e.target.value)} aria-label="Vorlage wählen">
          <option value="">+ Vorlage (Referenz-Feature) …</option>{andere.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <button type="button" className={ghost} disabled={!neu || busy} onClick={setzen}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}Setzen</button>
      </div>}
    </div>);
}
