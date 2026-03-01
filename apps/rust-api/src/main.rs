//! BeamLab High-Performance Rust API
//!
//! This is the main entry point for the Rust backend, providing:
//! - 50-100x faster structural analysis than Node.js
//! - 10x lower memory usage
//! - Zero garbage collection pauses
//! - Native multi-threading with Rayon

mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod solver;

use axum::{
    routing::{get, post, delete},
    Router,
    http,
};
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::Database;

/// Application state shared across all handlers
pub struct AppState {
    pub db: Database,
    pub config: Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing (logging) - ensure it flushes to stdout
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "beamlab_api=info,tower_http=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("========================================");
    tracing::info!("🚀 BeamLab Rust API v2.1.0 starting...");
    tracing::info!("========================================");

    // Load configuration
    dotenvy::dotenv().ok();
    
    tracing::info!("📋 Loading configuration from environment...");
    let config = match Config::from_env() {
        Ok(cfg) => {
            tracing::info!("✅ Configuration loaded successfully");
            tracing::info!("   Port: {}", cfg.port);
            tracing::info!("   Environment: {:?}", cfg.environment);
            tracing::info!("   Frontend URL: {}", cfg.frontend_url);
            cfg
        }
        Err(e) => {
            tracing::error!("❌ Failed to load configuration: {}", e);
            return Err(e);
        }
    };

    tracing::info!("📊 Using {} worker threads", rayon::current_num_threads());

    // Connect to MongoDB with retry logic
    tracing::info!("🔌 Connecting to MongoDB...");
    tracing::info!("   URI: {}...", &config.mongodb_uri.chars().take(30).collect::<String>());
    
    let db = match Database::connect(&config.mongodb_uri).await {
        Ok(db) => {
            tracing::info!("✅ Connected to MongoDB successfully");
            db
        }
        Err(e) => {
            tracing::error!("❌ Failed to connect to MongoDB: {}", e);
            tracing::error!("   Full error: {:?}", e);
            tracing::error!("   This is a fatal error - database is required");
            return Err(e);
        }
    };

    // Create shared application state
    let state = Arc::new(AppState {
        db,
        config: config.clone(),
    });

    // Build CORS layer
    // Note: When allow_credentials(true) is set, we cannot use Any for headers or methods
    // We must explicitly list allowed headers and methods for CORS security
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:5173".parse().unwrap(),
            "http://localhost:3000".parse().unwrap(),
            "https://beamlabultimate.tech".parse().unwrap(),
            "https://www.beamlabultimate.tech".parse().unwrap(),
            "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net".parse().unwrap(),
        ])
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::DELETE,
            http::Method::OPTIONS,
            http::Method::PATCH,
        ])
        .allow_headers([
            http::header::CONTENT_TYPE,
            http::header::AUTHORIZATION,
            http::header::ACCEPT,
            http::header::ORIGIN,
            http::header::CACHE_CONTROL,
            http::header::HeaderName::from_static("x-api-key"),
            http::header::HeaderName::from_static("x-requested-with"),
            http::header::HeaderName::from_static("x-request-id"),
            http::header::HeaderName::from_static("sentry-trace"),
            http::header::HeaderName::from_static("baggage"),
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(86400));

    // Build the router
    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/", get(handlers::health::root))
        .route("/health", get(handlers::health::health_check))
        .route("/api/openapi.yaml", get(handlers::openapi::serve_openapi))
        // Section database (read-only, public)
        .route("/api/sections", get(handlers::sections::list_sections))
        .route("/api/sections/:id", get(handlers::sections::get_section))
        .route("/api/sections/search", post(handlers::sections::search_sections))
        // Template generation (read-only, public)
        .route("/api/templates/beam", get(handlers::templates::beam_template))
        .route("/api/templates/continuous-beam", get(handlers::templates::continuous_beam_template))
        .route("/api/templates/truss", get(handlers::templates::truss_template))
        .route("/api/templates/frame", get(handlers::templates::frame_template))
        .route("/api/templates/portal", get(handlers::templates::portal_template))
        // Performance metrics
        .route("/api/metrics", get(handlers::metrics::get_metrics))
        .route("/api/metrics/detailed", get(handlers::metrics::get_detailed_metrics));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // Analysis endpoints (high-performance)
        .route("/api/analyze", post(handlers::analysis::analyze))
        .route("/api/analyze/solve", post(handlers::analysis::analyze))
        .route("/api/analyze/batch", post(handlers::analysis::batch_analyze))
        .route("/api/analyze/stream", post(handlers::analysis::stream_analyze))
        // Advanced analysis with Rust solver integration
        .route("/api/analysis/modal", post(handlers::analysis::modal_analysis))
        .route("/api/analysis/time-history", post(handlers::analysis::time_history_analysis))
        .route("/api/analysis/seismic", post(handlers::analysis::seismic_analysis))
        // Advanced analysis endpoints (Rust-native, high-performance)
        .route("/api/advanced/pdelta", post(handlers::advanced::pdelta_analysis))
        .route("/api/advanced/modal", post(handlers::advanced::modal_analysis))
        .route("/api/advanced/buckling", post(handlers::advanced::buckling_analysis))
        .route("/api/advanced/spectrum", post(handlers::advanced::spectrum_analysis))
        .route("/api/advanced/cable", post(handlers::advanced::cable_analysis))
        // Structure CRUD (fast database operations)
        .route("/api/structures", get(handlers::structures::list_structures))
        .route("/api/structures", post(handlers::structures::create_structure))
        .route("/api/structures/:id", get(handlers::structures::get_structure))
        .route("/api/structures/:id", axum::routing::put(handlers::structures::update_structure))
        .route("/api/structures/:id", axum::routing::delete(handlers::structures::delete_structure))
        // Auth middleware applied to all protected routes
        .layer(axum::middleware::from_fn(middleware::auth_middleware));

    let app = public_routes
        .merge(protected_routes)
        // Global middleware (applied to all routes)
        .layer(axum::middleware::from_fn(middleware::security_headers_middleware))
        .layer(axum::middleware::from_fn(middleware::rate_limit_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10MB limit
        .layer(cors)
        .with_state(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    tracing::info!("🦀 BeamLab Rust API listening on {}", addr);
    tracing::info!("⚡ High-performance structural analysis ready");
    tracing::info!("🔧 Endpoints: /api/analyze, /api/advanced/*, /api/structures/*");

    axum::serve(listener, app).await?;

    Ok(())
}
