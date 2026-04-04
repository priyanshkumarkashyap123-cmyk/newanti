#!/bin/bash
set -e

echo "Building WASM package..."
wasm-pack build --target web --out-dir ./pkg --release

echo "Build complete. Output in apps/backend-rust/pkg"
