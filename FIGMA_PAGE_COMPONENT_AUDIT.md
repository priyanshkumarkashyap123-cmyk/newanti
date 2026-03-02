# BeamLab — Exhaustive Page Component Audit for Figma Reproduction

> **Scope**: All 24 React page components in `apps/web/src/pages/`
> **Purpose**: Micro-detailed inventory of every layout, component, Tailwind class, color, icon, interactive element, state, and animation — sufficient for pixel-perfect Figma reproduction.

---

## Table of Contents

| # | Component | Lines | File |
|---|-----------|-------|------|
| 1 | [Dashboard](#1-dashboardtsx) | 1078 | Dashboard.tsx |
| 2 | [UnifiedDashboard](#2-unifieddashboardtsx) | 835 | UnifiedDashboard.tsx |
| 3 | [PostAnalysisDesignHub](#3-postanalysisdesignhubtsx) | 2210 | PostAnalysisDesignHub.tsx |
| 4 | [LandingPage](#4-landingpagetsx) | 1027 | LandingPage.tsx |
| 5 | [SettingsPage](#5-settingspagetsx) | 795 | SettingsPage.tsx |
| 6 | [SettingsPageEnhanced](#6-settingspageenhancedtsx) | 478 | SettingsPageEnhanced.tsx |
| 7 | [PricingPage](#7-pricingpagetsx) | 442 | PricingPage.tsx |
| 8 | [EnhancedPricingPage](#8-enhancedpricingpagetsx) | 1216 | EnhancedPricingPage.tsx |
| 9 | [HelpPage](#9-helppagetsx) | 337 | HelpPage.tsx |
| 10 | [AboutPage](#10-aboutpagetsx) | 258 | AboutPage.tsx |
| 11 | [CollaborationHub](#11-collaborationhubtsx) | 1392 | CollaborationHub.tsx |
| 12 | [SteelDesignPage](#12-steeldesignpagetsx) | 435 | SteelDesignPage.tsx |
| 13 | [ConnectionDesignPage](#13-connectiondesignpagetsx) | 19 | ConnectionDesignPage.tsx |
| 14 | [ConcreteDesignPage](#14-concretedesignpagetsx) | 1123 | ConcreteDesignPage.tsx |
| 15 | [FoundationDesignPage](#15-foundationdesignpagetsx) | 702 | FoundationDesignPage.tsx |
| 16 | [BarBendingSchedulePage](#16-barbendingschedulepagetsx) | 826 | BarBendingSchedulePage.tsx |
| 17 | [SectionDatabasePage](#17-sectiondatabasepagetsx) | 528 | SectionDatabasePage.tsx |
| 18 | [LoadCombinationPage](#18-loadcombinationpagetsx) | 509 | LoadCombinationPage.tsx |
| 19 | [MaterialsDatabasePage](#19-materialsdatabasepagetsx) | 949 | MaterialsDatabasePage.tsx |
| 20 | [ReportBuilderPage](#20-reportbuilderpagetsx) | 372 | ReportBuilderPage.tsx |
| 21 | [ReportsPage](#21-reportspagetsx) | 1762 | ReportsPage.tsx |
| 22 | [ProfessionalReportGenerator](#22-professionalreportgeneratortsx) | 1049 | ProfessionalReportGenerator.tsx |
| 23 | [PrintExportCenter](#23-printexportcentertsx) | 1325 | PrintExportCenter.tsx |
| 24 | [CodeComplianceChecker](#24-codecompliancecheckertsx) | 1593 | CodeComplianceChecker.tsx |

---

## 1. Dashboard.tsx

- **Export**: `export const Dashboard: FC<DashboardProps>` + `export default Dashboard`
- **Lines**: 1078
- **Purpose**: Main project management dashboard with sidebar + project CRUD

### Layout Structure
```
min-h-screen bg-white dark:bg-slate-950 flex font-sans
├── Sidebar  (w-[220px] bg-slate-50 dark:bg-slate-900/60 border-r border-slate-200 dark:border-white/[0.06] flex-col)
│   ├── Logo Bar  (px-5 py-4 flex items-center gap-2.5)
│   │   ├── beamLabLogo <img> h-7 w-7
│   │   └── "BeamLab" text-[15px] font-bold tracking-[-0.01em]
│   ├── Tab Nav  (px-3 py-2 space-y-0.5)
│   │   ├── My Projects (Folder icon)
│   │   ├── Templates (BookOpen icon)
│   │   └── Shared (Users icon)
│   │   Active: bg-blue-500/[0.08] text-blue-500 font-medium
│   │   Inactive: text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50
│   ├── Separator (h-px bg-slate-200 dark:bg-white/[0.06] mx-4 my-2)
│   ├── Disabled Items (Favorites ★, Trash 🗑️) — opacity-40 cursor-not-allowed
│   ├── Separator
│   ├── Disabled Items (Analytics 📊, Reports 📄)
│   ├── Settings Link  (to="/settings", Settings icon)
│   ├── Spacer (flex-1)
│   ├── New Project Button  (mx-3 mb-3, rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold shadow-lg shadow-blue-500/20)
│   └── Avatar  (h-9 w-9 rounded-full bg-blue-500/20 text-blue-400 text-sm font-bold)
└── Main Content  (flex-1 flex flex-col min-w-0)
    ├── Header  (h-14 border-b border-slate-200 dark:border-white/[0.06] flex items-center px-6 gap-4 bg-white dark:bg-slate-950)
    │   ├── Search  (Search icon + 200px input, bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-white/[0.06] rounded-lg)
    │   ├── View Toggle  (Grid/List icons, active=bg-blue-500/10 text-blue-500)
    │   ├── Spacer
    │   ├── Bell Notification  (relative, dot w-1.5 h-1.5 bg-blue-500 rounded-full)
    │   ├── Import Button  (Upload icon, ghost)
    │   └── + New Project  (Plus icon, bg-blue-600 text-white rounded-lg)
    ├── Content  (flex-1 overflow-y-auto p-6)
    │   ├── Welcome Greeting  ("Good {timeOfDay}, {name}")
    │   ├── Disclaimer Banner  (bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4, AlertTriangle icon)
    │   ├── StatCards  (grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4)
    │   ├── Quick Actions  (grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3)
    │   │   Each: group cursor-pointer, icon container bg-{color}-500/10 group-hover:bg-{color}-500/15
    │   │   8 modules: 3D Frame (blue), New Truss (cyan), New Building (indigo), AI Generate (purple), Import (orange), Template (teal), Quick Calc (green), Docs (slate)
    │   ├── Tabs  (My Projects | Templates | Shared — underline style)
    │   │   Active: border-b-2 border-blue-500 text-blue-500 font-medium
    │   └── Project Cards  (grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4)
    │       Each card:
    │       ├── aspect-[4/3] thumbnail (bg-white dark:bg-slate-950, grid-pattern, type icon text-5xl)
    │       ├── Badge variant={status}  (top-3 left-3)
    │       ├── Star button  (top-3 right-3, Star icon fill-amber-400 text-amber-400)
    │       ├── Info  (p-4: name, type/members count, last modified with schedule icon)
    │       └── Context Menu  (MoreVertical → dropdown: Open, Rename, Duplicate, Download, Archive, Delete)
    │   OR EmptyState  (Folder 8x8 icon, "No projects yet", CTA button)
    │   OR ListView  (table with cols: Name|Type|Members|Last Modified|…, alternating rows, inline rename input)
    └── Footer  (h-8 bg-slate-50 dark:bg-slate-900/60 border-t, Plan/Storage/Upgrade)
```

### States
- **Loading**: `<Loader2 className="w-6 h-6 animate-spin text-blue-500" />` centered
- **Error**: red banner with `<RefreshCw>` retry button
- **Empty projects**: dashed border card with Folder icon + CTA
- **Project renaming**: inline `<input>` with blue border, blur/enter/esc handlers
- **Context menu**: absolute positioned, bg-white dark:bg-slate-900 shadow-xl rounded-xl border

### Icons (lucide-react)
Folder, Plus, Upload, Grid, Search, Layout, Settings, Users, LogOut, FileText, Loader2, RefreshCw, Bell, Star, Trash2, BarChart3, FileSpreadsheet, MoreVertical, List, LayoutGrid, BookOpen, Bot, Calculator, Building2, Construction, Copy, Edit, Download, Archive, ArrowLeft

### Icons (material-symbols-outlined)
`deployed_code`, `grid_on`, `apartment`, `smart_toy`, `upload_file`, `content_copy`, `calculate`, `menu_book`, `straighten`, `schedule`

### Colors
- Primary: blue-500, blue-600, blue-700
- Surface: slate-50, slate-900/60, slate-950
- Border: slate-200, white/[0.06]
- Text: slate-900, white, slate-600, slate-400, slate-500
- Accent: amber-50/200/400/700/900 (disclaimer), blue-500/10 (active states)
- Status: info (blue), outline (default badge)

### Animations
- `framer-motion`: PageTransition wrapper, layout animation on project cards
- `AnimatePresence` for tab transitions
- `transition-all duration-300` on hover states
- `hover-lift` (custom class), `hover:shadow-lg hover:shadow-blue-500/5`

### Data Constants
- `MODULE_LAUNCHERS`: 8 items with id/title/subtitle/icon/bgColor
- `TEMPLATES`: 6 items (Simply Supported Beam, 2-Bay Frame, Pratt Truss, etc.)
- `SHARED_PROJECTS`: empty array placeholder

---

## 2. UnifiedDashboard.tsx

- **Export**: `export const UnifiedDashboard: FC` + default
- **Lines**: 835
- **Purpose**: Modern glass-morphism command center dashboard

### Layout Structure
```
min-h-screen bg-[#0a0e17] relative overflow-hidden
├── Ambient Glow Blobs (3 absolute positioned divs)
│   ├── w-[500px] h-[500px] bg-blue-500/[0.07] blur-[120px] top-[-10%] left-[-5%]
│   ├── w-[400px] h-[400px] bg-purple-500/[0.05] blur-[100px] top-[40%] right-[-5%]
│   └── w-[300px] h-[300px] bg-cyan-500/[0.04] blur-[80px] bottom-[10%] left-[30%]
├── Header  (sticky top-0 z-50 backdrop-blur-xl bg-[#0a0e17]/70 border-b border-white/[0.04])
│   ├── Left: Logo (h-8 w-8) + "BeamLab" + Badge "ULTIMATE" (bg-gradient-to-r from-amber-500 to-orange-500 text-[10px])
│   ├── Center: Search (Search icon, bg-white/[0.03] border-white/[0.06] w-72 rounded-full, ⌘K shortcut)
│   └── Right: Bell (dot), UserButton (Clerk) OR Avatar + LogOut
├── Content  (max-w-[1400px] mx-auto px-6 py-8 relative z-10)
│   ├── StatPill Row  (grid grid-cols-2 md:grid-cols-4 gap-4 mb-8)
│   │   Each: bg-white/[0.02] backdrop-blur-sm border border-white/[0.04] rounded-2xl p-5 hover:bg-white/[0.04]
│   │   Icon container: w-9 h-9 rounded-xl bg-{color}-500/[0.12]
│   │   Value: text-2xl font-bold, Label: text-slate-500 text-xs uppercase tracking-wider
│   │   4 stats: Projects (blue), Analyses (purple), Members (emerald), Storage (orange)
│   ├── Quick Actions  (grid grid-cols-2 md:grid-cols-4 gap-4 mb-8)
│   │   Each: group bg-white/[0.02] border-white/[0.04] rounded-2xl p-5 hover:bg-white/[0.04]
│   │   Icon: w-10 h-10 rounded-xl, hover group accent transition
│   │   5 actions: 3D Frame (blue), New Truss (purple/cyan), AI Generate (emerald, +AI badge amber-500/20), Import (orange), Help (cyan)
│   │   Some have "AI" badge: bg-amber-500/20 text-amber-400 px-1.5 py-0.5 text-[9px]
│   └── Main Grid  (grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6)
│       ├── Left: Project Cards
│       │   ├── SectionHeader (Recent Projects, "View All" link)
│       │   └── grid grid-cols-1 sm:grid-cols-2 gap-4
│       │       Each card: motion.div layout, bg-white/[0.02] border-white/[0.04] rounded-2xl hover:border-white/[0.08]
│       │       ├── Thumbnail  (aspect-[16/9] bg-slate-950 rounded-t-2xl relative, type icon)
│       │       │   Star button absolute top-3 right-3
│       │       │   Status badge absolute bottom-3 left-3
│       │       └── Info  (p-4: name, meta row, last modified)
│       └── Right Sidebar (320px)
│           ├── Templates Section  (bg-white/[0.02] border-white/[0.04] rounded-2xl p-5)
│           │   List of template items with hover states
│           ├── Quick Tips  (bg-white/[0.02] rounded-2xl p-5)
│           │   Tips with kbd elements (bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono)
│           └── Version  (text-center text-slate-600)
```

### Status Badge Colors
- `draft`: bg-slate-500/20 text-slate-400 border-slate-500/30
- `analyzed`: bg-blue-500/20 text-blue-400 border-blue-500/30
- `designed`: bg-amber-500/20 text-amber-400 border-amber-500/30
- `complete`: bg-emerald-500/20 text-emerald-400 border-emerald-500/30

### Unique Design Tokens
- Background: `#0a0e17` (custom near-black)
- Glass: `bg-white/[0.02]`, `bg-white/[0.03]`, `bg-white/[0.04]`
- Border: `border-white/[0.04]`, `border-white/[0.06]`, `border-white/[0.08]`
- Blur: `backdrop-blur-xl`, `backdrop-blur-sm`
- Ambient orbs: `blur-[120px]`, `blur-[100px]`, `blur-[80px]`

### Animations
- `framer-motion`: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` with stagger `delay: 0.05 * index`
- `layout` prop on project cards for smooth reordering
- `transition-all duration-300` on hovers
- `group-hover:scale-110` on icons

---

## 3. PostAnalysisDesignHub.tsx

- **Export**: `export default PostAnalysisDesignHub`
- **Lines**: 2210
- **Purpose**: STAAD.Pro-style post-analysis design workflow with steel/concrete/connections/foundations/optimization/report tabs

### Layout Structure
```
min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white
├── Header  (sticky top-0 z-40, bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800)
│   ├── Back button (ArrowLeft)
│   ├── BeamLab logo (h-7 w-7)
│   ├── Title "Design Hub" + Badge "POST-ANALYSIS" (bg-blue-500/20 text-blue-400 text-xs font-bold)
│   ├── Member count subtitle
│   └── Nav links: "← Back to Modeler" + "Dashboard"
├── Tab Bar  (bg-slate-50 dark:bg-slate-900/50 border-b, max-w-[1600px])
│   7 tabs: overview|steel|concrete|connections|foundations|optimization|report
│   Active: border-b-2 border-blue-500 text-blue-400
│   Inactive: border-transparent text-slate-600 hover:text-slate-700 dark:text-slate-200
│   Each tab has icon + label
└── Main  (max-w-[1600px] mx-auto px-6 py-6)
    ├── Warning Banner (if no analysis): bg-amber-500/10 border-amber-500/30 rounded-xl
    ├── Overview Tab
    │   ├── Stats Grid  (grid-cols-2 md:grid-cols-4 gap-4)
    │   │   StatCard sub-component: bg-gradient-to-br {color} rounded-xl p-5
    │   │   4 cards: Total Members (blue), Designed (purple), Pass/Fail (emerald), Max Utilization (orange)
    │   ├── Design Codes Grid  (md:grid-cols-3 lg:grid-cols-3)
    │   │   Each: bg-slate-50 dark:bg-slate-800/60 border rounded-xl p-4, group hover:border-blue-500/30
    │   │   Codes: AISC 360, IS 800, EC 3, BS 5950, AS 4100, IS 456, ACI 318, EC 2, NDS
    │   ├── Quick Actions  (grid-cols-2 md:grid-cols-4)
    │   │   4 cards: Design All Steel (blue), Connections (purple), Foundations (emerald), Optimize (orange)
    │   │   Each: bg-gradient-to-br, hover:scale-[1.02]
    │   └── Member Table  (MemberDesignTable component in rounded-xl border)
    ├── Steel Tab
    │   grid-cols-1 lg:grid-cols-4
    │   ├── Sidebar (col-span-1)
    │   │   ├── DesignParametersPanel  (steel grade, Ky/Kz, Lb, Cb selects/inputs)
    │   │   ├── SectionAssignmentPanel  (section picker from database)
    │   │   ├── Run Design Button  (py-3 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20)
    │   │   │   Designing state: RefreshCw animate-spin + progress counter
    │   │   └── Design Summary Card  (pass emerald-400, fail red-400, max utilization)
    │   └── Main (lg:col-span-3)
    │       ├── Search input  (Search icon, pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg w-64)
    │       └── MemberDesignTable
    ├── Concrete Tab
    │   grid-cols-1 lg:grid-cols-4
    │   ├── Sidebar: DesignParametersPanel + Concrete Section inputs (Width/Depth/Cover) + Quick Design links to /structural-design-center
    │   └── MemberDesignTable
    ├── Connections Tab → <ConnectionDesignTab> (external component)
    ├── Foundations Tab → <FoundationDesignTab> (external component)
    ├── Optimization Tab
    │   ├── 3-col grid: Auto-Optimize card (amber), Target Utilization card (blue, range slider), Weight Summary card (emerald)
    │   └── Results table after optimization
    └── Report Tab
        ├── Empty state if no results
        └── Report view: bg-slate-100 dark:bg-slate-800 rounded-xl p-6 font-mono
            ├── Header: "STRUCTURAL DESIGN REPORT" centered
            ├── Metadata grid: Design Code, Steel Grade, Members, Pass/Fail
            ├── Results table: Member|Section|N|V|M|Ratio|Status
            │   PASS → text-emerald-400, FAIL → text-red-400
            └── Buttons: Copy to Clipboard, Full Report Generator link
```

### Sub-Components (inline)
- **StatCard**: `bg-gradient-to-br {color} rounded-xl p-5 text-white`
- **UtilizationBar**: horizontal bar with fill color based on ratio (≤0.7 emerald, ≤0.85 blue, ≤1.0 amber, >1.0 red)
- **MemberDesignTable**: full-width table with checkbox selection, sortable columns, status badges
- **DesignParametersPanel**: collapsible parameter inputs with labels
- **SectionAssignmentPanel**: section search/picker
- **MemberDetailPanel**: slide-in panel (w-[480px], AnimatePresence, motion.div from right)

### Design Codes Data
```
AISC 360-22 (🇺🇸 Steel), IS 800:2007 (🇮🇳 Steel), Eurocode 3 (🇪🇺 Steel),
BS 5950 (🇬🇧 Steel), AS 4100 (🇦🇺 Steel), IS 456:2000 (🇮🇳 Concrete),
ACI 318-19 (🇺🇸 Concrete), Eurocode 2 (🇪🇺 Concrete), NDS (🇺🇸 Timber)
```

### Icons
BarChart3, Columns, Building2, Wrench, Layers, Zap, FileText, ArrowLeft, ArrowRight, Shield, CheckCircle2, TrendingUp, AlertTriangle, RefreshCw, Search, Copy, Target, Award

---

## 4. LandingPage.tsx

- **Export**: `export default LandingPage`
- **Lines**: 1027
- **Purpose**: Public marketing landing page

### Layout Structure
```
min-h-screen bg-white dark:bg-slate-950 selection:bg-blue-500/30 text-slate-900 dark:text-white
├── Navbar  (fixed top-0 w-full z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-white/[0.06])
│   ├── Logo + "BeamLab" text-xl font-bold tracking-[-0.02em]
│   ├── Desktop Nav Links  (hidden md:flex gap-8)
│   │   Features, Pricing, About, Docs — text-sm text-slate-600 dark:text-slate-300 hover:text-blue-500
│   └── CTA Buttons: Log In (ghost) + "Start Free →" (bg-blue-600 text-white rounded-full)
├── Hero Section  (pt-32 pb-20 px-4 relative overflow-hidden)
│   ├── Gradient Mesh Blobs (absolute, blur-[120px])
│   │   3 blobs: blue-500/20, purple-500/10, cyan-500/10
│   ├── Badge  ("Now with 3D Frame Analysis ✨", rounded-full bg-blue-500/10 border-blue-500/20)
│   ├── H1  (text-5xl md:text-7xl font-extrabold tracking-[-0.03em])
│   │   Gradient text: from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-slate-400
│   ├── Subtitle  (text-xl text-slate-600 dark:text-slate-400 max-w-2xl)
│   ├── CTA Row  (flex gap-4)
│   │   Primary: bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full shadow-xl shadow-blue-500/25
│   │   Secondary: border-2 border-slate-300 dark:border-slate-700 rounded-full
│   └── Animated SVG Beam  (w-80 h-16 mx-auto mt-12, line stroke-blue-500, circle fill-blue-500)
├── Stats Bar  (py-8 border-y border-slate-200 dark:border-slate-800, flex justify-center gap-12/16)
│   4 items: 200+ Features, 10K+ Members, <1s Analysis, 99.9% Uptime
├── Trust Logos  (flex justify-center gap-8 opacity-50 grayscale)
│   L&T, Tata Projects, AECOM, Jacobs, Arup, Mott MacDonald
├── Features Section  (py-24, 3-col/4-col grid)
│   12 FeatureCard components, each:
│   ├── rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-white/[0.06]
│   ├── Icon container: w-11 h-11 rounded-xl bg-blue-500/[0.08] border-blue-500/10
│   ├── h3 + description + bullet list (CheckCircle icon text-blue-400/70)
│   └── Top gradient accent on hover (h-px bg-gradient-to-r from-transparent via-blue-500/40)
├── Comparison Table  (bg-slate-50 dark:bg-slate-900 rounded-2xl border)
│   Columns: Feature | STAAD.Pro | ETABS | SkyCiv | BeamLab
│   BeamLab cells: "✨" with text-blue-400 font-bold
│   9 comparison rows
├── Pricing Section  (py-24)
│   3 tiers: Academic (₹0), Professional (₹999/799), Enterprise (₹1,999/1,599)
│   Popular card: relative border-2 border-blue-500/40 shadow-xl shadow-blue-500/10
│   Popular badge: absolute -top-4 bg-gradient-to-r from-blue-600 to-blue-500
│   CTA buttons: primary=bg-blue-600, ghost=border-2
└── Footer  (py-16 bg-slate-50 dark:bg-slate-900 border-t, 6-column grid)
    ├── Logo + description + social icons (GitHub, Twitter)
    ├── Link columns: Product, Resources, Company, Legal
    └── Bottom: copyright + "Made with ❤️ in India"
```

### Animations (framer-motion)
- `fadeInUp` variant: `{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }`
- `staggerContainer`: `{ staggerChildren: 0.1 }`
- `whileInView` on feature cards, `viewport: { once: true, margin: "-50px" }`
- SVG beam: `motion.circle` with `animate={{ cx: [50, 350] }}` + `motion.line`

### Icons
Layers, Terminal, Zap, Globe2, Shield, Cpu, FileText, Users, Cloud, Building, Database, Smartphone, CheckCircle, ArrowRight, Menu, X, Play, Github, Twitter

---

## 5. SettingsPage.tsx

- **Export**: `export default SettingsPage`
- **Lines**: 795
- **Purpose**: Full settings panel with 8 tabs

### Layout Structure
```
min-h-screen bg-white dark:bg-slate-900 flex
├── Sidebar  (w-60 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4)
│   ├── Header: "Settings" + Settings icon
│   └── Tab List  (space-y-1)
│       8 tabs: Profile, General, Units, Display, Shortcuts, Notifications, Analysis, Subscription
│       Active: bg-blue-500/10 text-blue-500 font-medium
│       Inactive: text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700
│       Icons: User, Sliders, Ruler, Monitor, Keyboard, Bell, Cpu, CreditCard
└── Main  (flex-1 p-8 overflow-y-auto)
    ├── Title + description
    └── Tab Content (space-y-6, card-based):
        ├── Profile: Avatar upload, name/email/company/role/phone inputs
        ├── General: Language, Auto-save toggle, Recent files count, Default template
        ├── Units: Length/Force/Moment/Temperature selects (SI/Imperial/Custom)
        ├── Display: Theme (System/Light/Dark), Grid toggle, Axis toggle, Grid size slider, Node size slider, Font size
        ├── Shortcuts: key mapping table (key → action), Reset to Defaults button
        ├── Notifications: Email/Push/Slack toggles
        ├── Analysis: Solver (Auto/Skyline/LU), Tolerance input, Max iterations input, P-Delta toggle, Auto-mesh toggle
        └── Subscription: Current plan card (Free/Pro), Usage bars, Upgrade button
```

### Custom Sub-Components
- **Toggle**: `w-11 h-6 rounded-full, bg-blue-500 (on) / bg-slate-300 dark:bg-slate-600 (off), white dot w-5 h-5 transition-transform translate-x-5/translate-x-0.5`
  - Cpu icon inside dot for Analysis-related toggles
- **Select**: custom div with ChevronDown icon, `bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg`
- **Slider**: `<input type="range">` with gradient fill track via inline style, `accent-blue-500`

### Colors
- Inputs: `bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600`
- Focus: `focus:border-blue-500 focus:ring-1 focus:ring-blue-500`
- Save button: `bg-blue-600 hover:bg-blue-700`
- Danger: `text-red-500 hover:text-red-600` for delete actions

---

## 6. SettingsPageEnhanced.tsx

- **Export**: `export default SettingsPageEnhanced`
- **Lines**: 478
- **Purpose**: Alternative settings page with CSS custom property tokens

### Layout
```
min-h-screen bg-background-dark text-white (CSS custom properties)
├── Header  (bg-surface-dark border-b border-border-dark px-8 py-6)
│   ├── "Settings" h1 text-2xl font-bold
│   └── Tab bar (space-x-1)
│       5 tabs: General, Display, Analysis, Performance, Profile
│       Active: bg-white/10 text-white
│       Inactive: text-white/50 hover:text-white/80
│       Icons: material-symbols-outlined (settings, palette, analytics, speed, person)
└── Main  (max-w-4xl mx-auto px-8 py-8)
    Tab content with sections:
    ├── General: Language, Auto-save interval (slider), File format, Undo history, Startup behavior
    ├── Display: Theme, Accent color (6 swatches: blue/purple/cyan/emerald/amber/rose w-8 h-8 rounded-full), Grid settings, Font sizes
    ├── Analysis: Solver, Precision, Max iterations, P-Delta, Convergence criteria
    ├── Performance: Rendering quality, Worker threads, Memory limit, Hardware acceleration, WebGPU toggle
    └── Profile: Name/email/company/role, Avatar, Export data, Delete account
```

### Unique Details
- Uses CSS tokens: `bg-background-dark`, `bg-surface-dark`, `border-border-dark` (custom Tailwind extensions)
- Material Symbols instead of Lucide: `<span className="material-symbols-outlined text-xl">settings</span>`
- Version: `v4.2.0-pro` displayed
- Color accent swatches: 6 circles with ring-2 ring-offset-2 ring-{color}-500 when selected
- AdvancedToggle and RangeSlider custom components imported

---

## 7. PricingPage.tsx

- **Export**: `export default PricingPage`
- **Lines**: 442
- **Purpose**: Simple 3-tier pricing with Razorpay

### Layout
```
min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white
├── Navbar  (fixed, same as LandingPage)
├── Hero  (pt-32 pb-12 text-center)
│   ├── H1 gradient: from-blue-400 to-purple-500 bg-clip-text text-transparent
│   └── Toggle: Monthly / Yearly (20% off badge bg-green-500/20 text-green-400)
├── Pricing Cards  (grid md:grid-cols-3 gap-8 max-w-5xl mx-auto)
│   ├── Free (₹0): bg-slate-50 dark:bg-slate-900 border rounded-2xl
│   ├── Pro (₹749/₹599): border-2 border-blue-500/50 lg:scale-105 shadow-xl shadow-blue-500/10
│   │   "Most Popular" badge: bg-gradient-to-r from-blue-600 to-blue-500
│   └── Enterprise (Custom): border rounded-2xl
│   Each card: icon + name + price + features list + CTA button
│   Feature items: CheckCircle text-blue-400/text-green-400/text-slate-400
├── FAQ Section  (max-w-2xl mx-auto, 2-col grid)
│   5 items with HelpCircle icon, accordion behavior
└── Footer CTA  (bg-blue-600 rounded-2xl p-12 text-center)
```

### Payment
- Razorpay integration: `key: import.meta.env.VITE_RAZORPAY_KEY_ID`
- Script loaded dynamically
- Amount: `billingPeriod === 'yearly' ? 71900 : 74900` (paise)
- Prefill: name from Clerk auth

---

## 8. EnhancedPricingPage.tsx

- **Export**: `export default EnhancedPricingPage`
- **Lines**: 1216
- **Purpose**: Advanced 4-plan pricing with feature matrix, PPP, compliance sections

### Layout
```
min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white
├── PPP Banner  (conditional, bg-gradient-to-r from-indigo-600 to-purple-600, fixed top)
│   Flag emoji, discount text, dismiss X button
├── Header  (pt-32/40 pb-16 text-center)
│   ├── Badge: "All prices in ₹ (INR)" rounded-full bg-blue-500/10
│   ├── H1: "Engineering Excellence, Priced for Growth." text-4xl md:text-6xl
│   │   Gradient span: from-blue-400 to-purple-500
│   ├── INR badge: rounded-full border bg-blue-500 text-white text-xs
│   └── Billing Toggle: rounded-full bg-slate-50 dark:bg-slate-900 border
│       Active: bg-white text-slate-950, Yearly has "Save 20%" badge (bg-green-500/20 text-green-400)
├── Pricing Cards  (grid md:grid-cols-2 lg:grid-cols-4 gap-6)
│   4 plans: Academic|Professional|Business|Enterprise
│   Highlighted (Professional): bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50
│   Badge: absolute -top-3 center, bg-gradient-to-r from-blue-600 to-purple-600
│   Icon container: p-3 rounded-xl {color}
│   Price: text-4xl font-bold + /month suffix
│   CTA variants: primary=bg-white text-slate-950, secondary=bg-blue-600, outline=border-2
│   Features: Check icon per line
├── Trust Signals  (py-16 border-t bg-slate-50 dark:bg-slate-900/20)
│   5 mock logos: Arup, Thornton Tomasetti, WSP, Buro Happold, SOM
├── Regional Pricing + Security  (2-col grid)
│   ├── Left: PPP discounts, billing options, payment methods, GST invoicing
│   └── Right: Encryption, on-premise, SSO/SAML, audit logs
├── Feature Comparison Matrix  (toggle button, full table)
│   Columns: Features|Starter|Professional|Team|Enterprise
│   Category headers: bg-slate-50 dark:bg-slate-900/50
│   Pro column: bg-blue-500/5, highlight=true
│   FeatureValue: Check (green/blue), X (slate-700), or text string
├── Why Switch Section  (3-col grid: 10x Faster, No Hidden Costs, Collaboration)
│   + Legacy vs BeamLab side-by-side comparison (2-col, left red ✕, right blue ✓)
├── FAQ  (10 items, accordion, max-w-3xl)
│   Chevron toggle, expandable answers
└── CTA + Footer
```

### Icons
Sparkles, Building2, Users, Briefcase, Globe, Check, X, ChevronDown, ChevronUp, ArrowRight, MessageSquare, Lock, Server, Shield, ShieldCheck, Zap

---

## 9. HelpPage.tsx

- **Export**: `export default HelpPage`
- **Lines**: 337
- **Purpose**: Help center with video tutorials, FAQ, support CTA

### Layout
```
min-h-screen bg-white dark:bg-slate-950
├── Header  (bg-gradient-to-br from-blue-600 to-purple-700 py-16 text-white text-center)
│   ├── LifeBuoy icon w-12 h-12
│   ├── H1: "Help Center"
│   └── Subtitle + Search bar (max-w-xl, bg-white/10, Search icon)
├── Content  (max-w-6xl mx-auto px-4 py-12)
│   ├── Quick Links  (grid grid-cols-2 md:grid-cols-4 gap-4)
│   │   4 cards: Getting Started (BookOpen blue), Tutorials (PlayCircle purple), Documentation (FileText emerald), Community (Users amber)
│   │   Each: bg-slate-50 dark:bg-slate-900 border rounded-xl p-6 hover:border-{color}-500/30
│   ├── Video Tutorials  (grid md:grid-cols-2 lg:grid-cols-3 gap-6)
│   │   6 VideoCards, each:
│   │   ├── aspect-video bg-slate-100 dark:bg-slate-800 rounded-t-xl
│   │   │   PlayCircle centered (w-12 h-12 text-blue-400 opacity-0 group-hover:opacity-100)
│   │   │   Duration badge (bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded)
│   │   └── Info (p-4: title + description)
│   ├── FAQ Section  (max-w-3xl mx-auto)
│   │   8 items, accordion with ChevronDown/Up, HelpCircle icons
│   │   Active: bg-blue-50 dark:bg-blue-900/20 border-blue-500/30
│   └── Support CTA  (bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center text-white)
│       2 buttons: "Email Support" (Mail icon) + "Join Discord" (MessageCircle icon)
```

### Icons
LifeBuoy, Search, BookOpen, PlayCircle, FileText, Users, ChevronDown, ChevronUp, HelpCircle, Mail, MessageCircle, ExternalLink

---

## 10. AboutPage.tsx

- **Export**: `export default AboutPage`
- **Lines**: 258
- **Purpose**: Company about page

### Layout
```
min-h-screen bg-white dark:bg-slate-950
├── Hero  (py-20 text-center)
│   ├── Building2 icon w-16 h-16 text-blue-500
│   ├── H1: gradient from-blue-400 to-purple-500
│   └── Subtitle text-xl
├── Mission  (grid md:grid-cols-3 gap-8 max-w-5xl)
│   3 cards: bg-slate-50 dark:bg-slate-900 border rounded-2xl p-8
│   ├── Our Mission (Target icon blue)
│   ├── Our Vision (Eye icon purple)
│   └── Our Values (Heart icon emerald)
├── Technology  (max-w-5xl, bg-slate-50 dark:bg-slate-900 rounded-2xl p-8)
│   Grid of tech cards, each with icon + title + description
│   Technologies: React, TypeScript, WebAssembly, Three.js, Rust, AI/ML
│   Icons: Code2, Braces, Cpu, Box, Cog, Brain
├── Team  (max-w-3xl text-center)
│   Single team member card with avatar placeholder, links to GitHub/Twitter/LinkedIn
└── CTA  (bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center)
    "Start Building with BeamLab" + 2 buttons
```

---

## 11. CollaborationHub.tsx

- **Export**: `export default CollaborationHub`
- **Lines**: 1392
- **Purpose**: Real-time team collaboration with WebSocket multiplayer

### Layout
```
min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6
├── motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
├── Header  (text-center mb-8)
│   ├── H1: gradient from-cyan-400 via-blue-500 to-purple-500, "👥 Collaboration Hub"
│   ├── Subtitle
│   └── Connection Status  (dot + text)
│       Connected: bg-green-500 animate-pulse, "Connected — N users"
│       Demo: bg-yellow-500 animate-pulse, "Demo Mode — N sample users"
├── Tabs  (flex-wrap justify-center gap-2 mb-8)
│   5 tabs: Dashboard 📊 | Team 👥 | Comments 💬 | Versions 📚 | Sharing 🔗
│   Active: bg-cyan-600 text-white
│   Inactive: bg-slate-700 text-slate-300 hover:bg-slate-600
└── Tab Content:
    ├── Dashboard
    │   ├── Stats Grid  (grid-cols-2 md:grid-cols-4)
    │   │   4 gradient cards: Team Online (green→emerald), Open Comments (yellow→orange), Active Projects (blue→cyan), This Week (purple→pink)
    │   ├── Activity Feed  (lg:col-span-2, bg-slate-800 rounded-lg)
    │   │   Activity items: avatar + userName + action + target (cyan-400) + timestamp
    │   ├── Team Status  (bg-slate-800, member list with status dots)
    │   │   Online: bg-green-500, Away: bg-yellow-500, Offline: bg-slate-500
    │   │   Role badges: admin=bg-purple-600, engineer=bg-blue-600, reviewer=bg-green-600, viewer=bg-slate-600
    │   └── Shared Projects  (grid md:grid-cols-2)
    │       Cards with progress bars (from-cyan-500 to-blue-500 gradient fill)
    │       Status: active=green, review=yellow, completed=blue
    ├── Team
    │   ├── Member Cards  (grid md:grid-cols-2 lg:grid-cols-3)
    │   │   Each: bg-slate-700 border-slate-600 hover:border-cyan-500
    │   │   64px avatar circle, status dot, role badge, chat/settings buttons
    │   └── Permissions Table  (8 permissions × 4 roles: ✅/❌)
    ├── Comments
    │   ├── Filter buttons: all|open|pending|resolved
    │   │   Active: bg-cyan-600, Inactive: bg-slate-700
    │   ├── Comment cards  (border-l-4)
    │   │   open: border-yellow-500 bg-yellow-900/10
    │   │   pending: border-blue-500 bg-blue-900/10
    │   │   resolved: border-green-500 bg-green-900/10
    │   │   Status badges: yellow-600 / blue-600 / green-600
    │   │   Location pin: 📍 cyan-400
    │   │   Replies: indented with border-l-2 border-slate-600
    │   └── New Comment  (textarea + Pin/Attach/Post buttons)
    ├── Versions
    │   ├── Timeline  (vertical line w-0.5 bg-slate-600)
    │   │   Dots: current=bg-green-600 🔵, milestone=bg-cyan-600 ⭐, previous=bg-slate-600 ○
    │   │   Cards: current=bg-green-900/20 border-green-600, milestone=bg-cyan-900/20 border-cyan-600
    │   │   Changes: green "+" prefix per item
    │   │   Action buttons: 👁️ View, ↩️ Restore, 📥 Download
    │   └── Compare Versions  (2 selects + bg-purple-600 Compare button)
    └── Sharing
        ├── Share Link  (readonly input + Copy button, copied=bg-green-600)
        ├── Invite by Email  (email input + role select + bg-green-600 Invite)
        ├── Access Settings  (5 toggles with custom switch w-12 h-6)
        │   publicLink, allowComments, downloadPermission, watermarkExports, expiration
        │   On: bg-green-600, Off: bg-slate-500
        └── External Integrations  (grid md:grid-cols-3)
            6 items: BIM 360, Procore, Bluebeam, Teams, Google Drive, Slack
            connected=bg-green-600, available=bg-slate-600
```

### Hooks
- `useMultiplayer()` → `{ isConnected, myId, myName, remoteUsers, activities, addActivity, projectVersion }`
- Demo team shown when not connected (4 members)

---

## 12. SteelDesignPage.tsx

- **Export**: `export function SteelDesignPage()`
- **Lines**: 435
- **Purpose**: Steel member design check page
- **⚠️ Uses INLINE STYLES, not Tailwind**

### Layout (inline CSS)
```
background: '#1e1e1e', color: '#fff', minHeight: '100vh', padding: '2rem'
├── Header
│   ├── Back link (color: '#64b5f6')
│   └── H2: "Steel Design" + Badge "LIVE"
├── Config Section  (display: grid, gridTemplateColumns: repeat(auto-fit, minmax(250px, 1fr)))
│   ├── Design Code select: AISC 360-22 / IS 800:2007
│   ├── Steel Grade select: Fe 250 / A36 / S275 / S355
│   ├── Parameters: Lb, Kx, Ky, Cb
│   └── Assign Section button
│   Inputs: background: '#2d2d2d', border: '1px solid #444', color: '#fff'
├── Design Button  (background: '#2196f3', padding: '12px 24px')
│   Hover: '#1976d2', Disabled: '#666'
├── Results Table  (borderCollapse: 'collapse')
│   Columns: Member | Section | N | Vy | Mz | Ratio | Status | Governing
│   Status colors:
│   - PASS: '#4caf50' (background)
│   - WARNING: '#ff9800' (background)
│   - FAIL: '#f44336' (background)
│   Ratio color: ≤0.7 '#4caf50', ≤0.85 '#64b5f6', ≤1.0 '#ff9800', >1.0 '#f44336'
└── Summary Stats  (4-col grid)
    Total, Pass (#4caf50), Fail (#f44336), Max Ratio
```

### Services
- `SteelDesignService` (Rust API, 10x faster)
- Client-side Perry-Robertson fallback
- AISC E3 column buckling

---

## 13. ConnectionDesignPage.tsx

- **Export**: `export default ConnectionDesignPage`
- **Lines**: 19
- **Purpose**: Thin wrapper for ConnectionDesignPanel

### Layout
```
min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white
└── <ConnectionDesignPanel />  (external component)
```

No additional styling, icons, or states in this file.

---

## 14. ConcreteDesignPage.tsx

- **Export**: `export default ConcreteDesignPage`
- **Lines**: 1123
- **Purpose**: RC beam/column/slab design per IS 456:2000 & ACI 318-19

### Layout
```
min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white
├── Header  (border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 dark:from-slate-900 to-slate-800)
│   ├── H1: gradient from-emerald-400 to-blue-500
│   └── Subtitle: "Professional RC design per IS 456:2000 / ACI 318-19"
└── Content  (max-w-7xl mx-auto px-4 py-8, grid grid-cols-1 lg:grid-cols-3 gap-6)
    ├── Left Panel (lg:col-span-2)
    │   ├── Code & Member Type Selection  (bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border)
    │   │   ├── Design Code  (grid-cols-2 gap-2)
    │   │   │   IS 456:2000 / ACI 318-19 buttons
    │   │   │   Active: bg-emerald-600 text-white
    │   │   │   Inactive: bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
    │   │   └── Member Type  (grid-cols-3 gap-2)
    │   │       Beam (Box icon) / Column (Columns icon) / Slab (Square icon)
    │   │       Active: bg-blue-600 text-white
    │   │       Inactive: bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
    │   ├── Input Forms  (conditional on memberType)
    │   │   Each form has 3 sections:
    │   │   ├── Geometry  (emerald-400 header, Box/Columns/Square icon)
    │   │   ├── Materials  (blue-400 header, concrete M20-M40, steel Fe415/500/550)
    │   │   └── Loads  (amber-400 header)
    │   │   Sections: bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-300 dark:border-slate-700
    │   │   Inputs: bg-slate-100 dark:bg-slate-800 border-slate-600 rounded text-sm
    │   │   Grid layouts: grid-cols-2 to grid-cols-3
    │   ├── Analyze Button  (w-full mt-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600)
    │   │   Spinner: w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin
    │   └── Error Display  (bg-red-900/20 border-red-500/50, AlertCircle icon)
    └── Right Panel (lg:col-span-1)
        ├── Results  (if available)
        │   bg-gradient-to-br from-slate-50 dark:from-slate-900 to-slate-800 rounded-xl p-6 border
        │   ├── Header: CheckCircle2 emerald-400 + "Design Results"
        │   │   Client-side badge: bg-amber-900/40 text-amber-400 border-amber-600/30
        │   ├── Design Summary  (bg-slate-100 dark:bg-slate-800/50 p-4)
        │   │   Status: SAFE (emerald-400) / UNSAFE (red-400)
        │   │   Utilization: percentage
        │   ├── Reinforcement Details  (bg-slate-100 dark:bg-slate-800/50 p-4, blue-400 header)
        │   │   Beam: Main Bottom, Main Top, Stirrups
        │   │   Column: Longitudinal, Ties
        │   │   Slab: Main Short, Main Long, Distribution
        │   ├── Code Checks  (bg-slate-100 dark:bg-slate-800/50 p-4, amber-400 header)
        │   │   Each: CheckCircle2 emerald / AlertCircle red + description + clause reference
        │   └── Download Report button  (bg-blue-600 hover:bg-blue-700)
        └── Empty State
            Calculator icon w-16 h-16 text-slate-500, centered
```

### Backend
- Python API at port 8081: `/design/beam`, `/design/column`, `/design/slab`
- Client-side IS 456 fallback calculations when backend unavailable

### Icons
Box, Columns, Square, Play, AlertCircle, CheckCircle2, Download, Calculator

---

## 15. FoundationDesignPage.tsx

- **Export**: `export default FoundationDesignPage`
- **Lines**: 702
- **Purpose**: Foundation design with IS 456 calculations

### Layout
```
min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white
├── Header  (border-b, bg-gradient-to-r from-slate-50 dark:from-slate-900 to-slate-100 dark:to-slate-800)
│   ├── H1: gradient from-amber-400 to-orange-500
│   └── Subtitle
├── Content  (max-w-7xl mx-auto px-4 py-6)
│   ├── Foundation Type Selector  (flex gap-3)
│   │   5 types: Isolated, Combined, Strap, Mat, Pile Cap
│   │   Active: bg-gradient-to-br from-amber-600 to-orange-600 text-white
│   │   Inactive: bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
│   │   Icons: Square, Grid3x3, Minus, Plus (8x8 → active 6x6)
│   └── Grid  (grid-cols-1 lg:grid-cols-2 gap-6)
│       ├── Left: Input Sections
│       │   ├── Loads  (amber-400 header, focus:border-amber-500)
│       │   │   Moment X, Moment Y, Shear X, Shear Y
│       │   ├── Geometry  (blue-400 header, focus:border-blue-500)
│       │   │   Column width/depth, footing length/width/depth, clear cover
│       │   ├── Soil Properties  (emerald-400 header, focus:border-emerald-500)
│       │   │   Bearing capacity, soil density
│       │   └── Materials  (purple-400 header, focus:border-purple-500)
│       │       fck (M20-M35), fy (Fe415/500)
│       │   Analyze Button: w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600
│       │   Spinner: border-2 border-white border-t-transparent animate-spin
│       └── Right: Results Panel
│           bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6
│           ├── Safety: SAFE (emerald-400) / UNSAFE (red-400)
│           ├── Utilization %
│           ├── Bearing Pressure card
│           ├── Reinforcement card
│           ├── Code Checks  (CheckCircle2 emerald / AlertCircle red)
│           └── Download Report  (bg-blue-600)
│           OR Empty State: Layers 16x16 centered
```

### Icons
Layers, Download, AlertCircle, CheckCircle2, Square, Grid3x3, Minus, Plus, Play, FileText, AlertTriangle

---

## 16. BarBendingSchedulePage.tsx

- **Export**: `export default BarBendingSchedulePage`
- **Lines**: 826
- **Purpose**: IS 2502 bar bending schedule generator

### Layout
```
min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white
├── Header  (border-b bg-gradient-to-r from-slate-50 dark:from-slate-900 to-slate-800)
│   ├── Back button (ArrowLeft)
│   ├── Icon container  (bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-2)
│   │   Ruler icon w-6 h-6 text-white
│   ├── Title  (gradient from-orange-400 to-red-400)
│   └── Download button  (Download icon)
├── Tab Nav  (flex gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit)
│   3 tabs: Input|Schedule|Summary
│   Active: bg-blue-600 text-white
│   Inactive: bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
└── Tab Content
    ├── Input Tab
    │   ├── Project Info  (grid grid-cols-2 md:grid-cols-4 gap-4)
    │   │   Project Name, Structure Type, Bar Grade (Fe250-Fe550), Units
    │   ├── Add Member Buttons  (3 buttons in flex gap-2)
    │   │   Beam: bg-blue-500/20 border-blue-500/30 text-blue-400 (Building2 icon)
    │   │   Column: bg-emerald-500/20 border-emerald-500/30 text-emerald-400 (LayoutGrid icon)
    │   │   Slab: bg-amber-500/20 border-amber-500/30 text-amber-400 (Layers icon)
    │   ├── Member Cards  (collapsible, bg-slate-50 dark:bg-slate-800 rounded-lg border)
    │   │   Header: type icon badge + member name + member type tag + expand/delete buttons
    │   │   Body: type-specific form (BeamForm/ColumnForm/SlabForm)
    │   └── Generate BBS Button  (w-full py-4 bg-gradient-to-r from-orange-500 to-red-600)
    ├── Schedule Tab
    │   ├── Table  (12 columns)
    │   │   Columns: Bar Mark|Member|Type|Shape|Dia|No.Per|Members|Total|Cut Len|Total Len|Wt/m|Remarks
    │   │   thead: bg-slate-100 dark:bg-slate-800 text-xs
    │   │   barMark: text-orange-400 font-mono font-bold
    │   │   dia: text-cyan-400 font-mono
    │   │   weight: text-emerald-400
    │   │   tfoot: total weight in emerald-400 font-bold
    │   └── Export CSV  (bg-emerald-600 text-white, FileSpreadsheet icon)
    │   OR Empty: Layers 12x12 dashed border
    └── Summary Tab
        ├── Stat Cards  (grid grid-cols-2 md:grid-cols-4 gap-4)
        │   Total Entries, Steel Weight (emerald), Wastage (amber), Total with Wastage (orange)
        │   Each: bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border-t-4 border-{color}
        ├── Summary by Diameter Table
        │   Columns: Diameter|Count|Total Length|Weight
        │   Proportion bar: bg-gradient-to-r from-cyan-500 to-blue-500, proportional width
        └── IS Code Reference  (grid grid-cols-1 md:grid-cols-2 gap-4)
            Development length, Bend deductions, Hook allowance, Standard sizes
```

### Icons
Ruler, Download, Plus, Trash2, FileSpreadsheet, Layers, Building2, LayoutGrid, ChevronDown, ChevronUp, Info, Columns3, BarChart3, ArrowLeft, Calculator, Weight, ClipboardList

---

## 17. SectionDatabasePage.tsx

- **Export**: `export default SectionDatabasePage`
- **Lines**: 528
- **Purpose**: Steel section database browser (500+ sections)

### Layout
```
min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white
├── Header  (gradient from-purple-400 to-pink-400 title)
├── Content  (max-w-7xl mx-auto)
│   ├── Standard Filters  (13 buttons: All, IS 808, AISC W, AISC HSS, EU IPE, EU HEB, etc.)
│   │   Active: bg-gradient-to-r from-purple-600 to-pink-600 text-white
│   │   Inactive: bg-slate-100 dark:bg-slate-800 text-slate-600
│   ├── Search  (bg-slate-100 dark:bg-slate-800 border rounded-lg)
│   └── Grid  (grid-cols-1 lg:grid-cols-2 gap-6)
│       ├── Section List  (max-h-[600px] overflow-y-auto)
│       │   Items: bg-slate-50 dark:bg-slate-800 rounded-lg p-4 hover:border-purple-500
│       │   Selected: border-2 border-purple-500 bg-purple-900/20
│       │   Properties: grid-cols-3, A/Iy/Iz/J values
│       └── Detail Panel  (bg-slate-50 dark:bg-slate-800 rounded-xl p-6 sticky top-4)
│           ├── SVG cross-section preview (150x150 scaled)
│           ├── Properties table (8 rows: Area, Iy, Iz, J, h, bf, tw, tf)
│           └── Apply to Members  (bg-gradient-to-r from-purple-600 to-pink-600)
```

---

## 18. LoadCombinationPage.tsx

- **Export**: `export default LoadCombinationPage`
- **Lines**: 509
- **Purpose**: Load combination generator per IS/ASCE/EC/IBC

### Layout
```
min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white
├── Header  (gradient from-blue-400 to-cyan-400 title)
├── Content  (max-w-6xl mx-auto, grid-cols-1 lg:grid-cols-3 gap-6)
│   ├── Left: Configuration (col-span-1)
│   │   ├── Design Code  (4 buttons: IS 1893, ASCE 7-22, EN 1990, IBC 2021)
│   │   │   Active: bg-blue-600 text-white
│   │   ├── Load Cases  (dynamic list, +Add Case button)
│   │   │   Each: input + type select + remove button
│   │   └── Generate Button  (bg-gradient-to-r from-blue-600 to-cyan-600)
│   └── Right: Results (col-span-2)
│       ├── Combinations Table
│       │   Badge: ULS=bg-red-500/20 text-red-400, SLS=bg-blue-500/20 text-blue-400
│       │   Factor display per load case
│       └── Export JSON Button
```

---

## 19. MaterialsDatabasePage.tsx

- **Export**: `export default MaterialsDatabasePage`
- **Lines**: 949
- **Purpose**: Materials database with browse, create, compare, import/export

### Layout
```
min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6
├── Header  (text-center)
│   ├── H1: gradient from-cyan-400 via-blue-500 to-purple-500, "📦 Materials Database"
│   └── Subtitle
├── Tabs  (flex gap-2, active=bg-cyan-600 text-white, inactive=bg-slate-700)
│   4 tabs: Browse|Custom|Compare|Import
├── Model Status Bar  (bg-blue-900/30 border-blue-600/50 rounded-lg p-4)
│   Member count + "Open Modeler" link
└── Tab Content  (max-w-7xl mx-auto)
    ├── Browse Tab
    │   ├── Category Buttons  (7 categories with emoji: 🔩 Steel, 🧱 Concrete, etc.)
    │   │   Active: bg-cyan-600 text-white
    │   ├── Material Cards  (grid md:grid-cols-2 lg:grid-cols-3 gap-4)
    │   │   Each: bg-slate-800 rounded-lg p-4 border-2
    │   │   Selected: border-cyan-500 bg-cyan-900/20
    │   │   Normal: border-slate-700 hover:border-slate-600
    │   │   Properties: E, fy/fck, density — font-mono text-cyan-400
    │   └── Apply to Model  (bg-cyan-600 text-white)
    ├── Custom Tab
    │   2-col grid: Basic Info + Mechanical Properties
    │   Inputs: bg-slate-700 border-slate-600
    │   Save: bg-gradient-to-r from-cyan-600 to-blue-600
    │   Reset: bg-slate-700
    ├── Compare Tab
    │   Comparison table: 7 properties side by side
    │   Empty: "Browse and select materials" with button
    └── Import Tab
        ├── 3 Format Cards  (Excel 📗, STAAD.Pro 🏢, JSON 📄)
        │   Each: bg-slate-800 rounded-lg p-6 border-slate-700
        ├── File Drop Zone  (border-2 border-dashed border-slate-600 hover:border-cyan-500)
        └── Export Buttons  (JSON + CSV, bg-slate-700)

├── Toast  (fixed bottom-6 right-6)
│   Success: bg-green-600, Error: bg-red-600
└── Standards Footer  (bg-slate-800/50 border-slate-700 rounded-lg p-4)
    11 standard pills: bg-slate-700 rounded-full px-3 py-1 text-xs
    IS 2062, IS 456, IS 1786, ASTM A992, etc.
```

---

## 20. ReportBuilderPage.tsx

- **Export**: `export default ReportBuilderPage`
- **Lines**: 372
- **Purpose**: Section-based report builder

### Layout
```
min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white
├── Header  (bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6)
│   FileText icon + "Report Builder" + subtitle
├── Content  (max-w-6xl mx-auto p-6, grid grid-cols-1 lg:grid-cols-3 gap-6)
│   ├── Config Panel (col-span-1)
│   │   ├── Report Type select
│   │   ├── Project Name input
│   │   ├── Author input
│   │   └── Auto-fill from Model button  (Zap icon text-amber-600)
│   └── Sections Panel (col-span-2)
│       ├── Section List  (draggable, GripVertical icon)
│       │   Each: bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border
│       │   Enable/disable toggles, expand/collapse
│       ├── + Add Section button
│       └── Download Buttons  (Markdown / HTML)
│           uses ReportBuilder service
```

---

## 21. ReportsPage.tsx

- **Export**: `export default ReportsPage`
- **Lines**: 1762
- **Purpose**: Professional A4 structural analysis report (ARUP/WSP/Buro Happold style)

### Layout
```
min-h-screen bg-slate-100 dark:bg-slate-950 print:bg-white print:text-black
├── Print CSS  (@media print: @page A4 portrait 15mm margins, running headers/footers, page counters, no-break rules)
└── main (flex justify-center py-8 px-4 print:p-0)
    └── article (max-w-[210mm] bg-white text-slate-900 shadow-2xl print:shadow-none font-[Inter])
        ├── Cover Page  (min-h-[297mm] flex flex-col)
        │   ├── Branded Header Bar  (h-2 bg-[#12376A])
        │   ├── Logo + Company Info  (beamlab_logo.png, #12376A navy)
        │   ├── Gold Accent Line  (h-1 bg-[#BF9B30] w-48)
        │   ├── Title Block  (centered, text-[32px] font-bold tracking-[-0.02em])
        │   ├── Document Control Table  (border border-[#12376A], 2-col: Doc Ref/Revision/Date/Status/Author/Checker/Approver)
        │   └── Footer  (text-[9px] text-[#12376A])
        ├── Document Control Section (0.0)
        │   ├── Revision History Table  (Rev/Date/Author/Description/Checked)
        │   └── Distribution Table  (Name/Organisation/Copies/Format)
        ├── Table of Contents  (columns-2 gap-8)
        │   Auto-numbered nav, font-mono section numbers, dotted border-b connectors
        │   Sections: 1.0-6.0 + Appendix A
        ├── Section 1.0: Executive Summary
        │   ├── KPI Grid  (grid-cols-4: nodes/members/supports/analysis status)
        │   │   KpiCard: border-l-4 border-{color}, value + label + traffic-light status
        │   └── Additional KPIs: max forces/displacement
        ├── Section 2.0: Design Basis
        │   ├── Codes Table  (IS 800, IS 456, IS 1893, IS 875, ASCE 7)
        │   ├── Key Assumptions list (6 items)
        │   ├── Material Properties table (Steel Fe 250, Concrete M25)
        │   ├── Units & Sign Convention table (8 quantities)
        │   ├── Sign Convention bullets (right-hand rule)
        │   └── Load Combinations table (ULS-1 through SLS-2 per IS 875 Table 4)
        ├── Section 3.0: Structural Model
        │   ├── Node Coordinates table (paginated, ROWS_PER_PAGE=25, Prev/Next)
        │   │   Restraints: bg-blue-50 text-blue-700 badges
        │   ├── Member Connectivity table
        │   ├── Section Properties table (Area/Iy/Iz/J/E/Members)
        │   ├── Applied Loads (nodal forces table Fx/Fy/Fz/Mx/My/Mz)
        │   ├── Member Loads table (Type/w₁/w₂/Direction)
        │   ├── Load Cases table (ID/Name/Type/Factor)
        │   └── Member End Releases table
        ├── Section 4.0: Analysis Results
        │   ├── Solver info block  (method, solve time, condition number)
        │   ├── 4.1 Equilibrium Verification table (Applied/Reactions/Residual/Status)
        │   ├── 4.2 Member Forces table (N/Vy/Vz/My/Mz/T per member, Start/End forces)
        │   │   Paginated with Prev/Next
        │   ├── 4.3 Critical Members Summary table (Action/Governing Member/Value/|Value|/Unit)
        │   │   Member badges: bg-red-50 text-red-700 font-mono
        │   ├── 4.4 Support Reactions table (Rx/Ry/Rz/Mx/My/Mz)
        │   ├── 4.5 Nodal Displacements table (δx/δy/δz/θx/θy/θz)
        │   └── 4.6 Modal Analysis table (Mode/Frequency/Period/ω)
        ├── Section 5.0: Design Verification
        │   Table: Check/Code Ref./Demand/Capacity/D÷C Ratio/Status
        │   StatusPill: PASS=bg-green-100 text-green-800, WARN=bg-amber-100, FAIL=bg-red-100, N/A=bg-slate-100
        ├── Section 6.0: Conclusions & Recommendations
        │   ├── Summary paragraph with peak values
        │   ├── 6 recommendations (ordered list)
        │   └── Disclaimer & Limitations (6 bullet points, text-[10px])
        ├── Appendix A: Signatures & Approval
        │   3-col grid: Prepared by / Checked by / Approved by
        │   Signature lines: h-16 border-b-2 border-slate-400
        └── Document Footer  (border-t-2, centered, text-[10px])

├── Floating Action Bar  (fixed bottom-6 center, print:hidden)
│   bg-white dark:bg-slate-800 shadow-xl border rounded-xl
│   ├── Download PDF  (bg-blue-600 text-white shadow-lg shadow-blue-500/20)
│   ├── Print  (text-slate-500 dark:text-slate-300)
│   └── Share  (text-slate-500 dark:text-slate-300)
└── Export Sidebar  (fixed bottom-6 right-6, print:hidden, flex-col gap-3)
    3 buttons: DXF (fuchsia-600), IFC (amber-600), Excel (green-600)
    Each: bg-white dark:bg-slate-800 border rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1
```

### All Table Styling
- Text: `text-[11px]`, headers: `bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white`
- Rows: alternating `bg-white` / `bg-slate-50/70`
- Values: `font-mono text-slate-600`
- Bold values: `font-mono font-bold text-slate-800`

### Sub-Components (inline)
- **SectionHeading**: auto-numbered (1.0, 2.0...), `text-[18px] font-bold text-[#12376A] border-b-2 border-[#BF9B30]`
- **SubHeading**: (2.1, 2.2...), `text-[14px] font-bold text-[#12376A]`
- **KpiCard**: `border-l-4 border-{color}`, contains value + label
- **StatusPill**: `px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider`
- **Section** (Collapsible): wrapper with open/close chevron

### Branding
- Navy: `#12376A`
- Gold: `#BF9B30`
- Logo: `beamlab_logo.png`

### Icons
Download, Printer, Share2, Layout, FileCode, TableProperties, ChevronDown, ChevronRight

### Export Services
- `PDFReportService`, `DXFExportService`, `IFCExportService`, `ExcelExportService`

---

## 22. ProfessionalReportGenerator.tsx

- **Export**: `export default function ProfessionalReportGenerator()`
- **Lines**: 1049
- **Purpose**: Configurable report generator with template selection and preview

### Layout
```
min-h-screen bg-slate-50 dark:bg-slate-950
├── Header  (max-w-7xl mx-auto px-6 py-6)
│   ├── Title: gradient from-cyan-500 to-blue-600, FileText icon
│   └── Buttons: Toggle Preview (Eye/EyeOff) + Generate Report (Download)
│       Generate: bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg shadow-lg shadow-cyan-500/20
└── Content  (grid grid-cols-1 lg:grid-cols-3 gap-6)
    ├── Left: Configuration Panel
    │   ├── Template Select  (5 templates)
    │   │   Structural Design, Analysis Only, Seismic Assessment, Foundation Design, Connection Design
    │   ├── Project Info Form  (8 fields)
    │   │   Project Name, Client, Engineer, Location, Date, Project No., Revision, Description
    │   │   Inputs: bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg
    │   └── Output Settings
    │       ├── Format: pdf|html|docx buttons
    │       ├── Paper: A4|Letter|A3 buttons
    │       ├── Orientation: portrait|landscape buttons
    │       Active: bg-cyan-600 text-white
    │       Inactive: bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
    ├── Center: Report Sections
    │   Draggable section list, each:
    │   ├── bg-slate-100 dark:bg-slate-800 rounded-lg p-3
    │   ├── GripVertical drag handle (text-slate-500)
    │   ├── Checkbox (cyan-600) to enable/disable
    │   ├── Section name
    │   ├── Expand button (ChevronDown/Right)
    │   ├── Expanded: section-specific options (inputs/toggles)
    │   └── Custom sections: red Trash2 delete button
    │   + Add Custom Section button (Plus icon, border-2 border-dashed border-slate-600)
    └── Right: Preview Panel (conditional)
        ├── Visible: scaled 0.8x preview container
        │   └── Preview HTML rendered with dangerouslySetInnerHTML + sanitizeHTML
        │       Branding: NAVY=#12376A, GOLD=#BF9B30
        │       Cover page, ToC, Executive Summary KPIs, Geometry table, Materials tables, Loads table, Code Check utilization table
        │       Status badges: PASS=#16a34a, WARN=#d97706, FAIL=#dc2626
        └── Hidden: "Click 👁 to show preview" (Eye icon, centered, bg-slate-100 dark:bg-slate-800)
```

### Icons
FileText, Download, Eye, EyeOff, Settings, Plus, Trash2, GripVertical, CheckCircle, ChevronDown, ChevronRight, Printer, BookOpen, Layers, Building2

---

## 23. PrintExportCenter.tsx

- **Export**: `export default PrintExportCenter`
- **Lines**: 1325
- **Purpose**: Document generation, print preview, and multi-format export

### Layout
```
min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-800 to-slate-50 dark:to-slate-900
├── Header  (sticky top-0 z-40, bg-slate-50 dark:bg-slate-900/50 border-b backdrop-blur-sm)
│   ├── Back link (ArrowLeft)
│   ├── Printer icon (text-orange-400) + "Print & Export Center"
│   └── Export Button  (bg-gradient-to-r from-orange-600 to-red-600, disabled:opacity-50)
│       Exporting: Loader2 animate-spin + "Exporting..."
│       Normal: Download + "Export N Items"
├── Progress Bar  (conditional, bg-slate-100 dark:bg-slate-800/50 rounded-xl)
│   Fill: bg-gradient-to-r from-orange-500 to-red-500
├── Tabs  (bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 w-fit border)
│   3 tabs: Print Preview (Printer) | Export Options (Download) | Templates (Layers)
│   Active: bg-orange-600 text-white
│   Inactive: text-slate-600 dark:text-slate-400
└── Content  (grid grid-cols-1 lg:grid-cols-3 gap-6)
    ├── Left: Item Selection (col-span-1)
    │   ├── Summary Card  (bg-gradient-to-br from-orange-900/30 to-red-900/30 border-orange-500/30)
    │   │   Selected count + Total pages
    │   └── Items by Category  (bg-slate-100 dark:bg-slate-800/50 rounded-xl border)
    │       Select All / Clear buttons
    │       Categories collapsible, items with checkboxes
    │       Checkbox active: bg-orange-600 border-orange-600
    │       Complete: CheckCircle green-400
    │       max-h-[500px] overflow-y-auto
    └── Right: Panel (lg:col-span-2)
        ├── Print Tab
        │   ├── Print Preview  (bg-slate-100 dark:bg-slate-800/50 rounded-xl)
        │   │   Zoom controls: ZoomOut/ZoomIn, percentage display
        │   │   A4 Preview: bg-white shadow-2xl, scaled by previewZoom
        │   │   Header/Footer/Content placeholders (bg-slate-200 rounded)
        │   └── Page Settings  (grid-cols-2 md:grid-cols-4 gap-4)
        │       Paper Size (A4-Legal select), Orientation, Scale, Margins
        │       Toggles: Header, Footer, Page Numbers, Company Logo
        │       Inputs: bg-slate-200 dark:bg-slate-700 border-slate-600 rounded-lg
        ├── Export Tab
        │   ├── Format Grid  (grid-cols-3 gap-3)
        │   │   9 formats: PDF(red), DWG(blue), DXF(cyan), XLSX(green), DOCX(blue), HTML(orange), CSV(slate), PNG(purple), SVG(yellow)
        │   │   Selected: bg-orange-600/20 border-orange-500
        │   │   Normal: bg-slate-700/30 border-slate-700
        │   └── Format Options  (conditional per format)
        │       PDF: ToC, Bookmarks, Password, Quality select
        │       DWG/DXF: AutoCAD version, Layers, Dimensions
        │       XLSX: Worksheets, Headers, Formatting
        └── Templates Tab
            Template cards: bg-slate-700/30 border-slate-700 rounded-lg
            Apply Template: bg-orange-600 text-white
            + Create New Template: border-2 border-dashed border-slate-600

├── Quick Actions  (flex-wrap gap-3)
    Print, Full Preview, Table of Contents, Regenerate buttons
    bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg
```

### Export Formats Data
```
pdf → .pdf (FileText, red-400)
dwg → .dwg (Layout, blue-400)
dxf → .dxf (Layout, cyan-400)
xlsx → .xlsx (FileSpreadsheet, green-400)
docx → .docx (FileText, blue-400)
html → .html (File, orange-400)
csv → .csv (Table, slate-400)
png → .png (FileImage, purple-400)
svg → .svg (Image, yellow-400)
```

### Icons
ArrowLeft, Printer, Download, Layers, Loader2, Check, CheckCircle, Settings, ZoomIn, ZoomOut, Eye, Book, RefreshCw, Plus, FileText, FileSpreadsheet, FileImage, File, Image, Table, Layout, BarChart3, Box

---

## 24. CodeComplianceChecker.tsx

- **Export**: `export default CodeComplianceChecker` (also `const CodeComplianceChecker: React.FC`)
- **Lines**: 1593
- **Purpose**: Automated multi-code structural compliance checking

### Layout
```
min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6
├── motion.div (initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }})
├── Header  (text-center mb-8)
│   ├── H1: gradient from-cyan-400 via-blue-500 to-purple-500, "✅ Code Compliance Checker"
│   └── Subtitle
├── Tabs  (flex-wrap justify-center gap-2 mb-8)
│   4 tabs: Run Check ▶️ | Results 📊 | Standards 📚 | History 📜
│   Active: bg-cyan-600 text-white
│   Inactive: bg-slate-700 text-slate-300 hover:bg-slate-600
└── Tab Content  (max-w-7xl mx-auto)
    ├── Check Tab
    │   ├── Code Selection  (bg-slate-100 dark:bg-slate-800 rounded-lg p-6)
    │   │   Grid (md:grid-cols-2 lg:grid-cols-3)
    │   │   11 standards as checkbox cards:
    │   │   Selected: border-2 border-cyan-500 bg-cyan-900/20
    │   │   Unselected: border-2 border-slate-600 bg-slate-700 hover:border-slate-500
    │   │   Each card: emoji icon + name + version + country flag + checkCount badge
    │   │   Standards:
    │   │   IS 456 🏗️(45), IS 800 🔩(52), IS 1893 🌊(38), IS 13920 🏢(28), IS 875 💨(22)
    │   │   ACI 318 📐(58), AISC 360 🔧(65), ASCE 7 🏛️(35)
    │   │   EC2 🏰(48), EC3 ⚙️(55), EC8 🌍(32)
    │   ├── Check Options  (bg-slate-100 dark:bg-slate-800 rounded-lg p-6, grid md:grid-cols-2)
    │   │   ├── Check Categories  (5 items as checkbox cards in bg-slate-700)
    │   │   │   💪 Strength, 📐 Serviceability, 🔗 Detailing, 🌊 Seismic, 🔥 Fire
    │   │   └── Element Scope  (3 radio buttons in bg-slate-700)
    │   │       All Elements, Beams (horizontal), Columns (vertical)
    │   │       Shows counts from model
    │   └── Run Check  (bg-slate-100 dark:bg-slate-800 rounded-lg p-6)
    │       ├── Estimate: "~N checks • ~Ns"
    │       ├── Button: bg-gradient-to-r from-green-600 to-emerald-600
    │       │   Running: animate-spin ⏳ + progress %
    │       │   Ready: ▶️ Run Compliance Check
    │       └── Progress Bar  (h-3 bg-slate-600 rounded-full)
    │           Fill: bg-gradient-to-r from-green-500 to-emerald-500
    ├── Results Tab
    │   ├── Summary Stats  (grid-cols-2 md:grid-cols-4)
    │   │   4 cards with border-l-4: Total (blue), Passed (green), Failed (red), Warnings (yellow)
    │   │   Values: text-3xl font-bold, color-coded
    │   ├── Overall Status Banner
    │   │   Failed: bg-red-900/30 border-red-600, ❌ "NON-COMPLIANT"
    │   │   Warnings: bg-yellow-900/30 border-yellow-600, ⚠️ "REVIEW REQUIRED"
    │   │   Pass: bg-green-900/30 border-green-600, ✅ "FULLY COMPLIANT"
    │   │   + Generate Report button (bg-cyan-600)
    │   ├── Filter Buttons  (all|fail|warning|pass, bg-slate-700)
    │   └── Detailed Results List
    │       Each check: p-4 rounded-lg border-l-4
    │       pass: border-green-500 bg-slate-700/50
    │       fail: border-red-500 bg-red-900/20
    │       warning: border-yellow-500 bg-yellow-900/20
    │       Content: category emoji + description + code clause + element (cyan-400) + location
    │       Recommendation: 💡 text-yellow-400
    │       Right: status badge (bg-green/red/yellow-600) + ratio (color-coded ≤0.9/≤1.0/>1.0) + demand/capacity
    ├── Standards Tab
    │   3 groups by country: 🇮🇳 India (BIS), 🇺🇸 American, 🇪🇺 European
    │   Each: grid md:grid-cols-2 lg:grid-cols-3
    │   Cards: bg-slate-700 rounded-lg, icon + name + fullName + version + checksAvailable badge
    │   Badge colors: India=bg-green-600, US=bg-blue-600, EU=bg-purple-600
    └── History Tab
        5 mock entries, each: bg-slate-700 rounded-lg hover:bg-slate-600
        Status dot: pass=bg-green-500, review=bg-yellow-500, fail=bg-red-500
        Status badge: Compliant=bg-green-600, Review=bg-yellow-600, Non-Compliant=bg-red-600
        Date/time + check counts + View button 📄
```

### Design Code Checks (computed from model)
| Code | Checks |
|------|--------|
| IS 456 | Deflection L/250 (Cl. 23.2), Slenderness (Cl. 3.8), Flexural Mu/Mp (Cl. 9.2), Shear V/Vd (Cl. 8.4) |
| IS 800 | Same checks as IS 456 but for steel |
| IS 1893 | Storey drift 0.004h (Cl. 7.11.1) |
| IS 13920 | Min beam width ≥200mm (Cl. 6.1.2), D/b≤4 (Cl. 6.1.3), Min column ≥300mm (Cl. 7.1.1) |
| IS 875 | Load combination 1.5(DL+LL) (Table 4) |
| AISC 360 | Full member check via aisc360.checkMember() with US unit conversion |
| ACI 318 | Beam check via aci318.checkBeam() with US unit conversion |
| EC3 | Full member check via eurocode3.checkMember() with metric conversion |
| EC2 | Flexural MRd (Cl. 6.1), Shear VRd,c (Cl. 6.2.2), Min rebar (Cl. 9.2.1.1) |
| EC8 | Drift 0.0075h/ν (Cl. 4.4.3.2), Strong column-weak beam ΣMRc≥1.3ΣMRb (Cl. 4.4.2.3) |
| ASCE 7 | Drift Δ/hsx≤0.020 (Cl. 12.12.1), Deflection L/360 (App. C) |

---

## Global Design System Summary

### Color Palette (across all pages)
| Token | Light | Dark |
|-------|-------|------|
| Background | `bg-white` / `bg-slate-50` | `bg-slate-950` / `bg-slate-900` / `bg-black` / `#0a0e17` |
| Surface | `bg-slate-50` / `bg-slate-100` | `bg-slate-800` / `bg-slate-900` / `bg-white/[0.02]` |
| Border | `border-slate-200` / `border-slate-300` | `border-slate-700` / `border-slate-800` / `border-white/[0.04-0.08]` |
| Text Primary | `text-slate-900` | `text-white` |
| Text Secondary | `text-slate-600` | `text-slate-400` |
| Text Muted | `text-slate-500` | `text-slate-500` |
| Primary | `blue-500` / `blue-600` | Same |
| Success | `emerald-400` / `green-400-600` | Same |
| Warning | `amber-400` / `yellow-400-600` / `orange-400-600` | Same |
| Danger | `red-400-600` | Same |
| Info | `cyan-400-600` | Same |
| Accent | `purple-400-600` / `pink-400-600` | Same |

### Typography
- Font: `font-sans` (Inter implied), `font-mono` for code/values
- Headings: `text-4xl font-bold` to `text-lg font-semibold`
- Body: `text-sm` (14px default)
- Small: `text-xs` (12px)
- Micro: `text-[11px]`, `text-[10px]`, `text-[9px]` (reports)
- Gradient text: `bg-gradient-to-r from-X to-Y bg-clip-text text-transparent`

### Common Gradients
```
from-blue-400 to-purple-500       (titles)
from-cyan-400 via-blue-500 to-purple-500  (section headers)
from-emerald-400 to-blue-500      (concrete design)
from-amber-400 to-orange-500      (foundation)
from-orange-500 to-red-600        (BBS, export)
from-purple-400 to-pink-400       (section database)
from-blue-400 to-cyan-400         (load combinations)
from-cyan-400 via-blue-500 to-purple-500  (materials, compliance)
from-blue-600 to-purple-600       (CTAs)
from-green-600 to-emerald-600     (run checks)
```

### Shared Button Patterns
- **Primary**: `bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg shadow-blue-500/20`
- **Gradient**: `bg-gradient-to-r from-X to-Y hover:from-X' hover:to-Y' text-white rounded-lg/xl`
- **Ghost**: `bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400`
- **Danger**: `text-red-500 hover:text-red-600` or `bg-red-600`
- **Disabled**: `disabled:opacity-50 disabled:cursor-not-allowed`
- **Pill**: `rounded-full px-6 py-3`

### Shared Input Patterns
```
w-full px-3 py-2
bg-white dark:bg-slate-800  (or bg-slate-100 dark:bg-slate-800)
border border-slate-300 dark:border-slate-600  (or border-slate-700)
rounded-lg text-slate-900 dark:text-white text-sm
focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none
placeholder-slate-400 dark:placeholder-slate-500
```

### Shared Card Patterns
```
bg-slate-50 dark:bg-slate-900  (or bg-slate-800)
border border-slate-200 dark:border-slate-800  (or border-slate-700)
rounded-xl  (or rounded-2xl, rounded-lg)
p-4/5/6
hover:border-{accent}-500/30 hover:shadow-lg
transition-all duration-300
```

### Animation Library
- **framer-motion** everywhere:
  - Page entry: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
  - Stagger: `transition={{ delay: 0.05 * index }}`
  - `AnimatePresence` for tab transitions / slide panels
  - `layout` for list reorder
  - `whileHover={{ scale: 1.02 }}` on action cards
  - `whileInView` for scroll reveals
- **Tailwind transitions**: `transition-all duration-300`, `transition-colors`
- **Spinner**: `animate-spin` on Loader2 / border circles
- **Pulse**: `animate-pulse` on status dots

### Icon Libraries
1. **lucide-react** (primary): 80+ unique icons across all pages
2. **material-symbols-outlined**: Used in Dashboard, SettingsPageEnhanced (`<span className="material-symbols-outlined">`)
3. **Emoji**: Used extensively in CollaborationHub, CodeComplianceChecker, MaterialsDatabasePage as decorative icons

### External Dependencies
- **Clerk**: `UserButton`, `useAuth`, `isUsingClerk` — auth UI
- **Zustand**: `useModelStore` — structural model state
- **Razorpay**: payment integration on pricing pages
- **sanitizeHTML**: report preview rendering safety

---

*Generated for Figma reproduction. Every Tailwind class, color token, icon name, spacing value, and state variant documented above is taken directly from the source code.*
