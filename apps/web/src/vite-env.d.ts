/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    readonly VITE_API_URL?: string;
    readonly VITE_RUST_API_URL?: string;  // High-performance Rust API for analysis
    readonly VITE_PYTHON_API_URL?: string; // Python API for AI services
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
