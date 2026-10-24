import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { fehlerMelderStarten } from "./lib/fehlerMelden.js";

fehlerMelderStarten();   // Fehler-Meldungen an die Codeschmiede (nur Technik, nur im fertigen Build)

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);

// Offline-Fähigkeit (Handy-App): Service Worker nur im fertigen Build
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
