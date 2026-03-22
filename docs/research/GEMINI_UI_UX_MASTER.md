# Gemini UI/UX Master Research Page (Single-Page Workflow)

This is the **one-page** version: everything needed for UI/UX deep research is here.

---

## 1) Objective

Run complete UI/UX research for BeamLab with the **least number of pages/files**.
Scope includes both:
- Core app workflows (auth, dashboard, modeling, analysis, design, reports)
- Public website workflows (landing, pricing, checkout/conversion)

---

## 2) Source Context (attach these to Gemini as needed)

- `apps/web/src/config/navigation.config.ts`
- `apps/web/src/app/routes/AuthRoutes.tsx`
- `apps/web/src/app/routes/AnalysisRoutes.tsx`
- `apps/web/src/app/routes/DesignRoutes.tsx`
- `apps/web/src/components/ui/`
- `apps/web/src/styles/theme.ts`
- `apps/web/src/styles/base.css`
- `apps/web/src/hooks/useLoadingState.ts`
- `apps/web/src/lib/api/errorMessages.ts`
- `apps/web/src/config/clientTierConfig.ts`
- `apps/web/src/store/authStore.ts`
- `apps/web/src/pages/LandingPage.tsx`
- `apps/web/src/pages/EnhancedPricingPage.tsx`
- `apps/web/src/pages/ReportBuilderPage.tsx`
- `apps/api/src/phonepe.ts`
- `apps/api/src/razorpay.ts`
- `apps/web/DESIGN_SYSTEM_GUIDE.md`
- `docs/marketing/BEAMLAB_MESSAGING_FRAMEWORK_2026.md`
- `.kiro/specs/beamlab-improvement-roadmap/requirements.md`

---

## 3) Run These Gemini Prompts (in order)

### Prompt A — IA + Navigation
Audit IA clarity, route hierarchy, duplicate pathways, and dead-end navigation for first-time and returning users. Provide top 10 issues with severity, evidence paths, and KPI impact.

### Prompt B — Design System Consistency
Audit component consistency (spacing, typography, states, disabled/loading/error variants). Return debt matrix and phased remediation plan.

### Prompt C — Core Workflow Usability
Audit auth → dashboard → modeler → analysis → report flow. Identify friction points for novice and expert users. Return heatmap and time-to-value improvements.

### Prompt D — Conversion Funnel UX
Audit landing → pricing → checkout. Identify blockers in messaging, CTA hierarchy, pricing clarity, and checkout confidence. Return A/B test hypotheses.

### Prompt E — Tier Gating UX
Audit how free/pro/business limits are communicated and enforced. Identify hard-stops and suggest trust-preserving upgrade nudges.

### Prompt F — Error/Loading/Recovery
Audit async UX: loading transparency, timeout behavior, error clarity, and backend fallback trust signaling. Propose standardized async/error patterns.

### Prompt G — Mobile + Accessibility
Audit responsive behavior and likely WCAG risk areas (focus, keyboard, contrast, ARIA, touch targets). Return prioritized remediation checklist.

### Prompt H — Prioritization + Tickets
Convert all findings to P0/P1/P2 roadmap and generate implementation-ready engineering tickets with acceptance criteria and telemetry.

---

## 4) Single Output Template (copy for each issue)

- **Issue ID:**
- **Title:**
- **Surface:** (Core App / Public Web)
- **Journey:**
- **Priority:** (P0/P1/P2)
- **Confidence:** (High/Med/Low)
- **Evidence Paths:**
- **Current Behavior:**
- **Recommended Change:**
- **User Impact:**
- **Business Impact:**
- **Success Metric(s):**
- **Owner:**
- **Dependencies/Risks:**
- **Acceptance Criteria:**
  - [ ]
  - [ ]
  - [ ]

---

## 5) Seed Backlog (Start Here)

| ID | Hypothesis | Priority | Evidence Paths | KPI Target |
|----|------------|----------|----------------|------------|
| UX-001 | Navigation overload in analysis/design/features | P0 | `navigation.config.ts`, route modules | +15% task findability |
| UX-002 | Tier-gating messaging inconsistent mid-task | P0 | `clientTierConfig.ts`, `errorMessages.ts`, `useTierAccess.tsx` | -25% gated-task abandonment |
| UX-003 | Loading/fallback behavior unclear to users | P0 | `useLoadingState.ts`, `useAnalysis.ts`, `rustApi.ts` | +20% error recovery success |
| UX-004 | Pricing-to-checkout continuity weak | P0 | `EnhancedPricingPage.tsx`, `PaymentGatewaySelector.tsx`, `phonepe.ts` | +10% checkout start |
| UX-005 | Report trust cues (units/provenance) unclear | P1 | `ReportBuilderPage.tsx`, `units.ts`, `resultContract.ts` | +18% report completion |
| UX-006 | Landing CTA hierarchy can be sharper | P1 | `LandingPage.tsx`, messaging framework doc | +8% pricing CTR |
| UX-007 | A11y state coverage incomplete | P1 | `components/ui`, `accessibility.spec.ts` | -40% a11y defects |
| UX-008 | Mobile pricing/form ergonomics need tuning | P1 | `EnhancedPricingPage.tsx`, `ResponsiveLayout.tsx` | +12% mobile completion |

---

## 6) Implementation Cadence (Minimal Process)

1. Run Prompts A→H in Gemini.
2. Fill issue template for validated findings only.
3. Rank P0/P1/P2.
4. Convert top P0/P1 into engineering tickets.
5. Track KPI before/after per release.

---

## 7) Definition of Done

Done when:
- Both surfaces (core + public) are covered,
- Every accepted issue has evidence path + KPI,
- Top priorities are converted to implementation-ready tickets,
- At least one KPI movement is measurable in next sprint.
