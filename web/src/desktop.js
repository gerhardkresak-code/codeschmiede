// Brücke zum Programm „Codeschmiede“ (Tauri). Im Browser gibt es die Werkstatt nicht.
const bridge = () => (typeof window !== "undefined" ? window.__TAURI_INTERNALS__ : null);
export const isDesktop = () => typeof bridge()?.invoke === "function";
export const tauri = (cmd, args = {}) => {
  if (!isDesktop()) return Promise.reject(new Error("Nur im Programm Codeschmiede verfügbar."));
  return bridge().invoke(cmd, args);
};
