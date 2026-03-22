# Requirements Document

## Introduction
BeamLab frontend UI currently suffers from visual inconsistency, token drift, and layout instability caused by mixed styling paradigms (hardcoded hex colors + token utilities + global CSS element rules).

This spec defines stabilization requirements for shared shell/layout/theming first, followed by page-by-page migration.

## Requirements

### Requirement 1: Design Token Consistency
**User Story:** As a user, I want consistent visual styles across all pages so the product feels professional and reliable.

#### Acceptance Criteria
1. The shell and top-level layout components SHALL use canonical token classes (`bg-canvas`, `bg-surface`, `text-token`, `text-soft`, `border-token`) instead of hardcoded hex color classes.
2. Newly modified pages SHALL avoid new hardcoded color values in class names.
3. Shared shell components SHALL use a single color system for dark and light compatibility.

### Requirement 2: Global CSS Safety
**User Story:** As a developer, I want global styles to avoid overriding component-level styles unexpectedly.

#### Acceptance Criteria
1. Root-level global selectors for `a`, `button`, `input`, `textarea`, `select` SHALL NOT enforce visual styles globally.
2. Legacy element styling SHALL be opt-in via scoped wrappers (e.g., `.legacy-content`, `.legacy-inputs`).
3. Tailwind- and component-library-styled controls SHALL render unchanged by global CSS rules.

### Requirement 3: Viewport and Layout Stability
**User Story:** As a mobile and desktop user, I want pages not to clip or jump due to viewport-height inconsistencies.

#### Acceptance Criteria
1. Shared app shell wrappers SHALL use dynamic viewport-safe sizing (`100dvh`) where appropriate.
2. High-level layout wrappers SHALL avoid fixed `h-screen` where it causes clipping.
3. Main content regions SHALL remain scrollable while chrome (top/sidebar/footer) stays stable.

### Requirement 4: UX Debt Visibility and Execution Plan
**User Story:** As a product owner, I want a phased, trackable migration plan so UI quality improves predictably.

#### Acceptance Criteria
1. A design document SHALL list root causes and anti-pattern categories.
2. A task list SHALL prioritize shared-shell and high-traffic page migration first.
3. Each phase SHALL define measurable completion checks (lint/search thresholds, visual smoke checks).
