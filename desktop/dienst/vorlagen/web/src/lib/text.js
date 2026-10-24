/** Begrüßung je Tageszeit – kleines Beispiel, an dem die Prüfungen zeigen, dass alles läuft. */
export function begruessung(stunde) {
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Hallo";
  return "Guten Abend";
}
