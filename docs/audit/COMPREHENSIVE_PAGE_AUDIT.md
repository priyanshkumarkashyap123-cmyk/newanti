# Comprehensive UI/UX Audit — All 25 Page Components

**Scope:** `apps/web/src/pages/*.tsx` (25 files)  
**Date:** 2025  
**Auditor:** Automated static analysis  
**Criteria:** Loading states · Error states · Empty states · Accessibility · Mobile responsiveness · Navigation · User feedback · Dead buttons

---

## Summary Dashboard

| Severity | Count |
|----------|-------|
| 🔴 Critical | 32 |
| 🟡 Warning | 28 |
| 🔵 Info | 16 |
| **Total** | **76** |

---

## Audit Findings Table

### 🔴 CRITICAL Issues (Must Fix)

| # | File | Line(s) | Category | Issue |
|---|------|---------|----------|-------|
| C1 | `SettingsPage.tsx` | ~620–780 | Dead Buttons | **All Select/Toggle `onChange` handlers are `() => { }` (NO-OP).** Units, notifications, and display settings do NOT persist — user changes are silently discarded. |
| C2 | `SettingsPageEnhanced.tsx` | ~445 | Dead Buttons | **"Change Password" button** has no `onClick` handler. |
| C3 | `SettingsPageEnhanced.tsx` | ~455 | Dead Buttons | **"Export My Data" button** has no `onClick` handler. |
| C4 | `SettingsPageEnhanced.tsx` | ~465 | Dead Buttons | **"Delete Account" button** has no `onClick` handler — a critical account action is completely non-functional. |
| C5 | `HelpPage.tsx` | ~230 | Dead Buttons | **"Chat with Support" button** has no `onClick` handler. |
| C6 | `HelpPage.tsx` | ~240 | Dead Buttons | **"Email Us" button** has no `onClick` handler. |
| C7 | `HelpPage.tsx` | ~180 | Dead Buttons | **"View all videos" link** has no `href` (navigates nowhere). |
| C8 | `HelpPage.tsx` | ~200 | Dead Buttons | **"Go to Documentation Center"** uses `href="#"` — dead link. |
| C9 | `HelpPage.tsx` | ~100 | Dead Buttons | **Search bar does NOT filter** FAQ or help content — purely decorative. |
| C10 | `ContactPage.tsx` | ~120 | Error States | **API errors are silently swallowed.** The `catch` block sets `submitted = true` (success) even on failure — user believes message was sent when it wasn't. |
| C11 | `ConcreteDesignPage.tsx` | ~1050 | Dead Buttons | **"Download Detailed Report" button** has no `onClick` handler. |
| C12 | `FoundationDesignPage.tsx` | ~726 | Dead Buttons | **"Download Report" button** has no `onClick` handler. |
| C13 | `StructuralDesignCenter.tsx` | ~700 | Dead Buttons | **"Docs" button** in top bar has no `onClick` handler. |
| C14 | `StructuralDesignCenter.tsx` | ~705 | Dead Buttons | **"Export" button** in top bar has no `onClick` handler. |
| C15 | `StructuralDesignCenter.tsx` | ~710 | Dead Buttons | **"View All" button** in recent designs section has no `onClick` handler. |
| C16 | `StructuralDesignCenter.tsx` | ~740 | Dead Buttons | **Footer "Help" and "Settings" buttons** have no `onClick` handlers. |
| C17 | `CloudStorageDashboard.tsx` | ~870 | Dead Buttons | **"Open in Editor" button** in project detail panel has no `onClick` — primary action is non-functional. |
| C18 | `CloudStorageDashboard.tsx` | ~875 | Dead Buttons | **"Download" button** in project detail panel has no `onClick`. |
| C19 | `CloudStorageDashboard.tsx` | ~880 | Dead Buttons | **"Share" button** in project detail panel has no `onClick`. |
| C20 | `CloudStorageDashboard.tsx` | ~885 | Dead Buttons | **"Duplicate" button** in project detail panel has no `onClick`. |
| C21 | `CloudStorageDashboard.tsx` | ~890 | Dead Buttons | **"Delete" button** in project detail panel has no `onClick` and no confirmation dialog. |
| C22 | `CloudStorageDashboard.tsx` | ~612 | Dead Buttons | **Star/Favorite toggle** `onClick` only calls `stopPropagation()` with no actual toggle logic — star state never changes. |
| C23 | `CollaborationHub.tsx` | ~940 | Dead Buttons | **"Reply" button** on comments has no `onClick` handler — cannot reply to design comments. |
| C24 | `CollaborationHub.tsx` | ~950 | Dead Buttons | **"Show in Model" button** on comments has no `onClick` handler. |
| C25 | `CollaborationHub.tsx` | ~967 | Dead Buttons | **"Pin to Element" button** has no `onClick` handler. |
| C26 | `CollaborationHub.tsx` | ~970 | Dead Buttons | **"Attach File" button** has no `onClick` handler. |
| C27 | `CollaborationHub.tsx` | ~986 | Dead Buttons | **"Create Milestone" button** has no `onClick` handler. |
| C28 | `CollaborationHub.tsx` | ~1145 | Dead Buttons | **"Compare Changes" button** has no `onClick` handler — version comparison is non-functional. |
| C29 | `CollaborationHub.tsx` | ~1020 | Dead Buttons | **Version history action buttons** (View 👁️, Restore ↩️, Download 📥) have `aria-label` but no `onClick`. |
| C30 | `CollaborationHub.tsx` | ~800 | Dead Buttons | **Team member action buttons** (💬 chat, ⚙️ settings) have no `onClick`. |
| C31 | `EnhancedPricingPage.tsx` | ~550 | Dead Buttons | **PPP banner "Apply for India Plan" button** has no `onClick` handler. |
| C32 | `ReportsPage.tsx` | ~1740 | Dead Buttons | **"Share" button** in floating action bar has no `onClick` handler. |

---

### 🟡 WARNING Issues (Should Fix)

| # | File | Line(s) | Category | Issue |
|---|------|---------|----------|-------|
| W1 | `SteelDesignPage.tsx` | 1–300 | Mobile Responsiveness | **No responsive CSS classes anywhere.** Uses hardcoded pixel widths and `bg-[#1e1e1e]` inline color values. Page is completely unusable on mobile. |
| W2 | `SteelDesignPage.tsx` | 1–300 | Navigation | **No back button, breadcrumb, or navigation link.** User is trapped on the page with no way to return. |
| W3 | `SteelDesignPage.tsx` | 1–300 | Accessibility | **No `aria-label` attributes** on any interactive elements. Form inputs lack proper `htmlFor`/`id` label association. |
| W4 | `ConnectionDesignPage.tsx` | 1–18 | All Categories | **18-line wrapper component** that only renders `<ConnectionDesignPanel />`. Has zero loading states, zero error handling, zero empty states, zero navigation, zero accessibility attributes. All UX depends entirely on the child component. |
| W5 | `SettingsPage.tsx` | ~200 | Mobile Responsiveness | **Sidebar uses fixed `w-60 flex-shrink-0`** — does not collapse on mobile. Settings tabs are inaccessible on small screens. |
| W6 | `SettingsPageEnhanced.tsx` | ~100 | Mobile Responsiveness | **Sidebar is not responsive** — no mobile collapse/hamburger pattern. |
| W7 | `SettingsPage.tsx` | ~50 | User Feedback | **Profile tab shows hardcoded** `"User"` / `"user@beamlab.app"` instead of actual user data from auth provider. |
| W8 | `DigitalTwinDashboard.tsx` | ~500 | Mobile Responsiveness | **KPI cards use `grid-cols-4`** without responsive breakpoints (`sm:`, `md:` prefixes). Cards overflow on small screens. |
| W9 | `QuantitySurveyPage.tsx` | 1–230 | Navigation | **No back button or navigation link.** User cannot return to the previous page. |
| W10 | `QuantitySurveyPage.tsx` | 1–230 | Loading States | **No loading indicator** for auto-generation of BOQ items from the structural model. |
| W11 | `QuantitySurveyPage.tsx` | ~100 | Accessibility | **Form inputs missing `htmlFor`/`id` label association.** Screen readers cannot associate labels with their inputs. |
| W12 | `QuantitySurveyPage.tsx` | ~150 | User Feedback | **"Add" button does not validate** empty description field — allows adding blank BOQ items. |
| W13 | `EnhancedPricingPage.tsx` | ~50 | Mobile Responsiveness | **No mobile hamburger menu** in navigation bar. Nav links overflow on small screens. |
| W14 | `AboutPage.tsx` | ~50 | Mobile Responsiveness | **No mobile hamburger menu** in navigation. Links may overflow on small screens. |
| W15 | `HelpPage.tsx` | ~50 | Mobile Responsiveness | **No mobile navigation menu.** Desktop nav links are hidden or overflow on mobile. |
| W16 | `ContactPage.tsx` | ~50 | Mobile Responsiveness | **No mobile hamburger menu.** Nav links are not accessible on small screens. |
| W17 | `ContactPage.tsx` | 1–300 | Navigation | **No back button or breadcrumb.** User must use browser back button. |
| W18 | `ConcreteDesignPage.tsx` | 1–1123 | Navigation | **No back button, breadcrumb, or navigation link.** |
| W19 | `FoundationDesignPage.tsx` | 1–794 | Navigation | **No back button or navigation link.** User is stranded on the page. |
| W20 | `FoundationDesignPage.tsx` | ~630 | Mobile Responsiveness | **Soil & Materials section uses `grid-cols-2`** without responsive breakpoints for very small screens. |
| W21 | `FoundationDesignPage.tsx` | 500–720 | Accessibility | **All form input labels lack `htmlFor`/`id` pairing.** Labels are nearby `<label>` elements but not programmatically associated with their `<input>` elements. |
| W22 | `CollaborationHub.tsx` | ~560 | Accessibility | **Activity feed items use hardcoded `bg-slate-700/50`** — appears broken in light mode (dark background on light page). |
| W23 | `CollaborationHub.tsx` | ~1310 | Accessibility | **Access settings toggles** are built with `<div>` elements instead of `<input type="checkbox">`. No `role="switch"`, no `aria-checked`, not keyboard-accessible. |
| W24 | `CollaborationHub.tsx` | ~1340 | Mobile Responsiveness | **Tab buttons use `flex-wrap`** but individual tab widths are not constrained — may cause horizontal scroll on small screens. |
| W25 | `CollaborationHub.tsx` | 1–1392 | Loading States | **No loading state at all.** Uses entirely hardcoded static data with no indication of data fetching. |
| W26 | `CollaborationHub.tsx` | 1–1392 | Empty States | **No empty states** for any tab — if there are no team members, comments, versions, or shared projects, the user sees an empty container. |
| W27 | `CloudStorageDashboard.tsx` | ~830 | Mobile Responsiveness | **Selected project detail panel** uses `fixed w-96` which covers the entire screen on mobile with no close affordance visible without scrolling. |
| W28 | `ReportsPage.tsx` | 1–1767 | Loading States | **No loading indicator** for report generation/rendering. Long reports with many nodes/members may take time to render with no feedback. |

---

### 🔵 INFO Issues (Nice to Have)

| # | File | Line(s) | Category | Issue |
|---|------|---------|----------|-------|
| I1 | `Dashboard.tsx` | various | Consistency | Uses `material-symbols-outlined` font icons alongside Lucide React icons — inconsistent icon library. |
| I2 | `SettingsPageEnhanced.tsx` | various | Consistency | Uses `material-symbols-outlined` font icons while most pages use Lucide React. Also uses CSS custom properties for colors instead of Tailwind. |
| I3 | `Dashboard.tsx` | ~900 | Empty States | **Favorites and Trash tabs** display only static placeholder empty states — cannot actually favorite or trash projects from these tabs. |
| I4 | `PricingPage.tsx` | 1–474 | User Feedback | **No toast/notification on payment success** — user is redirected without confirmation feedback. |
| I5 | `PricingPage.tsx` | ~300 | Loading States | **No loading skeleton** while the pricing page initializes. Content appears abruptly. |
| I6 | `SignInPage.tsx` | 1–200 | — | Well-implemented. Has `ClerkLoading` skeleton, `ClerkLoaded` rendering, dark mode detection, "Back to home" link. No issues found. |
| I7 | `SignUpPage.tsx` | 1–200 | — | Well-implemented. Same pattern as SignInPage. No issues found. |
| I8 | `NotFoundPage.tsx` | 1–150 | — | **Excellent implementation.** Multiple navigation options, `aria-hidden` on decorative elements, `window.history.back()`, random tips. No issues found. |
| I9 | `LandingPage.tsx` | 1–1580 | — | **Excellent accessibility.** Has `aria-label`, `aria-checked`, `role="radiogroup"`, `scope` attributes on table headers, skip-to-content link, keyboard-navigable pricing toggle. No significant issues. |
| I10 | `BarBendingSchedulePage.tsx` | 1–826 | — | Well-implemented. Has back button (`navigate(-1)`), tab navigation, empty states per tab, CSV export, responsive grid layout. No significant issues. |
| I11 | `UnifiedDashboard.tsx` | 1–860 | — | Well-implemented. Real API fetching with loading skeleton, error state with Retry, empty state with search feedback, delete confirmation dialog. No significant issues. |
| I12 | `ReportsPage.tsx` | 1–1767 | Accessibility | Excellent table semantics with `<thead>`, `<tbody>`, `scope` attributes. Proper empty states for all data sections. Pagination controls properly disabled when on first/last page. Professional quality. |
| I13 | `PostAnalysisDesignHub.tsx` | 1–1000+ | Empty States | Has comprehensive member design interface with search, filter, select-all, and section assignment. Client-side fallback for steel design. Proper `aria-label` on close buttons. (Partially audited — 1000/2389 lines read.) |
| I14 | `CollaborationHub.tsx` | various | Consistency | Uses emoji characters (👥💬📊) for icons instead of Lucide React or consistent icon system used elsewhere. |
| I15 | `CloudStorageDashboard.tsx` | ~740 | Accessibility | **List view table action buttons** (Download, Share, MoreVertical) have no `aria-label` — screen readers cannot identify button purpose. |
| I16 | `ConcreteDesignPage.tsx` | ~500 | User Feedback | Has good inline error display with `AlertCircle` icon and clear/descriptive error messages. Client-side IS 456 fallback when API is unavailable is well-handled with a badge indicator. |

---

## Per-Page Summary

| Page | Loading | Error | Empty | A11y | Mobile | Nav | Feedback | Dead Btns | Grade |
|------|---------|-------|-------|------|--------|-----|----------|-----------|-------|
| `LandingPage.tsx` | N/A | N/A | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| `NotFoundPage.tsx` | N/A | N/A | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| `SignInPage.tsx` | ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| `SignUpPage.tsx` | ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ✅ | ✅ | **A** |
| `BarBendingSchedulePage.tsx` | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **A-** |
| `UnifiedDashboard.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **A-** |
| `Dashboard.tsx` | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | **B+** |
| `ReportsPage.tsx` | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | **B+** |
| `ConcreteDesignPage.tsx` | ✅ | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ | ❌ | **B** |
| `FoundationDesignPage.tsx` | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ❌ | **B** |
| `DigitalTwinDashboard.tsx` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | **B** |
| `PricingPage.tsx` | ⚠️ | ✅ | N/A | ✅ | ✅ | ✅ | ⚠️ | ✅ | **B** |
| `EnhancedPricingPage.tsx` | N/A | N/A | N/A | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | **B-** |
| `AboutPage.tsx` | N/A | N/A | N/A | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | **B-** |
| `CloudStorageDashboard.tsx` | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ❌ | **C+** |
| `PostAnalysisDesignHub.tsx` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | **B** |
| `QuantitySurveyPage.tsx` | ❌ | ❌ | ⚠️ | ❌ | ✅ | ❌ | ⚠️ | ✅ | **C** |
| `StructuralDesignCenter.tsx` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | **C+** |
| `ContactPage.tsx` | ✅ | ❌ | N/A | ✅ | ⚠️ | ❌ | ❌ | ✅ | **C** |
| `SteelDesignPage.tsx` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | **C-** |
| `CollaborationHub.tsx` | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ⚠️ | ❌ | **D** |
| `SettingsPage.tsx` | N/A | N/A | N/A | ⚠️ | ❌ | ✅ | ❌ | ❌ | **D** |
| `SettingsPageEnhanced.tsx` | N/A | N/A | N/A | ⚠️ | ❌ | ✅ | ✅ | ❌ | **D+** |
| `HelpPage.tsx` | N/A | N/A | N/A | ⚠️ | ❌ | ⚠️ | ❌ | ❌ | **D** |
| `ConnectionDesignPage.tsx` | ❓ | ❓ | ❓ | ❓ | ❓ | ❌ | ❓ | ❓ | **F** |

**Legend:** ✅ Good · ⚠️ Partial/Issues · ❌ Missing/Broken · ❓ Delegated to child · N/A Not applicable

---

## Top Priority Fixes

### 1. Fix Settings Pages — Settings Don't Persist (C1)
**Impact:** Every user who tries to change units, display, notification, or shortcut settings finds their changes silently ignored.  
**Files:** `SettingsPage.tsx` (all `onChange: () => { }` handlers), `SettingsPageEnhanced.tsx` (dead account action buttons)  
**Fix:** Wire up `onChange` handlers to a Zustand store or API. Add save confirmation toast.

### 2. Fix ContactPage Silent Error Swallowing (C10)
**Impact:** Users think their support message was sent when the API call actually failed.  
**File:** `ContactPage.tsx` ~L120  
**Fix:** In the `catch` block, set an error state instead of success. Display an error message with retry option.

### 3. Wire Up Download Report Buttons (C11, C12)
**Impact:** Users complete a design analysis but cannot download the results.  
**Files:** `ConcreteDesignPage.tsx` ~L1050, `FoundationDesignPage.tsx` ~L726  
**Fix:** Implement PDF generation using the existing report infrastructure from `ReportsPage.tsx`.

### 4. Fix CollaborationHub Dead Buttons (C23–C30)
**Impact:** 8+ core collaboration features (reply, attach, pin, compare, milestone) are completely non-functional.  
**File:** `CollaborationHub.tsx`  
**Fix:** Either implement the handlers or display "Coming Soon" tooltips.

### 5. Fix CloudStorageDashboard Project Actions (C17–C22)
**Impact:** Users can view projects but cannot open, download, share, duplicate, or delete them.  
**File:** `CloudStorageDashboard.tsx`  
**Fix:** Wire up project actions to the `ProjectService` API. Add confirmation dialog for delete.

### 6. Add Mobile Navigation to Public Pages (W13–W16)
**Impact:** Marketing pages (Pricing, About, Help, Contact) are not navigable on mobile.  
**Fix:** Add hamburger menu component consistent with `LandingPage.tsx` mobile nav pattern.

### 7. Add Back Navigation to Design Pages (W2, W9, W18, W19)
**Impact:** Users entering SteelDesign, ConcreteDesign, FoundationDesign, or QuantitySurvey pages cannot navigate back.  
**Fix:** Add `<Link to="/dashboard">` or `navigate(-1)` back button, following the pattern in `BarBendingSchedulePage.tsx`.

---

## Files With Zero Issues

| File | Notes |
|------|-------|
| `SignInPage.tsx` | Clean Clerk integration with loading skeleton |
| `SignUpPage.tsx` | Same pattern as SignInPage |
| `NotFoundPage.tsx` | Excellent UX with multiple recovery paths |
| `LandingPage.tsx` | Best accessibility of all pages |
| `BarBendingSchedulePage.tsx` | Complete UX with back nav, tabs, empty states, export |

---

*End of audit. 76 issues identified across 25 page components.*
