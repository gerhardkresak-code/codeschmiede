fn main() {
    // Eigene Befehle des Programms – nur diese darf die Web-App aufrufen (siehe capabilities/remote.json)
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["device_info", "device_sign", "device_reset"]),
        ),
    )
    .expect("tauri-build fehlgeschlagen");
}
