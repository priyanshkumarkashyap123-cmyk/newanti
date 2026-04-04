#!/bin/bash

# Build script for Civil Engineering Rust WASM module
# Compiles Rust code to WebAssembly with optimizations

set -e

echo "🦀 Building Civil Engineering WASM Module..."

# Navigate to the backend-rust directory
cd "$(dirname "$0")"

# Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    cargo install wasm-pack
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf pkg/

# Build for web target with optimizations
echo "🔨 Compiling to WebAssembly..."
wasm-pack build \
    --target web \
    --release \
    --out-dir pkg \
    --out-name civil_engineering \
    -- --features "console_error_panic_hook"

# Optimize WASM binary size
if command -v wasm-opt &> /dev/null; then
    echo "⚡ Optimizing WASM binary..."
    wasm-opt -Oz pkg/civil_engineering_bg.wasm -o pkg/civil_engineering_bg.wasm
fi

echo "📊 Build complete! Output in pkg/"
ls -lh pkg/

# Generate TypeScript type definitions summary
echo "
📝 TypeScript bindings generated:
   - pkg/civil_engineering.js
   - pkg/civil_engineering.d.ts
   - pkg/civil_engineering_bg.wasm

🚀 Usage in your web app:
   import init, * as CivilEng from './pkg/civil_engineering.js';
   
   await init();
   
   // Example: Frame analysis
   const frame = new CivilEng.WasmFrame2D();
   frame.add_node(0, 0);
   frame.add_node(6, 0);
   // ...
   const result = JSON.parse(frame.analyze());
"
