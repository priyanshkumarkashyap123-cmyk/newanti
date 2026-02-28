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

        let mongodb_uri = std::env::var("MONGODB_URI")
            .unwrap_or_else(|_| "mongodb://localhost:27017/beamlab".into());

        let jwt_secret = std::env::var("JWT_SECRET")
            .context("FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure defaults.")?;

        let frontend_url = std::env::var("FRONTEND_URL")
            .unwrap_or_else(|_| "http://localhost:5173".into());

        Ok(Config {
            port,
            mongodb_uri,
            jwt_secret,
            frontend_url,
            environment,
            max_nodes: 100_000,      // Support 100k nodes
            max_members: 500_000,    // Support 500k members
            analysis_timeout_secs: 300, // 5 minute timeout
        })
    }

    pub fn is_production(&self) -> bool {
        self.environment == Environment::Production
    }
}
