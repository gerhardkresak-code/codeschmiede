// [PROJEKTNAME] – Programm für Windows und Mac (Tauri 2). Grundgerüst aus der Codeschmiede.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Beispiel-Befehl, den die Oberfläche aufruft.
#[tauri::command]
fn begruessen(name: &str) -> String {
    format!("Hallo {name}!")
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![begruessen])
        .run(tauri::generate_context!())
        .expect("Programm konnte nicht starten");
}

#[cfg(test)]
mod tests {
    #[test]
    fn begruesst() {
        assert_eq!(super::begruessen("Test"), "Hallo Test!");
    }
}
