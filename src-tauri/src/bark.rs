use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub key: String,
    pub server: String,
    pub encryption_key: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BarkPushRequest {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub body: Option<String>,
    pub ciphertext: Option<String>,
    pub url: Option<String>,
    pub group: Option<String>,
    pub icon: Option<String>,
    pub sound: Option<String>,
    pub call: Option<String>,
    pub level: Option<String>,
    pub copy: Option<String>,
    pub is_archive: Option<String>,
    pub automatically_copy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BarkResponse {
    pub code: i64,
    pub message: Option<String>,
    pub timestamp: Option<i64>,
}

pub struct BarkClient {
    server: String,
    client: reqwest::Client,
}

impl BarkClient {
    pub fn new(server: &str) -> Self {
        Self {
            server: server.trim_end_matches('/').to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        }
    }

    pub async fn push(&self, key: &str, request: &BarkPushRequest) -> Result<BarkResponse> {
        let url = format!("{}/{}", self.server, key);
        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "application/json; charset=utf-8")
            .json(request)
            .send()
            .await?;

        let status = resp.status();
        let body: serde_json::Value = resp.json().await?;

        if !status.is_success() {
            return Err(anyhow::anyhow!(
                "HTTP {}: {}",
                status.as_u16(),
                body["message"].as_str().unwrap_or("Unknown error")
            ));
        }

        Ok(BarkResponse {
            code: body["code"].as_i64().unwrap_or(0),
            message: body["message"].as_str().map(|s| s.to_string()),
            timestamp: body["timestamp"].as_i64(),
        })
    }

    pub async fn check_health(&self, key: &str) -> Result<BarkResponse> {
        let request = BarkPushRequest {
            title: Some("Bark Push".to_string()),
            body: Some("Test".to_string()),
            sound: Some("birdsong".to_string()),
            group: Some("Test".to_string()),
            ..Default::default()
        };
        self.push(key, &request).await
    }
}
