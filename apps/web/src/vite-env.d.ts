/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    readonly VITE_API_URL?: string;
    readonly VITE_RUST_API_URL?: string;
    readonly VITE_PYTHON_API_URL?: string;
    readonly VITE_WEBSOCKET_URL?: string;
    readonly VITE_USE_CLERK?: string;
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_GEMINI_API_KEY?: string;
    readonly VITE_GEMINI_MODEL?: string;
    readonly VITE_GEMINI_TIMEOUT?: string;
    readonly VITE_PHONEPE_MERCHANT_ID?: string;
    readonly VITE_PHONEPE_ENV?: string;
    readonly VITE_DEBUG?: string;
    readonly VITE_ENABLE_WEBGPU?: string;
    readonly VITE_ENABLE_COLLABORATION?: string;
    readonly VITE_ENABLE_AI_FEATURES?: string;
    readonly VITE_SOURCE_MAPS?: string;
    readonly VITE_MAX_WORKERS?: string;
    readonly VITE_API_TIMEOUT?: string;
    readonly VITE_PREFER_GEMINI?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
