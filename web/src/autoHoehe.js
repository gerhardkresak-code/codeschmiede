import { useLayoutEffect } from "react";

// Eingabefelder der KI-Chats wachsen beim Tippen mit (Gerhard 2026-10-23 22:08: „automatisch nach unten gezogen, man sieht beim Tippen immer den ganzen Text“).
// Mindestens doppelt so hoch wie bisher, höchstens ca. die halbe Fensterhöhe – darüber scrollt das Feld.
export function useAutoHoehe(ref, wert, { min = 112, maxAnteil = 0.5 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    const max = Math.max(min, Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * maxAnteil));
    const h = Math.min(max, Math.max(min, el.scrollHeight + 2));
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight + 2 > max ? "auto" : "hidden";
  }, [ref, wert, min, maxAnteil]);
}
