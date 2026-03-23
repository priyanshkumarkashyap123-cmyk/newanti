# STAAD UI/UX Canonical Source Hierarchy (Phase 1)

## Purpose

Define the evidence trust order for the STAAD vs BeamLab UI/UX audit so every inventory row is traceable and repeatable.

## Canonical priority order

1. **Tier 1 (Primary, highest confidence)**
   - STAAD.Pro Help v21 official documentation (`docs.bentley.com/LiveContent/web/STAAD.Pro Help-v21/...`)
   - Use for: ribbon tab tools, dialogs, shortcuts, workflow mode behavior, application shell references.

2. **Tier 2 (Secondary, medium-high confidence)**
   - Bentley official product/support pages (`bentley.com`, official communities where source is Bentley-authored)
   - Use for: product-level workflow framing, release context, feature positioning when not explicit in Help.

3. **Tier 3 (Tertiary, lower confidence)**
   - Community/forum/discussion content
   - Use for: edge behavior hypotheses only. Must be flagged and later verified against Tier 1/2 before becoming a final claim.

## Confidence rules

- **High**: directly listed in Tier 1 (tool row, command table, shortcut, or parent-topic reference).
- **Medium**: inferred from Tier 1 navigation graph or validated by Tier 2 prose but not explicit in command table.
- **Low**: appears only in Tier 3/community; keep as provisional.

## Evidence row minimums

Every ledger row must include:

- `SourceURL` (direct page URL)
- `ObservedBehavior` (what the UI does, not just label text)
- `TransitionTrigger` + `StateChange`
- `Confidence` score based on the rubric above

## Source crawl log for this phase

### Successfully captured for Phase 1

- Geometry tab: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/STD_GEOMETRY_RIBBON_TAB.html`
- Application window layout: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-11AB84A4-4A5C-436D-9537-45C4614B68D8.html`
- Ribbon control reference: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-78C80AD8-E9D6-437F-8CEE-8D721CE58010.html`
- Quick access toolbar: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-BB7677AA-3CD8-4A2D-BF29-119FB57BD75A.html`

### Attempted but not extractable in current session

- BeamLab public site: `https://beamlabultimate.tech/`
  - Status: crawler extraction unavailable in this session
  - Decision: BeamLab baseline remains repository/docs (already user-approved)

## BeamLab baseline source for parity mapping

Use repository artifacts as source of truth for BeamLab:

- `docs/figma/STAAD_PRO_FEATURES_DESIGN_SPEC.md`
- `docs/audit/UI_COMPONENT_INVENTORY.md`
- `apps/web/src/components/layout/EngineeringRibbon.tsx`
- `apps/web/src/components/toolbar/ModelingToolbar.tsx`
- `apps/web/src/store/uiStore.ts`
- `apps/web/src/components/modeler/StaadProDialogStubs.tsx`

## Notes

- Phase 1 ledger seeding is intentionally STAAD-first (authoritative command inventory).
- BeamLab mapping columns are provisional until Phase 5 code extraction is finalized.
