// Codeschmiede – Programm für Windows und Mac.
//
// Schlanke Hülle (Tauri) um die Oberfläche der Codeschmiede, die live geladen wird. Dazu zwei Aufgaben:
// 1. Claude-API-Schlüssel sicher im Tresor dieses Benutzers verwahren (Windows-Anmeldeinformationsverwaltung / Mac-Schlüsselbund).
//    Die Oberfläche kann ihn setzen, prüfen und löschen, aber nie lesen.
// 2. Den Werkstatt-Dienst (Node, Ordner „dienst“) starten und stoppen. Er bekommt den Schlüssel nur als Umgebungsvariable.
// Konzept: docs/KONZEPT.md
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::Manager;

mod tresor {
    pub const SERVICE: &str = "Codeschmiede";
    pub const ACCOUNT: &str = "claude_api_schluessel";

    #[cfg(any(windows, target_os = "macos"))]
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
    }
    #[cfg(any(windows, target_os = "macos"))]
    pub fn lesen() -> Result<Option<String>, String> {
        match entry()?.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(any(windows, target_os = "macos"))]
    pub fn schreiben(s: &str) -> Result<(), String> {
        entry()?.set_password(s).map_err(|e| e.to_string())
    }
    #[cfg(any(windows, target_os = "macos"))]
    pub fn loeschen() -> Result<(), String> {
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }

    // Andere Systeme (nur Entwicklung/Prüfung): Datei im Benutzerordner, nur für den Besitzer lesbar
    #[cfg(not(any(windows, target_os = "macos")))]
    fn pfad() -> std::path::PathBuf {
        std::path::Path::new(&std::env::var("HOME").unwrap_or_else(|_| ".".into())).join(".codeschmiede-schluessel")
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    pub fn lesen() -> Result<Option<String>, String> {
        match std::fs::read_to_string(pfad()) {
            Ok(s) => Ok(Some(s.trim().to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    pub fn schreiben(s: &str) -> Result<(), String> {
        std::fs::write(pfad(), s).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(pfad(), std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    pub fn loeschen() -> Result<(), String> {
        match std::fs::remove_file(pfad()) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// Prüft das Format eines Anthropic-API-Schlüssels (ohne ihn irgendwo auszugeben).
fn schluessel_gueltig(k: &str) -> bool {
    k.starts_with("sk-ant-") && k.len() >= 30 && k.len() <= 300 && k.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[derive(Default)]
struct Werkstatt {
    kind: Option<Child>,
    eingabe: Option<ChildStdin>,
    letzte: String,
    auftrag: Option<i64>,
}
struct Zustand(Arc<Mutex<Werkstatt>>);

#[derive(Serialize)]
struct Status {
    laeuft: bool,
    text: String,
    auftrag: Option<i64>,
}

#[derive(Serialize)]
struct Pruefung {
    node: bool,
    git: bool,
    gh: bool,
    gh_angemeldet: bool,
}

#[derive(Deserialize)]
struct StartKonfig {
    supabase_url: String,
    anon_key: String,
    access_token: String,
    user_id: String,
    admin: bool,
}

/// PATH für Kindprozesse: am Mac kennen Programme aus dem Finder Homebrew-Pfade nicht.
fn pfad_umgebung() -> String {
    let basis = std::env::var("PATH").unwrap_or_default();
    if cfg!(target_os = "macos") {
        format!("/opt/homebrew/bin:/usr/local/bin:{basis}")
    } else {
        basis
    }
}

fn befehl(programm: &str) -> Command {
    let mut c = Command::new(programm);
    c.env("PATH", pfad_umgebung());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // kein Konsolenfenster
    }
    c
}

fn laeuft_erfolgreich(programm: &str, args: &[&str]) -> bool {
    befehl(programm).args(args).stdout(Stdio::null()).stderr(Stdio::null()).status().map(|s| s.success()).unwrap_or(false)
}

#[tauri::command]
fn ws_api_key_status() -> Result<bool, String> {
    Ok(tresor::lesen()?.is_some())
}

#[tauri::command]
fn ws_api_key_set(key: String) -> Result<(), String> {
    let k = key.trim();
    if !schluessel_gueltig(k) {
        return Err("Das ist kein gültiger Claude-API-Schlüssel (beginnt mit sk-ant-).".into());
    }
    tresor::schreiben(k)
}

#[tauri::command]
fn ws_api_key_delete() -> Result<(), String> {
    tresor::loeschen()
}

#[tauri::command]
fn ws_check() -> Pruefung {
    Pruefung {
        node: laeuft_erfolgreich("node", &["--version"]),
        git: laeuft_erfolgreich("git", &["--version"]),
        gh: laeuft_erfolgreich("gh", &["--version"]),
        gh_angemeldet: laeuft_erfolgreich("gh", &["auth", "status"]),
    }
}

#[tauri::command]
fn ws_status(state: tauri::State<'_, Zustand>) -> Status {
    let mut w = state.0.lock().unwrap();
    let lebt = match w.kind.as_mut() {
        Some(k) => matches!(k.try_wait(), Ok(None)),
        None => false,
    };
    if !lebt {
        w.kind = None;
        w.eingabe = None;
        w.auftrag = None;
    }
    Status { laeuft: lebt, text: w.letzte.clone(), auftrag: w.auftrag }
}

#[tauri::command]
fn ws_start(config: StartKonfig, app: tauri::AppHandle, state: tauri::State<'_, Zustand>) -> Result<(), String> {
    {
        let mut w = state.0.lock().unwrap();
        if let Some(k) = w.kind.as_mut() {
            if matches!(k.try_wait(), Ok(None)) {
                return Ok(());
            }
        }
    }
    let schluessel = tresor::lesen()?.ok_or("Kein API-Schlüssel hinterlegt.")?;
    if !config.supabase_url.starts_with("https://") || config.access_token.is_empty() || config.user_id.is_empty() {
        return Err("Ungültige Anmeldedaten für die Werkstatt.".into());
    }
    let skript = app.path().resource_dir().map_err(|e| e.to_string())?.join("dienst").join("index.mjs");
    let daten = app.path().app_data_dir().map_err(|e| e.to_string())?.join("werkstatt");
    std::fs::create_dir_all(&daten).map_err(|e| e.to_string())?;
    let rechner = std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_else(|_| "Werkstatt-PC".into());

    let mut kind = befehl("node")
        .arg(&skript)
        .current_dir(&daten)
        .env("ANTHROPIC_API_KEY", schluessel)
        .env("CLAUDE_AGENT_SDK_CLIENT_APP", "codeschmiede")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Werkstatt konnte nicht starten (Node installiert?): {e}"))?;

    let mut eingabe = kind.stdin.take().ok_or("Keine Verbindung zur Werkstatt")?;
    let erste = serde_json::json!({
        "supabase_url": config.supabase_url, "anon_key": config.anon_key, "access_token": config.access_token,
        "user_id": config.user_id, "admin": config.admin, "daten_ordner": daten, "pc_name": rechner,
    });
    writeln!(eingabe, "{erste}").map_err(|e| e.to_string())?;

    let ausgabe = kind.stdout.take().ok_or("Keine Ausgabe der Werkstatt")?;
    let geteilt = state.0.clone();
    std::thread::spawn(move || {
        for zeile in BufReader::new(ausgabe).lines().map_while(Result::ok) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&zeile) {
                let mut w = geteilt.lock().unwrap();
                w.letzte = v.get("text").and_then(|t| t.as_str()).unwrap_or_default().chars().take(300).collect();
                w.auftrag = v.get("auftrag").and_then(|a| a.as_i64());
            }
        }
    });

    let mut w = state.0.lock().unwrap();
    w.kind = Some(kind);
    w.eingabe = Some(eingabe);
    w.letzte = "Werkstatt startet …".into();
    Ok(())
}

#[tauri::command]
fn ws_token(token: String, state: tauri::State<'_, Zustand>) -> Result<(), String> {
    let mut w = state.0.lock().unwrap();
    if let Some(e) = w.eingabe.as_mut() {
        writeln!(e, "{}", serde_json::json!({ "token": token })).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn ws_stop(state: tauri::State<'_, Zustand>) -> Result<(), String> {
    let mut w = state.0.lock().unwrap();
    if let Some(e) = w.eingabe.as_mut() {
        let _ = writeln!(e, "{}", serde_json::json!({ "stop": true }));
    }
    if let Some(mut k) = w.kind.take() {
        // Dienst meldet „aus“ und beendet sich; sicherheitshalber nach kurzer Zeit beenden
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(3));
            let _ = k.kill();
        });
    }
    w.eingabe = None;
    w.auftrag = None;
    w.letzte = "Werkstatt aus".into();
    Ok(())
}

fn main() {
    let zustand = Arc::new(Mutex::new(Werkstatt::default()));
    let beim_beenden = zustand.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _a, _c| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Zustand(zustand))
        .invoke_handler(tauri::generate_handler![
            ws_api_key_status, ws_api_key_set, ws_api_key_delete, ws_check, ws_start, ws_token, ws_stop, ws_status
        ])
        .build(tauri::generate_context!())
        .expect("Codeschmiede konnte nicht starten")
        .run(move |_app, ereignis| {
            if let tauri::RunEvent::Exit = ereignis {
                let mut w = beim_beenden.lock().unwrap();
                if let Some(e) = w.eingabe.as_mut() {
                    let _ = writeln!(e, "{}", serde_json::json!({ "stop": true }));
                }
                if let Some(mut k) = w.kind.take() {
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    let _ = k.kill();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schluessel_format() {
        assert!(schluessel_gueltig("sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"));
        assert!(!schluessel_gueltig("sk-ant-kurz"));
        assert!(!schluessel_gueltig("ghp_abcdefghijklmnopqrstuvwxyz0123456789"));
        assert!(!schluessel_gueltig("sk-ant-api03-mit leerzeichen und so weiter 12345"));
    }

    #[test]
    fn tresor_rundreise() {
        // nur auf Linux (Datei-Tresor) ohne Systemdialog prüfbar
        #[cfg(not(any(windows, target_os = "macos")))]
        {
            let k = "sk-ant-api03-test-test-test-test-test-test";
            tresor::schreiben(k).unwrap();
            assert_eq!(tresor::lesen().unwrap().as_deref(), Some(k));
            tresor::loeschen().unwrap();
            assert!(tresor::lesen().unwrap().is_none());
        }
    }
}
