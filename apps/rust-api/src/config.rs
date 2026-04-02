//! Configuration management

use anyhow::{Context, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub mongodb_uri: String,
    pub jwt_secret: String,
    pub frontend_url: String,
    pub environment: Environment,
    pub max_nodes: usize,
    pub max_members: usize,
    pub analysis_timeout_secs: u64,
    pub cors_origins: Vec<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Environment {
    Development,
    Production,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let environment = match std::env::var("RUST_ENV")
            .or_else(|_| std::env::var("NODE_ENV"))
            .unwrap_or_else(|_| "development".into())
            .as_str()
        {
            "production" => Environment::Production,
            _ => Environment::Development,
        };

        // Try PORT first (Azure standard), fallback to RUST_API_PORT, then default
        let port = std::env::var("PORT")
            .or_else(|_| std::env::var("RUST_API_PORT"))
            .unwrap_or_else(|_| "8080".into())
            .parse()
            .context("Invalid PORT")?;

        let mongodb_uri = match std::env::var("MONGODB_URI") {
            Ok(v) => v,
            Err(_) => anyhow::bail!("FATAL: MONGODB_URI env var is required for Rust API startup"),
        };

        let jwt_secret = std::env::var("JWT_SECRET")
            .context("FATAL: JWT_SECRET environment variable is required for Rust API startup")?;

        let frontend_url =
            std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".into());

        // Parse CORS origins from comma-separated env var with defaults
        let cors_origins = std::env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| {
                if environment == Environment::Production {
                    "https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net".to_string()
                } else {
                    "http://localhost:5173,http://localhost:3000,https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net".to_string()
                }
            })
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        let config = Config {
            port,
            mongodb_uri,
            jwt_secret,
            frontend_url,
            environment,
            max_nodes: 100_000,         // Support 100k nodes
            max_members: 500_000,       // Support 500k members
            analysis_timeout_secs: 300, // 5 minute timeout
            cors_origins,
        };

        // Reject localhost URLs in production
        if config.is_production() {
            fn has_localhost(s: &str) -> bool {
                let lower = s.to_lowercase();
                lower.contains("localhost") || lower.contains("127.0.0.1")
            }
            let checks = [
                ("MONGODB_URI", &config.mongodb_uri),
                ("FRONTEND_URL", &config.frontend_url),
            ];
            let bad: Vec<&str> = checks
                .iter()
                .filter(|(_, v)| has_localhost(v))
                .map(|(k, _)| *k)
                .collect();
            if !bad.is_empty() {
                anyhow::bail!(
                    "FATAL: localhost URLs in PRODUCTION for: {}. Set correct production URLs.",
                    bad.join(", ")
                );
            }

            let internal_service_secret = std::env::var("INTERNAL_SERVICE_SECRET")
                .context("FATAL: INTERNAL_SERVICE_SECRET environment variable is required in production")?;
            let lowered = internal_service_secret.to_lowercase();
            let looks_placeholder = lowered.contains("replace")
                || lowered.contains("changeme")
                || lowered.contains("placeholder")
                || lowered.contains("example")
                || lowered.contains("your_");

            if internal_service_secret.trim().len() < 16 || looks_placeholder {
                anyhow::bail!(
                    "FATAL: INTERNAL_SERVICE_SECRET must be a non-placeholder value with at least 16 characters in production"
                );
            }
        }

        Ok(config)
    }

    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }
}
