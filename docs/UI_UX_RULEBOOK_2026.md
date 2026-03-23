# BeamLab UI/UX Rulebook (2026)

This rulebook defines the shared visual system for all web pages and reusable components.

## 1) Color Rules

- Primary action color: `--color-primary` family.
- Background hierarchy:
	- Canvas: `--color-canvas`
	- Surface: `--color-surface`
	- Border: `--color-border`
- Text hierarchy:
	- Primary readability: `--color-text`
	- Secondary/supporting content: `--color-text-soft`
	- Meta/caption/hints: `--color-text-dim`
- No new hardcoded dark hex values in shared components unless justified by a design-system token update.

## 2) Typography Rules

- Labels: semibold with `tracking-[0.01em]`.
- Body text should maintain a readable line-height (`~1.6`).
- Avoid duplicate utility tokens (e.g., `tracking-wide tracking-wide`).

## 3) Spacing & Size Rules

- Use consistent control heights (`sm/md/lg`) for interactive elements.
- Maintain section rhythm via shared wrappers (`.ui-section`, `.ui-section-tight`).
- Keep primary layouts in a constrained shell (`.ui-page-shell`) for visual balance.

## 4) Button Placement Rules

- Primary actions align to the end of action bars when they represent “continue/submit”.
- Secondary actions remain adjacent in lower emphasis.
- Use standardized wrappers:
	- `.ui-actions-row`
	- `.ui-actions-row-start`

## 5) Exposure & Contrast Rules

- Ensure readable contrast in both themes using token text colors.
- Avoid low-contrast muted text on actionable controls.
- Focus states must remain visible and keyboard-friendly.

## 6) Shared Component Priorities

When updating UI quality, apply in this order:
1. Shared primitives (`button`, `FormInputs`)
2. Shell/navigation (`PageHeader`, `PageFooter`)
3. High-traffic pages
4. Long-tail pages

## 7) Quality Gate Before Merge

- Type-check and build pass for `apps/web`.
- No regression in accessible focus visibility.
- No duplicate utility classes introduced.
