# Design Document

## Overview
This stabilization effort addresses three major root causes:

1. **Token drift**: many pages rely on hardcoded hex classes (`bg-[#0b1326]`, `text-[#dae2fd]`, etc.) instead of canonical token utilities.
2. **Global CSS bleed**: broad element selectors in `styles/components.css` interfere with per-component styling.
3. **Layout fragility**: widespread `h-screen` + `overflow-hidden` combinations cause clipping and inconsistent behavior on mobile browsers.

## Root Cause Findings (Audit)
- Shared shell and many pages use hardcoded hex palette directly.
- Global styles previously targeted raw element selectors (`a`, `button`, and unscoped input selectors).
- Multiple page families use inconsistent background systems (`bg-canvas`, hardcoded navy, and slate gradients intermixed).

## Phase Strategy

### Phase 1 — Shared Foundations (Started)
- Scope global CSS legacy styles to opt-in wrappers.
- Normalize `AppShell` root wrapper to token-based color classes + dynamic viewport-safe height.
- Remove obvious class duplication and low-noise layout issues.

### Phase 2 — High-Traffic Pages
- Migrate `UnifiedDashboard`, `Dashboard`, `SettingsPage`, and core auth screens to token classes.
- Replace repeated hardcoded hex classes with token utilities.
- Keep behavior unchanged while improving visual consistency.

### Phase 3 — Long-Tail Pages and Modules
- Migrate analysis/design pages batch-wise.
- Handle special pages with print/report needs separately.

### Phase 4 — Guardrails
- Add lint/search guardrails to block new hardcoded hex values in high-level layout/page files.
- Add visual smoke checklist for dark/light and responsive breakpoints.

## Technical Notes
- Canonical token utilities already exist in `styles/base.css` (`bg-canvas`, `bg-surface`, `text-token`, `text-soft`, `border-token`).
- Keep scoped legacy wrappers for old content where full migration is deferred.
- Do not remove required fallback or debug UI styling in bootstrap/error states.
