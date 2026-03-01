# 17 — Settings
## BeamLab Ultimate Figma Specification

---

## 17.1 Settings Page Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Settings                                                          [✕]    │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│ ┌──────────────────┐ ┌──────────────────────────────────────────────────┐│
│ │ Navigation       │ │                                                  ││
│ │                  │ │  [Content area for selected setting]             ││
│ │ 👤 Profile       │ │                                                  ││
│ │ ⚙️ General      │ │                                                  ││
│ │ 📐 Units        │ │                                                  ││
│ │ 🎨 Appearance   │ │                                                  ││
│ │ ⌨️ Shortcuts    │ │                                                  ││
│ │ 🔔 Notifications│ │                                                  ││
│ │ 💳 Subscription │ │                                                  ││
│ │ 🔒 Privacy      │ │                                                  ││
│ │ 📊 Usage        │ │                                                  ││
│ │ ❓ Help         │ │                                                  ││
│ │                  │ │                                                  ││
│ └──────────────────┘ └──────────────────────────────────────────────────┘│
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

Layout: 240px sidebar + fluid content area
Navigation: vertical list, active item highlighted with blue left border
```

---

## 17.2 Profile Settings

```
┌──────────────────────────────────────────────────────────────────┐
│ Profile                                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────┐                                                      │
│ │ 👤     │  [Change Photo]                                      │
│ │ Avatar │                                                      │
│ └────────┘                                                      │
│                                                                  │
│ Full Name:      [Rakshit Tiwari              ]                  │
│ Email:          rakshit@company.com (from Clerk)  [Change →]    │
│ Role:           [Structural Engineer ▾]                         │
│ Organization:   [Structural Consultants Pvt Ltd  ]              │
│ License No:     [SE-2024-XXXX                    ]              │
│ Phone:          [+91 98765 43210              ]                  │
│                                                                  │
│ Professional Details (for report headers):                      │
│ Designation:    [Sr. Structural Engineer      ]                  │
│ Qualifications: [M.Tech (Structural Engg)     ]                │
│ Stamp/Seal:     [Upload seal image ▾] [seal.png ✓]             │
│                                                                  │
│ Connected Accounts:                                              │
│ ● Google: r.tiwari@gmail.com          [Disconnect]              │
│ ● GitHub: @rakshit-t                  [Disconnect]              │
│ ○ LinkedIn: Not connected             [Connect]                 │
│                                                                  │
│                              [Save Changes]                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 17.3 Units Settings

```
┌──────────────────────────────────────────────────────────────────┐
│ Units & Precision                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Preset: ● SI (Metric)  ○ Imperial  ○ MKS  ○ Custom            │
│                                                                  │
│ ── Length ──                                                    │
│ Primary:    [meters (m) ▾]                                      │
│ Section:    [millimeters (mm) ▾]                                │
│ Precision:  [3 decimal places ▾]                                │
│                                                                  │
│ ── Force ──                                                     │
│ Force:      [kilonewtons (kN) ▾]                               │
│ Moment:     [kN·m ▾]                                           │
│ Distributed:[kN/m ▾]                                           │
│ Pressure:   [kN/m² ▾]                                          │
│ Precision:  [2 decimal places ▾]                                │
│                                                                  │
│ ── Stress ──                                                    │
│ Stress:     [MPa (N/mm²) ▾]                                   │
│ Precision:  [1 decimal place ▾]                                │
│                                                                  │
│ ── Temperature ──                                               │
│ Temperature:[°C ▾]                                              │
│                                                                  │
│ ── Angle ──                                                     │
│ Angle:      [degrees ▾]                                        │
│ Rotation:   [radians ▾]                                        │
│                                                                  │
│ ── Mass / Weight ──                                             │
│ Mass:       [kg ▾]                                             │
│ Density:    [kg/m³ ▾]                                          │
│                                                                  │
│ ── Display Format ──                                            │
│ Number format: ● 1,234.56 (comma thousands, dot decimal)       │
│               ○ 1.234,56 (European)                            │
│               ○ 1234.56 (no separator)                         │
│ Scientific notation for values > [ 1,000,000 ]                 │
│                                                                  │
│                  [Reset to Default]  [Save]                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 17.4 Appearance / Theme Settings

```
┌──────────────────────────────────────────────────────────────────┐
│ Appearance                                                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ── Theme ──                                                     │
│                                                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │             │
│ │ │ ■■■■■■■  │ │ │ │ □□□□□□□  │ │ │ │ ■■□□□■■  │ │             │
│ │ │ ■ Dark ■ │ │ │ │ □ Light□ │ │ │ │ ■System■ │ │             │
│ │ │ ■■■■■■■  │ │ │ │ □□□□□□□  │ │ │ │ ■■□□□■■  │ │             │
│ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │             │
│ │   ● Dark     │ │   ○ Light    │ │   ○ System   │             │
│ └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
│ ── Accent Color ──                                              │
│ ● Blue (#3b82f6)   ○ Purple (#8b5cf6)  ○ Cyan (#06b6d4)      │
│ ○ Green (#22c55e)  ○ Orange (#f97316)  ○ Custom [#____]       │
│                                                                  │
│ ── 3D Viewport ──                                               │
│ Background Color: [#0f172a ▾]                                   │
│ Grid Color:       [#334155 ▾]                                   │
│ Grid Opacity:     [───●──────] 30%                              │
│ Show Grid:        ☑                                             │
│ Show Axes:        ☑                                             │
│ Anti-aliasing:    ☑                                             │
│ Shadow Quality:   [Medium ▾]                                    │
│                                                                  │
│ ── Node & Member Display ──                                     │
│ Node Size:        [───●──────] 6px                              │
│ Member Width:     [─────●────] 3px                              │
│ Load Arrow Scale: [───●──────] 1.0x                             │
│ Label Font Size:  [11px ▾]                                     │
│ Show Node Numbers:  ☑                                           │
│ Show Member Numbers: ☑                                          │
│ Show Section Names:  ☐                                          │
│                                                                  │
│ ── Font ──                                                      │
│ UI Font Size:     [14px ▾]                                     │
│ Code/Data Font:   [13px ▾]                                     │
│ Compact Mode:     ☐ (reduce padding throughout UI)             │
│                                                                  │
│                  [Reset to Default]  [Save]                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 17.5 Keyboard Shortcuts Settings

```
┌──────────────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 🔍 [Search shortcuts...]                                        │
│                                                                  │
│ Preset: ● Default  ○ STAAD-like  ○ AutoCAD-like  ○ Custom     │
│                                                                  │
│ ── General ──                                                   │
│ Save                  ⌘S          [Edit]                        │
│ Undo                  ⌘Z          [Edit]                        │
│ Redo                  ⌘⇧Z         [Edit]                       │
│ Delete                ⌫ / Del     [Edit]                        │
│ Select All            ⌘A          [Edit]                        │
│ Command Palette       ⌘K          [Edit]                        │
│ AI Chat               ⌘J          [Edit]                        │
│                                                                  │
│ ── Modeling ──                                                  │
│ Add Node              N           [Edit]                        │
│ Add Member            M           [Edit]                        │
│ Add Support           S           [Edit]                        │
│ Add Load              L           [Edit]                        │
│ Move                  G           [Edit]                        │
│ Copy                  ⌘D          [Edit]                        │
│ Mirror                ⌘M          [Edit]                        │
│ Rotate                R           [Edit]                        │
│                                                                  │
│ ── View ──                                                      │
│ Zoom to Fit           F           [Edit]                        │
│ Top View              Numpad 7    [Edit]                        │
│ Front View            Numpad 1    [Edit]                        │
│ Right View            Numpad 3    [Edit]                        │
│ Isometric View        Numpad 0    [Edit]                        │
│ Toggle Wireframe      W           [Edit]                        │
│                                                                  │
│ ── Analysis ──                                                  │
│ Run Analysis          F5          [Edit]                        │
│ Show BMD              B           [Edit]                        │
│ Show SFD              V           [Edit]                        │
│ Show Deformed Shape   D           [Edit]                        │
│                                                                  │
│ [Reset All]  [Export Shortcuts]  [Import Shortcuts]             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 17.6 Subscription Management

```
┌──────────────────────────────────────────────────────────────────┐
│ Subscription & Billing                                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Current Plan: 🏆 Professional                                   │
│ Status: ● Active                                                │
│ Next billing: Feb 15, 2025                                      │
│ Amount: ₹4,999/month                                            │
│                                                                  │
│ ── Plan Features ──                                             │
│ ✅ Unlimited projects                                           │
│ ✅ All analysis types                                           │
│ ✅ All design codes                                             │
│ ✅ AI features (100 queries/day)                                │
│ ✅ BIM integration                                              │
│ ✅ Collaboration (up to 5 users)                                │
│ ✅ Priority support                                             │
│ ✅ Export to PDF, DXF, IFC                                      │
│ ❌ Enterprise API access                                        │
│ ❌ Custom branding                                              │
│ ❌ Dedicated support                                            │
│                                                                  │
│ [Upgrade to Enterprise →]                                       │
│                                                                  │
│ ── Usage This Month ──                                          │
│ Projects: 12 / ∞                                                │
│ AI Queries: 47 / 100 per day  [───────●─────]                  │
│ Storage: 2.3 GB / 50 GB       [──●────────────]                │
│ Team Members: 3 / 5           [─────●──────────]                │
│                                                                  │
│ ── Billing History ──                                          │
│ ┌──────────────┬──────────┬──────────┬────────┐                │
│ │ Date         │ Amount   │ Plan     │ Status │                │
│ ├──────────────┼──────────┼──────────┼────────┤                │
│ │ Jan 15, 2025 │ ₹4,999   │ Pro      │ Paid   │                │
│ │ Dec 15, 2024 │ ₹4,999   │ Pro      │ Paid   │                │
│ │ Nov 15, 2024 │ ₹2,499   │ Starter  │ Paid   │                │
│ └──────────────┴──────────┴──────────┴────────┘                │
│                                                                  │
│ Payment Method: VISA ●●●● 4242     [Update]                    │
│                                                                  │
│ [Cancel Subscription]  [Download All Invoices]                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
