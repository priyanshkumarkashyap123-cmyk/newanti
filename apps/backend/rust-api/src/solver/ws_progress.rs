//! WebSocket Progress Reporting System
//!
//! Real-time progress updates for long-running analyses via WebSocket.
//! Broadcasts job progress events to connected clients.

#![allow(dead_code)]

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures::stream::StreamExt;
use futures::SinkExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// WebSocket progress message sent to clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressMessage {
    #[serde(rename = "type")]
    pub msg_type: String, // "progress", "complete", "error", "heartbeat"
    pub job_id: Option<String>,
    pub progress: Option<f64>,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
    pub timestamp: String,
}

/// Manages WebSocket connections and broadcasts
pub struct ProgressBroadcaster {
    /// Broadcast channel for all progress events
    sender: broadcast::Sender<ProgressMessage>,
    /// Track connected clients per user
    clients: Arc<RwLock<HashMap<String, usize>>>,
}

impl ProgressBroadcaster {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self {
            sender,
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Get a new receiver for broadcast messages
    pub fn subscribe(&self) -> broadcast::Receiver<ProgressMessage> {
        self.sender.subscribe()
    }

    /// Broadcast a progress update to all connected clients
    pub fn broadcast(&self, msg: ProgressMessage) {
        let _ = self.sender.send(msg);
    }

    /// Send a progress update for a specific job
    pub fn send_progress(&self, job_id: &str, progress: f64, message: &str) {
        self.broadcast(ProgressMessage {
            msg_type: "progress".into(),
            job_id: Some(job_id.to_string()),
            progress: Some(progress),
            message: Some(message.to_string()),
            data: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        });
    }

    /// Send completion notification
    pub fn send_complete(&self, job_id: &str, data: serde_json::Value) {
        self.broadcast(ProgressMessage {
            msg_type: "complete".into(),
            job_id: Some(job_id.to_string()),
            progress: Some(1.0),
            message: Some("Analysis complete".to_string()),
            data: Some(data),
            timestamp: chrono::Utc::now().to_rfc3339(),
        });
    }

    /// Send error notification
    pub fn send_error(&self, job_id: &str, error: &str) {
        self.broadcast(ProgressMessage {
            msg_type: "error".into(),
            job_id: Some(job_id.to_string()),
            progress: None,
            message: Some(error.to_string()),
            data: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        });
    }

    /// Track client connection
    pub async fn client_connected(&self, user_id: &str) {
        let mut clients = self.clients.write().await;
        *clients.entry(user_id.to_string()).or_insert(0) += 1;
    }

    /// Track client disconnection
    pub async fn client_disconnected(&self, user_id: &str) {
        let mut clients = self.clients.write().await;
        if let Some(count) = clients.get_mut(user_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                clients.remove(user_id);
            }
        }
    }

    /// Get active connection count
    pub async fn active_connections(&self) -> usize {
        self.clients.read().await.values().sum()
    }
}

impl Default for ProgressBroadcaster {
    fn default() -> Self {
        Self::new(1024)
    }
}

/// Handle WebSocket upgrade for progress streaming
pub async fn ws_progress_handler(
    ws: WebSocketUpgrade,
    broadcaster: Arc<ProgressBroadcaster>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_connection(socket, broadcaster))
}

/// Handle individual WebSocket connection
async fn handle_ws_connection(socket: WebSocket, broadcaster: Arc<ProgressBroadcaster>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = broadcaster.subscribe();
    let user_id = "anonymous".to_string(); // In production, extract from auth token

    broadcaster.client_connected(&user_id).await;

    // Send welcome message
    let welcome = ProgressMessage {
        msg_type: "connected".into(),
        job_id: None,
        progress: None,
        message: Some("Connected to BeamLab progress stream".into()),
        data: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    if let Ok(json) = serde_json::to_string(&welcome) {
        let _ = sender.send(Message::Text(json.into())).await;
    }

    // Spawn task to forward broadcasts to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle incoming messages (e.g., subscribe to specific jobs)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(_text) => {
                    // Could handle subscription requests here
                    // e.g., {"action": "subscribe", "job_id": "..."}
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either task to finish (connection closed)
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    broadcaster.client_disconnected(&user_id).await;
}

/// Heartbeat task — sends periodic pings to keep connections alive
pub async fn heartbeat_task(broadcaster: Arc<ProgressBroadcaster>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
    loop {
        interval.tick().await;
        broadcaster.broadcast(ProgressMessage {
            msg_type: "heartbeat".into(),
            job_id: None,
            progress: None,
            message: None,
            data: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_broadcaster_creation() {
        let broadcaster = ProgressBroadcaster::new(100);
        let mut rx = broadcaster.subscribe();

        broadcaster.send_progress("job-1", 0.5, "Half done");

        // Should receive the message
        let msg = rx.try_recv().unwrap();
        assert_eq!(msg.msg_type, "progress");
        assert_eq!(msg.job_id.unwrap(), "job-1");
        assert_eq!(msg.progress.unwrap(), 0.5);
    }

    #[test]
    fn test_progress_message_serialization() {
        let msg = ProgressMessage {
            msg_type: "progress".into(),
            job_id: Some("test-123".into()),
            progress: Some(0.75),
            message: Some("Computing reactions".into()),
            data: None,
            timestamp: "2026-02-19T12:00:00Z".into(),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("progress"));
        assert!(json.contains("0.75"));
    }
}
