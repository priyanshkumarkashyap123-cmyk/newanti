# Website Engineering Design System Specification (`apps/web`)

## 1) Purpose and Scope

This document defines the implementation contract for all product UI work under `apps/web`.

Goals:
- Keep feature pages visually consistent and behaviorally predictable.
- Reuse primitives and layout shells instead of ad-hoc UI construction.
- Scale cleanly as new engineering modules are added (analysis/design/workflow/reporting).
- Preserve current production patterns for desktop and mobile.

Out of scope:
## 11) ModuleRegistry Pattern: Zero-Code Module Addition

The **ModuleRegistry** enables adding new engineering member types with **only registry + schema changes**—zero new JSX or Axum handler code.

- Backend service contracts.
- Rust solver internals.
- Deployment infrastructure.

---

## 2) Architectural Layers

The frontend is organized as a layered system.

1. Design tokens and global styles
- Source of truth: `src/styles/base.css` (`@theme` variables, dark variant, typography, spacing, elevation).
- Shared component classes: `src/styles/components.css`.

2. Primitive UI components
- Source of truth: `src/components/ui/*`.
- Export surface: `src/components/ui/index.ts`.
- Includes button/input/dialog/form controls/data grid/toast/navigation/sheet/table primitives.

3. Layout engine
- Global app shell: `src/layouts/AppShell.tsx`.
- Workspace-driven layouts: `src/layouts/WorkspaceLayout.tsx`, `src/layouts/ModernWorkspace.tsx`.
- Specialized modeler workspace: `src/components/ModernModeler.tsx`.

4. Route and feature composition
- Root route composition: `src/App.tsx`.
- Feature route bundles: `src/app/routes/*Routes.tsx`.
- Navigation metadata: `src/config/appRouteMeta.ts`.

5. Page templates and schema-driven pages
- Template: `src/templates/MemberDesignTemplate.tsx`.
- Schema registry: `src/config/design-schemas/index.ts`.
- Example page: `src/pages/ConcreteDesignPage.tsx`.

---

## 3) Primitive Component Standards

### 3.1 Single import contract
Always consume shared primitives from the UI layer. Do not create page-local duplicates for common controls.

Required pattern:
- Import from `src/components/ui` (prefer `ui/index.ts` re-exports).
- Extend through props and variants; avoid hard-forking component files.

### 3.2 Variant-first API design
When a primitive needs visual alternatives, add or reuse variant props instead of creating a new component family.

Examples already in use:
- `Button`: variant + size + loading states.
- `Input`: label/error/icon states.
- `Dialog`/`Modal`: semantic wrappers around shared dialog base.

### 3.3 Behavior consistency
Every primitive must preserve:
- Keyboard accessibility.
- Focus-visible ring and contrast token usage.
- Disabled/loading semantics.
- Mobile-safe interaction targets.

### 3.4 Data-heavy UI standard
For tabular and editable engineering inputs, use `MasterDataGrid` config mode:
- Drive columns, validation, sorting/filtering, and cell renderers through config + registry.
- Keep domain logic in page/service hooks, not inside reusable grid internals.

---

## 4) Layout Engine Standards

### 4.1 App-level shell responsibilities
`AppShell` owns:
- Sidebar and topbar frame.
- Global command/search entry points.
- Breadcrumb and page framing semantics.
- Authenticated navigation framing.

Page modules must not reimplement this shell.

### 4.2 Workspace-level composition
Use `WorkspaceLayout` or `ModernWorkspace` when the feature has:
- Left tool/context panels.
- Center canvas/work area.
- Right inspector/properties.
- Optional results/table dock.

Rules:
- Resizable/collapsible behavior should come from layout primitives.
- New pages should fill slots, not recreate panel infrastructure.
- Mobile behavior must collapse/pivot panels the same way existing workspace pages do.

### 4.3 Modeler-grade interaction
`ModernModeler` is the reference for advanced engineering UX:
- Guided workflow sidebar.
- Ribbon-driven actions.
- 3D canvas + overlays.
- Docked results and modal orchestration.
- Guardrails: error boundaries and fallback panels.

Use it as a pattern source for high-complexity modules, not as copy-paste code.

---

## 5) Theming and Token Contract

### 5.1 Token-first styling
All visual values must map to tokens from `base.css`:
- Color tokens (`--color-*`)
- Radius tokens (`--radius-*`)
- Typography tokens
- Elevation and transition tokens

Hard-coded hex/rgb values are forbidden in feature/page code unless introducing a new approved token.

### 5.2 Dark mode and theme state
Theme behavior is controlled by:
- CSS dark variant (`@custom-variant dark`)
- Runtime provider (`ThemeProvider.tsx`)

Requirements:
- New components must support light and dark without bespoke CSS branches.
- Accent and semantic color usage should align with current provider behavior.

### 5.3 CSS layering strategy
Use this order of preference:
1. Existing utility/tokens classes.
2. Shared component classes in `components.css`.
3. Minimal feature-local CSS only when unavoidable.

No broad global CSS overrides for individual pages.

---

## 6) Route and Navigation Scalability

### 6.1 Feature route bundles
Add new domain screens through `src/app/routes/*Routes.tsx` bundles.

Do not bloat `App.tsx` with feature internals; keep `App.tsx` as top-level composition only.

### 6.2 Metadata-driven navigation
Every new feature route must be registered in `src/config/appRouteMeta.ts` with:
- route key/path
- category
- title/description
- icon/label metadata as needed

This keeps sidebars, command surfaces, and route discoverability aligned.

### 6.3 Backward-safe additions
For new modules:
- Add route bundle first.
- Register metadata.
- Reuse existing shell/layout slots.
- Add feature-specific page component last.

---

## 7) Template + Schema Strategy for Engineering Pages

The canonical pattern for rapidly scaling design pages is:
- shared template + per-member schema.

Reference:
- `MemberDesignTemplate.tsx`
- `design-schemas/index.ts`
- `ConcreteDesignPage.tsx`

Requirements:
- Put field definitions, defaults, and validation in schema config.
- Keep page wrappers thin (member type selection + schema binding).
- Avoid page-specific form logic duplication.

---

## 8) Accessibility, Responsiveness, and Reliability Rules

### 8.1 Accessibility
All new components/pages must include:
- Keyboard reachability for interactive controls.
- Proper ARIA labels for icon-only controls and landmark panes.
- Visible focus states.
- Error message semantics tied to invalid inputs.

### 8.2 Responsive behavior
At minimum, validate:
- Mobile sidebar open/close and overlay behavior.
- Panel collapse behavior for narrow widths.
- Data grids and dialogs on small screens.

### 8.3 Reliability guardrails
Complex workspaces should use:
- Panel-level error boundaries.
- Loading and fallback surfaces.
- Defensive handling around async module/data loading.

---

## 9) Performance Rules

- Prefer memoized selectors/hooks for large state stores.
- Lazy-load heavy dialogs/panels where appropriate.
- Keep render trees shallow in panel-heavy views.
- Virtualize or paginate large tables where needed.
- Keep animation purposeful and short; avoid layout-thrashing transitions.

---

## 10) Anti-Patterns (Do Not Do)

- Creating one-off button/input/modal implementations in feature folders.
- Introducing new global CSS files for a single page concern.
- Hard-coding colors/spacing instead of token usage.
- Building a custom layout shell inside a page component.
- Skipping route metadata registration for new pages.
- Copy-pasting large modeler/workspace blocks instead of composing shared layout primitives.

---

## 11) New Engineering Module Playbook

Use this exact order when adding a new module.

1. Define route intent
- Create or extend a route bundle in `src/app/routes`.

2. Register discoverability metadata
- Add entry to `src/config/appRouteMeta.ts`.

3. Choose layout shell
- Use `AppShell` for standard pages.
- Use `WorkspaceLayout`/`ModernWorkspace` for engineering workspaces.

4. Compose with primitives
- Build inputs/actions/dialogs/tables using `src/components/ui`.

5. Apply schema/template pattern if form-heavy
- Add schema config and bind through existing template components.

6. Wire feature logic
- Keep solver/API/business logic in hooks/services; keep components presentational.

7. Validate cross-cutting quality
- Accessibility keyboard pass.
- Mobile panel behavior pass.
- Theme token/dark pass.
- Error boundary/loading/fallback pass.

---

## 12) ModuleRegistry Pattern: Zero-Code Module Addition

The **ModuleRegistry** enables adding new engineering member types with **only registry + schema changes**—zero new JSX or Axum handler code.

### 12.1 What is the ModuleRegistry?

A JSON-based registry at `src/config/module-registry.json` paired with TypeScript types in `src/config/module-registry.types.ts`. It defines:

- **Frontend contract**: route path, component to load, schema key, display metadata, tier/access.
- **Backend contract**: API endpoint, handler function, design codes, request/response types, cache TTL.

Once an entry is in the registry, the frontend can discover and load it dynamically without code changes.

### 12.2 Registry Structure

Each entry has this shape:

```typescript
{
	"id": "concrete_footing",
	"memberKind": "footing",
	"designCode": "is_456",
	"displayName": "RC Footing Design",
	"description": "Isolated footing bearing capacity and reinforcement",
	"frontend": {
		"routePath": "/design/concrete-footing",
		"componentPath": "src/pages/ConcreteFootingDesignPage",
		"schemaKey": "footingSchema",
		"label": "RC Footing",
		"category": "Concrete Design",
		"tier": "pro"
	},
	"backend": {
		"endpoint": "/api/design/concrete/footing-bearing-capacity",
		"handlerFn": "footing_bearing_capacity"
	}
}
```

### 12.3 Adding a New Member Type: The Checklist

To add a new member type (e.g., **RC Footing Design**), follow this exact sequence. **No other code changes are required if the Rust handler already exists.**

#### Step 1: Add Registry Entry

Edit `src/config/module-registry.json` and add a new entry.

#### Step 2: Add Schema Config

Edit `src/config/design-schemas/index.ts` and define the schema.

#### Step 3: Create Page Component

Create `src/pages/ConcreteFootingDesignPage.tsx` (it reuses the template).

**That's it!** The page is automatically discoverable, routable, and wired to the backend.

#### Step 4 (Optional): Implement Rust Handler

If the handler doesn't exist in `apps/rust-api/src/handlers/design.rs`, add it.

### 12.4 What You Don't Need to Do

- No new route files.
- No new JSX components beyond the thin page wrapper.
- No manual navigation updates.
- No hard-coded API paths.

---

## 13) ModuleRegistry-to-Backend Dispatch Contract

The registry is the frontend-facing contract; the backend must mirror it with a stable dispatch layer.

### 13.1 Dispatch rule

Each registry entry must map to exactly one backend capability:

- a Rust handler function in `apps/rust-api/src/handlers/design.rs`, or
- an existing solver function exported from `apps/rust-api/src/design_codes/*`.

The frontend must never guess endpoint paths, request field names, or response shapes.

### 13.2 Backend mirror source

The backend mirror may be represented as:

- a Rust enum / trait map,
- a generated JSON mirror,
- or a typed lookup table in Rust.

Required mirror fields:

- `memberKind`
- `designCode`
- `endpoint`
- `handlerFn`
- `requestType`
- `responseType`

### 13.3 Zero-handler-code rule for new members

If a new member type can reuse an existing generalized solver entrypoint, then adding it must require only:

1. registry entry,
2. schema config,
3. response/request type mapping.

No new Axum route function is allowed for a pure variant of an existing member family.

### 13.4 Recommended implementation model

Use a shared dispatch key:

```text
${designCode}:${memberKind}
```

Examples:

- `is_456:beam`
- `is_456:column`
- `is_456:footing`
- `is_800:connection`

That key should resolve to:

- frontend schema key,
- frontend route target,
- backend handler/solver entrypoint.

### 13.5 Validation rule

Before a registry entry is accepted:

- the frontend schema key must exist,
- the backend request/response types must exist,
- the endpoint must be reachable through the backend dispatch layer,
- the registry entry must be visible in route metadata.

---

## 14) Definition of Done for UI Features

A feature is complete only if:
- It uses existing primitives and layout shells.
- It registers route metadata for navigation/discovery.
- It updates the ModuleRegistry (or the schema registry for template-based pages).
- It follows token-based theme rules (no hard-coded visual constants).
- It works in light/dark and desktop/mobile.
- It includes accessible controls and error semantics.
- It avoids duplicated form/layout infrastructure already available in the system.
