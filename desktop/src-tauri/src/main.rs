// Codeschmiede – Programm für Windows und Mac.
//
// Schlanke Hülle (Tauri) um die Oberfläche der Codeschmiede, die live geladen wird. Aufgabe des Programms:
// den Werkstatt-Dienst (Node, Ordner „dienst“) starten und stoppen. Der Dienst lässt die Aufträge vom offiziellen
// Claude Code abarbeiten, das die Person selbst installiert und mit ihrem eigenen Abo angemeldet hat
// (Entscheidung Gerhard 2026-10-22 14:22). Das Programm speichert keine Zugangsdaten zu Claude.
// Konzept: docs/KONZEPT.md
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

mod design;

/// Automatische Updates (Anweisung Gerhard 2026-10-22 16:25): im Hintergrund laden, beim nächsten Start aktiv,
/// Knopf „Jetzt neu starten“; nie mitten in einem laufenden Auftrag. Quelle: codeschmiede-updates.pages.dev (signiert).
#[derive(Default)]
struct UpdateStand {
    version: Option<String>,
    bereit: Option<(tauri_plugin_updater::Update, Vec<u8>)>,
    fehler: Option<String>,
}
struct Updates(Arc<Mutex<UpdateStand>>);

#[derive(Serialize)]
struct UpdateInfo {
    aktuell: String,
    neu: Option<String>,
    bereit: bool,
    fehler: Option<String>,
}

async fn update_pruefen(app: tauri::AppHandle, stand: Arc<Mutex<UpdateStand>>) {
    let ergebnis: Result<(), String> = async {
        let updater = app.updater().map_err(|e| e.to_string())?;
        if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
            let schon_da = {
                let s = stand.lock().unwrap();
                s.version.as_deref() == Some(update.version.as_str()) && s.bereit.is_some()
            };
            if schon_da {
                return Ok(());
            }
            stand.lock().unwrap().version = Some(update.version.clone());
            let bytes = update.download(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
            stand.lock().unwrap().bereit = Some((update, bytes));
        }
        Ok(())
    }
    .await;
    stand.lock().unwrap().fehler = ergebnis.err();
}

#[tauri::command]
fn ws_update_status(app: tauri::AppHandle, updates: tauri::State<'_, Updates>) -> UpdateInfo {
    let s = updates.0.lock().unwrap();
    UpdateInfo {
        aktuell: app.package_info().version.to_string(),
        neu: s.version.clone(),
        bereit: s.bereit.is_some(),
        fehler: s.fehler.clone(),
    }
}

#[tauri::command]
fn ws_update_neustart(app: tauri::AppHandle, updates: tauri::State<'_, Updates>, state: tauri::State<'_, Zustand>) -> Result<(), String> {
    {
        let mut w = state.0.lock().unwrap();
        if w.auftrag.is_some() {
            return Err("Gerade läuft ein Auftrag – das Update wird danach bzw. beim nächsten Start eingespielt.".into());
        }
        if let Some(e) = w.eingabe.as_mut() {
            let _ = writeln!(e, "{}", serde_json::json!({ "stop": true }));
        }
        if let Some(mut k) = w.kind.take() {
            std::thread::sleep(std::time::Duration::from_millis(800));
            let _ = k.kill();
        }
    }
    let (update, bytes) = updates.0.lock().unwrap().bereit.take().ok_or("Kein Update bereit.")?;
    update.install(bytes).map_err(|e| e.to_string())?;
    app.restart();
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
    claude: bool,
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

/// PATH für Kindprozesse: am Mac kennen Programme aus dem Finder Homebrew-Pfade nicht;
/// Claude Code liegt oft in ~/.local/bin bzw. ~/.claude/local.
fn pfad_umgebung() -> String {
    let basis = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).unwrap_or_default();
    if cfg!(target_os = "macos") {
        format!("/opt/homebrew/bin:/usr/local/bin:{home}/.local/bin:{home}/.claude/local:{basis}")
    } else if cfg!(windows) {
        format!("{home}\\.local\\bin;{basis}")
    } else {
        format!("{home}/.local/bin:{basis}")
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
fn ws_check() -> Pruefung {
    Pruefung {
        claude: laeuft_erfolgreich("claude", &["--version"]) || (cfg!(windows) && laeuft_erfolgreich("claude.cmd", &["--version"])),
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
        // Claude Code soll mit dem Abo-Login der Person arbeiten, nicht mit einem Schlüssel aus der Umgebung
        .env_remove("ANTHROPIC_API_KEY")
        .env_remove("ANTHROPIC_AUTH_TOKEN")
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

/// Richtet auf Wunsch die Statuszeile von Claude Code ein, die die Abo-Limits für die Codeschmiede ablegt.
/// Eine bestehende eigene Statuszeile wird nie überschrieben.
#[tauri::command]
fn ws_statuszeile(app: tauri::AppHandle) -> Result<String, String> {
    let skript = app.path().resource_dir().map_err(|e| e.to_string())?.join("dienst").join("werkzeuge").join("abo-statuszeile.mjs");
    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).map_err(|_| "Benutzerordner nicht gefunden".to_string())?;
    let ordner = std::path::Path::new(&home).join(".claude");
    std::fs::create_dir_all(&ordner).map_err(|e| e.to_string())?;
    let datei = ordner.join("settings.json");
    let befehl_text = format!("node \"{}\"", skript.display());
    let neu = statuszeile_eintragen(std::fs::read_to_string(&datei).ok().as_deref(), &befehl_text)?;
    match neu {
        None => Ok("Statuszeile ist schon eingerichtet.".into()),
        Some(text) => {
            std::fs::write(&datei, text).map_err(|e| e.to_string())?;
            Ok("Statuszeile eingerichtet – die Abo-Limits erscheinen nach der nächsten Nutzung von Claude Code.".into())
        }
    }
}

/// Liefert den neuen Inhalt von settings.json (None = schon eingerichtet). Fehler, wenn eine fremde Statuszeile existiert.
fn statuszeile_eintragen(alt: Option<&str>, befehl_text: &str) -> Result<Option<String>, String> {
    let mut j: serde_json::Value = match alt {
        Some(t) if !t.trim().is_empty() => serde_json::from_str(t).map_err(|_| "~/.claude/settings.json ist kein gültiges JSON – bitte von Hand prüfen.".to_string())?,
        _ => serde_json::json!({}),
    };
    if let Some(v) = j.get("statusLine") {
        if v.get("command").and_then(|c| c.as_str()) == Some(befehl_text) {
            return Ok(None);
        }
        return Err("Es gibt schon eine eigene Statuszeile in Claude Code – sie wird nicht überschrieben.".into());
    }
    let obj = j.as_object_mut().ok_or("Unerwarteter Inhalt in ~/.claude/settings.json")?;
    obj.insert("statusLine".into(), serde_json::json!({ "type": "command", "command": befehl_text }));
    Ok(Some(serde_json::to_string_pretty(&j).unwrap()))
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

async fn tokio_schlaf(sekunden: u64) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(std::time::Duration::from_secs(sekunden))).await;
}

fn main() {
    let zustand = Arc::new(Mutex::new(Werkstatt::default()));
    let beim_beenden = zustand.clone();
    let updates = Arc::new(Mutex::new(UpdateStand::default()));
    let updates_setup = updates.clone();
    let updates_ende = updates.clone();
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Zustand(zustand))
        .manage(Updates(updates))
        .setup(move |app| {
            let handle = app.handle().clone();
            let stand = updates_setup.clone();
            tauri::async_runtime::spawn(async move {
                tokio_schlaf(15).await;
                loop {
                    update_pruefen(handle.clone(), stand.clone()).await;
                    tokio_schlaf(3600).await;
                }
            });
            Ok(())
        })
        .manage(design::Schluessel(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![ws_check, ws_start, ws_token, ws_stop, ws_status, ws_statuszeile, ws_update_status, ws_update_neustart, design::ws_design_geraet, design::ws_design_signieren])
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
                drop(w);
                // fertig geladenes Update beim Beenden einspielen („beim nächsten Start aktiv“)
                if let Some((update, bytes)) = updates_ende.lock().unwrap().bereit.take() {
                    let _ = update.install(bytes);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn statuszeile_neu_und_vorhanden() {
        let b = "node \"/x/abo-statuszeile.mjs\"";
        let neu = statuszeile_eintragen(None, b).unwrap().unwrap();
        assert!(neu.contains("statusLine"));
        assert!(statuszeile_eintragen(Some(&neu), b).unwrap().is_none());
        let fremd = r#"{"statusLine":{"type":"command","command":"meins.sh"},"model":"opus"}"#;
        assert!(statuszeile_eintragen(Some(fremd), b).is_err());
        let andere = r#"{"model":"opus"}"#;
        let r = statuszeile_eintragen(Some(andere), b).unwrap().unwrap();
        assert!(r.contains("\"model\"") && r.contains("statusLine"));
        assert!(statuszeile_eintragen(Some("kaputt{"), b).is_err());
    }
}
