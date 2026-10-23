import React, { useMemo } from "react";

// Markdown-Darstellung der Codeschmiede: eigene, sichere Darstellung (kein HTML aus dem Text, Links nur http/https)
function inline(text, k = "i") {
  const teile = []; let rest = text; let n = 0;
  const muster = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(~~([^~]+)~~)|(\*([^*\s][^*]*)\*)/;
  while (rest) {
    const m = rest.match(muster);
    if (!m) { teile.push(rest); break; }
    if (m.index) teile.push(rest.slice(0, m.index));
    const key = `${k}-${n++}`;
    if (m[1]) teile.push(<b key={key}>{inline(m[2], key)}</b>);
    else if (m[3]) teile.push(<code key={key} className="font-mono text-[0.85em] bg-slate-100 dark:bg-slate-800 rounded px-1">{m[4]}</code>);
    else if (m[5]) teile.push(/^https?:\/\//i.test(m[7]) ? <a key={key} href={m[7]} target="_blank" rel="noopener noreferrer" className="text-emerald-700 dark:text-emerald-400 underline">{m[6]}</a> : <span key={key} className="underline decoration-dotted">{m[6]}</span>);
    else if (m[8]) teile.push(<s key={key}>{m[9]}</s>);
    else if (m[10]) teile.push(<i key={key}>{m[11]}</i>);
    rest = rest.slice(m.index + m[0].length);
  }
  return teile;
}
export function Markdown({ text, suche, klein = false }) {
  const bloecke = useMemo(() => {
    const z = (text || "").replace(/\r/g, "").split("\n"); const out = []; let i = 0;
    while (i < z.length) {
      const l = z[i];
      if (/^```/.test(l)) { const code = []; i++; while (i < z.length && !/^```/.test(z[i])) code.push(z[i++]); i++; out.push({ t: "code", v: code.join("\n") }); continue; }
      const h = l.match(/^(#{1,4})\s+(.*)/); if (h) { out.push({ t: "h", n: h[1].length, v: h[2] }); i++; continue; }
      if (/^\s*\|/.test(l)) { const rows = []; while (i < z.length && /^\s*\|/.test(z[i])) rows.push(z[i++]); out.push({ t: "table", v: rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim())) }); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) { const it = []; const nr = /^\s*\d+\./.test(l); while (i < z.length && /^\s*([-*]|\d+\.)\s+/.test(z[i])) { it.push({ tief: (z[i].match(/^\s*/)[0].length >= 2), v: z[i].replace(/^\s*([-*]|\d+\.)\s+/, "") }); i++; } out.push({ t: nr ? "ol" : "ul", v: it }); continue; }
      if (/^>\s?/.test(l)) { const q = []; while (i < z.length && /^>\s?/.test(z[i])) q.push(z[i++].replace(/^>\s?/, "")); out.push({ t: "q", v: q.join(" ") }); continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push({ t: "hr" }); i++; continue; }
      if (!l.trim()) { i++; continue; }
      const p = []; while (i < z.length && z[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*([-*]|\d+\.)\s+|>)/.test(z[i])) p.push(z[i++]);
      out.push({ t: "p", v: p.join(klein ? "\n" : " ") });   // in Chats bleiben Zeilenumbrüche (Befunde der Werkstatt)
    }
    return out;
  }, [text, klein]);
  const treffer = (s) => !suche || String(s).toLowerCase().includes(suche.toLowerCase());
  return (
    <div className={`${klein ? "text-[inherit] gap-1.5" : "text-sm text-slate-800 dark:text-slate-200 gap-2.5"} leading-relaxed flex flex-col min-w-0 break-words`}>
      {bloecke.map((b, k) => {
        if (b.t === "h") { const C = `h${Math.min(4, b.n + 1)}`; return <C key={k} className={`font-display font-bold ${klein ? "text-[1.05em]" : b.n === 1 ? "text-xl" : b.n === 2 ? "text-lg mt-2" : "text-base mt-1"}`}>{inline(b.v, `h${k}`)}</C>; }
        if (b.t === "code") return <pre key={k} className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre">{b.v}</pre>;
        if (b.t === "table") {
          const [kopf, ...rows] = b.v; const zeigen = rows.filter((r) => treffer(r.join(" ")));
          return (
            <div key={k} className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-950"><tr>{kopf.map((c, j) => <th key={j} className="text-left font-semibold px-2.5 py-2 align-top">{inline(c, `t${k}${j}`)}</th>)}</tr></thead>
                <tbody>{zeigen.map((r, j) => <tr key={j} className="border-t border-slate-100 dark:border-slate-800">{r.map((c, x) => <td key={x} className="px-2.5 py-2 align-top">{inline(c, `t${k}-${j}-${x}`)}</td>)}</tr>)}</tbody></table>
              {suche && zeigen.length < rows.length && <p className="text-[11px] text-slate-500 px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-800">{zeigen.length} von {rows.length} Zeilen passen zur Suche</p>}
            </div>);
        }
        if (b.t === "ul" || b.t === "ol") { const L = b.t; return <L key={k} className={`${L === "ol" ? "list-decimal" : "list-disc"} pl-5 flex flex-col gap-1`}>{b.v.map((x, j) => <li key={j} className={x.tief ? "ml-4" : ""}>{inline(x.v, `l${k}${j}`)}</li>)}</L>; }
        if (b.t === "q") return <blockquote key={k} className="border-l-4 border-emerald-600 pl-3 text-slate-600 dark:text-slate-300">{inline(b.v, `q${k}`)}</blockquote>;
        if (b.t === "hr") return <hr key={k} className="border-slate-200 dark:border-slate-800" />;
        return <p key={k} className={klein ? "whitespace-pre-line" : undefined}>{inline(b.v, `p${k}`)}</p>;
      })}
    </div>);
}

