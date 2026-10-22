fn main() {
    // Eigene Befehle des Programms – nur diese darf die Oberfläche aufrufen (siehe capabilities/web.json)
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "ws_check", "ws_start", "ws_token", "ws_stop", "ws_status", "ws_statuszeile",
    ])))
    .expect("tauri-build fehlgeschlagen");
}
