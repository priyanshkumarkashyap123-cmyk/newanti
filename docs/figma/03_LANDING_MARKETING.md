# 03 — Landing & Marketing Pages
## BeamLab Ultimate Figma Specification

---

## 3.1 Landing Page — Desktop (1440×900)

### 3.1.1 Navigation Bar (Fixed, Sticky)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🏗 BeamLab Ultimate          Features  Pricing  Docs  Demo       [Sign In] [Start Free →] │
└──────────────────────────────────────────────────────────────────────────────────┘

Style:
  Position: fixed top, z-50
  Height: 64px
  bg: rgba(15,23,42,0.8) backdrop-blur-xl (scroll state)
  bg: transparent (at top, before scroll)
  border-bottom: 1px rgba(255,255,255,0.06) (on scroll)
  Logo: "BeamLab" in Space Grotesk 20px bold + construction icon
  Nav links: 14px medium, text-slate-300, hover: text-white
  Sign In: ghost button
  Start Free: primary button with shimmer animation
  Mobile: hamburger menu at <768px
```

### 3.1.2 Hero Section
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    (Animated gradient blobs in background)                       │
│                                                                                  │
│                     ┌────────────────────────┐                                  │
│                     │ ✨ v3.0 Now Live       │  ← Badge: pill, border, shimmer  │
│                     └────────────────────────┘                                  │
│                                                                                  │
│            The Future of Structural                                             │
│            Engineering is Here                                                  │  ← display-xl, gradient-text
│                                                                                  │
│       Professional-grade structural analysis and design                         │
│       platform. STAAD.Pro level power, browser-native.                          │  ← body 18px, text-slate-400
│       AI-powered. Cloud-first. Indian standards built-in.                       │
│                                                                                  │
│       ┌──────────────────┐  ┌──────────────────────┐                           │
│       │ Start Analysing  │  │  ▶ View Live Demo    │                           │
│       │     Free →       │  │                      │                           │  ← Primary CTA + Secondary CTA
│       └──────────────────┘  └──────────────────────┘                           │
│                                                                                  │
│     ┌────────────────────────────────────────────────────────────┐               │
│     │                                                            │               │
│     │              HERO IMAGE / 3D VIEWPORT PREVIEW              │               │  ← Interactive 3D preview or
│     │              (Animated structural model)                   │               │    screenshot with perspective
│     │              Multi-story frame with loads                   │               │    shadow and glow border
│     │                                                            │               │
│     └────────────────────────────────────────────────────────────┘               │
│                                                                                  │
│        ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│        │  913K+  │  │  2,476  │  │  200+   │  │  99.9%  │                     │  ← Stats bar: animated counters
│        │Lines Code│  │  Files  │  │ Features│  │ Uptime  │                     │
│        └─────────┘  └─────────┘  └─────────┘  └─────────┘                     │
└──────────────────────────────────────────────────────────────────────────────────┘

Gradient blobs:
  Blob 1: 600px circle, primary-500/20, float animation, top-left
  Blob 2: 400px circle, secondary/15, float animation (delayed), top-right
  Blob 3: 500px circle, accent/10, float animation (delayed), center
  All blobs: filter blur(80px)

Hero image:
  border-radius: 12px
  border: 1px rgba(255,255,255,0.08)
  shadow: 0 20px 60px rgba(0,0,0,0.4)
  glow: 0 0 80px rgba(59,130,246,0.15)
```

### 3.1.3 Trust Bar
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Trusted by engineers at:                                                        │
│  [L&T Logo]  [Tata Projects]  [AECOM]  [Jacobs]  [Arup]  [Mott MacDonald]     │
└──────────────────────────────────────────────────────────────────────────────────┘
  Logos: grayscale, opacity 0.5, hover: opacity 1.0, color
  Text: caption, text-muted, uppercase, tracking-wider
  Padding: 48px top/bottom
```

### 3.1.4 Features Section
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│                    Everything You Need for                                       │
│                    Structural Engineering                                        │  ← display-md, gradient text
│                                                                                  │
│     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│     │  🏗             │  │  📊            │  │  🤖            │                  │
│     │  3D Modeling    │  │  FEM Analysis  │  │  AI Assistant  │                  │
│     │                │  │                │  │                │                  │
│     │ Full 3D frame  │  │ Linear, P-Δ,   │  │ Natural lang   │                  │
│     │ modeling with   │  │ Buckling,      │  │ model creation │                  │
│     │ auto-mesh &     │  │ Dynamic,       │  │ and code       │                  │
│     │ snap tools      │  │ Pushover       │  │ compliance     │                  │
│     └────────────────┘  └────────────────┘  └────────────────┘                  │
│                                                                                  │
│     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│     │  🔩            │  │  📋            │  │  👥            │                  │
│     │  Design Codes  │  │  Reports       │  │  Collaboration │                  │
│     │                │  │                │  │                │                  │
│     │ IS456, IS800,  │  │ Professional   │  │ Real-time      │                  │
│     │ IS1893, AISC,  │  │ PDF reports    │  │ multiplayer    │                  │
│     │ Eurocode, ACI  │  │ with calc      │  │ editing with   │                  │
│     │ compliance     │  │ sheets         │  │ team sync      │                  │
│     └────────────────┘  └────────────────┘  └────────────────┘                  │
│                                                                                  │
│  ROW 3:                                                                          │
│     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│     │  🌐            │  │  ⚡           │  │  📐            │                  │
│     │  Cloud Native  │  │  WebAssembly  │  │  BIM Ready     │                  │
│     │  MongoDB Atlas  │  │  Rust-powered  │  │  IFC import/   │                  │
│     │  auto-save     │  │  solver engine │  │  export, Revit │                  │
│     └────────────────┘  └────────────────┘  └────────────────┘                  │
│                                                                                  │
│  ROW 4:                                                                          │
│     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                  │
│     │  📏            │  │  🔬            │  │  📱            │                  │
│     │  Section DB    │  │  Seismic       │  │  Works on Any  │                  │
│     │  10,000+ steel │  │  IS1893, ASCE7 │  │  Device — web  │                  │
│     │  & concrete    │  │  response spec │  │  first, always │                  │
│     └────────────────┘  └────────────────┘  └────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────┘

Feature Card:
  Width: 380px (3-col grid, 24px gap)
  bg: surface-dark, border: 1px border-subtle
  radius: 16px, padding: 32px
  Icon: 48px in 64px circle, bg primary/10
  Title: h3, text-primary, mt-4
  Desc: body, text-muted, mt-2, line-clamp-3
  Hover: border-primary/30, translateY(-4px), shadow elevation-2
  Animation: stagger fadeInUp on scroll, 100ms delay between cards
```

### 3.1.5 Comparison / Why BeamLab Section
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    Why Engineers Switch to BeamLab                               │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │ Feature              │ STAAD.Pro │ ETABS  │ SkyCiv │ BeamLab           │    │
│  ├──────────────────────┼──────────┼────────┼────────┼───────────────────┤    │
│  │ Web Browser Based    │    ✕     │   ✕    │   ✓    │   ✓ ✨            │    │
│  │ AI-Powered Design    │    ✕     │   ✕    │   ✕    │   ✓ ✨            │    │
│  │ Indian Codes (IS)    │    ✓     │   ~    │   ✕    │   ✓ ✨            │    │
│  │ Real-time Collab     │    ✕     │   ✕    │   ✓    │   ✓ ✨            │    │
│  │ Free Tier            │    ✕     │   ✕    │   ✓    │   ✓ ✨            │    │
│  │ 3D FEM Analysis      │    ✓     │   ✓    │   ✓    │   ✓              │    │
│  │ Nonlinear Analysis   │    ✓     │   ✓    │   ~    │   ✓              │    │
│  │ Steel/RC Design      │    ✓     │   ✓    │   ✓    │   ✓              │    │
│  │ Starting Price       │ $6,000/yr│$5,000/yr│ $129/mo│  FREE            │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1.6 Interactive Demo Preview
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    See It in Action                                              │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                          │    │
│  │   [Tab: Modeling]  [Tab: Analysis]  [Tab: Results]  [Tab: Design]       │    │
│  │                                                                          │    │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │    │
│  │   │                                                                 │   │    │
│  │   │              Animated GIF / Video Preview                       │   │    │
│  │   │              showing the selected workflow                      │   │    │
│  │   │              (auto-cycles every 8 seconds)                      │   │    │
│  │   │                                                                 │   │    │
│  │   └─────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                          │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│                        [Try Live Demo →]                                         │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1.7 Testimonials Section
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    What Engineers Say                                            │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │ ★★★★★            │  │ ★★★★★            │  │ ★★★★★            │              │
│  │                  │  │                  │  │                  │              │
│  │ "BeamLab replaced│  │ "The AI feature  │  │ "Indian code     │              │
│  │ our STAAD.Pro    │  │ alone is worth   │  │ compliance is    │              │
│  │ license. Same    │  │ switching. It    │  │ unmatched. IS456,│              │
│  │ power, zero      │  │ generated my     │  │ IS800, IS1893    │              │
│  │ installation."   │  │ 20-story model   │  │ all built in."   │              │
│  │                  │  │ in 30 seconds."  │  │                  │              │
│  │ — Rajesh K.      │  │ — Priya S.       │  │ — Arun M.        │              │
│  │ Senior SE, L&T   │  │ Design Lead,     │  │ Chief Engineer,  │              │
│  │                  │  │ Tata Projects    │  │ PWD Maharashtra  │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│                                                                                  │
│  [◀]  ● ● ○ ○ ○  [▶]                                                           │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1.8 Pricing Preview
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    Simple, Transparent Pricing                                   │
│         [Monthly]  [Yearly — Save 20%]  ← toggle                               │
│                                                                                  │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────┐                   │
│  │  ACADEMIC       │  │  PROFESSIONAL  ★│  │  ENTERPRISE    │                   │
│  │                │  │  MOST POPULAR    │  │                │                   │
│  │  ₹0            │  │  ₹999/mo        │  │  Custom        │                   │
│  │  forever       │  │  ₹799/mo yearly │  │                │                   │
│  │                │  │                  │  │                │                   │
│  │ ✓ 5 projects   │  │ ✓ Unlimited     │  │ ✓ Everything   │                   │
│  │ ✓ Basic anal.  │  │ ✓ All analysis  │  │ ✓ SSO/SAML     │                   │
│  │ ✓ IS codes     │  │ ✓ AI features   │  │ ✓ On-premise   │                   │
│  │ ✓ Community    │  │ ✓ Priority supp │  │ ✓ Custom codes │                   │
│  │                │  │ ✓ Collaboration │  │ ✓ SLA support  │                   │
│  │ [Get Started]  │  │ [Start Trial →] │  │ [Contact Sales]│                   │
│  └────────────────┘  └─────────────────┘  └────────────────┘                   │
│                                                                                  │
│                    [View Full Feature Comparison →]                              │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

Popular card: border-primary, shadow glow-primary, scale(1.05)
```

### 3.1.9 CTA Section
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  bg: gradient primary → secondary, subtle grid pattern overlay                  │
│                                                                                  │
│              Ready to Build Something                                           │
│              Extraordinary?                                                     │  ← display-lg, white
│                                                                                  │
│         Start your first analysis in under 2 minutes.                           │
│         No installation. No credit card. Just engineering.                       │  ← body 16px, white/80
│                                                                                  │
│              ┌──────────────────────────┐                                       │
│              │   Start Free Now →       │  ← Large white button                 │
│              └──────────────────────────┘                                       │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1.10 Footer
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🏗 BeamLab Ultimate                                                            │
│  Professional structural                                                        │
│  engineering platform                                                           │
│                                                                                  │
│  Product           Resources          Company          Legal                    │
│  Features          Documentation      About            Privacy Policy           │
│  Pricing           API Reference      Contact          Terms of Service         │
│  Demo              Changelog          Careers          Cookie Policy            │
│  Downloads         Community          Blog             Refund Policy            │
│  Integrations      Tutorials          Partners                                  │
│                    Status Page                                                   │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────   │
│  © 2026 BeamLab Technologies. All rights reserved.                              │
│  Made with ❤️ in India   [Twitter] [LinkedIn] [GitHub] [YouTube]                │
└──────────────────────────────────────────────────────────────────────────────────┘

bg: #0f172a (darkest)
border-top: 1px border-subtle
Link columns: 4-column grid
Links: 13px, text-muted, hover: text-primary
Social icons: 20px, text-muted, hover: text-white
```

---

## 3.2 Pricing Page — Full (Dedicated)

### 3.2.1 Layout
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR (same as landing)                                                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│              Choose Your Plan                                                   │
│              Start free. Scale as you grow.                                     │
│                                                                                  │
│              [Monthly]  ═══●  [Yearly — Save 20%]                              │
│                                                                                  │
│  ┌───────────┐  ┌────────────────┐  ┌───────────────┐  ┌───────────┐          │
│  │ ACADEMIC  │  │ PROFESSIONAL ★ │  │ BUSINESS      │  │ ENTERPRISE│          │
│  │ & HOBBYIST│  │                │  │               │  │           │          │
│  │           │  │                │  │               │  │           │          │
│  │  FREE     │  │  ₹999/mo      │  │  ₹1,999/mo   │  │  Custom   │          │
│  │  forever  │  │  ₹799/mo yr   │  │  ₹1,599/mo yr│  │           │          │
│  │           │  │                │  │               │  │           │          │
│  │ 3 projects│  │ Unlimited     │  │ Unlimited     │  │ Unlimited │          │
│  │ 2D only   │  │ 3D analysis   │  │ Advanced NL   │  │ Everything│          │
│  │ Basic IS  │  │ AI assistant  │  │ Team collab   │  │ On-premise│          │
│  │ codes     │  │ Steel+RC      │  │ All design    │  │ SSO/SAML  │          │
│  │ Community │  │ Email support │  │ Priority supp │  │ Dedicated │          │
│  │ support   │  │ PDF reports   │  │ API access    │  │ support   │          │
│  │           │  │ BIM export    │  │ Custom reports│  │           │          │
│  │[Get Start]│  │[Start Trial→] │  │[Start Trial→] │  │[Contact → ]│          │
│  └───────────┘  └────────────────┘  └───────────────┘  └───────────┘          │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                    DETAILED FEATURE COMPARISON MATRIX                            │
│                                                                                  │
│  ┌──────────────────────┬──────┬──────┬──────┬──────┐                          │
│  │ Feature              │ Free │ Pro  │ Biz  │ Ent  │                          │
│  ├──────────────────────┼──────┼──────┼──────┼──────┤                          │
│  │ MODELING                                          │                          │
│  │ 2D Frame Modeling    │  ✓   │  ✓   │  ✓   │  ✓   │                          │
│  │ 3D Space Frame       │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Plate/Shell Elements │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ Auto-Mesh Generation │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Structure Wizard     │  3   │  All │  All │  All  │                          │
│  ├──────────────────────┼──────┼──────┼──────┼──────┤                          │
│  │ ANALYSIS                                          │                          │
│  │ Linear Static        │  ✓   │  ✓   │  ✓   │  ✓   │                          │
│  │ P-Delta              │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Modal Analysis       │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Buckling             │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Nonlinear            │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ Dynamic/Time-History │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ Pushover             │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ Seismic (IS1893)     │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  ├──────────────────────┼──────┼──────┼──────┼──────┤                          │
│  │ DESIGN                                            │                          │
│  │ Steel Design IS800   │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ RC Design IS456      │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Connection Design    │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ Foundation Design    │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ International Codes  │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  ├──────────────────────┼──────┼──────┼──────┼──────┤                          │
│  │ FEATURES                                          │                          │
│  │ AI Architect         │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Collaboration        │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ BIM Integration      │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ API Access           │  ✕   │  ✕   │  ✕   │  ✓   │                          │
│  │ Custom Reports       │  ✕   │  ✕   │  ✓   │  ✓   │                          │
│  │ PDF Export           │  ✕   │  ✓   │  ✓   │  ✓   │                          │
│  │ Cloud Storage        │ 50MB │  5GB │ 50GB │ Unlim │                          │
│  │ Projects             │   3  │ Unlim│ Unlim│ Unlim │                          │
│  └──────────────────────┴──────┴──────┴──────┴──────┘                          │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                    FREQUENTLY ASKED QUESTIONS                                   │
│                                                                                  │
│  ▼ Can I use BeamLab for real engineering projects?                             │
│    Yes, BeamLab performs validated FEM analysis matching...                      │
│                                                                                  │
│  ▶ Is my data secure?                                                           │
│  ▶ Can I cancel my subscription anytime?                                        │
│  ▶ Do you offer student/academic discounts?                                     │
│  ▶ Which design codes are supported?                                            │
│  ▶ Can I import STAAD.Pro or ETABS files?                                      │
│  ▶ Is there an API for automation?                                              │
│  ▶ What payment methods do you accept?                                          │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  FOOTER (same as landing)                                                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.3 About Page

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR                                                                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                          │    │
│  │              About BeamLab                                    ┌───────┐ │    │
│  │                                                               │ Photo │ │    │
│  │  We're building the world's most accessible                   │  or   │ │    │
│  │  structural engineering platform. Born in India,              │ 3D    │ │    │
│  │  built for the world.                                         │ model │ │    │
│  │                                                               └───────┘ │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ── Our Mission ──                                                              │
│  Democratize structural engineering by making professional-grade                │
│  analysis tools accessible to every engineer, everywhere.                       │
│                                                                                  │
│  ── Timeline ──                                                                  │
│  2024 ●── Founded, first prototype                                              │
│  2025 ●── v1.0 launched, 100+ users                                            │
│  2025 ●── v2.0 AI features, Rust solver                                        │
│  2026 ●── v3.0 Full industry parity                                            │
│                                                                                  │
│  ── Tech Stack ──                                                               │
│  [React+TS] [Three.js] [Rust/WASM] [FastAPI] [MongoDB] [Azure]                │
│                                                                                  │
│  ── Contact ──                                                                   │
│  📧 support@beamlab.io                                                          │
│  📍 India                                                                        │
│  🐙 github.com/beamlab                                                          │
│                                                                                  │
│  FOOTER                                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.4 Contact Page

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR                                                                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│              Get in Touch                                                       │
│                                                                                  │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐          │
│  │                             │  │                                  │          │
│  │  Contact Info               │  │  Name: [________________]       │          │
│  │                             │  │  Email: [________________]      │          │
│  │  📧 support@beamlab.io     │  │  Company: [________________]    │          │
│  │  📞 +91-XXXX-XXXXXX       │  │  Subject: [________________]    │          │
│  │  📍 Hyderabad, India       │  │                                  │          │
│  │                             │  │  Category:                      │          │
│  │  Business Hours:            │  │  [Sales Inquiry ▾]             │          │
│  │  Mon-Fri 9AM-6PM IST      │  │                                  │          │
│  │                             │  │  Message:                       │          │
│  │  Social:                    │  │  ┌────────────────────────────┐ │          │
│  │  [LinkedIn] [Twitter]      │  │  │                            │ │          │
│  │  [GitHub]  [YouTube]       │  │  │                            │ │          │
│  │                             │  │  │                            │ │          │
│  │                             │  │  └────────────────────────────┘ │          │
│  │                             │  │                                  │          │
│  │                             │  │  [Send Message →]               │          │
│  │                             │  │                                  │          │
│  └─────────────────────────────┘  └──────────────────────────────────┘          │
│                                                                                  │
│  FOOTER                                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.5 Capabilities Page
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR                                                                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│           Full Capabilities Overview                                            │
│                                                                                  │
│  Left sidebar nav:              Main content:                                   │
│  ┌───────────┐                  ┌────────────────────────────────────────┐      │
│  │ Modeling   │                  │ ANALYSIS CAPABILITIES                  │      │
│  │ Analysis  ◀│                  │                                        │      │
│  │ Design     │                  │ ┌──────────┐ ┌──────────┐ ┌────────┐ │      │
│  │ Loading    │                  │ │ Linear   │ │ P-Delta  │ │Buckling│ │      │
│  │ Results    │                  │ │ Static   │ │ Analysis │ │Analysis│ │      │
│  │ Reports    │                  │ │          │ │          │ │        │ │      │
│  │ AI         │                  │ │[Details] │ │[Details] │ │[Detail]│ │      │
│  │ Collab     │                  │ └──────────┘ └──────────┘ └────────┘ │      │
│  │ BIM        │                  │                                        │      │
│  │ Integr.    │                  │ ┌──────────┐ ┌──────────┐ ┌────────┐ │      │
│  └───────────┘                  │ │ Modal    │ │ Dynamic  │ │Seismic │ │      │
│                                  │ │ Analysis │ │ Analysis │ │IS 1893 │ │      │
│                                  │ └──────────┘ └──────────┘ └────────┘ │      │
│                                  │                                        │      │
│                                  │ ┌──────────┐ ┌──────────┐ ┌────────┐ │      │
│                                  │ │Nonlinear │ │ Pushover │ │ Cable  │ │      │
│                                  │ │Material  │ │ Analysis │ │Membrane│ │      │
│                                  │ └──────────┘ └──────────┘ └────────┘ │      │
│                                  └────────────────────────────────────────┘      │
│                                                                                  │
│  FOOTER                                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.6 Documentation / Help Center Page
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  NAV BAR                                                                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  🔍 [Search documentation...]                                                   │
│                                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                    │
│  │ 📖 Getting     │  │ 🏗 Modeling    │  │ 📊 Analysis    │                    │
│  │    Started     │  │    Guide       │  │    Guide       │                    │
│  │  Quick start,  │  │  Nodes, beams, │  │  Linear, NL,   │                    │
│  │  first project │  │  loads, props  │  │  dynamic, seis │                    │
│  └────────────────┘  └────────────────┘  └────────────────┘                    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                    │
│  │ 🔩 Design      │  │ 🤖 AI Features │  │ 📋 API         │                    │
│  │    Codes       │  │               │  │    Reference   │                    │
│  │  IS456, IS800, │  │  AI architect, │  │  REST API,     │                    │
│  │  IS1893 guides │  │  voice, chat   │  │  webhooks      │                    │
│  └────────────────┘  └────────────────┘  └────────────────┘                    │
│                                                                                  │
│  Popular Articles                                                               │
│  ▸ How to create a multi-story building model                                   │
│  ▸ Running seismic analysis per IS 1893                                         │
│  ▸ Steel design workflow with IS 800                                            │
│  ▸ Understanding P-Delta effects                                                │
│  ▸ Exporting reports to PDF                                                     │
│                                                                                  │
│  FOOTER                                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3.7 Mobile Landing Page (375×812)
```
┌───────────────────────┐
│ 🏗 BeamLab       [≡]  │  ← Hamburger menu
├───────────────────────┤
│                       │
│ ┌───────────────────┐ │
│ │ ✨ v3.0 Now Live  │ │
│ └───────────────────┘ │
│                       │
│  The Future of        │
│  Structural           │
│  Engineering          │  ← display-lg (smaller)
│  is Here              │
│                       │
│ Professional-grade    │
│ structural analysis   │
│ platform.             │
│                       │
│ ┌──────────────────┐  │
│ │ Start Free →     │  │  ← Full width CTA
│ └──────────────────┘  │
│ ┌──────────────────┐  │
│ │ View Demo        │  │  ← Full width outline
│ └──────────────────┘  │
│                       │
│ ┌──────────────────┐  │
│ │ Preview Image    │  │
│ │                  │  │
│ └──────────────────┘  │
│                       │
│ Features (1 column)   │
│ ┌──────────────────┐  │
│ │ 🏗 3D Modeling   │  │
│ │ Full 3D frame... │  │
│ └──────────────────┘  │
│ ┌──────────────────┐  │
│ │ 📊 FEM Analysis  │  │
│ │ Linear, P-Δ,...  │  │
│ └──────────────────┘  │
│ ...                   │
│                       │
│ Pricing (stacked)     │
│ ┌──────────────────┐  │
│ │ FREE             │  │
│ │ ₹0 forever       │  │
│ │ [Get Started]    │  │
│ └──────────────────┘  │
│ ┌──────────────────┐  │
│ │ PROFESSIONAL ★   │  │
│ │ ₹999/mo          │  │
│ │ [Start Trial]    │  │
│ └──────────────────┘  │
│                       │
│ FOOTER (stacked)      │
└───────────────────────┘
```

---

## 3.8 Mobile Navigation Drawer
```
┌───────────────────────┐
│ 🏗 BeamLab       [✕]  │
├───────────────────────┤
│                       │
│  Features             │
│  Pricing              │
│  Documentation        │
│  Demo                 │
│  ─────────────────── │
│  Sign In              │
│  ┌──────────────────┐ │
│  │ Start Free →     │ │
│  └──────────────────┘ │
│                       │
│  Dark Mode [═══●]    │
│                       │
└───────────────────────┘

Full-screen overlay on mobile
bg: surface-dark
slideInRight animation
Links: h4 size, 56px tap targets
```
