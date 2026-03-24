# 02 — Frontend Information Architecture and Routing Specification

_Last updated: 24 March 2026_

## 1. Frontend architecture summary

Frontend is a React + Vite SPA with:

- central route registry in `apps/web/src/App.tsx`
- domain route modules in `apps/web/src/app/routes/*`
- auth gating via `RequireAuth`
- shell decision via `ConditionalLayout`
- route metadata taxonomy in `apps/web/src/config/appRouteMeta.ts`

## 2. Shell behavior contract

| Condition | Render mode |
|---|---|
| public route | plain content (no AppShell) |
| full-screen route (`/app`, `/workspace/*`) | plain/full-screen content |
| authenticated + non-public | `AppShell` wrapper |
| auth loading | route loading state |

## 3. Top-level route domains

### Public domain

- `/`
- `/pricing`
- `/blog`
- `/capabilities`
- `/privacy-policy`, `/terms-of-service`, `/terms-and-conditions`, `/refund-cancellation`
- `/help`, `/about`, `/contact`, `/support`
- `/learning`, `/sitemap`

### Auth/account domain

- `/sign-in/*`, `/sign-up/*`
- `/forgot-password`, `/reset-password`
- `/account-locked`, `/link-expired`, `/verify-email`
- `/auth/callback/:provider`
- authenticated pages: `/profile`, `/notifications`, `/settings`

### Workspace domain

- `/stream` (unified dashboard)
- `/app` (main modeler)
- `/workspace/:moduleType`
- `/demo` (gated/redirect logic via payment test mode)

## 4. Analysis route map

Defined in `AnalysisRoutes.tsx`:

- `/analysis/modal`
- `/analysis/time-history`
- `/analysis/seismic`
- `/analysis/buckling`
- `/analysis/cable`
- `/analysis/pdelta`
- `/analysis/nonlinear`
- `/analysis/dynamic`
- `/analysis/pushover`
- `/analysis/plate-shell`

Routing behavior: redirects into workflow targets using `buildAnalysisWorkflowTarget(...)`.

## 5. Design route map

Defined in `DesignRoutes.tsx`:

- `/design/tools`
- `/design/steel`
- `/design/connections`
- `/design/reinforcement`
- `/design/detailing`
- `/design/concrete`
- `/design/foundation`
- `/design/geotechnical`
- `/design/composite`
- `/design/timber`
- `/design-center`
- `/design-hub`
- `/design/advanced-structures`
- `/design/moving-load`
- `/design/torsion`
- `/design/retaining-wall`
- `/design/staircase`

## 6. Feature/tools/integration route map

Defined in `FeatureRoutes.tsx`:

- tools: `/tools/load-combinations`, `/tools/section-database`, `/tools/bar-bending`, `/tools/advanced-meshing`, `/tools/print-export`
- reports/vis: `/reports/builder`, `/reports/professional`, `/visualization`, `/visualization/3d-engine`, `/visualization/result-animation`
- integration: `/bim`, `/bim/export-enhanced`, `/cad/integration`, `/integrations/api-dashboard`
- enterprise: `/collaboration`, `/cloud-storage`, `/digital-twin`
- data/compliance: `/materials/database`, `/compliance/checker`
- planning: `/space-planning`, `/space-planning/landing`, `/room-planner`
- AI/civil: `/ai-architect`, `/civil-hub`

## 7. Cross-cutting frontend providers and hooks

| Layer | Key modules |
|---|---|
| bootstrapping | `main.tsx`, `AppInitializer.tsx` |
| auth/session | `AuthProvider`, `useUserRegistration`, `useDeviceSession` |
| analytics/error | `AnalyticsProvider`, `ErrorBoundary`, global error hook |
| state integration | `initializeIntegration()` + Zustand stores |
| route UX | `RouteLoadingState`, `ScrollToTop`, `RouteMetaTags` |

## 8. Frontend → backend integration contract

- Node API base from `API_CONFIG.baseUrl`
- Python API base from `API_CONFIG.pythonUrl`
- Rust API base from `API_CONFIG.rustUrl`
- Production env validation enforces HTTPS and non-localhost for production builds

## 9. IA acceptance criteria

1. Every path in route modules is represented in feature taxonomy.
2. Protected pages must remain wrapped with `RequireAuth`.
3. Public/legal/auth flows remain accessible without app shell.
4. `/app` and `/workspace/*` remain full-screen optimized routes.
5. Route changes must update route map documentation and metadata.
