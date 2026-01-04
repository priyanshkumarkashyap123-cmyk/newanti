# BHEEMLA ULTIMATE - Custom Domain Setup Guide

## 🌐 Your Custom Domain: Bheemla Ultimate

This guide configures your application to run on your custom domain instead of localhost.

---

## 1. Domain Configuration (Choose One Option)

### Option A: Local Development (Mac - Using /etc/hosts)

Add these lines to `/etc/hosts`:

```bash
sudo nano /etc/hosts

# Add these lines:
127.0.0.1    app.bheemla.local
127.0.0.1    api.bheemla.local
127.0.0.1    www.bheemla.local
::1          app.bheemla.local
::1          api.bheemla.local
::1          www.bheemla.local
```

**Command to do this:**
```bash
echo "127.0.0.1    app.bheemla.local" | sudo tee -a /etc/hosts
echo "127.0.0.1    api.bheemla.local" | sudo tee -a /etc/hosts
echo "127.0.0.1    www.bheemla.local" | sudo tee -a /etc/hosts
```

**Verify it worked:**
```bash
ping app.bheemla.local
ping api.bheemla.local
```

### Option B: Buy Actual Domain

Register a domain with:
- Namecheap
- GoDaddy
- Domain.com
- AWS Route 53

Example: `bheemla-ultimate.tech` or `beamlab-pro.dev`

Point DNS to your server/Azure App Service.

### Option C: Free Domain for Testing

Use services like:
- Ngrok (tunnel to localhost)
- Local.dev (local domains)
- Traefik (reverse proxy)

---

## 2. Environment Setup

### Create `.env.local` (Development)

```bash
# Frontend Environment
VITE_API_URL=http://api.bheemla.local:3001
VITE_PYTHON_API_URL=http://api.bheemla.local:3002
VITE_APP_NAME=Bheemla Ultimate
VITE_FRONTEND_URL=http://app.bheemla.local:5173

# App URLs
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY

# Backend URLs for frontend
VITE_WEBSOCKET_URL=ws://api.bheemla.local:3001
```

### Create `.env.local` for API (apps/api)

```bash
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
APP_NAME=Bheemla Ultimate API

# Frontend URLs (CORS)
FRONTEND_URL=http://app.bheemla.local:5173
ALLOWED_ORIGINS=http://app.bheemla.local:5173,http://www.bheemla.local:5173,http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/bheemla-ultimate

# API Keys
CLERK_SECRET_KEY=sk_test_YOUR_KEY
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY

# Python Backend
PYTHON_API_URL=http://api.bheemla.local:3002
```

### Create `.env.local` for Python Backend (apps/backend-python)

```bash
# Server
HOST=0.0.0.0
PORT=3002
APP_NAME=Bheemla Ultimate Python API

# Frontend
FRONTEND_URL=http://app.bheemla.local:5173
ALLOWED_ORIGINS=http://app.bheemla.local:5173,http://www.bheemla.local:5173,http://localhost:5173

# AI
GEMINI_API_KEY=AIzaXXX_YOUR_KEY
USE_MOCK_AI=true

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bheemla
```

---

## 3. Update Vite Configuration

Create `apps/web/vite.config.domain.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }],
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'app.bheemla.local',
    port: 5173,
    strictPort: false,
    hmr: {
      host: 'app.bheemla.local',
      port: 5173,
      protocol: 'http',
    },
    proxy: {
      '/api': {
        target: 'http://api.bheemla.local:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://api.bheemla.local:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

---

## 4. Update Server Configurations

### For Node.js API (apps/api/src/index.ts)

```typescript
import express from 'express';
import cors from 'cors';

const app = express();

// CORS for custom domain
const allowedOrigins = [
  'http://app.bheemla.local:5173',
  'http://www.bheemla.local:5173',
  'https://bheemla-ultimate.tech',
  'https://www.bheemla-ultimate.tech',
  process.env.FRONTEND_URL,
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Bheemla Ultimate API running on http://api.bheemla.local:${PORT}`);
});
```

---

## 5. Start Servers with Domain

### Development Servers with Domain

```bash
# Terminal 1: Frontend (on app.bheemla.local:5173)
cd apps/web
npm run dev -- --host app.bheemla.local

# Terminal 2: API (on api.bheemla.local:3001)
cd apps/api
npm run dev -- --host api.bheemla.local

# Terminal 3: Python Backend (on api.bheemla.local:3002)
cd apps/backend-python
python -m uvicorn main:app --host 0.0.0.0 --port 3002 --reload
```

### Or use Docker Compose for All Services

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    container_name: bheemla-frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://api.bheemla.local:3001
      - VITE_PYTHON_API_URL=http://api.bheemla.local:3002
    depends_on:
      - api
    networks:
      - bheemla-network

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: bheemla-api
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - HOST=0.0.0.0
      - FRONTEND_URL=http://app.bheemla.local:5173
      - MONGODB_URI=mongodb://mongo:27017/bheemla-ultimate
    depends_on:
      - mongo
    networks:
      - bheemla-network

  python-api:
    build:
      context: ./apps/backend-python
      dockerfile: Dockerfile
    container_name: bheemla-python-api
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - FRONTEND_URL=http://app.bheemla.local:5173
    networks:
      - bheemla-network

  mongo:
    image: mongo:latest
    container_name: bheemla-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - bheemla-network

volumes:
  mongo_data:

networks:
  bheemla-network:
    driver: bridge
```

Start with:
```bash
docker-compose up -d
```

---

## 6. Access Your Application

### Local Development (Option A):
- **Frontend**: http://app.bheemla.local:5173
- **API**: http://api.bheemla.local:3001
- **Python API**: http://api.bheemla.local:3002
- **MongoDB**: mongodb://localhost:27017

### Production (Option B):
- **Frontend**: https://www.bheemla-ultimate.tech
- **API**: https://api.bheemla-ultimate.tech
- **Python API**: https://python-api.bheemla-ultimate.tech

---

## 7. Testing Your Domain Setup

### Test Frontend Access
```bash
curl -I http://app.bheemla.local:5173
# Should return HTTP/1.1 200 OK
```

### Test API Access
```bash
curl -I http://api.bheemla.local:3001/health
# Should return JSON response
```

### Test in Browser
```
http://app.bheemla.local:5173
```

---

## 8. Advanced: Reverse Proxy Setup (Traefik)

For production-like testing with all domains on one machine, use Traefik:

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - bheemla-network

  frontend:
    build: ./apps/web
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.bheemla.local`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=5173"
    networks:
      - bheemla-network

  api:
    build: ./apps/api
    environment:
      - PORT=3001
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.bheemla.local`)"
      - "traefik.http.services.api.loadbalancer.server.port=3001"
    networks:
      - bheemla-network

networks:
  bheemla-network:
```

Start:
```bash
docker-compose up -d
```

Then add to `/etc/hosts`:
```
127.0.0.1    app.bheemla.local
127.0.0.1    api.bheemla.local
```

Access:
- Frontend: http://app.bheemla.local
- API: http://api.bheemla.local
- Traefik Dashboard: http://localhost:8080

---

## 9. Production Deployment

For Azure deployment with custom domain:

1. **Purchase Domain** (e.g., bheemla-ultimate.tech)
2. **Configure DNS**:
   - Point A record to Azure Static Web Apps IP
   - Point CNAME for API to Container Apps domain
3. **Azure Configuration**:
   ```
   Frontend:
   - Custom domain: www.bheemla-ultimate.tech
   - HTTPS: Enabled
   
   API:
   - Container Apps domain
   - Custom domain: api.bheemla-ultimate.tech
   ```

4. **Update Environment Variables** in Azure:
   ```
   VITE_API_URL=https://api.bheemla-ultimate.tech
   VITE_FRONTEND_URL=https://www.bheemla-ultimate.tech
   FRONTEND_URL=https://www.bheemla-ultimate.tech
   ```

---

## 10. Troubleshooting

### Domain Not Resolving
```bash
# Check /etc/hosts
cat /etc/hosts | grep bheemla

# Flush DNS cache (Mac)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

### CORS Errors
- Check `ALLOWED_ORIGINS` in .env
- Ensure frontend URL matches exactly (including port)
- Check API CORS configuration

### Can't Connect to API
```bash
# Test API connectivity
curl -v http://api.bheemla.local:3001/health

# Check if API server is running
lsof -i :3001
```

### Hot Reload Not Working
- Check Vite HMR configuration
- Verify hostname in vite.config.ts
- Clear browser cache (Cmd+Shift+R)

---

## 11. Quick Commands

```bash
# Start all servers with domain
pnpm dev -- --host app.bheemla.local

# Test domains resolve
ping app.bheemla.local
ping api.bheemla.local

# Check what's listening
lsof -i -P -n | grep LISTEN

# Flush DNS (Mac)
sudo dscacheutil -flushcache

# View /etc/hosts
cat /etc/hosts

# Stop all servers
pkill -f "node\|python" 
```

---

## Summary

You now have **Bheemla Ultimate** configured to run on your custom domain:
- **Frontend**: app.bheemla.local (or www.bheemla-ultimate.tech)
- **API**: api.bheemla.local (or api.bheemla-ultimate.tech)
- **Python API**: api.bheemla.local:3002 (or python-api.bheemla-ultimate.tech)

No more localhost! 🚀

---

*Last Updated: 2026-01-04*
*Environment: Development & Production Ready*
