# Rollback Strategy & Incident Playbook

> **Version**: 1.0  
> **Last Updated**: 2025-01  
> **Audience**: DevOps, Backend Engineers, On-call

---

## Table of Contents

1. [Overview](#overview)
2. [Rollback Decision Matrix](#rollback-decision-matrix)
3. [Frontend Rollback (Azure Static Web Apps)](#frontend-rollback)
4. [Node API Rollback (Azure App Service)](#node-api-rollback)
5. [Python API Rollback (Azure App Service)](#python-api-rollback)
6. [Rust API Rollback (Docker / Azure)](#rust-api-rollback)
7. [Database Rollback](#database-rollback)
8. [Docker Compose Rollback (Self-Hosted)](#docker-compose-rollback)
9. [DNS / CDN Rollback](#dns--cdn-rollback)
10. [Post-Incident Checklist](#post-incident-checklist)

---

## Overview

Every production deployment MUST be reversible within **5 minutes** for frontend and **10 minutes** for backend services.

**Golden Rule**: If you can't roll back, you can't ship.

### Deployment Topology

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Azure SWA  │────▶│  Node API   │────▶│  MongoDB    │
│  (Frontend) │     │  (Express)  │     │  (Atlas)    │
└─────────────┘     └─────────────┘     └─────────────┘
                    ┌─────────────┐
       ┌───────────▶│ Python API  │
       │            │  (FastAPI)  │
       │            └─────────────┘
       │            ┌─────────────┐
       └───────────▶│  Rust API   │
                    │  (Axum)     │
                    └─────────────┘
```

---

## Rollback Decision Matrix

| Symptom | Severity | Action | Target |
|---------|----------|--------|--------|
| White screen / SPA crash | P0 | Redeploy previous SWA build | Frontend |
| Auth failures (401/403 spike) | P0 | Roll back Node API | Node API |
| Analysis returns wrong results | P1 | Roll back Python API | Python API |
| 5xx error rate > 5% | P1 | Roll back affected service | Any |
| Performance regression > 2x p95 | P2 | Roll back + investigate | Any |
| Migration failure | P1 | `pnpm migrate:rollback` | Database |

---

## Frontend Rollback

Azure Static Web Apps maintains an environment per deployment.

### Option A: Re-deploy from GitHub (Recommended)

```bash
# 1. Find the last known good commit
git log --oneline -10

# 2. Revert to that commit on main
git revert HEAD --no-edit  # If single bad commit
git push origin main

# 3. GitHub Actions will auto-deploy the revert
# Monitor: https://github.com/YOUR_ORG/beamlab/actions
```

### Option B: Re-deploy via Azure CLI

```bash
# List recent deployments
az staticwebapp show -n brave-mushroom-0eae8ec00

# The Azure SWA GitHub Action keeps previous builds.
# Re-run the last successful workflow:
gh run rerun <RUN_ID>
```

### Option C: Rollback via CDN Cache

```bash
# Azure SWA uses global CDN. Purge cache if stale assets are served:
az cdn endpoint purge \
  --resource-group beamlab-rg \
  --profile-name beamlab-cdn \
  --name beamlab-endpoint \
  --content-paths "/*"
```

**Verification**:
```bash
curl -s https://beamlabultimate.tech | grep '"version"'
```

---

## Node API Rollback

### Azure App Service

```bash
# List recent deployments
az webapp deployment list -n beamlab-backend-node -g beamlab-rg --output table

# Swap back to previous deployment slot
az webapp deployment slot swap \
  -n beamlab-backend-node \
  -g beamlab-rg \
  --slot staging \
  --target-slot production

# Or redeploy a specific image tag
az webapp config container set \
  -n beamlab-backend-node \
  -g beamlab-rg \
  --docker-custom-image-name beamlab/api-node:v2.0.9  # previous version
```

### Docker Compose (Self-Hosted)

```bash
# 1. Update IMAGE_TAG in .env
echo "IMAGE_TAG=v2.0.9" >> .env

# 2. Pull and restart only the affected service
docker compose pull api-node
docker compose up -d api-node

# 3. Verify
curl -s http://localhost:3001/api/health | jq .
```

**Verification**:
```bash
curl -s https://beamlab-backend-node.azurewebsites.net/api/health
# Should return: { "status": "ok", "version": "2.0.9" }
```

---

## Python API Rollback

```bash
# Azure App Service
az webapp config container set \
  -n beamlab-backend-python \
  -g beamlab-rg \
  --docker-custom-image-name beamlab/backend-python:v2.0.9

# Docker Compose
docker compose pull backend-python
docker compose up -d backend-python

# Verify
curl -s https://beamlab-backend-python.azurewebsites.net/health
curl -s http://localhost:8000/docs  # OpenAPI should load
```

---

## Rust API Rollback

```bash
# Azure
az webapp config container set \
  -n beamlab-rust-api \
  -g beamlab-rg \
  --docker-custom-image-name beamlab/rust-api:v2.0.9

# Docker Compose
docker compose pull rust-api
docker compose up -d rust-api

# Verify
curl -s http://localhost:8080/api/health
```

---

## Database Rollback

### Migration Rollback

```bash
# Check current status
cd apps/api
pnpm migrate:status

# Roll back the last migration
pnpm migrate:rollback

# For multiple rollbacks, run repeatedly:
pnpm migrate:rollback  # rolls back 1
pnpm migrate:rollback  # rolls back 2
```

### Data Rollback from Backup

If a migration corrupted data, restore from the mongo-backup sidecar:

```bash
# 1. List available backups
docker exec mongo-backup ls -la /backup/

# 2. Stop the API to prevent writes during restore
docker compose stop api-node backend-python rust-api

# 3. Restore from backup
docker exec mongo-backup mongorestore \
  --uri="mongodb://root:${MONGO_PASSWORD}@mongodb:27017" \
  --authenticationDatabase=admin \
  --drop \
  /backup/beamlab-2025-01-15_03-00-01/

# 4. Restart services
docker compose start api-node backend-python rust-api
```

### MongoDB Atlas Point-in-Time Recovery

If using Atlas, you can restore to any point in the last 24 hours:

```bash
# Via Atlas UI:
# 1. Go to Clusters → ... → Restore
# 2. Select "Point in Time"
# 3. Choose timestamp BEFORE the bad deployment
# 4. Restore to the same cluster (or a new one for safety)
```

---

## Docker Compose Rollback

For self-hosted deployments using `docker-compose.yml`:

```bash
# 1. Identify the problem service
docker compose logs --tail=100 api-node | grep -i error

# 2. Roll back to previous image
export IMAGE_TAG=v2.0.9
docker compose up -d api-node  # Only restarts the affected service

# 3. Full rollback (all services)
export IMAGE_TAG=v2.0.9
docker compose down
docker compose up -d

# 4. Nuclear option: rebuild everything
docker compose down -v  # WARNING: removes volumes!
docker compose build --no-cache
docker compose up -d
```

### Preserving Data During Rollback

```bash
# Always backup before destructive operations
docker exec mongodb mongodump --out=/data/backup-$(date +%F)

# Volumes are preserved across `docker compose down` (no -v flag)
docker compose down     # Safe: keeps volumes
docker compose down -v  # DANGEROUS: deletes all data volumes
```

---

## DNS / CDN Rollback

If a DNS change was made and needs reverting:

```bash
# Check current DNS records
dig beamlabultimate.tech +short
dig api.beamlabultimate.tech +short

# Revert in Azure DNS or your DNS provider
# TTL is typically 300s (5 min) — allow time for propagation

# Verify propagation
watch -n 10 'dig beamlabultimate.tech +short'
```

---

## Post-Incident Checklist

After every rollback, complete these steps:

- [ ] **Confirm rollback successful** — smoke test all endpoints
- [ ] **Notify team** in #engineering channel with:
  - What was deployed
  - What the symptom was
  - What was rolled back to
  - Who is investigating the root cause
- [ ] **Create incident ticket** with severity label
- [ ] **Preserve evidence** — save logs, error screenshots, APM traces
- [ ] **Root cause analysis** within 48 hours
  - What went wrong?
  - Why didn't tests catch it?
  - What will prevent recurrence?
- [ ] **Update this runbook** if any steps were wrong or missing
- [ ] **Add regression test** for the specific failure

### Incident Severity Levels

| Level | Response Time | Examples |
|-------|--------------|---------|
| P0 | Immediate | Full outage, auth broken, data loss |
| P1 | < 30 min | Major feature broken, error rate > 5% |
| P2 | < 4 hours | Performance degradation, minor feature broken |
| P3 | Next sprint | Cosmetic issues, non-critical bugs |

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | Check PagerDuty/Opsgenie | — |
| Backend Lead | @backend-lead | After 15 min no response |
| DevOps | @devops-team | Infrastructure issues |
| CTO | @cto | P0 lasting > 30 min |

---

*This document is a living runbook. Update it after every incident.*
