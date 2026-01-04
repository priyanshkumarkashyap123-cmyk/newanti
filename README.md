# BeamLab Ultimate

A professional-grade structural engineering platform with AI-powered model generation and advanced finite element analysis.

## 🎯 Key Features

### Advanced Structural Analysis
- ✅ **Triangular & Trapezoidal Loads**: Rigorous mathematical derivations with fixed-end force formulas
- ✅ **P-Delta Analysis**: Second-order effects with Newton-Raphson iteration
- ✅ **Buckling Analysis**: Eigenvalue-based stability analysis with Euler formula validation
- ✅ **High-Performance WASM Solver**: Rust-based solver compiled to WebAssembly
- ✅ **Professional-Grade Mathematics**: Validated against structural engineering textbooks

### AI-Powered Design
- 🤖 Natural language to structural model conversion
- 📊 Automated load case generation
- 🎨 Interactive 3D visualization with Three.js

## Tech Stack

- **Frontend**: React + Vite + Three.js
- **Node.js API**: Express + Clerk Auth + MongoDB
- **Python Engine**: FastAPI + Google Gemini AI
- **Auth**: Clerk
- **Database**: MongoDB Atlas
- **Hosting**: Microsoft Azure

## Project Structure

```
beamlab-ultimate/
├── apps/
│   ├── web/              # React Frontend (Vite)
│   ├── api/              # Node.js Backend (Express)
│   └── backend-python/   # Python Backend (FastAPI)
├── packages/             # Shared packages
├── .env.example          # Environment variables reference
└── DEPLOYMENT.md         # Deployment guide
```

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.9+
- pnpm or npm

### Setup

```bash
# Install dependencies
npm install

# Build WASM Solver (requires Rust)
cd packages/solver-wasm && wasm-pack build --target web

# Start frontend (from apps/web)
cd apps/web && npm run dev

# Start Node.js API (from apps/api)
cd apps/api && npm run dev

# Start Python Engine (from apps/backend-python)
cd apps/backend-python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8081
```

## 🔬 Advanced Structural Analysis

### Solver Capabilities

The integrated WASM-based solver provides:

1. **Direct Stiffness Method** - Classical FEM for 2D frames
2. **Advanced Load Types**:
   - Point loads (concentrated forces and moments)
   - Uniform distributed loads (UDL)
   - Triangular loads (linearly varying from w₁ to w₂)
   - Trapezoidal loads (general linear variation)

3. **Second-Order Analysis (P-Delta)**:
   - Captures geometric nonlinearity from axial loads
   - Newton-Raphson iteration for convergence
   - Amplification factors: λ = 1/(1-P/P_E)
   - Critical for tall buildings and slender structures

4. **Stability Analysis (Buckling)**:
   - Generalized eigenvalue problem: [K_e - λK_g]φ = 0
   - Critical load calculation: P_cr = λ × P_applied
   - Validation against Euler formula: P_cr = π²EI/L²
   - Multiple buckling modes

### Test and Validation

Run comprehensive test suite:
```bash
# Serve test file
python3 -m http.server 8000

# Navigate to http://localhost:8000/test_advanced_structural.html
```

**Test Cases**:
- ✅ Triangular load on cantilever beam
- ✅ Trapezoidal load equilibrium  
- ✅ P-Delta amplification factor validation
- ✅ Euler buckling load comparison
- ✅ Portal frame second-order analysis

### Documentation

- **[ADVANCED_STRUCTURAL_ANALYSIS.md](ADVANCED_STRUCTURAL_ANALYSIS.md)** - Complete mathematical theory with derivations
- **[ADVANCED_FEATURES_COMPLETE.md](ADVANCED_FEATURES_COMPLETE.md)** - Feature descriptions and usage examples
- **[ADVANCED_MATHEMATICS_COMPLETE.md](ADVANCED_MATHEMATICS_COMPLETE.md)** - In-depth mathematical concepts and algorithms
- **[test_advanced_structural.html](test_advanced_structural.html)** - Interactive test suite with validation
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

## Environment Variables

See [.env.example](./.env.example) for all required environment variables.

## License

MIT
