// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bark;
mod crypto;
mod store;
mod types;

use bark::{BarkClient, BarkPushRequest, BarkResponse, DeviceInfo};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use store::AppStore;
use tauri::State;
use types::{AppSettings, PushHistory};

struct AppState {
    store: Mutex<AppStore>,
}

// ── Device Commands ──────────────────────────────────────────────

#[tauri::command]
async fn add_device(
    state: State<'_, AppState>,
    name: String,
    key: String,
    server: String,
) -> Result<DeviceInfo, String> {
    let server = if server.is_empty() {
        "https://api.day.app".to_string()
    } else {
        server.trim_end_matches('/').to_string()
    };
    let device = DeviceInfo {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        key,
        server,
        encryption_key: None,
        created_at: chrono::Utc::now(),
    };
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.add_device(device.clone());
    Ok(device)
}

#[tauri::command]
fn get_devices(state: State<'_, AppState>) -> Result<Vec<DeviceInfo>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.get_devices().clone())
}

#[tauri::command]
fn remove_device(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.remove_device(&id);
    Ok(())
}

#[tauri::command]
fn update_device(
    state: State<'_, AppState>,
    id: String,
    name: String,
    key: String,
    server: String,
    encryption_key: Option<String>,
) -> Result<DeviceInfo, String> {
    let server = if server.is_empty() {
        "https://api.day.app".to_string()
    } else {
        server.trim_end_matches('/').to_string()
    };
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.update_device(&id, name, key, server, encryption_key)
}

#[tauri::command]
async fn test_device(device_key: String, server: String) -> Result<BarkResponse, String> {
    let server = if server.is_empty() {
        "https://api.day.app".to_string()
    } else {
        server.trim_end_matches('/').to_string()
    };
    let client = BarkClient::new(&server);
    client
        .check_health(&device_key)
        .await
        .map_err(|e| e.to_string())
}

// ── Push Commands ────────────────────────────────────────────────

#[tauri::command]
async fn send_push(
    state: State<'_, AppState>,
    device_id: String,
    request: BarkPushRequest,
) -> Result<BarkResponse, String> {
    let device = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        store
            .get_device(&device_id)
            .ok_or("Device not found")?
            .clone()
    };

    let mut req = request.clone();

    if let Some(ref enc_key) = device.encryption_key {
        if !enc_key.is_empty() && req.ciphertext.is_none() {
            let plaintext = serde_json::to_string(&req).unwrap_or_default();
            match crypto::encrypt(&plaintext, enc_key) {
                Ok(ct) => {
                    req = BarkPushRequest {
                        ciphertext: Some(ct),
                        ..Default::default()
                    };
                }
                Err(e) => return Err(format!("Encryption failed: {}", e)),
            }
        }
    }

    let client = BarkClient::new(&device.server);
    let resp = client.push(&device.key, &req).await.map_err(|e| e.to_string())?;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.add_history(
            &device_id,
            request.title.unwrap_or_default(),
            request.body.unwrap_or_default(),
            resp.code == 200,
        );
    }

    Ok(resp)
}

// ── Batch Push ───────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
struct BatchPushRequest {
    device_ids: Vec<String>,
    title: Option<String>,
    subtitle: Option<String>,
    body: String,
    url: Option<String>,
    group: Option<String>,
    icon: Option<String>,
    sound: Option<String>,
    call: Option<bool>,
    level: Option<String>,
    copy: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct BatchPushResult {
    device_id: String,
    device_name: String,
    success: bool,
    message: String,
}

#[tauri::command]
async fn send_batch_push(
    state: State<'_, AppState>,
    request: BatchPushRequest,
) -> Result<Vec<BatchPushResult>, String> {
    let devices: Vec<DeviceInfo> = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        request
            .device_ids
            .iter()
            .filter_map(|id| store.get_device(id).cloned())
            .collect()
    };

    let mut results = Vec::new();

    for device in &devices {
        let mut push_req = BarkPushRequest {
            title: request.title.clone(),
            subtitle: request.subtitle.clone(),
            body: Some(request.body.clone()),
            ciphertext: None,
            url: request.url.clone(),
            group: request.group.clone(),
            icon: request.icon.clone(),
            sound: request.sound.clone(),
            call: request.call.map(|c| if c { "1".to_string() } else { "0".to_string() }),
            level: request.level.clone(),
            copy: request.clone().copy,
            is_archive: None,
            automatically_copy: None,
        };

        if let Some(ref enc_key) = device.encryption_key {
            if !enc_key.is_empty() {
                let plaintext = serde_json::to_string(&push_req).unwrap_or_default();
                match crypto::encrypt(&plaintext, enc_key) {
                    Ok(ct) => {
                        push_req = BarkPushRequest {
                            title: None,
                            subtitle: None,
                            body: None,
                            ciphertext: Some(ct),
                            url: None,
                            group: None,
                            icon: None,
                            sound: None,
                            call: None,
                            level: None,
                            copy: None,
                            is_archive: None,
                            automatically_copy: None,
                        };
                    }
                    Err(e) => {
                        results.push(BatchPushResult {
                            device_id: device.id.clone(),
                            device_name: device.name.clone(),
                            success: false,
                            message: format!("Encryption failed: {}", e),
                        });
                        continue;
                    }
                }
            }
        }

        let client = BarkClient::new(&device.server);
        let push_result = client.push(&device.key, &push_req).await;
        match push_result {
            Ok(resp) => {
                {
                    let mut store = state.store.lock().map_err(|e| e.to_string())?;
                    store.add_history(
                        &device.id,
                        request.title.clone().unwrap_or_default(),
                        request.body.clone(),
                        resp.code == 200,
                    );
                }
                results.push(BatchPushResult {
                    device_id: device.id.clone(),
                    device_name: device.name.clone(),
                    success: resp.code == 200,
                    message: resp.message.unwrap_or_default(),
                });
            }
            Err(e) => {
                results.push(BatchPushResult {
                    device_id: device.id.clone(),
                    device_name: device.name.clone(),
                    success: false,
                    message: e.to_string(),
                });
            }
        }
    }

    Ok(results)
}

// ── History Commands ─────────────────────────────────────────────

#[tauri::command]
fn get_history(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<Vec<PushHistory>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.get_history(device_id.as_deref()))
}

#[tauri::command]
fn clear_history(
    state: State<'_, AppState>,
    device_id: Option<String>,
) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.clear_history(device_id.as_deref());
    Ok(())
}

// ── Settings Commands ────────────────────────────────────────────

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(store.get_settings().clone())
}

#[tauri::command]
fn update_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.update_settings(settings);
    Ok(())
}

// ── Encryption Commands ──────────────────────────────────────────

#[tauri::command]
fn encrypt_text(text: String, key: String) -> Result<String, String> {
    crypto::encrypt(&text, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_text(ciphertext: String, key: String) -> Result<String, String> {
    crypto::decrypt(&ciphertext, &key).map_err(|e| e.to_string())
}

// ── Main ─────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            store: Mutex::new(AppStore::load()),
        })
        .invoke_handler(tauri::generate_handler![
            add_device,
            get_devices,
            remove_device,
            update_device,
            test_device,
            send_push,
            send_batch_push,
            get_history,
            clear_history,
            get_settings,
            update_settings,
            encrypt_text,
            decrypt_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
