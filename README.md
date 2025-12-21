# BeamLab Ultimate - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Installation
```bash
cd /Users/rakshittiwari/Desktop/newanti
pnpm install
```

### Development
```bash
pnpm dev
```

This starts:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## 📁 Project Structure

```
newanti/
├── apps/
│   ├── web/          # React + TypeScript + Three.js
│   └── api/          # Express + TypeScript + MongoDB
└── packages/         # Shared libraries (future)
```

---

## 🛠️ Common Commands

```bash
# Development
pnpm dev              # Start all apps
pnpm build            # Build all apps
pnpm lint             # Lint all code
pnpm type-check       # Check TypeScript

# Individual apps
cd apps/web && pnpm dev    # Frontend only
cd apps/api && pnpm dev    # Backend only
```

---

## 🎯 Key Features

- ✅ **TurboRepo** - Intelligent build caching
- ✅ **pnpm Workspaces** - Efficient package management
- ✅ **Strict TypeScript** - No `any` types allowed
- ✅ **Hot Reload** - Instant feedback
- ✅ **Path Aliases** - `@/` imports

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Workspace definition |
| `turbo.json` | Build pipeline |
| `apps/web/vite.config.ts` | Frontend build config |
| `apps/api/tsconfig.json` | Backend TypeScript config |

---

## 📚 Tech Stack

### Frontend
- React 18.3.1
- TypeScript 5.6.3
- Vite 5.4.21
- Three.js 0.170.0
- React Three Fiber 8.17.10

### Backend
- Node.js 22.20.0
- Express 4.22.1
- TypeScript 5.6.3
- MongoDB 6.10.0

---

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill processes on ports
lsof -ti:5173 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Clean install
```bash
rm -rf node_modules apps/*/node_modules
pnpm install
```

---

**Ready to build BeamLab Ultimate!** 🏗️
