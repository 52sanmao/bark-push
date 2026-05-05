use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct PushHistory {
    pub id: String,
    pub device_id: String,
    pub title: String,
    pub body: String,
    pub success: bool,
    pub sent_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub default_server: String,
    pub default_sound: String,
    pub default_level: String,
    pub default_group: String,
    pub auto_copy: bool,
    pub save_history: bool,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_server: "https://api.day.app".to_string(),
            default_sound: "birdsong".to_string(),
            default_level: "active".to_string(),
            default_group: String::new(),
            auto_copy: true,
            save_history: true,
            theme: "dark".to_string(),
        }
    }
}
