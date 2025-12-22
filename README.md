# BeamLab Ultimate

A professional-grade structural engineering platform with AI-powered model generation.

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

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

## Environment Variables

See [.env.example](./.env.example) for all required environment variables.

## License

MIT
