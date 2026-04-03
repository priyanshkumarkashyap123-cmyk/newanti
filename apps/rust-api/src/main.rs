//! BeamLab High-Performance Rust API
//!
//! This is the main entry point for the Rust backend, providing:
//! - 50-100x faster structural analysis than Node.js
//! - 10x lower memory usage
//! - Zero garbage collection pauses
//! - Native multi-threading with Rayon

mod cache;
mod config;
mod db;
mod design_codes;
mod error;
mod handlers;
mod middleware;
mod models;
mod optimization;
mod solver;

use axum::{
    http,
    routing::{delete, get, post},
    Router,
};
use rayon::ThreadPoolBuilder;
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer, cors::CorsLayer, limit::RequestBodyLimitLayer, trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::cache::AnalysisCache;
use crate::config::Config;
use crate::db::Database;
use crate::handlers::health::{health_check, health_dependencies, health_ready, root};

/// Application state shared across all handlers
pub struct AppState {
    pub db: Database,
    pub config: Config,
    pub analysis_cache: AnalysisCache,
}

fn parse_positive_usize_env(name: &str) -> Option<usize> {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|v| *v > 0)
}

fn is_truthy_env(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false)
}

async fn v1_path_rewrite_middleware(
    mut request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    if !is_truthy_env("ENABLE_V1_ROUTES") {
        return next.run(request).await;
    }

    let original_path = request.uri().path();
    let rewritten_path = if original_path == "/api/v1" {
        Some("/api".to_string())
    } else if original_path.starts_with("/api/v1/") {
        Some(original_path.replacen("/api/v1/", "/api/", 1))
    } else {
        None
    };

    if let Some(path) = rewritten_path {
        let query = request
            .uri()
            .query()
            .map(|q| format!("?{}", q))
            .unwrap_or_default();
        let rewritten = format!("{}{}", path, query);
        if let Ok(uri) = rewritten.parse::<http::Uri>() {
            *request.uri_mut() = uri;
        }
    }

    next.run(request).await
}

/// Configure Rayon global thread pool once at process startup.
///
/// Priority:
/// 1) `RAYON_NUM_THREADS` env var
/// 2) host available parallelism
fn configure_rayon_pool() -> usize {
    let host_parallelism = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let desired_threads = parse_positive_usize_env("RAYON_NUM_THREADS")
        .unwrap_or(host_parallelism)
        .max(1);

    match ThreadPoolBuilder::new()
        .num_threads(desired_threads)
        .build_global()
    {
        Ok(_) => {
            tracing::info!(
                desired_threads,
                host_parallelism,
                "Configured Rayon global thread pool"
            );
        }
        Err(e) => {
            tracing::warn!(
                error = %e,
                current_threads = rayon::current_num_threads(),
                "Rayon pool already initialized; reusing existing pool"
            );
        }
    }

    rayon::current_num_threads()
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing (logging) - JSON in production, human-readable in dev
    let is_prod = std::env::var("RUST_ENV").unwrap_or_default() == "production"
        || std::env::var("NODE_ENV").unwrap_or_default() == "production";

    let fmt_layer = tracing_subscriber::fmt::layer();
    let env_filter = tracing_subscriber::EnvFilter::new(
        std::env::var("RUST_LOG").unwrap_or_else(|_| "beamlab_api=info,tower_http=info".into()),
    );

    if is_prod {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt_layer.json())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt_layer)
            .init();
    }

    tracing::info!("========================================");
    tracing::info!("🚀 BeamLab Rust API v2.1.0 starting...");
    tracing::info!("========================================");

    // Load configuration
    dotenvy::dotenv().ok();

    let host_parallelism = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let tokio_workers_env = parse_positive_usize_env("TOKIO_WORKER_THREADS");
    let rayon_workers_env = parse_positive_usize_env("RAYON_NUM_THREADS");

    tracing::info!(
        host_parallelism,
        tokio_workers_env = tokio_workers_env.unwrap_or(host_parallelism),
        rayon_workers_env = rayon_workers_env.unwrap_or(host_parallelism),
        "Runtime concurrency configuration"
    );

    let effective_rayon_threads = configure_rayon_pool();

    // ── Sentry Error Monitoring ──────────────────────────────────────────
    let _sentry_guard = match std::env::var("SENTRY_DSN") {
        Ok(dsn) if !dsn.is_empty() => {
            let guard = sentry::init((
                dsn,
                sentry::ClientOptions {
                    release: Some("beamlab-rust-api@2.1.0".into()),
                    environment: Some(
                        std::env::var("ENVIRONMENT")
                            .unwrap_or_else(|_| "development".into())
                            .into(),
                    ),
                    traces_sample_rate: 0.2,
                    ..Default::default()
                },
            ));
            tracing::info!("Sentry initialized for Rust backend");
            Some(guard)
        }
        _ => {
            tracing::info!("SENTRY_DSN not set — Sentry disabled");
            None
        }
    };

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

    tracing::info!(
        "📊 Runtime thread summary: host={} tokio_configured={} rayon_effective={}",
        host_parallelism,
        tokio_workers_env.unwrap_or(host_parallelism),
        effective_rayon_threads
    );

    // Connect to MongoDB with retry logic
    tracing::info!("🔌 Connecting to MongoDB...");
    tracing::info!(
        "   URI: {}...",
        &config.mongodb_uri.chars().take(30).collect::<String>()
    );

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
        analysis_cache: AnalysisCache::default_analysis(),
    });

    tracing::info!("🗄️  Analysis result cache initialized (256 entries, 10min TTL)");

    // Build CORS layer
    // Note: When allow_credentials(true) is set, we cannot use Any for headers or methods
    // We must explicitly list allowed headers and methods for CORS security
    
    // Parse CORS origins from config
    let cors_origin_headers: Vec<http::HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|origin| http::HeaderValue::from_str(origin).ok())
        .collect();
    let cors_allow_origin = tower_http::cors::AllowOrigin::list(cors_origin_headers);

    let cors = CorsLayer::new()
        .allow_origin(cors_allow_origin)
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
    // 
    // Versioning Phases (see ADR-009: API Versioning Strategy & Deprecation Protocol):
    // Phase 1 (Current): All routes are unversioned (e.g., /api/analyze, /api/design/*)
    //                    Deprecated via HTTP Deprecation headers with 6-month Sunset window
    // Phase 2 (Weeks 5–12): Routes also mounted under /api/v1/* prefix (e.g., /api/v1/analyze)
    //                       Both paths remain active during deprecation window
    // Phase 3 (June 30):   Unversioned routes removed; only /api/v1/* paths remain
    //
    // To enable Phase 2, set environment variable ENABLE_V1_ROUTES=true
    // During Phase 2, both paths coexist for backward compatibility
    //
    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/health/ready", get(handlers::health::health_ready))
        .route(
            "/health/dependencies",
            get(handlers::health::health_dependencies),
        )
        .route("/api/openapi.yaml", get(handlers::openapi::serve_openapi))
        // Section database (read-only, public)
        .route("/api/sections", get(handlers::sections::list_sections))
        .route(
            "/api/sections/search",
            get(handlers::sections::search_sections_get).post(handlers::sections::search_sections),
        )
        .route("/api/sections/:id", get(handlers::sections::get_section))
        // Template generation (read-only, public)
        .route(
            "/api/templates/beam",
            get(handlers::templates::beam_template),
        )
        .route(
            "/api/templates/continuous-beam",
            get(handlers::templates::continuous_beam_template),
        )
        .route(
            "/api/templates/truss",
            get(handlers::templates::truss_template),
        )
        .route(
            "/api/templates/frame",
            get(handlers::templates::frame_template),
        )
        .route(
            "/api/templates/portal",
            get(handlers::templates::portal_template),
        )
        // Performance metrics
        .route("/api/metrics", get(handlers::metrics::get_metrics))
        .route(
            "/api/metrics/detailed",
            get(handlers::metrics::get_detailed_metrics),
        );

    // Protected routes (auth required)
    let protected_routes = Router::new()
        // Analysis endpoints (high-performance)
        .route("/api/analyze", post(handlers::analysis::analyze))
        .route("/api/analyze/solve", post(handlers::analysis::analyze))
        .route(
            "/api/analyze/batch",
            post(handlers::analysis::batch_analyze),
        )
        .route(
            "/api/analyze/stream",
            post(handlers::analysis::stream_analyze),
        )
        // Advanced analysis with Rust solver integration
        .route(
            "/api/analysis/modal",
            post(handlers::analysis::modal_analysis),
        )
        .route(
            "/api/analysis/time-history",
            post(handlers::analysis::time_history_analysis),
        )
        .route(
            "/api/analysis/seismic",
            post(handlers::analysis::seismic_analysis),
        )
        // Advanced analysis endpoints (Rust-native, high-performance)
        .route(
            "/api/advanced/pdelta",
            post(handlers::advanced::pdelta_analysis),
        )
        .route(
            "/api/advanced/modal",
            post(handlers::advanced::modal_analysis),
        )
        .route(
            "/api/advanced/buckling",
            post(handlers::advanced::buckling_analysis),
        )
        .route(
            "/api/advanced/spectrum",
            post(handlers::advanced::spectrum_analysis),
        )
        .route(
            "/api/advanced/cable",
            post(handlers::advanced::cable_analysis),
        )
        // Rigorous solver mechanics (Staged Construction, DAM, Nonlinear, Mass Source)
        .route(
            "/api/advanced/staged-construction",
            post(handlers::advanced::staged_construction_analysis),
        )
        .route("/api/advanced/dam", post(handlers::advanced::dam_analysis))
        .route(
            "/api/advanced/nonlinear",
            post(handlers::advanced::nonlinear_solve),
        )
        .route(
            "/api/advanced/mass-source",
            post(handlers::advanced::mass_source_analysis),
        )
        // Dynamic & Advanced Loading Engines (Wind Tunnel, Influence Surface, Spectrum Directional)
        .route(
            "/api/advanced/wind-tunnel",
            post(handlers::advanced::wind_tunnel_analysis),
        )
        .route(
            "/api/advanced/influence-surface",
            post(handlers::advanced::influence_surface_analysis),
        )
        .route(
            "/api/advanced/spectrum-directional",
            post(handlers::advanced::spectrum_directional_analysis),
        )
        // Design, Optimization & Detailing Engines
        .route(
            "/api/advanced/auto-design",
            post(handlers::advanced::auto_design_optimization),
        )
        .route(
            "/api/advanced/cracked-section",
            post(handlers::advanced::cracked_section_analysis),
        )
        .route(
            "/api/advanced/floor-walking",
            post(handlers::advanced::floor_walking_vibration),
        )
        .route(
            "/api/advanced/rebar-detailing",
            post(handlers::advanced::rebar_detailing_analysis),
        )
        // Report generation endpoints (production-ready calculation reports)
        .route(
            "/api/reports/analysis",
            post(handlers::report::generate_analysis_report),
        )
        .route(
            "/api/reports/design",
            post(handlers::report::generate_design_report),
        )
        // Structure CRUD (fast database operations)
        .route(
            "/api/structures",
            get(handlers::structures::list_structures),
        )
        .route(
            "/api/structures",
            post(handlers::structures::create_structure),
        )
        .route(
            "/api/structures/:id",
            get(handlers::structures::get_structure),
        )
        .route(
            "/api/structures/:id",
            axum::routing::put(handlers::structures::update_structure),
        )
        .route(
            "/api/structures/:id",
            axum::routing::delete(handlers::structures::delete_structure),
        )
        // Design code checks (IS 456 / IS 800 / IS 1893 / IS 875 / Serviceability)
        .route(
            "/api/design/is456/flexural-capacity",
            post(handlers::design::flexural_capacity),
        )
        .route(
            "/api/design/is456/shear",
            post(handlers::design::shear_design),
        )
        .route(
            "/api/design/is456/biaxial-column",
            post(handlers::design::biaxial_column),
        )
        .route(
            "/api/design/is456/deflection",
            post(handlers::design::deflection_check_is456),
        )
        .route(
            "/api/design/is800/bolt-bearing",
            post(handlers::design::bolt_bearing),
        )
        .route(
            "/api/design/is800/bolt-hsfg",
            post(handlers::design::bolt_hsfg),
        )
        .route(
            "/api/design/is800/fillet-weld",
            post(handlers::design::fillet_weld),
        )
        .route(
            "/api/design/is800/auto-select",
            post(handlers::design::auto_select),
        )
        .route(
            "/api/design/is1893/base-shear",
            post(handlers::design::base_shear),
        )
        .route(
            "/api/design/is1893/eq-forces",
            post(handlers::design::eq_forces),
        )
        .route(
            "/api/design/is1893/drift",
            post(handlers::design::drift_check),
        )
        .route(
            "/api/design/is875/wind-per-storey",
            post(handlers::design::wind_per_storey),
        )
        .route(
            "/api/design/is875/pressure-coefficients",
            post(handlers::design::pressure_coefficients),
        )
        .route(
            "/api/design/is875/live-load",
            post(handlers::design::live_load),
        )
        .route(
            "/api/design/is875/live-load-reduction",
            post(handlers::design::live_load_reduction),
        )
        .route(
            "/api/design/geotech/spt-correlation",
            post(handlers::design::spt_correlation),
        )
        .route(
            "/api/design/geotech/slope/infinite",
            post(handlers::design::infinite_slope_stability),
        )
        .route(
            "/api/design/geotech/foundation/bearing-capacity",
            post(handlers::design::bearing_capacity_strip),
        )
        .route(
            "/api/design/geotech/retaining-wall/stability",
            post(handlers::design::retaining_wall_stability),
        )
        .route(
            "/api/design/geotech/settlement/consolidation",
            post(handlers::design::consolidation_settlement),
        )
        .route(
            "/api/design/geotech/liquefaction/screening",
            post(handlers::design::liquefaction_screening),
        )
        .route(
            "/api/design/geotech/foundation/pile-axial-capacity",
            post(handlers::design::pile_axial_capacity),
        )
        .route(
            "/api/design/geotech/earth-pressure/rankine",
            post(handlers::design::rankine_earth_pressure),
        )
        .route(
            "/api/design/geotech/earth-pressure/seismic",
            post(handlers::design::seismic_earth_pressure),
        )
        .route(
            "/api/design/serviceability/deflection",
            post(handlers::design::deflection_check),
        )
        .route(
            "/api/design/serviceability/vibration",
            post(handlers::design::vibration_check),
        )
        .route(
            "/api/design/serviceability/crack-width",
            post(handlers::design::crack_width),
        )
        // Batch processing (Phase 6 enterprise feature)
        .route("/api/design/batch", post(handlers::design::batch_design))
        // Section-wise beam design
        .route(
            "/api/design/section-wise/rc",
            post(handlers::design::section_wise_rc),
        )
        .route(
            "/api/design/section-wise/steel",
            post(handlers::design::section_wise_steel),
        )
        .route(
            "/api/design/section-wise/from-analysis",
            post(handlers::design::section_wise_from_analysis),
        )
        // International design codes
        .route(
            "/api/design/aisc360/bending",
            post(handlers::design::aisc_bending),
        )
        .route(
            "/api/design/ec3/bending",
            post(handlers::design::ec3_bending),
        )
        .route("/api/design/ec3/shear", post(handlers::design::ec3_shear))
        .route(
            "/api/design/ec2/bending",
            post(handlers::design::ec2_bending),
        )
        .route("/api/design/ec2/shear", post(handlers::design::ec2_shear))
        .route(
            "/api/design/aci318/bending",
            post(handlers::design::aci_bending),
        )
        .route(
            "/api/design/aci318/shear",
            post(handlers::design::aci_shear),
        )
        .route(
            "/api/design/nds2018/bending",
            post(handlers::design::nds_bending),
        )
        // Composite & detailing
        .route(
            "/api/design/composite-beam",
            post(handlers::design::composite_beam_design),
        )
        .route(
            "/api/design/base-plate",
            post(handlers::design::base_plate_design),
        )
        .route(
            "/api/design/ductile-detailing",
            post(handlers::design::ductile_detailing_check),
        )
        // New design code endpoints (Phase 5)
        .route(
            "/api/design/is456/torsion",
            post(handlers::design::torsion_design),
        )
        .route(
            "/api/design/aisc360/compression",
            post(handlers::design::aisc_compression),
        )
        .route(
            "/api/design/aisc360/shear",
            post(handlers::design::aisc_shear),
        )
        .route(
            "/api/design/aisc360/interaction",
            post(handlers::design::aisc_interaction),
        )
        .route(
            "/api/design/aci318/column",
            post(handlers::design::aci_column),
        )
        .route(
            "/api/design/aci318/development-length",
            post(handlers::design::aci_development_length),
        )
        .route(
            "/api/design/ec2/crack-width",
            post(handlers::design::ec2_crack_width),
        )
        .route(
            "/api/design/ec2/punching-shear",
            post(handlers::design::ec2_punching_shear),
        )
        .route(
            "/api/design/ec3/column-buckling",
            post(handlers::design::ec3_column_buckling),
        )
        .route(
            "/api/design/ec3/interaction",
            post(handlers::design::ec3_interaction),
        )
        // Section databases
        .route("/api/sections/aisc", get(handlers::design::aisc_sections))
        .route("/api/sections/ec3", get(handlers::design::ec3_sections))
        // Structural Optimization (FSD Engine)
        .route(
            "/api/optimization/fsd",
            post(handlers::optimization::fsd_optimize),
        )
        .route(
            "/api/optimization/check-member",
            post(handlers::optimization::check_member_endpoint),
        )
        .route(
            "/api/optimization/auto-select",
            post(handlers::optimization::auto_select_section),
        )
        .route(
            "/api/optimization/quick",
            post(handlers::optimization::quick_optimize),
        )
        .route(
            "/api/optimization/info",
            get(handlers::optimization::optimization_info),
        )
        // Auth middleware applied to all protected routes
        .layer(axum::middleware::from_fn(middleware::auth_middleware));
    // ── Optimization endpoint ──

    let app = public_routes
        .merge(protected_routes)
        // Global middleware (applied to all routes)
        .layer(axum::middleware::from_fn(v1_path_rewrite_middleware))
        .layer(axum::middleware::from_fn(
            middleware::rate_limit::logging_middleware,
        ))
        .layer(axum::middleware::from_fn(
            middleware::security_headers_middleware,
        ))
        .layer(axum::middleware::from_fn(
            middleware::rate_limit::rate_limit_middleware,
        ))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(RequestBodyLimitLayer::new(5 * 1024 * 1024)) // 5MB limit
        .layer(cors)
        .with_state(state);

    // Phase 2 Versioning Implementation (Future):
    // To add /api/v1/* routes during Phase 2, nest the protected_routes:
    //   let v1_protected = protected_routes.clone()
    //       .route_layer(axum::routing::get(|State(state): State<Arc<AppState>>| async { ... }))
    //     Or use nest_service:
    //       Router::new()
    //         .nest("/api/v1", protected_routes.clone())
    //         .nest("/api", protected_routes)
    //         .merge(public_routes)
    // This mounts the same handlers under both paths, supporting Phase 2 deprecation window

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("🦀 BeamLab Rust API listening on {}", addr);
    tracing::info!("⚡ High-performance structural analysis ready");
    tracing::info!("🔧 Endpoints: /api/analyze, /api/advanced/*, /api/structures/*");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Rust API shut down gracefully");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to listen for ctrl+c");
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to listen for SIGTERM")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => tracing::info!("Received SIGINT"),
        _ = terminate => tracing::info!("Received SIGTERM"),
    }
}
