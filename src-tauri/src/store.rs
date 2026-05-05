use crate::bark::DeviceInfo;
use crate::types::{AppSettings, PushHistory};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Default, Clone)]
struct StoreData {
    devices: Vec<DeviceInfo>,
    history: Vec<PushHistory>,
    settings: AppSettings,
}

pub struct AppStore {
    path: PathBuf,
    data: StoreData,
}

impl AppStore {
    pub fn load() -> Self {
        let dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("bark-push");
        fs::create_dir_all(&dir).ok();
        let path = dir.join("store.json");
        let data = if path.exists() {
            fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            StoreData::default()
        };
        Self { path, data }
    }

    fn save(&self) {
        if let Ok(json) = serde_json::to_string_pretty(&self.data) {
            fs::write(&self.path, json).ok();
        }
    }

    pub fn get_devices(&self) -> &Vec<DeviceInfo> { &self.data.devices }
    pub fn get_device(&self, id: &str) -> Option<&DeviceInfo> {
        self.data.devices.iter().find(|d| d.id == id)
    }
    pub fn add_device(&mut self, device: DeviceInfo) {
        self.data.devices.push(device);
        self.save();
    }
    pub fn remove_device(&mut self, id: &str) {
        self.data.devices.retain(|d| d.id != id);
        self.save();
    }
    pub fn update_device(&mut self, id: &str, name: String, key: String, server: String, encryption_key: Option<String>) -> Result<DeviceInfo, String> {
        let device = self.data.devices.iter_mut().find(|d| d.id == id).ok_or("Device not found")?;
        device.name = name;
        device.key = key;
        device.server = server;
        device.encryption_key = encryption_key;
        let result = device.clone();
        self.save();
        Ok(result)
    }

    pub fn get_history(&self, device_id: Option<&str>) -> Vec<PushHistory> {
        match device_id {
            Some(did) => self.data.history.iter().filter(|h| h.device_id == did).cloned().collect(),
            None => self.data.history.clone(),
        }
    }
    pub fn add_history(&mut self, device_id: &str, title: String, body: String, success: bool) {
        self.data.history.push(PushHistory {
            id: uuid::Uuid::new_v4().to_string(),
            device_id: device_id.to_string(),
            title, body, success,
            sent_at: chrono::Utc::now(),
        });
        if self.data.history.len() > 500 {
            let drain_count = self.data.history.len() - 500;
            self.data.history.drain(..drain_count);
        }
        self.save();
    }
    pub fn clear_history(&mut self, device_id: Option<&str>) {
        match device_id {
            Some(did) => self.data.history.retain(|h| h.device_id != did),
            None => self.data.history.clear(),
        }
        self.save();
    }

    pub fn get_settings(&self) -> &AppSettings { &self.data.settings }
    pub fn update_settings(&mut self, settings: AppSettings) {
        self.data.settings = settings;
        self.save();
    }
}
