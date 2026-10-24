// Aufruf eines Befehls im Programm (Rust) – Beispiel für die Verbindung Oberfläche ↔ Programm
document.getElementById("gruss").addEventListener("click", async () => {
  const t = await window.__TAURI__.core.invoke("begruessen", { name: "Gerhard" });
  document.getElementById("antwort").textContent = t;
});
