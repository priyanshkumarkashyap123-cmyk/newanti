# Design Document: BeamLab UX and Product Strategy

## Overview

This document describes the technical design for the UX, documentation, onboarding, error
handling, modeling workflow, and monetisation conversion features identified in the
requirements document. The work closes four critical gaps versus SkyCiv and RISA-3D:
public documentation, guided onboarding, pre-analysis model validation, and a contextual
conversion funnel.

The implementation is entirely within the existing React SPA (`apps/web`) and Node API
(`apps/api`). No new backend services are required; the Rust and Python APIs are not
touched by this spec.

---

## Architecture

### Current State

```
LandingPage ──► SignUp ──► Dashboard ──► Modeler (no guidance)
                                │
                                └──► (no help, no onboarding, no validation UX)
```

Key gaps:
- No `/docs` route or public help content
- No first-run redirect or onboarding wizard
- No pre-analysis validation pipeline surfaced to the user
- No contextual upgrade prompts tied to specific usage events
- No funnel event schema beyond generic GA4 events

### Target State

```
LandingPage (social proof, trust bar, live example CTA)
    │
    ├──► /docs  (HelpCenter — public, no auth)
    │       └── articles, glossary, video walkthroughs, AI assistant guide
    │
    └──► SignUp ──► OnboardingFlow (5 steps, persisted progress)
                        │
                        └──► Dashboard (usage counters, conversion prompts)
                                │
                                └──► Modeler
                                        ├── WelcomeBanner + InteractiveTutorial
                                        ├── ContextualHelpPanel (wired to active tool)
                                        ├── SpreadsheetInputPanel (nodes + members)
                                        ├── CommandBar (CAD-style coordinate input)
                                        ├── PreAnalysisValidation ──► WarningLogPanel
                                        │       └── RepairModel service
                                        ├── ResultsViewer (colour-coded diagrams)
                                        │       └── CalculationReport (per-member)
                                        └── ReportExportDialog (title block, watermark)
```

### Mermaid Architecture Diagram

```mermaid
graph TD
    LP[LandingPage] --> DOCS[/docs HelpCenter]
    LP --> SIGNUP[SignUp]
    LP --> LIVE[Live Example - anonymous]
    SIGNUP --> OB[OnboardingFlow]
    OB --> DASH[Dashboard]
    DASH --> MOD[Modeler]
    MOD --> HELP[ContextualHelpPanel]
    MOD --> SPREAD[SpreadsheetInputPanel]
    MOD --> CMD[CommandBar]
    MOD --> VAL[PreAnalysisValidation]
    VAL --> WARN[WarningLogPanel]
    WARN --> REPAIR[RepairModel]
    MOD --> RV[ResultsViewer]
    RV --> CALC[CalculationReport]
    RV --> REPORT[ReportExportDialog]
    DASH --> CP[ConversionPrompt]
    MOD --> CP
    CP --> UPGRADE[UpgradeModal existing]
    MOD --> TUT[InteractiveTutorial]
    MOD --> AI[AIAssistant]
    ANALYTICS[useAnalytics hook] -.-> DASH
    ANALYTICS -.-> MOD
    ANALYTICS -.-> OB
```

---

## Components and Interfaces

### 2.1 HelpCenter (`/docs`)

A public route rendered without authentication. Content is stored as static MDX files
bundled with the SPA (no CMS dependency at launch).

```typescript
// apps/web/src/pages/HelpCenterPage.tsx
interface HelpArticle {
  slug: string;           // URL segment, e.g. "getting-started"
  title: string;
  category: 'guide' | 'reference' | 'tutorial' | 'glossary';
  videoUrl?: string;      // YouTube embed URL
  content: string;        // MDX source
  updatedAt: string;      // ISO date
}

interface HelpSearchResult {
  article: HelpArticle;
  score: number;          // relevance score 0–1
  excerpt: string;        // matched snippet
}

interface HelpCenterPageProps {
  initialSlug?: string;   // deep-link to specific article
}
```

Required articles at launch (slugs):
`getting-started`, `modeler-overview`, `first-analysis`, `interpreting-results`,
`generating-report`, `pricing-plans`, `glossary`, `ai-assistant`

Search is implemented client-side using `fuse.js` over the article index — no server
round-trip, satisfying the 2-second response requirement.

### 2.2 ContextualHelpPanel

Slides in from the right side of the Modeler. The active article is determined by the
currently active tool/panel key stored in Modeler state.

```typescript
// apps/web/src/components/ContextualHelpPanel.tsx
interface ContextualHelpPanelProps {
  activeToolKey: string;  // e.g. "node-tool", "load-panel", "results-viewer"
  isOpen: boolean;
  onClose: () => void;
}

// Mapping from tool key → help article slug
type ToolHelpMap = Record<string, string>;
```


### 2.3 OnboardingFlow

A multi-step wizard rendered as a full-screen overlay immediately after first sign-up.
Progress is persisted in the user profile (`onboardingProgress` field).

```typescript
// apps/web/src/components/onboarding/OnboardingFlow.tsx
type OnboardingRole = 'student' | 'practising_engineer' | 'researcher' | 'other';
type OnboardingUseCase = 'steel_frame' | 'rc_frame' | 'truss' | 'other';
type UnitSystem = 'SI' | 'Imperial';

interface OnboardingState {
  currentStep: number;          // 1–5
  completedSteps: number[];     // steps already done
  role?: OnboardingRole;
  useCase?: OnboardingUseCase;
  unitSystem?: UnitSystem;
  completedAt?: string;         // ISO timestamp
}

interface OnboardingFlowProps {
  initialState: OnboardingState;
  onComplete: (state: OnboardingState) => void;
  onDismiss: (state: OnboardingState) => void;
}

// Steps:
// 1 - RoleSelection
// 2 - UseCaseSelection
// 3 - UnitSystemSelection
// 4 - ExampleModelLoader (loads pre-built model into Modeler)
// 5 - RunAnalysisPrompt (prompts user to click Run Analysis)
```

### 2.4 InteractiveTutorial

Extends the existing `TutorialOverlay.tsx` with element-targeting and auto-advance logic.

```typescript
// apps/web/src/components/tour/InteractiveTutorial.tsx
interface TutorialStepDef {
  id: string;
  instruction: string;
  targetSelector: string;       // CSS selector for the highlighted element
  completionEvent: string;      // event name that auto-advances the step
  stepNumber: number;
  totalSteps: number;
}

interface TutorialSequence {
  id: string;                   // e.g. "create-simple-beam"
  title: string;
  steps: TutorialStepDef[];
}

interface InteractiveTutorialProps {
  sequence: TutorialSequence;
  isActive: boolean;
  currentStepIndex: number;
  onStepComplete: (stepId: string) => void;
  onSkip: () => void;
  onPause: () => void;
}

// Required sequences:
// "create-simple-beam", "add-supports-and-loads",
// "run-static-analysis", "export-pdf-report"
```

### 2.5 WarningLogPanel

Pre-analysis validation results panel. Opens automatically when validation finds issues.

```typescript
// apps/web/src/components/WarningLogPanel.tsx
type ValidationSeverity = 'error' | 'warning';

interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;                 // e.g. "ZERO_LENGTH_MEMBER"
  message: string;              // human-readable, e.g. "Member M12 has zero length"
  elementId?: string;           // ID of the offending node or member
  elementType?: 'node' | 'member';
}

interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  validatedAt: number;          // Date.now()
}

interface WarningLogPanelProps {
  result: ValidationResult;
  isOpen: boolean;
  onGoTo: (issue: ValidationIssue) => void;
  onRepair: () => void;
  onClose: () => void;
}
```

### 2.6 RepairModel Service

Pure function — no side effects beyond returning the repaired model and a summary.

```typescript
// apps/web/src/services/repairModel.ts
interface RepairSummary {
  mergedNodes: number;
  removedZeroLengthMembers: number;
  removedDuplicateMembers: number;
  totalFixes: number;
}

interface RepairResult {
  model: StructuralModel;       // patched model (new reference)
  summary: RepairSummary;
  hasChanges: boolean;
}

function repairModel(model: StructuralModel): RepairResult;
```

### 2.7 ResultsViewer

Colour-coded force diagram overlay system integrated into the 3D viewport.

```typescript
// apps/web/src/components/ResultsViewer.tsx
type ResultType = 'moment' | 'shear' | 'axial' | 'deflection';

interface ForceTooltipData {
  memberId: string;
  resultType: ResultType;
  value: number;
  unit: string;
  positionRatio: number;        // 0.0 (start) to 1.0 (end)
}

interface ResultsViewerState {
  activeLoadCaseId: string;
  visibleResultTypes: Set<ResultType>;
  selectedMemberId?: string;
  showDeflectedShape: boolean;
  deflectionScale: number;      // default 100
}

interface ResultsViewerProps {
  analysisResults: AnalysisResults;
  state: ResultsViewerState;
  onStateChange: (state: ResultsViewerState) => void;
  onMemberSelect: (memberId: string) => void;
}
```

### 2.8 CalculationReport

Per-member step-by-step design check output.

```typescript
// apps/web/src/components/CalculationReport.tsx
interface LimitStateCheck {
  name: string;                 // e.g. "Flexure"
  demand: number;
  capacity: number;
  utilizationRatio: number;     // demand / capacity
  governingCombo: string;
  codeClause: string;           // e.g. "AISC 360-16 §H1-1"
  passed: boolean;
}

interface CalculationReportData {
  memberId: string;
  sectionName: string;
  checks: LimitStateCheck[];
  controllingCheck: LimitStateCheck;  // highest utilization ratio
}

interface CalculationReportProps {
  data: CalculationReportData;
  onExportPDF: () => void;
}
```

### 2.9 ReportExportDialog

```typescript
// apps/web/src/components/ReportExportDialog.tsx
interface TitleBlockConfig {
  projectName: string;
  engineerName: string;
  companyName: string;
  projectNumber: string;
  date: string;
  logoDataUrl?: string;         // base64 data URL of uploaded logo
}

interface ReportSectionSelection {
  projectInfo: boolean;
  modelSummary: boolean;
  loadCases: boolean;
  loadCombinations: boolean;
  nodeDisplacements: boolean;
  supportReactions: boolean;
  memberForces: boolean;
  designCheckSummary: boolean;
  calculationSheets: boolean;
}

interface ReportExportDialogProps {
  titleBlock: TitleBlockConfig;
  sections: ReportSectionSelection;
  userTier: 'free' | 'pro' | 'enterprise';
  onGenerate: (config: TitleBlockConfig, sections: ReportSectionSelection) => Promise<void>;
  onClose: () => void;
}
```

### 2.10 ConversionPrompt

Contextual upgrade prompt shown at specific trigger events.

```typescript
// apps/web/src/components/ConversionPrompt.tsx
type ConversionTrigger =
  | 'project_limit'
  | 'public_project_notice'
  | 'pdf_watermark'
  | 'design_module_gate'
  | 'model_size_limit'
  | 'ai_assistant_gate';

interface ConversionPromptProps {
  trigger: ConversionTrigger;
  isOpen: boolean;
  onUpgrade: () => void;
  onDismiss: () => void;
}
```

### 2.11 SpreadsheetInputPanel

Dual-mode input panel for nodes and members.

```typescript
// apps/web/src/components/SpreadsheetInputPanel.tsx
type SpreadsheetMode = 'nodes' | 'members';

interface NodeRow {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface MemberRow {
  id: string;
  startNodeId: string;
  endNodeId: string;
  sectionProfile: string;
}

interface SpreadsheetInputPanelProps {
  mode: SpreadsheetMode;
  nodes: NodeRow[];
  members: MemberRow[];
  onNodeChange: (id: string, field: 'x' | 'y' | 'z', value: number) => void;
  onMemberChange: (id: string, field: keyof MemberRow, value: string) => void;
}
```

### 2.12 CommandBar

CAD-style coordinate input bar.

```typescript
// apps/web/src/components/CommandBar.tsx
interface ParsedCoordinate {
  x: number;
  y: number;
  z: number;
  isRelative: boolean;
}

// Parses "3.0, 0.0, 4.5" → absolute
// Parses "@1.5, 0, 0" → relative to last node
function parseCoordinateInput(input: string, lastNode?: { x: number; y: number; z: number }): ParsedCoordinate | null;

interface CommandBarProps {
  isVisible: boolean;
  lastNodePosition?: { x: number; y: number; z: number };
  onCoordinateSubmit: (coord: ParsedCoordinate) => void;
  onDismiss: () => void;
}
```

### 2.13 useAnalytics Hook

Typed funnel event hook wrapping the existing `analytics.ts`.

```typescript
// apps/web/src/hooks/useAnalytics.ts
type FunnelEvent =
  | 'page_view_landing'
  | 'signup_started'
  | 'signup_completed'
  | 'onboarding_completed'
  | 'first_analysis_run'
  | 'upgrade_prompt_shown'
  | 'upgrade_cta_clicked'
  | 'checkout_started'
  | 'checkout_completed';

interface FunnelEventPayload {
  event: FunnelEvent;
  userTier: 'free' | 'pro' | 'enterprise';
  sessionId: string;
  triggerType?: ConversionTrigger;  // for upgrade_prompt_shown
  timestamp: number;
}

interface UseAnalyticsReturn {
  trackFunnel: (event: FunnelEvent, extra?: Partial<FunnelEventPayload>) => void;
}

function useAnalytics(): UseAnalyticsReturn;
```

### 2.14 SectionLibraryBrowser

Filterable section browser built on top of `SectionDatabase.ts`.

```typescript
// apps/web/src/components/SectionLibraryBrowser.tsx
type DesignCodeFamily = 'AISC' | 'IS' | 'Eurocode';
type ProfileFamily = 'W' | 'S' | 'C' | 'L' | 'HSS' | 'ISMB' | 'ISMC' | 'ISA' | 'ISHB' | 'IPE' | 'HEA' | 'HEB' | 'UB' | 'UC';

interface SectionFilter {
  designCode?: DesignCodeFamily;
  profileFamily?: ProfileFamily;
  minDepth?: number;
  maxDepth?: number;
  minWeight?: number;
  maxWeight?: number;
}

interface SectionProperties {
  name: string;
  area: number;       // mm²
  Ix: number;         // mm⁴
  Iy: number;         // mm⁴
  Sx: number;         // mm³
  Sy: number;         // mm³
  weightPerMetre: number; // kg/m
}

interface SectionLibraryBrowserProps {
  filter: SectionFilter;
  onFilterChange: (filter: SectionFilter) => void;
  onSelect: (section: SectionProperties) => void;
}
```


---

## Colour System and Design Tokens

All new components use the existing token system from `apps/web/src/styles/theme.ts` and
`apps/web/src/constants/BrandingConstants.ts`. No new tokens are introduced.

### Token Usage by Component

| Component | Background | Text | Border | Accent |
|---|---|---|---|---|
| HelpCenterPage | `neutral[900]` | `neutral[100]` | `neutral[700]` | `primary[500]` |
| ContextualHelpPanel | `neutral[800]` | `neutral[100]` | `neutral[700]` | `primary[500]` |
| OnboardingFlow | `neutral[900]` | `neutral[100]` | `neutral[700]` | `primary[500]` |
| WarningLogPanel — error row | `error[500]/10` | `error[400]` | `error[500]/30` | `error[500]` |
| WarningLogPanel — warning row | `warning[500]/10` | `warning[400]` | `warning[500]/30` | `warning[500]` |
| ResultsViewer — pass member | `success[500]` | — | — | — |
| ResultsViewer — fail member | `error[500]` | — | — | — |
| ResultsViewer — warning member | `warning[500]` | — | — | — |
| CalculationReport | `neutral[900]` (dark) / `white` (PDF) | `neutral[100]` / `BEAMLAB_COLORS.slate900` | `neutral[700]` / `BEAMLAB_COLORS.slate200` | `BEAMLAB_COLORS.navy` |
| ReportExportDialog | `neutral[800]` | `neutral[100]` | `neutral[700]` | `primary[500]` |
| ConversionPrompt | `neutral[800]` | `neutral[100]` | `primary[600]/30` | `primary[500]` |
| SpreadsheetInputPanel | `neutral[900]` | `neutral[100]` | `neutral[700]` | `primary[500]` |
| CommandBar | `neutral[800]` | `neutral[100]` | `primary[500]` | `primary[400]` |
| TrustBar (LandingPage) | `BEAMLAB_COLORS.navy` | `white` | `BEAMLAB_COLORS.gold` | `BEAMLAB_COLORS.gold` |

### Force Diagram Colour Scale

The Results Viewer uses a diverging colour scale for force diagrams:

- Maximum positive value: `error[500]` (`#ef4444`) — red
- Zero crossing: `neutral[400]` (`#94a3b8`) — grey
- Maximum negative value: `primary[500]` (`#3b82f6`) — blue
- Node highlights: `#22d3ee` (cyan, from `semanticColors.elements.node`)
- Failed member highlight: `error[500]` (`#ef4444`)
- Warning member highlight: `warning[500]` (`#f59e0b`)

### PDF Report Tokens

PDF reports use `BrandingConstants.ts` exclusively (jsPDF-compatible RGB tuples):

- Title block header bar: `BEAMLAB_COLORS_RGB.navy` (`[18, 55, 106]`)
- Gold accent stripe: `BEAMLAB_COLORS_RGB.gold` (`[191, 155, 48]`)
- Body text: `BEAMLAB_COLORS_RGB.slate900`
- Table header background: `BEAMLAB_COLORS_RGB.slate100`
- Pass badge: `BEAMLAB_COLORS_RGB.green`
- Fail badge: `BEAMLAB_COLORS_RGB.red`
- Watermark text: `BEAMLAB_COLORS_RGB.slate500` at 30% opacity

---

## Data Models

### 3.1 User Profile Extensions

New fields added to the existing user profile document (Node API / database):

```typescript
interface UserProfileExtensions {
  onboardingProgress: {
    currentStep: number;
    completedSteps: number[];
    role?: OnboardingRole;
    useCase?: OnboardingUseCase;
    unitSystem?: UnitSystem;
    completedAt?: string;
  };
  tutorialState: {
    skippedSequences: string[];   // sequence IDs the user has skipped
    completedSequences: string[]; // sequence IDs the user has completed
    activeSequenceId?: string;
    activeStepIndex?: number;
  };
  analyticsConsent: boolean;
  firstModelerOpenAt?: string;    // ISO timestamp — drives welcome banner
}
```

### 3.2 Funnel Event Schema

Stored in the Node API database (new `funnel_events` table / collection):

```typescript
interface FunnelEventRecord {
  id: string;                     // UUID
  event: FunnelEvent;
  userId: string;                 // anonymised user ID (not email)
  sessionId: string;
  userTier: 'free' | 'pro' | 'enterprise';
  triggerType?: ConversionTrigger;
  timestamp: string;              // ISO 8601
  // No PII fields — no email, name, IP address
}
```

### 3.3 Trust Bar Statistics Cache

Cached in the Node API (in-memory + Redis if available, falls back to last known value):

```typescript
interface TrustBarStats {
  analysesRun: number;
  registeredUsers: number;
  cachedAt: string;               // ISO timestamp
}

// GET /api/public/trust-stats — public endpoint, cached 1 hour
// GET /api/admin/funnel-stats?from=ISO&to=ISO — admin-only
```

### 3.4 Report Logo Persistence

Logo images are stored as base64 data URLs in the project document (no separate file
upload service required at launch):

```typescript
interface ProjectReportConfig {
  titleBlock: TitleBlockConfig;
  defaultSections: ReportSectionSelection;
  updatedAt: string;
}
```

### 3.5 Shareable Report Link

Time-limited public URLs are generated by the Node API:

```typescript
interface ShareableReportLink {
  token: string;                  // random 32-byte hex
  projectId: string;
  reportConfig: ReportSectionSelection;
  expiresAt: string;              // now + 7 days
  createdAt: string;
}

// GET /api/reports/share/:token — public, no auth, returns PDF stream
// POST /api/reports/share — creates link, requires auth
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid
executions of a system — essentially, a formal statement about what the system should do.
Properties serve as the bridge between human-readable specifications and machine-verifiable
correctness guarantees.*

### Property 1: Validation Detection Completeness

*For any* structural model containing one or more of the defined error conditions
(zero-length member, member referencing non-existent node, unconnected node, no supports,
no loads) or warning conditions (high aspect ratio member, near-duplicate nodes within
0.01 m, duplicate member definition, empty load case), the validation function SHALL
return at least one issue entry of the correct severity for each condition present.

**Validates: Requirements 5.2, 5.3**

### Property 2: Analysis Blocked by Errors

*For any* structural model where the validation result contains one or more errors
(severity = 'error'), the analysis submission function SHALL return without calling the
solver, and the "Run Analysis" button label SHALL contain the error count.

**Validates: Requirements 5.6**

### Property 3: Warning Log Entry Count Matches Validation Result

*For any* validation result with N total issues (errors + warnings), the WarningLogPanel
SHALL render exactly N issue rows — no more, no fewer.

**Validates: Requirements 5.4**

### Property 4: Repair Model Idempotency

*For any* structural model, applying `repairModel` twice SHALL produce the same result as
applying it once: `repairModel(repairModel(m).model).summary.totalFixes === 0`.

**Validates: Requirements 6.2, 6.4**

### Property 5: Repair Model Undo Stack Growth

*For any* structural model where `repairModel` returns `hasChanges = true`, the undo
history stack length SHALL increase by exactly 1 after the repair is applied.

**Validates: Requirements 6.4**

### Property 6: Tier Watermark Invariant

*For any* PDF report generated by a free-tier user, every page SHALL contain the string
"BeamLab Free". *For any* PDF report generated by a pro-tier or enterprise-tier user, no
page SHALL contain the string "BeamLab Free".

**Validates: Requirements 9.4, 9.5, 11.4**

### Property 7: Report Section Selection Fidelity

*For any* subset S of report sections selected in `ReportSectionSelection`, the generated
PDF SHALL contain content for every section in S and SHALL NOT contain content for any
section not in S.

**Validates: Requirements 9.3**

### Property 8: Conversion Prompt Coverage

*For every* defined `ConversionTrigger` value, there exists a user action that, when
performed by a free-tier user at the relevant limit, causes a `ConversionPrompt` to be
displayed with that trigger type. Additionally, every displayed `ConversionPrompt` SHALL
include a dismiss option.

**Validates: Requirements 10.1–10.7**

### Property 9: Funnel Event PII Exclusion

*For any* funnel event payload recorded by the platform, the payload object SHALL NOT
contain any of the following fields: `email`, `name`, `firstName`, `lastName`, `phone`,
`ipAddress`. Only `userId` (anonymised) and `sessionId` are permitted as identifiers.

**Validates: Requirements 16.4**

### Property 10: Analytics Opt-Out Enforcement

*For any* user with `analyticsConsent = false`, calling `trackFunnel` SHALL NOT invoke
the analytics endpoint — the event SHALL be silently dropped.

**Validates: Requirements 16.5**

### Property 11: Onboarding Step Persistence

*For any* onboarding session dismissed at step N (where 1 ≤ N ≤ 5), re-entering the
onboarding flow SHALL start at step N+1 (or show the completion screen if N = 5), and
SHALL NOT re-display any step with index ≤ N.

**Validates: Requirements 3.4**

### Property 12: Grid Snapping Invariant

*For any* node placed in the graphical canvas with grid snapping enabled and grid spacing
G, the placed node's X, Y, and Z coordinates SHALL each be a multiple of G (within
floating-point tolerance of 1e-9).

**Validates: Requirements 12.5, 12.6**

### Property 13: Coordinate Command Bar Round-Trip

*For any* valid absolute coordinate string of the form "X, Y, Z" (where X, Y, Z are
finite decimal numbers), `parseCoordinateInput(input)` SHALL return a `ParsedCoordinate`
where `coord.x`, `coord.y`, `coord.z` equal the parsed values and `coord.isRelative` is
`false`. *For any* valid relative coordinate string of the form "@dX, dY, dZ" and a
reference node P, the result SHALL equal `{ x: P.x + dX, y: P.y + dY, z: P.z + dZ }`.

**Validates: Requirements 12.7**

### Property 14: Section Library Filter Fidelity

*For any* `SectionFilter` applied to the section library, every section returned by the
filter function SHALL satisfy all non-null filter criteria (design code, profile family,
depth range, weight range). No section violating any active filter criterion SHALL appear
in the results.

**Validates: Requirements 13.2**

### Property 15: Self-Weight Computation Correctness

*For any* member with a known section area A (mm²), material density ρ (kg/m³), and
length L (m), the self-weight distributed load computed by "Apply Self-Weight" SHALL equal
`ρ × A × 1e-6 × g` kN/m (where g = 9.81 m/s²), within a relative tolerance of 0.01%.

**Validates: Requirements 13.6**

### Property 16: Calculation Report Controlling Check

*For any* `CalculationReportData` with one or more limit state checks, the
`controllingCheck` field SHALL be the check with the highest `utilizationRatio`, and it
SHALL appear as the first entry when the report is rendered.

**Validates: Requirements 8.2, 8.3**


---

## Error Handling

### 5.1 Pre-Analysis Validation Errors

Validation errors are non-exceptional — they are returned as structured `ValidationResult`
objects, never thrown. The `runAnalysis` action checks `result.errorCount > 0` before
submitting to any solver. The WarningLogPanel opens automatically when issues exist.

### 5.2 RepairModel Failures

`repairModel` is a pure function and cannot fail. If the input model is malformed in a way
that prevents repair (e.g., corrupt node references), the function returns the original
model unchanged with `hasChanges = false` and logs a warning to the console.

### 5.3 PDF Generation Timeout

If PDF generation exceeds 10 seconds, the ReportExportDialog displays an error toast:
"Report generation timed out. Try reducing the number of sections or members." The
operation is cancelled and no partial PDF is offered.

### 5.4 Trust Bar Statistics Endpoint Unavailable

The LandingPage fetches trust bar stats on mount with a 3-second timeout. On failure
(network error, 5xx, or timeout), it reads from `localStorage` key `trust_bar_cache`.
If no cache exists, it renders placeholder dashes ("—") rather than zeros to avoid
misleading users.

### 5.5 AI Assistant Service Error

When the AI assistant API returns a non-2xx response or times out, the panel renders:

```
AI Assistant is temporarily unavailable.
Please try again in a few minutes.
```

No stack trace or raw error message is shown to the user. The error is logged to the
existing error tracking service.

### 5.6 Shareable Report Link Expiry

Accessing a `/api/reports/share/:token` URL after the 7-day expiry returns HTTP 410 Gone.
The frontend renders a "This link has expired" page with a CTA to log in and regenerate.

### 5.7 Analytics Delivery Failure

If the analytics endpoint is unreachable, funnel events are queued in `sessionStorage`
(max 50 events) and retried with exponential backoff (1s, 2s, 4s, max 3 retries). Events
that cannot be delivered after retries are silently dropped — analytics loss is acceptable
and must not degrade the user experience.

### 5.8 Onboarding State Corruption

If `onboardingProgress` in the user profile is missing or has an invalid shape, the
platform defaults to `currentStep: 1, completedSteps: []` and re-runs the full flow.
This is a safe fallback — repeating onboarding is preferable to a broken state.

---

## Testing Strategy

### 6.1 Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:

- Unit tests verify specific examples, edge cases, and integration points
- Property tests verify universal correctness across all inputs

### 6.2 Property-Based Testing

**Library**: `fast-check` (already used in the codebase for space-planning tests)

**Configuration**: Each property test runs a minimum of 100 iterations.

**Tag format**: Each test file includes a comment:
`// Feature: beamlab-ux-and-product-strategy, Property N: <property_text>`

**Property test sketches** (one test per property):

```typescript
// Property 1: Validation Detection Completeness
// Feature: beamlab-ux-and-product-strategy, Property 1: Validation detection completeness
import * as fc from 'fast-check';
import { validateModel } from '../services/modelValidation';

test('validation detects all error conditions', () => {
  fc.assert(fc.property(
    fc.record({
      hasZeroLengthMember: fc.boolean(),
      hasMissingNodeRef: fc.boolean(),
      hasUnconnectedNode: fc.boolean(),
      hasNoSupports: fc.boolean(),
      hasNoLoads: fc.boolean(),
    }),
    (flags) => {
      const model = buildModelWithFlags(flags);
      const result = validateModel(model);
      const errorCodes = result.issues.map(i => i.code);
      if (flags.hasZeroLengthMember) expect(errorCodes).toContain('ZERO_LENGTH_MEMBER');
      if (flags.hasMissingNodeRef) expect(errorCodes).toContain('MISSING_NODE_REF');
      if (flags.hasNoSupports) expect(errorCodes).toContain('NO_SUPPORTS');
      if (flags.hasNoLoads) expect(errorCodes).toContain('NO_LOADS');
    }
  ), { numRuns: 200 });
});

// Property 4: Repair Model Idempotency
// Feature: beamlab-ux-and-product-strategy, Property 4: Repair model idempotency
test('repairModel is idempotent', () => {
  fc.assert(fc.property(
    arbitraryStructuralModel(),
    (model) => {
      const once = repairModel(model);
      const twice = repairModel(once.model);
      expect(twice.summary.totalFixes).toBe(0);
    }
  ), { numRuns: 100 });
});

// Property 6: Tier Watermark Invariant
// Feature: beamlab-ux-and-product-strategy, Property 6: Tier watermark invariant
test('free tier PDFs always contain watermark', () => {
  fc.assert(fc.property(
    arbitraryReportConfig(),
    async (config) => {
      const pdf = await generateReport(config, 'free');
      const pages = extractPDFPages(pdf);
      pages.forEach(page => expect(page).toContain('BeamLab Free'));
    }
  ), { numRuns: 100 });
});

test('paid tier PDFs never contain watermark', () => {
  fc.assert(fc.property(
    fc.oneof(fc.constant('pro'), fc.constant('enterprise')),
    arbitraryReportConfig(),
    async (tier, config) => {
      const pdf = await generateReport(config, tier);
      const pages = extractPDFPages(pdf);
      pages.forEach(page => expect(page).not.toContain('BeamLab Free'));
    }
  ), { numRuns: 100 });
});

// Property 12: Grid Snapping Invariant
// Feature: beamlab-ux-and-product-strategy, Property 12: Grid snapping invariant
test('snapped coordinates are multiples of grid spacing', () => {
  fc.assert(fc.property(
    fc.float({ min: 0.1, max: 10.0 }),   // grid spacing G
    fc.float({ min: -100, max: 100 }),    // raw x
    fc.float({ min: -100, max: 100 }),    // raw y
    fc.float({ min: -100, max: 100 }),    // raw z
    (G, rawX, rawY, rawZ) => {
      const snapped = snapToGrid({ x: rawX, y: rawY, z: rawZ }, G);
      expect(snapped.x % G).toBeCloseTo(0, 9);
      expect(snapped.y % G).toBeCloseTo(0, 9);
      expect(snapped.z % G).toBeCloseTo(0, 9);
    }
  ), { numRuns: 500 });
});

// Property 13: Coordinate Command Bar Round-Trip
// Feature: beamlab-ux-and-product-strategy, Property 13: Coordinate command bar round-trip
test('parseCoordinateInput round-trips absolute coordinates', () => {
  fc.assert(fc.property(
    fc.float({ min: -1000, max: 1000 }),
    fc.float({ min: -1000, max: 1000 }),
    fc.float({ min: -1000, max: 1000 }),
    (x, y, z) => {
      const input = `${x}, ${y}, ${z}`;
      const result = parseCoordinateInput(input);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(x, 6);
      expect(result!.y).toBeCloseTo(y, 6);
      expect(result!.z).toBeCloseTo(z, 6);
      expect(result!.isRelative).toBe(false);
    }
  ), { numRuns: 200 });
});

// Property 14: Section Library Filter Fidelity
// Feature: beamlab-ux-and-product-strategy, Property 14: Section library filter fidelity
test('section library filter returns only matching sections', () => {
  fc.assert(fc.property(
    arbitrarySectionFilter(),
    (filter) => {
      const results = filterSections(allSections, filter);
      results.forEach(section => {
        if (filter.designCode) expect(section.designCode).toBe(filter.designCode);
        if (filter.profileFamily) expect(section.family).toBe(filter.profileFamily);
        if (filter.minDepth != null) expect(section.depth).toBeGreaterThanOrEqual(filter.minDepth);
        if (filter.maxDepth != null) expect(section.depth).toBeLessThanOrEqual(filter.maxDepth);
      });
    }
  ), { numRuns: 200 });
});

// Property 15: Self-Weight Computation Correctness
// Feature: beamlab-ux-and-product-strategy, Property 15: Self-weight computation correctness
test('self-weight equals density × area × g', () => {
  fc.assert(fc.property(
    fc.float({ min: 1000, max: 20000 }),  // density kg/m³
    fc.float({ min: 100, max: 100000 }),  // area mm²
    fc.float({ min: 0.1, max: 100 }),     // length m
    (density, areaMm2, length) => {
      const expected = density * (areaMm2 * 1e-6) * 9.81; // kN/m
      const actual = computeSelfWeight(density, areaMm2, length);
      expect(actual).toBeCloseTo(expected, 4);
    }
  ), { numRuns: 300 });
});
```

### 6.3 Unit Tests

Unit tests focus on specific examples, edge cases, and integration points:

**Help Center**
- Search returns empty array for a query with no matches
- Search returns correct articles for known query terms
- All required article slugs are present in the article index

**Onboarding**
- Completing step 5 fires the `onboarding_completed` analytics event
- Dismissing at step 3 saves `completedSteps: [1, 2, 3]`
- Re-entering after dismissal at step 3 starts at step 4

**Warning Log**
- `WarningLogPanel` renders 0 rows for an empty `ValidationResult`
- "Go to" button calls `onGoTo` with the correct issue
- "Repair Model" button calls `onRepair`

**Repair Model**
- Clean model returns `hasChanges: false` and `totalFixes: 0`
- Model with two nodes at (0,0,0) and (0.005,0,0) returns `mergedNodes: 1`
- Model with a zero-length member returns `removedZeroLengthMembers: 1`

**Calculation Report**
- Report with all passing checks renders no fail badge
- Report with one failing check (utilization > 1.0) renders fail badge on controlling check
- Controlling check is always the first row

**Conversion Prompts**
- `ConversionPrompt` with trigger `'project_limit'` renders the correct message
- Dismiss button calls `onDismiss` without calling `onUpgrade`

**Funnel Analytics**
- `trackFunnel` with `analyticsConsent = false` does not call the endpoint
- `trackFunnel` payload does not contain `email` or `name` fields

**Trust Bar**
- Renders cached values when the endpoint returns 500
- Renders "—" when no cache exists and endpoint fails

**Command Bar**
- `parseCoordinateInput("abc")` returns `null`
- `parseCoordinateInput("@1.5, 0, 0")` with last node `{x:1, y:0, z:0}` returns `{x:2.5, y:0, z:0, isRelative:true}`

### 6.4 Integration Tests

- Full onboarding flow: sign up → redirect → complete 5 steps → dashboard
- Analysis blocked: model with errors → click Run Analysis → solver not called
- Repair + re-validate: model with duplicate nodes → repair → validation returns 0 errors
- PDF watermark: free-tier user → generate report → every page contains watermark string
- Funnel event delivery: trigger `upgrade_prompt_shown` → event appears in `/api/admin/funnel-stats`

### 6.5 Test File Locations

```
apps/web/src/services/__tests__/modelValidation.test.ts
apps/web/src/services/__tests__/repairModel.test.ts
apps/web/src/services/__tests__/repairModel.property.test.ts
apps/web/src/services/__tests__/commandBar.test.ts
apps/web/src/services/__tests__/commandBar.property.test.ts
apps/web/src/services/__tests__/sectionLibrary.property.test.ts
apps/web/src/services/__tests__/selfWeight.property.test.ts
apps/web/src/components/__tests__/WarningLogPanel.test.tsx
apps/web/src/components/__tests__/CalculationReport.test.tsx
apps/web/src/components/__tests__/ConversionPrompt.test.tsx
apps/web/src/components/__tests__/ReportExportDialog.property.test.ts
apps/web/src/hooks/__tests__/useAnalytics.test.ts
apps/web/src/pages/__tests__/HelpCenterPage.test.tsx
apps/web/src/pages/__tests__/OnboardingFlow.test.tsx
apps/api/src/__tests__/funnelStats.test.ts
```

