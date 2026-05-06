#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

#[derive(Serialize, Deserialize, Clone)]
struct Config {
    key: String,
    server: String,
    sound: String,
    draft: String,
    enc_algorithm: String,
    enc_mode: String,
    enc_key: String,
    enc_iv: String,
    close_to_tray: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            key: String::new(),
            server: "https://api.day.app".to_string(),
            sound: String::new(),
            draft: String::new(),
            enc_algorithm: "AES128".to_string(),
            enc_mode: "CBC".to_string(),
            enc_key: String::new(),
            enc_iv: String::new(),
            close_to_tray: false,
        }
    }
}

static CONFIG: Mutex<Option<Config>> = Mutex::new(None);

fn config_path() -> PathBuf {
    let dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")).join("bark-push");
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

fn load_config() -> Config {
    let mut cached = CONFIG.lock().unwrap();
    if let Some(ref cfg) = *cached {
        return cfg.clone();
    }
    let path = config_path();
    let cfg = if path.exists() {
        fs::read_to_string(&path).ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        Config::default()
    };
    *cached = Some(cfg.clone());
    cfg
}

fn save_config(cfg: &Config) {
    let mut cached = CONFIG.lock().unwrap();
    *cached = Some(cfg.clone());
    if let Ok(json) = serde_json::to_string_pretty(cfg) {
        fs::write(config_path(), json).ok();
    }
}

#[tauri::command]
fn get_config() -> Config {
    load_config()
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) {
    let mut cfg = load_config();
    // Accept both camelCase (from Tauri JS) and snake_case
    let get = |k1: &str, k2: &str| -> Option<String> {
        settings.get(k1).or_else(|| settings.get(k2)).and_then(|v| v.as_str()).map(|s| s.to_string())
    };
    let get_bool = |k1: &str, k2: &str| -> Option<bool> {
        settings.get(k1).or_else(|| settings.get(k2)).and_then(|v| v.as_bool())
    };
    if let Some(v) = get("key", "key") { cfg.key = v; }
    if let Some(v) = get("server", "server") { cfg.server = v; }
    if let Some(v) = get("sound", "sound") { cfg.sound = v; }
    if let Some(v) = get("draft", "draft") { cfg.draft = v; }
    if let Some(v) = get("encAlgorithm", "enc_algorithm") { cfg.enc_algorithm = v; }
    if let Some(v) = get("encMode", "enc_mode") { cfg.enc_mode = v; }
    if let Some(v) = get("encKey", "enc_key") { cfg.enc_key = v; }
    if let Some(v) = get("encIv", "enc_iv") { cfg.enc_iv = v; }
    if let Some(v) = get_bool("closeToTray", "close_to_tray") { cfg.close_to_tray = v; }
    save_config(&cfg);
}

fn encrypt_payload(json_str: &str, mode: &str, key: &str, iv: &str) -> Result<(String, Option<String>), String> {
    use base64::{engine::general_purpose::STANDARD as B64, Engine};
    use aes::cipher::{block_padding, BlockEncryptMut, KeyInit, KeyIvInit};

    let key_bytes = key.as_bytes();
    let need_iv = mode == "CBC";
    let iv_bytes = if need_iv { iv.as_bytes() } else { &[0u8; 16][..] };

    // Validate
    if !matches!(key_bytes.len(), 16 | 24 | 32) {
        return Err(format!("加密失败：KEY长度必须是16/24/32位（当前{}位）", key_bytes.len()));
    }
    if need_iv && iv_bytes.len() != 16 {
        return Err(format!("加密失败：CBC模式IV必须是16位（当前{}位）", iv_bytes.len()));
    }

    let plaintext = json_str.as_bytes();
    let bs = 16usize; // AES block size
    let padded_len = ((plaintext.len() / bs) + 1) * bs;

    let ciphertext = match (key_bytes.len(), mode) {
        (16, "CBC") => {
            let enc = cbc::Encryptor::<aes::Aes128>::new(key_bytes.into(), iv_bytes.into());
            let mut buf = vec![0u8; padded_len];
            buf[..plaintext.len()].copy_from_slice(plaintext);
            let ct = enc.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, plaintext.len())
                .map_err(|e| format!("加密填充失败(PKCS7): {:?}", e))?;
            B64.encode(ct)
        }
        (16, _) => {
            let enc = ecb::Encryptor::<aes::Aes128>::new(key_bytes.into());
            let mut buf = vec![0u8; padded_len];
            buf[..plaintext.len()].copy_from_slice(plaintext);
            let ct = enc.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, plaintext.len())
                .map_err(|e| format!("加密填充失败(PKCS7): {:?}", e))?;
            B64.encode(ct)
        }
        (24, "CBC") => {
            let enc = cbc::Encryptor::<aes::Aes192>::new(key_bytes.into(), iv_bytes.into());
            let mut buf = vec![0u8; padded_len];
            buf[..plaintext.len()].copy_from_slice(plaintext);
            let ct = enc.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, plaintext.len())
                .map_err(|e| format!("加密填充失败(PKCS7): {:?}", e))?;
            B64.encode(ct)
        }
        (24, _) => {
            let enc = ecb::Encryptor::<aes::Aes192>::new(key_bytes.into());
            let mut buf = vec![0u8; padded_len];
            buf[..plaintext.len()].copy_from_slice(plaintext);
            let ct = enc.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, plaintext.len())
                .map_err(|e| format!("加密填充失败(PKCS7): {:?}", e))?;
            B64.encode(ct)
        }
        (32, "CBC") => {
            let enc = cbc::Encryptor::<aes::Aes256>::new(key_bytes.into(), iv_bytes.into());
            let mut buf = vec![0u8; padded_len];
            buf[..plaintext.len()].copy_from_slice(plaintext);
            let ct = enc.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, plaintext.len())
                .map_err(|e| format!("加密填充失败(PKCS7): {:?}", e))?;
            B64.encode(ct)
        }
        _ => {
            let enc = ecb::Encryptor::<aes::Aes256>::new(key_bytes.into());
            let mut buf = vec![0u8; padded_len];
            buf[..plaintext.len()].copy_from_slice(plaintext);
            let ct = enc.encrypt_padded_mut::<block_padding::Pkcs7>(&mut buf, plaintext.len())
                .map_err(|e| format!("加密填充失败(PKCS7): {:?}", e))?;
            B64.encode(ct)
        }
    };

    let iv_param = if need_iv { Some(iv.to_string()) } else { None };
    Ok((ciphertext, iv_param))
}

#[derive(Serialize, Deserialize)]
struct PushResult {
    success: bool,
    message: String,
}

#[tauri::command]
async fn send_push(
    key: String, server: String,
    title: Option<String>, body: String,
    url: Option<String>, sound: Option<String>,
    group: Option<String>, use_url_mode: bool,
    enc_algorithm: Option<String>, enc_mode: Option<String>,
    enc_padding: Option<String>, enc_key: Option<String>, enc_iv: Option<String>,
) -> PushResult {
    let server = if server.is_empty() { "https://api.day.app".to_string() } else { server.trim_end_matches('/').to_string() };
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().unwrap();

    let use_enc = enc_key.as_ref().map_or(false, |k| !k.is_empty());

    if use_enc {
        // Encrypted mode always uses POST with ciphertext
        let mode = enc_mode.as_deref().unwrap_or("CBC");
        let ekey = enc_key.as_deref().unwrap_or("");
        let eiv = enc_iv.as_deref().unwrap_or("");

        let mut msg = serde_json::Map::new();
        if let Some(t) = &title { if !t.is_empty() { msg.insert("title".into(), serde_json::Value::String(t.clone())); } }
        msg.insert("body".into(), serde_json::Value::String(body.clone()));
        if let Some(u) = &url { if !u.is_empty() { msg.insert("url".into(), serde_json::Value::String(u.clone())); } }
        if let Some(s) = &sound { if !s.is_empty() { msg.insert("sound".into(), serde_json::Value::String(s.clone())); } }
        if let Some(g) = &group { if !g.is_empty() { msg.insert("group".into(), serde_json::Value::String(g.clone())); } }
        let json_str = serde_json::to_string(&serde_json::Value::Object(msg)).unwrap();

        match encrypt_payload(&json_str, mode, ekey, eiv) {
            Ok((ciphertext, iv_param)) => {
                let mut url_str = format!("{}/{}", server, key);
                url_str.push_str("?ciphertext=");
                url_str.push_str(&urlencoding::encode(&ciphertext));
                if let Some(iv) = iv_param {
                    url_str.push_str("&iv=");
                    url_str.push_str(&urlencoding::encode(&iv));
                }
                match client.post(&url_str).send().await {
                    Ok(resp) => parse_response(resp).await,
                    Err(e) => PushResult { success: false, message: format!("Network: {}", e) },
                }
            }
            Err(e) => PushResult { success: false, message: e },
        }
    } else if use_url_mode {
        // URL mode: GET /key/title?params
        // Auto-add url param so clicking notification opens browser
        let title_enc = urlencoding::encode(&body);

        let mut url_str = format!("{}/{}/{}", server, key, title_enc);

        let mut params = vec![];
        // Auto-add jump URL: opens the Bark device page in browser
        let jump_url = format!("{}/{}", server, key);
        params.push(format!("url={}", urlencoding::encode(&jump_url)));
        if let Some(s) = &sound { if !s.is_empty() { params.push(format!("sound={}", urlencoding::encode(s))); } }
        if let Some(g) = &group { if !g.is_empty() { params.push(format!("group={}", urlencoding::encode(g))); } }
        url_str.push('?');
        url_str.push_str(&params.join("&"));

        match client.get(&url_str).send().await {
            Ok(resp) => parse_response(resp).await,
            Err(e) => PushResult { success: false, message: format!("Network: {}", e) },
        }
    } else {
        // JSON POST mode
        let mut m = serde_json::Map::new();
        if let Some(t) = &title { if !t.is_empty() { m.insert("title".into(), serde_json::Value::String(t.clone())); } }
        m.insert("body".into(), serde_json::Value::String(body));
        if let Some(u) = &url { if !u.is_empty() { m.insert("url".into(), serde_json::Value::String(u.clone())); } }
        if let Some(s) = &sound { if !s.is_empty() { m.insert("sound".into(), serde_json::Value::String(s.clone())); } }
        if let Some(g) = &group { if !g.is_empty() { m.insert("group".into(), serde_json::Value::String(g.clone())); } }
        let payload = serde_json::Value::Object(m);
        let endpoint = format!("{}/{}", server, key);

        match client.post(&endpoint)
            .header("Content-Type", "application/json; charset=utf-8")
            .json(&payload).send().await
        {
            Ok(resp) => parse_response(resp).await,
            Err(e) => PushResult { success: false, message: format!("Network: {}", e) },
        }
    }
}

async fn parse_response(resp: reqwest::Response) -> PushResult {
    let status = resp.status();
    match resp.json::<serde_json::Value>().await {
        Ok(b) => {
            let code = b["code"].as_i64().unwrap_or(0);
            let msg = b["message"].as_str().unwrap_or("Unknown").to_string();
            if code == 200 { PushResult { success: true, message: msg } }
            else { PushResult { success: false, message: format!("({}) {}", code, msg) } }
        }
        Err(e) => PushResult { success: false, message: format!("HTTP {} - {}", status, e) },
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_config, save_settings, send_push])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();

            // Handle close event - hide to tray if enabled
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let cfg = load_config();
                    if cfg.close_to_tray {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error");
}
