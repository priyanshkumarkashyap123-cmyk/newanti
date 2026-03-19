# Feature-Backend Traceability Matrix

**Purpose:** Verify that each frontend feature is correctly wired to its backend service and that the integration contract is validated.

**Last Updated:** 2026-03-18  
**Status:** Phase-1 Foundation

---

## Matrix Format

| Frontend Route | Component | Gateway Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|---|
| Route Path | Feature Component | API Path tested | Rust / Python / Node | Auth, Request Type, Response Type | ✅ Verified / 🔄 Pending |

---

## Analysis Features

| Frontend Route | Component | Gateway Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|---|
| `/analysis` | AnalysisRecipe | `POST /api/analyze` | Rust (primary) | POST + auth, returns `{jobId}` or immediate result | 🔄 Pending |
| `/analysis` | AnalysisResults | `GET /api/analyze/job/:jobId` | Node → MongoDB | GET + auth, polls async job state | 🔄 Pending |
| `/analysis` | AnalysisExplorer | `GET /api/analyze/capabilities` | Rust | GET + auth, returns available analysis types | 🔄 Pending |
| `/analysis/pdelta` | P-Delta Analysis | `POST /api/advanced/pdelta` | Rust | POST + auth + model, returns `{iterations, displacements}` | 🔄 Pending |
| `/analysis/modal` | Modal Analysis | `POST /api/advanced/modal` | Rust | POST + auth + model, returns `{frequencies, modes}` | 🔄 Pending |

## Design Features

| Frontend Route | Component | Gateway Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|---|
| `/design/concrete` | RC Beam Design | `POST /api/design/concrete/beam` | Rust (primary), Python (fallback) | POST + auth + section, returns `{passed, utilization, message}` | 🔄 Pending |
| `/design/steel` | Steel Design | `POST /api/design/steel/member` | Rust (primary), Python (fallback) | POST + auth + section, returns `{passed, utilization, message}` | 🔄 Pending |
| `/design/connection` | Connection Design | `POST /api/design/connection/bolt` | Rust (primary), Python (fallback) | POST + auth + props, returns `{passed, stress, shear}` | 🔄 Pending |
| `/design/foundation` | Foundation Design | `POST /api/design/foundation/footing` | Rust (primary), Python (fallback) | POST + auth + soil, returns `{safe_bearing, settlement}` | 🔄 Pending |

## Advanced Analysis Features

| Frontend Route | Component | Gateway Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|---|
| `/advanced/pdelta` | P-Delta Nonlinear | `POST /api/advanced/pdelta` | Rust | POST + auth, returns `{iterations, max_displacement, convergence}` | 🔄 Pending |
| `/advanced/modal` | Modal Analysis | `POST /api/advanced/modal` | Rust | POST + auth, returns `{frequencies, damping, modes}` | 🔄 Pending |
| `/advanced/spectrum` | Response Spectrum | `POST /api/advanced/spectrum` | Rust | POST + auth + spectrum, returns `{max_responses}` | 🔄 Pending |
| `/advanced/buckling` | Elastic Buckling | `POST /api/advanced/buckling` | Rust | POST + auth + model, returns `{eigenvalues, modes}` | 🔄 Pending |
| `/advanced/cable` | Cable Analysis | `POST /api/advanced/cable` | Rust | POST + auth + cable props, returns `{catenary, tensions}` | 🔄 Pending |

## AI/Reports Features

| Frontend Route | Component | Gateway Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|---|
| `/reports` | Report Generation | `POST /api/ai/report` | Python (FastAPI) | POST + auth + analysis, returns `{reportId}` + async job | 🔄 Pending |
| `/ai-design-aid` | AI Design Assistant | `POST /api/ai/design-assist` | Python (FastAPI) | POST + auth + prompt, returns `{suggestion, confidence}` | 🔄 Pending |
| `/ai-code-navigate` | Code Navigator | `POST /api/ai/code-navigate` | Python (FastAPI) | POST + auth + code, returns `{annotations, insights}` | 🔄 Pending |

## Layout/Mesh Features

| Frontend Route | Component | Gateway Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|---|
| `/layout/grid` | Grid Layout | `POST /api/layout/grid` | Python (FastAPI) | POST + auth + params, returns `{nodes, members}` | 🔄 Pending |
| `/mesh/auto` | Auto Mesh | `POST /api/mesh/auto` | Python (FastAPI) | POST + auth + geometry, returns `{mesh_id}` + async job | 🔄 Pending |

---

## Gateway Health & Auth

| Route | Endpoint | Backend Service | Contract | Status |
|---|---|---|---|---|
| Health / Dashboard | `GET /health` | Node (MongoDB check) | Returns `{status: "ok"}` or `{status: "degraded"}` | 🔄 Pending |
| Health / Dependencies | `GET /health/dependencies` | Node (queries all backends) | Returns `{rust: {status}, python: {status}}` | 🔄 Pending |
| CORS Preflight | `OPTIONS /api/*` | Node Middleware | Returns CORS headers, 204 | 🔄 Pending |
| Auth Required | All `/api/*` | Node Auth Middleware | 401 without token, 200/202/404 with token | 🔄 Pending |

---

## Validation Checklist

- [ ] **Routing**: Each frontend route reaches the correct gateway endpoint
- [ ] **Authentication**: Protected endpoints return 401 without token, correct response with token
- [ ] **CORS**: Preflight requests pass, frontend can make cross-origin requests
- [ ] **Response Contract**: Each endpoint returns expected JSON shape and status codes
- [ ] **Error Handling**: Invalid inputs return 400 + error message, not 500
- [ ] **Async Jobs**: Long-running operations return 202 + jobId, polling works
- [ ] **Fallback Routing**: Design endpoints try Rust first, fall back to Python on error
- [ ] **Rate Limiting**: Analysis endpoints respect cost-weight limits (5× for analysis, 10× for advanced)
- [ ] **Service Discovery**: Each backend reachable from gateway (Rust, Python, MongoDB)

---

## Notes for Verification Runs

### Phase-1 Verification (Blocked by `apply_patch` tool)
1. Run `./scripts/test-production-integration.sh staging <JWT_TOKEN>`
   - Pass JWT token from local auth OR generate test token from Clerk
   - Verify all ✅ status codes match expected values
   - Verify all ❌ are logged with exact mismatches

2. Run `./scripts/run-integration-audit.sh staging`
   - Combines readiness checks + integration tests
   - Outputs summary to `/tmp/beamlab-audit-staging-*`

### Production Verification (requires real credentials)
1. Authenticate to Azure: `az login`
2. Run `./scripts/test-production-integration.sh production <PROD_JWT_TOKEN>`
   - Tests live `https://beamlab-backend-node.azurewebsites.net`
   - Requires valid JWT signed by production key

### Adding New Routes
When a new frontend feature is added:
1. Add row to appropriate section of this matrix
2. Implement gateway route in `apps/api/src/routes/*/`
3. Proxy to correct backend (Rust/Python)
4. Run test and mark ✅ when verified

---

## Integration Roadmap

**✅ Completed (Foundational Layer)**
- Gateway proxy architecture (Node → Rust/Python)
- MongoDB persistence for async jobs
- Auth middleware (Clerk + JWT)
- Rate limiting + cost-weight tracking
- Health checks + dependency monitoring
- Error parsing + diagnosis

**🔄 In Progress (Phase-1)**
- Test script modernization (gateway-first, auth validation)
- Traceability matrix (this document)
- Audit orchestration script

**📋 TODO (Phase-2)**
- Automated verification runner (GitHub Actions)
- Deployment validation gates
- Performance baselines (API response times, throughput)
- Dashboard: real-time feature✓integration status

---

## Questions?
- **Route not in matrix?** Add it + open PR
- **Test failing?** Check logs in `/tmp/beamlab-audit-*/`
- **Contract mismatch?** Compare actual response vs expected in this matrix + update both
