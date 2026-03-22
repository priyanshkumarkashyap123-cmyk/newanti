# Implementation Plan

- [x] 1. Stabilize global CSS rules (Phase 1 foundation)
  - Scope global link and native input styles to opt-in wrappers.
  - Remove root-level styling behavior that causes cross-page overrides.
  - Files: `apps/web/src/styles/components.css`

- [x] 2. Normalize shared shell wrapper (Phase 1 foundation)
  - Replace `h-screen` shell root with dynamic viewport-safe height.
  - Use token classes at shell root (`bg-canvas`, `text-token`).
  - Files: `apps/web/src/layouts/AppShell.tsx`

- [ ] 3. Migrate high-traffic page palettes (Phase 2)
  - `apps/web/src/pages/UnifiedDashboard.tsx`
  - `apps/web/src/pages/Dashboard.tsx`
  - `apps/web/src/pages/SettingsPage.tsx`
  - `apps/web/src/pages/SettingsPageEnhanced.tsx`

- [ ] 4. Reduce hardcoded color debt in shared layouts
  - `apps/web/src/layouts/WorkspaceLayout.tsx`
  - `apps/web/src/layouts/ModernWorkspace.tsx`

- [ ] 5. Add guardrails and migration checks
  - Search-based threshold checks for new hardcoded hex usage in shell/pages.
  - Document visual smoke test matrix (dark/light, mobile/tablet/desktop).

- [ ] 6. Validation
  - Run type/lint checks for touched files.
  - Confirm no regressions in auth, shell navigation, and top-level route rendering.
