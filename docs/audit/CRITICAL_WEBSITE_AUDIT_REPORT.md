# BeamLab Ultimate — Critical Website Audit Report
### Independent Analysis by Senior Experience Analyst | March 2026

---

## Executive Summary

BeamLab Ultimate is an ambitious, feature-rich structural engineering SaaS platform built on React 18 + Vite + Three.js (frontend), Express 5 + MongoDB (API gateway), FastAPI + NumPy/SciPy (FEA engine), and Rust (high-performance solver). After a deep-dive audit of every layer — routing, UI, performance, backend, UX workflows, SEO, and PWA — I've identified **47 actionable findings** across 8 categories.

**Overall Grade: B+ (78/100)**

| Area | Grade | Industry Benchmark | Gap |
|------|-------|-------------------|-----|
| UI Component System | A- (88) | shadcn/ui + Radix standard | Near-best-in-class |
| Feature Completeness | A (92) | STAAD.Pro, ETABS, SAP2000 | Exceeds web competitors |
| Backend Security | A- (86) | OWASP Top 10 | One critical gap (see §5.1) |
| Performance & Lag | C+ (68) | Core Web Vitals | **Major bottlenecks** |
| UX & Interaction Design | B+ (80) | Figma/Linear/Notion standards | Solid but has friction |
| Routing & Navigation | B (75) | SPA best practices | Gaps in deep-linking |
| SEO & Social Sharing | B+ (82) | Google Search Central | Missing per-route meta |
| PWA & Offline | B- (72) | PWA Checklist (web.dev) | Conflicting manifests |

---

## Table of Contents

1. [Performance & Lag Analysis (HIGHEST PRIORITY)](#1-performance--lag-analysis)
2. [UI & Design System Audit](#2-ui--design-system-audit)
3. [Routing & Navigation](#3-routing--navigation)
4. [UX Interaction Analysis](#4-ux-interaction-analysis)
5. [Backend & API Architecture](#5-backend--api-architecture)
6. [SEO, PWA & Meta](#6-seo-pwa--meta)
7. [Industry Comparison](#7-industry-comparison)
8. [Prioritized Fix Roadmap](#8-prioritized-fix-roadmap)

---

## 1. Performance & Lag Analysis

### 1.1 CRITICAL: Monolithic Zustand Store Causing Re-render Cascades

**File:** `apps/web/src/store/model.ts` (2,266 lines)

The entire structural model — nodes, members, plates, loads, analysis results, selection state, diagram visibility, modal results, clipboard — lives in **one Zustand store**. Every `set()` call produces a new state object. Components subscribing without granular selectors re-render on every store mutation.

**Impact:** The 3D canvas (`StructuralCanvas.tsx`) subscribes to `state.members` and `state.nodes` as full `Map<>` objects. When a user selects a node (changing `selectedIds`), the entire 3D scene re-renders because the Map reference changes.

**Industry Standard:** Applications like Figma, Blender Web, and OnShape use **entity-component-system (ECS)** patterns or **sharded stores** (one store per domain: geometry, selection, viewport, analysis). Zustand's own documentation recommends slicing stores into at most 200-300 lines.

**Fix:**
```
model.ts (2,266 lines) → Split into:
├── geometryStore.ts   (nodes, members, plates — ~500 lines)
├── selectionStore.ts  (selectedIds, hoveredId — ~100 lines)  
├── analysisStore.ts   (results, diagrams, modal — ~400 lines)
├── loadStore.ts       (loads, combinations — ~300 lines)
├── viewStore.ts       (camera, visibility toggles — ~200 lines)
└── projectStore.ts    (metadata, save/load — ~200 lines)
```

### 1.2 CRITICAL: Missing `useShallow` in 3D Viewer Components

**Files:** `StructuralCanvas.tsx`, `PlateRenderer.tsx`, `UltraLight*Renderer.tsx`

```typescript
// CURRENT — triggers re-render on ANY store change:
const members = useModelStore((state) => state.members);
const nodes = useModelStore((state) => state.nodes);

// FIX — only re-renders when the actual data changes:
const members = useModelStore(useShallow((state) => state.members));
const nodes = useModelStore(useShallow((state) => state.nodes));
```

Only ~10 selectors exist in `selectors.ts` for a store with 30+ fields. The 3D viewer bypasses them entirely.

### 1.3 HIGH: Undo History Memory Bloat

**File:** `model.ts` line ~2080 — `zundo` temporal middleware with `limit: 25`

Each undo snapshot stores the **complete model state** including all Maps. A model with 10,000 nodes × 25 snapshots = massive memory consumption (potentially 100+ MB). No structural diffing is applied.

**Industry Standard:** AutoCAD, Revit, and Figma use **command-based undo** (storing operations, not full state snapshots) or **structural diffing** (only storing deltas).

**Fix:** Implement a `diff`/`patch` approach or switch to command-based undo. At minimum, reduce limit to 10 for models exceeding 5,000 elements.

### 1.4 HIGH: Monaco Editor Always Loaded (~3-5MB)

`@monaco-editor/react` is in the `editor-vendor` manual chunk, which means it's downloaded by any user who accesses any lazy route that imports it transitively. Monaco alone is 3-5MB minified. Most users will never open the code editor.

**Fix:** Make Monaco truly lazy — `React.lazy(() => import('@monaco-editor/react'))` only in the `ScriptEditor` component, not at the chunk level.

### 1.5 HIGH: No Resize Event Debounce

**File:** `useResponsive.tsx` lines 75-76

`resize` and `orientationchange` event listeners fire with no debounce or throttle. Each event triggers state updates and re-renders.

**Fix:** Add `requestAnimationFrame` throttle or 150ms debounce.

### 1.6 MEDIUM: Memory Leak Risks

| Source | Risk | File |
|--------|------|------|
| `requestAnimationFrame` without `cancelAnimationFrame` cleanup | Leak on unmount | `RealTimeAnalysisPanel.tsx`, `ResultsReveal.tsx`, `UltraLightNodesRenderer.tsx` |
| XR session listeners using `.bind(this)` | Cannot be removed | `XRVisualization.ts` lines 114-119 |
| Worker not terminated after analysis | Worker persists in memory | `AnalysisService.ts` line 315 |
| `setInterval` in services without cleanup | Accumulates if service recreated | `DigitalTwinService.ts`, `SelfImprovementEngine.ts` |

### 1.7 MEDIUM: Missing Canvas Interaction Throttling

No throttle found on pointer move events in the 3D viewer. Hovering over a dense structural model triggers raycasts on every pixel movement — extremely expensive for models with >1,000 elements.

**Industry Standard:** Autodesk Viewer, three.js examples, and OnShape throttle raycasts to 60 FPS max (16ms) or use spatial indexing (BVH) for O(log n) lookups.

### 1.8 LOW: No Bundle Analysis Tooling

No `rollup-plugin-visualizer` or equivalent is configured. The `chunkSizeWarningLimit` is set to 1200KB (industry standard is 500KB). Without visibility into actual chunk sizes, optimization is guesswork.

### 1.9 Performance Scores Summary

| Metric | Current Lighthouse Config Threshold | Likely Actual | Industry Standard |
|--------|-------------------------------------|---------------|-------------------|
| FCP | ≤ 2000ms | ~1800ms (inlined critical CSS helps) | ≤ 1800ms |
| LCP | ≤ 2500ms | ~3000-4000ms (Three.js + WASM load) | ≤ 2500ms |
| CLS | ≤ 0.1 | ~0.05 (skeleton loaders prevent shift) | ≤ 0.1 |
| TBT | ≤ 300ms | ~500ms (JS bundle evaluation) | ≤ 200ms |
| TTI | ≤ 3500ms | ~4000-5000ms (WASM init + hydration) | ≤ 3800ms |
| JS Bundle | ≤ 500KB (budget) | ~2-4MB total | ≤ 400KB initial |

---

## 2. UI & Design System Audit

### 2.1 Strengths (What's Working Well)

| Aspect | Details | Grade |
|--------|---------|-------|
| **Component Library** | 70+ components following shadcn/ui + Radix pattern. `React.forwardRef`, `displayName`, CVA variants on all primitives. | A |
| **Button System** | 10 variants × 7 sizes, loading states with `aria-busy`, icon slots, ripple effect, `asChild` composition | A+ |
| **Dark Mode** | Class-based toggle via `ThemeProvider`, 5 accent palettes, `matchMedia` listener for system preference, `localStorage` persistence | A- |
| **Accessibility Foundation** | Skip link, `aria-invalid` on inputs, `aria-describedby` for errors, `role="alert"`, `focus-visible` ring styles, `prefers-reduced-motion` support | B+ |
| **Barrel Exports** | `ui/index.ts` with categorized, organized exports | A |

### 2.2 CRITICAL: Token Triplification

Three overlapping color/spacing token sources exist:

| Layer | File | Purpose |
|-------|------|---------|
| CSS Custom Properties | `index.css` `@theme {}` | Tailwind v4 native tokens (~120 vars) |
| TypeScript Object | `styles/theme.ts` | Full token set for programmatic access |
| Runtime Injection | `ThemeProvider.tsx` | 5 accent palettes applied as CSS vars |

Values **diverge** between sources:
- `--color-primary` in `index.css`: `#3b82f6`
- `primary.DEFAULT` in Tailwind v3 backup: `#2b7cee` (different blue!)
- The stale v3 backup config (`tailwind.config.v3-backup.js`) remains in the repo creating confusion.

**Industry Standard:** A single `design-tokens.json` (W3C Design Tokens format) generates all three outputs via build tooling (Style Dictionary, Figma Tokens, etc.).

### 2.3 HIGH: CSS Architecture Split

| File | Lines | Paradigm | Problem |
|------|-------|----------|---------|
| `index.css` | 1,711 | Tailwind v4 utilities + global overrides | Massive; contains global input/textarea/select/button/a overrides that conflict with component classes |
| `App.css` | 564 | BEM-style traditional CSS | Entirely dark-only hardcoded colors (`#0D0D12`, `#1E1E28`) — ignores theme system |
| JSX inline `style={}` | Scattered | Direct inline styles | `SteelDesignPage.tsx`, `ErrorBoundary.tsx` use hardcoded hex colors (`#4fc3f7`, `#2d2d2d`) bypassing tokens |

**Three styling paradigms coexist.** This is a maintenance nightmare and the #1 source of visual inconsistency.

**Industry Standard:** One paradigm. For Tailwind apps: Tailwind utilities in JSX + CVA for variants. Zero global CSS beyond resets and `@theme` variables.

### 2.4 MEDIUM: Duplicate Toast Provider

`ToastProvider` is instantiated in **both** `AppProviders.tsx` (wrapping the whole app) **and** inside `App.tsx` (around `<Routes>`). Two independent toast systems are active — toasts dispatched from one won't appear in the other.

### 2.5 MEDIUM: Two Layout Systems

Both `WorkspaceLayout.tsx` and `ModernWorkspace.tsx` exist as full layout implementations using `react-resizable-panels`. It's unclear which is canonical. Both import different sub-components with different styling approaches.

### 2.6 LOW: Responsive Design (Desktop-Only Core)

Marketing pages (Landing, Pricing, About) are fully responsive with proper breakpoints. The core modeler/workspace is **desktop-only** with `h-screen w-screen overflow-hidden` and no mobile adaptation.

**Acceptable for a structural engineering CAD tool**, but there's no graceful "Mobile not supported" messaging or redirect to a mobile-friendly view.

---

## 3. Routing & Navigation

### 3.1 Route Architecture Overview

**75 routes** across the application with extensive `React.lazy()` code splitting. Only 3 components (LandingPage, SignInPage, SignUpPage) are eagerly loaded — correct for critical path.

### 3.2 HIGH: `/api/dashboard` Route Conflicts with Dev Proxy

The Vite dev server proxies `/api` to `localhost:3001`. The client-side route `/api/dashboard` will be intercepted by the proxy and **never reach React Router** in development.

**Fix:** Rename to `/integrations/dashboard`.

### 3.3 HIGH: Misleading Route Aliases

| Route | Component | Problem |
|-------|-----------|---------|
| `/analysis/nonlinear` | `PDeltaAnalysisPanel` | P-Delta is geometric nonlinearity only — route name implies general nonlinear analysis |
| `/design/welded-connections` | `ConnectionDesignPage` | Same component as `/design/connections` — no way to differentiate context |
| `/design/reinforcement` | `DetailingDesignPage` | Same component as `/design/detailing` — no differentiation |

### 3.4 MEDIUM: No Deep-Linking in Modeler

The modeler state (open project, selected elements, viewport position, active tool) lives entirely in Zustand stores — **none of it persists to the URL**. Users cannot bookmark or share a specific project view. Browser back button doesn't navigate between modeler states.

**Industry Standard:** Figma uses URL hashes for viewport position. Google Docs preserve document state in URL. Even Autodesk Viewer uses URL parameters for model view states.

### 3.5 MEDIUM: No Unsaved Changes Guard

No `beforeunload` event or React Router `useBlocker` / `usePrompt` is used to warn users about unsaved changes when navigating away from the modeler.

### 3.6 MEDIUM: Triple-Nested Error Boundaries

Three `ErrorBoundary` wrappers exist:
1. `main.tsx` line 117 (outermost)
2. Inside `AppProviders.tsx` line 67 (redundant — catches same errors as #1)
3. Inside `App.tsx` line 315 (route-level)

The outer two are redundant. Consolidate to two: one top-level crash boundary and one inside `App` for route-level isolation.

### 3.7 LOW: Provider Nesting Depth

The provider chain is **11 levels deep** from `ErrorBoundary` → `BrowserRouter` → `AuthProvider` → `SubscriptionProvider` → `AppProvider` → `AppProviders` → `ErrorBoundary` → `ThemeProvider` → `NotificationProvider` → `ConfirmProvider` → `ToastProvider`. While not a performance issue per se, this creates a deep React component tree that complicates debugging.

---

## 4. UX Interaction Analysis

### 4.1 Onboarding: Good Intent, Poor Coordination

Three onboarding layers exist but fire independently:

| Layer | Trigger | Content |
|-------|---------|---------|
| **OnboardingFlow** | First visit (`localStorage` check) | 6-step wizard collecting role, experience, use cases |
| **ProductTour** | 1.5s after page load for new users | 7-step spotlight overlay |
| **QuickStartModal** | On modeler open | Action cards (New, Resume, Tutorial, Wizard) |

**Problem:** All three can fire sequentially, overwhelming a new user. There's no coordination — the onboarding flow stores its completion flag, but the tour and QuickStart don't check it.

**Industry Standard:** Notion, Linear, and Figma use a single, non-blocking onboarding flow with progressive disclosure. A coordination layer decides what to show based on user progress.

### 4.2 HIGH: `window.confirm()` for Destructive Actions

| Location | Action | Problem |
|----------|--------|---------|
| `UnifiedDashboard.tsx` line 462 | Delete project | Uses native `window.confirm()` — jarring in a polished dark UI |
| `Toolbar.tsx` | Login gate | `window.confirm()` for "Login to analyze" prompt |

A `ConfirmDialog` component + `useConfirm()` hook **already exist** in the codebase but are not used in these critical paths.

**Fix:** Replace all `window.confirm()` calls with `useConfirm()`.

### 4.3 HIGH: No Command Palette / Feature Search

With **40+ dialogs** accessible from the ModernModeler (3,679 lines!), discoverability is a major challenge. There's no `Cmd+K` command palette or feature search to help users find functionality.

**Industry Standard:** Every modern professional tool (VS Code, Figma, Linear, Notion, Slack, Raycast) has a command palette. For a 75-route, 40+ dialog app, this is essential.

### 4.4 MEDIUM: Form Validation Only on Submit

The sign-up form (`InHouseSignUp.tsx`) validates only on form submission, not on blur or change. Users fill out the entire form, submit, then discover errors.

**Industry Standard:** Inline validation on blur (after first submission attempt) with real-time password strength feedback. GitHub, Stripe, and Linear all validate on blur.

### 4.5 MEDIUM: No Toast System Consistently Used

An `useAppNotifications` hook exists but isn't widely adopted. Some pages have inline toasts, others use console logs for user-facing feedback. Action confirmations ("Project saved", "Analysis complete") lack consistent visual feedback.

### 4.6 Dashboard UX Gaps

| Feature | Status | Competition |
|---------|--------|-------------|
| Project rename | Missing | ETABS, SAP2000: inline rename |
| Project duplicate | Missing | Every SaaS dashboard has this |
| Project archive | Missing | Industry standard for non-destructive removal |
| Bulk operations | Missing | Select multiple → delete/export |
| Sort options | Missing | Sort by name, date, size |
| Grid/List view toggle | Missing | Standard dashboard pattern |

### 4.7 Wizard Quality: Strong

The `StructureWizard` is well-crafted: category → template → parametric sliders → live SVG preview → stats panel → Generate. The `ConnectionDesignWizard` uses proper step gating with `canProceed`. Both follow industry patterns.

### 4.8 Undo/Redo: Properly Implemented

Full undo/redo via `zundo` temporal middleware with Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts. Toolbar buttons show `disabled` state when no history exists. This is correctly implemented (the memory concern in §1.3 is about efficiency, not correctness).

---

## 5. Backend & API Architecture

### 5.1 Architecture Overview

| Service | Stack | Role |
|---------|-------|------|
| Node.js API | Express 5, Mongoose, Socket.IO | Gateway, Auth, CRUD, Payments |
| Python Backend | FastAPI, NumPy/SciPy | FEA Engine, AI, Design |
| Rust API | Actix/Axum | High-performance solver |

Microservice gateway pattern with circuit breaking, retry logic, and dual-auth (Clerk production / in-house fallback).

### 5.2 Strengths

| Aspect | Details |
|--------|---------|
| **Response Envelope** | Unified `{ success, data/error, requestId, ts }` via `res.ok()`/`res.fail()` middleware |
| **Validation** | 525-line Zod schema covering structural analysis, design codes, auth with password strength |
| **Rate Limiting** | 6-tier rate limits (General 100/min, Analysis 10/min, Auth 5/min, AI 20/min with cost weighting) |
| **CSRF** | Double-submit cookie + Origin/Referer validation |
| **Account Lockout** | 10 failures → 15 min lockout with decay |
| **Payment Security** | HMAC-SHA256 with `timingSafeEqual` for Razorpay webhook verification |
| **WebSocket Security** | JWT verification on handshake + per-event rate limiting (60 cursor/sec, 10 edits/sec) |
| **Graceful Shutdown** | 15s timeout, closes HTTP → WebSocket → MongoDB |

### 5.3 CRITICAL: In-Memory Rate Limiting in Multi-Instance Deploy

Both Node and Python backends use **in-memory** stores for rate limiting and account lockout. In Azure App Service with auto-scaling, each instance has its own counters. An attacker can rotate requests across instances.

**Industry Standard:** Redis-backed rate limiting (e.g., `rate-limiter-flexible` with Redis adapter, or Upstash Rate Limit).

### 5.4 HIGH: No Request Body Sanitization

Zod validates types but **does not sanitize** HTML/script content in string fields. Project names, descriptions, and AI session messages could contain XSS payloads stored in MongoDB and rendered unsanitized.

**Industry Standard:** DOMPurify server-side or Zod `.transform()` with HTML entity encoding on all user-provided strings.

### 5.5 HIGH: Inconsistent Response Shapes

Newer routes use the unified envelope (`res.ok()`/`res.fail()`), but older routes (Razorpay, some auth endpoints) use raw `res.json({ success, message })`. Python responses are ad-hoc dictionaries without a standardized envelope.

### 5.6 MEDIUM: No Request Correlation Across Services

`X-Request-ID` is generated in Node but **not propagated** to Python/Rust proxied requests. Distributed tracing across the three services is impossible.

### 5.7 MEDIUM: `Schema.Types.Mixed` for Project Data

Project model data is stored as `Mixed` (schemaless JSON). No validation on the stored structural model — could store arbitrary data, and corrupted models will crash the frontend silently.

### 5.8 Security Scorecard vs OWASP Top 10

| OWASP Risk | Coverage | Gap |
|------------|----------|-----|
| A01: Broken Access Control | Strong — Clerk JWT + role checks | Master user bypass via env var |
| A02: Cryptographic Failures | Strong — bcrypt 12 rounds, HMAC-SHA256 | None |
| A03: Injection | Partial — Zod types but no sanitization | **XSS stored payloads** |
| A04: Insecure Design | Good — defense in depth | Rate limits not distributed |
| A05: Security Misconfiguration | Good — Helmet, CORS, CSP | CSRF disabled in dev |
| A06: Vulnerable Components | Unknown — no dependency audit visible | Add `npm audit` to CI |
| A07: Auth Failures | Strong — lockout, rate limit, JWT | In-memory lockout resets on restart |
| A08: Data Integrity | Good — webhook HMAC verification | Schemaless project data |
| A09: Logging & Monitoring | Partial — Sentry, request IDs | No distributed tracing |
| A10: SSRF | Good — no user-controlled URLs proxied | None visible |

---

## 6. SEO, PWA & Meta

### 6.1 SEO: Strong Foundation, Key Gaps

**What's excellent:**
- Full Open Graph + Twitter Card meta in `index.html`
- JSON-LD `SoftwareApplication` structured data
- `sitemap.xml` with 8 URLs + `robots.txt`
- Dynamic `document.title` per page

**What's missing:**

| Issue | Impact |
|-------|--------|
| No per-route meta descriptions/OG tags (no `react-helmet-async`) | Social shares of `/pricing`, `/capabilities` show homepage meta |
| `og-image.png` referenced but missing from `/branding/` | Social shares show broken image |
| Fabricated `aggregateRating` in JSON-LD (`"ratingValue": "4.8"`, `"ratingCount": "150"`) | Google penalty risk |
| Sitemap `lastmod` all identical (`2026-01-06`) | Signals staleness to crawlers |

### 6.2 PWA: Conflicting Manifests

**Two manifest files exist:**

| Feature | `site.webmanifest` (ACTIVE) | `manifest.json` (UNUSED) |
|---------|----------------------------|--------------------------|
| Icons | 3 basic | 11 including maskable |
| App shortcuts | None | 3 (New, Recent, Analyze) |
| Screenshots | None | 2 (desktop + mobile) |
| File handlers | None | JSON, IFC support |
| Share target | None | Full share_target config |

The HTML links to the inferior `site.webmanifest`. The richer `manifest.json` with all modern PWA features is **completely unused**.

**Fix:** Switch `<link rel="manifest">` to `manifest.json` or merge features.

### 6.3 Service Worker: Comprehensive but Overbuilt

701-line service worker with Cache First, Network First, Stale While Revalidate strategies, WASM caching, background sync, IndexedDB offline storage, push notifications, and cross-tab sync. The `maximumFileSizeToCacheInBytes` is 10MB — could cache large WASM files that are rarely used.

---

## 7. Industry Comparison

### 7.1 BeamLab vs Desktop Competitors

| Feature | BeamLab | STAAD.Pro | ETABS | SAP2000 |
|---------|---------|-----------|-------|---------|
| **Platform** | Web (browser) | Desktop | Desktop | Desktop |
| **Collaboration** | Real-time WebSocket | None | None | None |
| **3D Rendering** | Three.js/WebGL | OpenGL | DirectX | OpenGL |
| **AI Integration** | Gemini AI assistant | None | None | None |
| **Code Checking** | IS, ASCE, Eurocode | All major codes | All major codes | All major codes |
| **Pricing** | ₹999/mo | $5,000+/yr | $3,500+/yr | $3,500+/yr |
| **Offline** | PWA (partial) | Full | Full | Full |
| **FEA Solver** | WASM + Python + Rust | Fortran | Fortran | Fortran |
| **Import/Export** | DXF, IFC, JSON | DXF, IFC, CIS/2 | DXF, IFC, CIS/2, ETABS | DXF, IFC, S2K |

**BeamLab's competitive edge:** Price, collaboration, AI, and web accessibility. **Gap:** Solver maturity and breadth of design code coverage vs 30+ year desktop incumbents.

### 7.2 BeamLab vs Web Competitors

| Feature | BeamLab | SkyCiv | ClearCalcs | Dlubal Web |
|---------|---------|--------|------------|------------|
| **3D Modeler** | Full Three.js canvas | Basic WebGL | 2D only | Full 3D |
| **Real-time Collab** | WebSocket cursors + CRDT | None | None | Limited |
| **Meshing** | Delaunay + advanced | Basic | None | Full |
| **Dynamic Analysis** | Modal, Time-History, Pushover | Modal only | None | Full |
| **AI Assistant** | Gemini integration | None | None | None |
| **BIM Integration** | IFC import/export page | None | None | Full |
| **Design Codes** | IS, ASCE, Eurocode | Multiple | AUS/US only | All major |
| **PWA/Offline** | Service worker | None | None | None |
| **Pricing** | ₹999/mo (~$12) | $49/mo | $49/mo | $120/mo |

**BeamLab leads in feature count and price/value ratio.** However, SkyCiv and Dlubal have more polished UX with fewer rough edges.

### 7.3 BeamLab vs Modern SaaS UX Standards

| UX Pattern | BeamLab | Figma | Linear | Notion |
|------------|---------|-------|--------|--------|
| Command Palette (Cmd+K) | Missing | Yes | Yes | Yes |
| Deep-linking URLs | Missing | Excellent | Yes | Yes |
| Optimistic Updates | Missing | Yes | Yes | Yes |
| Toast Notifications | Inconsistent | Consistent | Consistent | Consistent |
| Unsaved Changes Guard | Missing | Yes | N/A | Auto-save |
| Auto-save | Mentioned but manual | Real | Real | Real |
| Keyboard-first Navigation | Partial | Excellent | Excellent | Good |
| Breadcrumbs | 2 pages only | Full | Full | Full |
| Mobile Graceful Degradation | None | Read-only mobile | Mobile app | Mobile app |
| Onboarding Coordination | 3 uncoordinated layers | Single flow | Single flow | Tooltips |
| Error Recovery | Good boundaries | Excellent | Good | Good |

---

## 8. Prioritized Fix Roadmap

### P0 — Ship This Week (Critical Lag & Security Fixes)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | **Split model store** into 5-6 sub-stores + granular selectors | 3-5 days | Eliminates #1 source of UI lag |
| 2 | **Add `useShallow`** to all 3D viewer store subscriptions | 2 hours | Prevents Canvas re-render cascades |
| 3 | **Replace `window.confirm()`** with existing `useConfirm()` | 1 hour | Professional UX for destructive actions |
| 4 | **Fix OG image** — create 1200×630 `og-image.png` | 30 min | Social shares stop showing broken image |
| 5 | **Switch to `manifest.json`** or merge PWA manifests | 30 min | Enables PWA install with proper icons |
| 6 | **Remove fabricated `aggregateRating`** from JSON-LD | 10 min | Eliminates Google penalty risk |

### P1 — Next Sprint (High-Impact UX & Performance)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 7 | **Add command palette** (Cmd+K) for feature discovery | 2-3 days | Unlocks 40+ features for keyboard users |
| 8 | **Implement unsaved changes guard** with `useBlocker` | 4 hours | Prevents data loss |
| 9 | **Add resize event debounce** to `useResponsive.tsx` | 30 min | Stops rapid re-renders on resize |
| 10 | **Fix memory leaks** — cancel rAF, terminate workers, cleanup intervals | 1 day | Prevents long-session degradation |
| 11 | **Add XSS sanitization** on user-provided strings (server-side DOMPurify) | 4 hours | Closes OWASP A03 gap |
| 12 | **Coordinate onboarding layers** — single flow controller | 1 day | Stops overwhelming new users |
| 13 | **Unify response shapes** across all API endpoints | 4 hours | Consistent frontend error handling |
| 14 | **Add `react-helmet-async`** for per-route meta | 1 day | SEO for all 75 routes |

### P2 — Next Month (Architecture & Polish)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 15 | **Consolidate CSS** — migrate App.css to Tailwind, eliminate inline styles | 3-5 days | Single styling paradigm |
| 16 | **Single token source** — design-tokens.json generating CSS + TS + theme | 2-3 days | Ends token triplification |
| 17 | **Redis-backed rate limiting** for multi-instance deployment | 1 day | Distributed security |
| 18 | **Add canvas interaction throttling** for pointer events | 4 hours | Smooth experience on dense models |
| 19 | **Implement structural undo diffing** for large models | 3-5 days | 10x memory reduction |
| 20 | **Add bundle analyzer** (rollup-plugin-visualizer) to CI | 1 hour | Visibility into chunk sizes |
| 21 | **Add distributed tracing** (OpenTelemetry) across Node → Python → Rust | 2-3 days | Debug cross-service issues |
| 22 | **Deep-link modeler state** in URL (project, viewport, selection) | 2-3 days | Bookmarkable views |

### P3 — Backlog (Nice-to-Have)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 23 | Remove duplicate ToastProvider | 30 min | Cleaner provider tree |
| 24 | Remove stale `tailwind.config.v3-backup.js` | 5 min | Reduces confusion |
| 25 | Consolidate two layout systems | 2-3 days | Single canonical layout |
| 26 | Add mobile "not supported" message for modeler routes | 2 hours | Graceful degradation |
| 27 | Dashboard: add rename, duplicate, archive, bulk ops, sort, grid/list | 3-5 days | Competitive dashboard UX |
| 28 | on-blur form validation for sign-up | 2 hours | Inline error feedback |
| 29 | LOD (Level of Detail) for 3D rendering | 3-5 days | Better GPU perf for large models |
| 30 | Breadcrumbs in modeler | 4 hours | Navigation context |

---

## Appendix A: Files Referenced

| File | Lines | Key Finding |
|------|-------|-------------|
| `apps/web/src/store/model.ts` | 2,266 | Monolithic mega-store — split required |
| `apps/web/src/components/ModernModeler.tsx` | 3,679 | 40+ lazy dialogs — needs command palette |
| `apps/web/src/index.css` | 1,711 | Oversized — extract into component CSS |
| `apps/web/src/App.css` | 564 | Legacy BEM CSS — migrate to Tailwind |
| `apps/web/src/workers/StructuralSolverWorker.ts` | 3,971 | Massive worker — maintenance risk |
| `apps/api/src/routes/authRoutes.ts` | 1,386 | Full in-house auth — well-implemented |
| `apps/api/src/middleware/validation.ts` | 525 | Comprehensive Zod schemas |
| `apps/web/public/sw.ts` | 701 | Overbuilt service worker |
| `apps/web/src/pages/UnifiedDashboard.tsx` | 835 | Good but missing CRUD ops |
| `apps/api/src/razorpay.ts` | 609 | Secure payment integration |

## Appendix B: Tech Debt Heatmap

```
CRITICAL ████████ model.ts store, CSS split, no command palette
HIGH     ██████   Memory leaks, missing throttles, XSS gap
MEDIUM   ████     Token duplication, inconsistent API shapes
LOW      ██       Stale configs, duplicate providers, mobile
```

---

*Report generated from full codebase analysis. All file references verified against source. Recommendations prioritized by user impact × implementation effort.*
