// Eigene Design-Freigabe für den Seiten-Designer von Trainer to go (Entscheidung Gerhard 2026-10-24).
//
// Der Seiten-Designer läuft eingebettet (iframe) in der Codeschmiede. Die Plattform-Rechte von Trainer to go bleiben an
// das Plattform-Programm gebunden. Die Codeschmiede hat darum einen EIGENEN Geräteschlüssel (Ed25519): Der private Teil
// liegt im Windows-Tresor bzw. Mac-Schlüsselbund und verlässt den PC nie. Signiert werden NUR Nachrichten im festen Format
// „ttg-design|register|…“, „ttg-design|verify|…“, „ttg-design|code|…“. Der Inhaber gibt das Gerät einmal frei; danach
// öffnet die Sitzung (30 Min.) bei Trainer to go ausschließlich die Design-Pakete. Kein Zugang zur Plattform-Verwaltung.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use rand::rngs::OsRng;
use serde::Serialize;
use std::sync::Mutex;

mod ablage {
    pub const DIENST: &str = "Codeschmiede";
    pub const KONTO: &str = "ttg-design-schluessel";

    #[cfg(any(windows, target_os = "macos"))]
    fn eintrag() -> Result<keyring::Entry, String> {
        keyring::Entry::new(DIENST, KONTO).map_err(|e| e.to_string())
    }
    #[cfg(any(windows, target_os = "macos"))]
    pub fn laden() -> Result<Option<String>, String> {
        match eintrag()?.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(any(windows, target_os = "macos"))]
    pub fn speichern(geheim: &str) -> Result<(), String> {
        eintrag()?.set_password(geheim).map_err(|e| e.to_string())
    }

    // Andere Systeme (nur Entwicklung/Test): Datei im Benutzerordner, nur für den Besitzer lesbar
    #[cfg(not(any(windows, target_os = "macos")))]
    fn pfad() -> std::path::PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        std::path::Path::new(&home).join(".codeschmiede-ttg-design-schluessel")
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    pub fn laden() -> Result<Option<String>, String> {
        match std::fs::read_to_string(pfad()) {
            Ok(s) => Ok(Some(s.trim().to_string())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    pub fn speichern(geheim: &str) -> Result<(), String> {
        std::fs::write(pfad(), geheim).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(pfad(), std::fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }
}

pub struct Schluessel(pub Mutex<Option<SigningKey>>);

fn dekodieren(geheim: &str) -> Result<SigningKey, String> {
    let bytes = B64.decode(geheim.trim()).map_err(|_| "Design-Schlüssel beschädigt".to_string())?;
    let arr: [u8; 32] = bytes.try_into().map_err(|_| "Design-Schlüssel beschädigt".to_string())?;
    Ok(SigningKey::from_bytes(&arr))
}

fn schluessel(zustand: &Schluessel) -> Result<SigningKey, String> {
    let mut g = zustand.0.lock().map_err(|_| "Interner Fehler".to_string())?;
    if let Some(k) = g.as_ref() {
        return Ok(k.clone());
    }
    let k = match ablage::laden()? {
        Some(geheim) => dekodieren(&geheim)?,
        None => {
            let k = SigningKey::generate(&mut OsRng);
            ablage::speichern(&B64.encode(k.to_bytes()))?;
            k
        }
    };
    *g = Some(k.clone());
    Ok(k)
}

/// Nur Nachrichten im festen Format der Design-Freigabe – nichts anderes (auch kein „ttg-desktop|…“).
pub fn erlaubt(nachricht: &str) -> bool {
    nachricht.len() <= 512
        && !nachricht.contains('\n')
        && (nachricht.starts_with("ttg-design|register|")
            || nachricht.starts_with("ttg-design|verify|")
            || nachricht.starts_with("ttg-design|code|"))
}

fn rechnername() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("/usr/sbin/scutil").args(["--get", "ComputerName"]).output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if out.status.success() && !name.is_empty() {
                return name;
            }
        }
        return "Mac".into();
    }
    #[cfg(not(target_os = "macos"))]
    {
        std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_else(|_| "Windows-PC".into())
    }
}

#[derive(Serialize)]
pub struct Geraet {
    public_key: String,
    name: String,
    app_version: String,
}

#[tauri::command]
pub fn ws_design_geraet(app: tauri::AppHandle, zustand: tauri::State<'_, Schluessel>) -> Result<Geraet, String> {
    let k = schluessel(&zustand)?;
    Ok(Geraet {
        public_key: B64.encode(k.verifying_key().to_bytes()),
        name: rechnername(),
        app_version: app.package_info().version.to_string(),
    })
}

#[tauri::command]
pub fn ws_design_signieren(nachricht: String, zustand: tauri::State<'_, Schluessel>) -> Result<String, String> {
    if !erlaubt(&nachricht) {
        return Err("Diese Nachricht darf nicht signiert werden.".into());
    }
    let k = schluessel(&zustand)?;
    Ok(B64.encode(k.sign(nachricht.as_bytes()).to_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signature, Verifier};

    #[test]
    fn nur_design_nachrichten() {
        assert!(erlaubt("ttg-design|verify|abc|1760000000000"));
        assert!(erlaubt("ttg-design|code|abc|1760000000000|123456"));
        assert!(!erlaubt("ttg-desktop|verify|abc|1760000000000"));
        assert!(!erlaubt("irgendwas"));
        assert!(!erlaubt(&format!("ttg-design|verify|{}", "x".repeat(600))));
        assert!(!erlaubt("ttg-design|verify|a\nttg-desktop|verify|b"));
    }

    #[test]
    fn signatur_ist_pruefbar() {
        let k = SigningKey::generate(&mut OsRng);
        let msg = "ttg-design|verify|00000000-0000-0000-0000-000000000000|1760000000000";
        let sig = k.sign(msg.as_bytes());
        let roh = B64.decode(B64.encode(sig.to_bytes())).unwrap();
        let sig2 = Signature::from_bytes(&roh.try_into().unwrap());
        assert!(k.verifying_key().verify(msg.as_bytes(), &sig2).is_ok());
    }
}
