# 16 — Collaboration
## BeamLab Ultimate Figma Specification

---

## 16.1 Multi-User Workspace

### Collaborative Cursor Display
```
┌───────────────────────────────────────────────────────────────────────────┐
│ 3D Viewport — Collaborative Mode                                         │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   [Avatar: RT] You                                                       │
│                                                                           │
│        ┌──── structure model ────┐                                       │
│        │                          │                                       │
│   🔵──┤  ← Your cursor (blue)   │                                       │
│        │        🟢══ Ankit (editing M12,                                 │
│        │           locked members highlighted)                            │
│        │                 🟡── Priya (viewing results)                    │
│        │                          │                                       │
│        └──────────────────────────┘                                       │
│                                                                           │
│ Active Users (3):                                                        │
│ ┌──────────────────────────────────────────────┐                         │
│ │ 🔵 Rakshit T. (You) — Editing geometry      │                         │
│ │ 🟢 Ankit S.         — Editing member M12    │                         │
│ │ 🟡 Priya M.         — Viewing results       │                         │
│ └──────────────────────────────────────────────┘                         │
│                                                                           │
│ Locked elements (by others):                                             │
│   M12 (Ankit) — highlighted with green dashed border                    │
│   Cannot edit locked elements — tooltip: "Being edited by Ankit S."     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

Cursor colors: assigned automatically from palette
  User 1: #3b82f6 (blue)
  User 2: #22c55e (green)
  User 3: #f59e0b (amber)
  User 4: #8b5cf6 (purple)
  User 5: #ef4444 (red)
  User 6: #06b6d4 (cyan)

Each cursor has:
  Colored arrow pointer
  Name tag (8px below cursor)
  Selection highlight in user's color
```

---

## 16.2 Share Project Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ Share Project                                               [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Project: 8-Storey RC Frame Building                              │
│                                                                   │
│ ── Invite People ──                                             │
│ ┌───────────────────────────────────────┐                        │
│ │ 📧 [Enter email address...  ] [Invite]│                       │
│ └───────────────────────────────────────┘                        │
│                                                                   │
│ ── Current Access ──                                            │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 👤 Rakshit Tiwari (You)          Owner        [Owner ▾]     │ │
│ │    rakshit@company.com                                       │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ 👤 Ankit Sharma                  Editor       [Editor ▾]    │ │
│ │    ankit@company.com             Active now                  │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ 👤 Priya Mehta                   Viewer       [Viewer ▾]    │ │
│ │    priya@company.com             Last seen 2h ago           │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ 👤 External Checker              Commenter    [Commenter ▾] │ │
│ │    checker@structural.co         Invited (pending)          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Roles:                                                           │
│   Owner: Full access, can delete project                        │
│   Editor: Modify model, run analysis, design                    │
│   Commenter: View + add comments, cannot modify                 │
│   Viewer: View only, can export                                 │
│                                                                   │
│ ── Link Sharing ──                                              │
│                                                                   │
│ ☑ Enable link sharing                                           │
│ Anyone with link: [Can View ▾]                                  │
│ 🔗 https://beamlab.app/p/STR-2024-0042                        │
│ [📋 Copy Link]                                                  │
│                                                                   │
│ Link expires: [Never ▾]                                         │
│ Password protect: ☐ [Set password]                              │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                             [Done]              │
└───────────────────────────────────────────────────────────────────┘
```

---

## 16.3 Comments System

### Comment Thread Panel
```
┌───────────────────────────────────────────────────────┐
│ Comments                               [Filter ▾] [✕] │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Filter: [All] [Open] [Resolved] [My Comments]        │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 💬 Thread #1 — Member M20 Design        🔴 Open│  │
│ │ 📍 Pinned to: Member M20, Node N17             │  │
│ │                                                 │  │
│ │ 👤 Ankit S. — 3 hours ago                      │  │
│ │ The column M20 fails the LTB check with        │  │
│ │ UR=1.12. Should we upgrade to ISHB 250 or      │  │
│ │ add bracing?                                    │  │
│ │                                                 │  │
│ │   👤 Rakshit T. — 2 hours ago                  │  │
│ │   Let's try ISHB 250 first. Bracing would      │  │
│ │   affect the architectural facade.              │  │
│ │                                                 │  │
│ │   👤 Ankit S. — 1 hour ago                     │  │
│ │   Done. ISHB 250 brings UR to 0.76. Updated.   │  │
│ │                                                 │  │
│ │ [Reply...]              [✅ Resolve] [🗑 Delete]│  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 💬 Thread #2 — Drift Check          🟢 Resolved│  │
│ │ 📍 Pinned to: Storey 5                         │  │
│ │                                                 │  │
│ │ 👤 Priya M. — 1 day ago                        │  │
│ │ Storey drift exceeds IS 1893 limit at level 5. │  │
│ │ Columns need stiffening.                        │  │
│ │   ✅ Resolved by Rakshit T. — 6 hours ago      │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ── Add Comment ──                                    │
│ ┌─────────────────────────────────────────────────┐  │
│ │ [Type comment... @mention a person]             │  │
│ │                                                 │  │
│ │ Attach to: [Click element in viewport 🎯]      │  │
│ │                        [📎 Attach] [Send →]    │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘

Comment pins in viewport:
  💬 icon floating near the element
  Color: red (open), green (resolved)
  Click to expand thread
  Hover: preview first message
```

---

## 16.4 Version History

```
┌───────────────────────────────────────────────────────────────────┐
│ Version History                                             [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Current: v12 (Auto-saved 2 min ago)                             │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ● v12 — Current version                          2 min ago  │ │
│ │   Auto-save: Section optimization applied                    │ │
│ │                                                              │ │
│ │ ● v11 — Manual save                              1 hour ago │ │
│ │   "After design optimization" — Rakshit T.                  │ │
│ │   [🔍 View] [↩️ Restore] [📋 Compare with current]         │ │
│ │                                                              │ │
│ │ ● v10 — Manual save                               3 hrs ago │ │
│ │   "Analysis complete, all load cases" — Rakshit T.          │ │
│ │   [🔍 View] [↩️ Restore] [📋 Compare]                      │ │
│ │                                                              │ │
│ │ ○ v9 — Auto-save                                  4 hrs ago │ │
│ │   Load combinations added                                    │ │
│ │                                                              │ │
│ │ ○ v8 — Auto-save                                  5 hrs ago │ │
│ │   Seismic loads generated (IS 1893)                          │ │
│ │                                                              │ │
│ │ ● v7 — Manual save                              yesterday   │ │
│ │   "Geometry and sections complete" — Ankit S.               │ │
│ │   [🔍 View] [↩️ Restore] [📋 Compare]                      │ │
│ │                                                              │ │
│ │ ○ v6-v1 — collapsed                                         │ │
│ │   [Show all versions (12 total)]                             │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ── Compare Mode ──                                              │
│ When comparing two versions, viewport splits:                    │
│ ┌─────────────────────┬─────────────────────┐                   │
│ │ v10 (3 hrs ago)     │ v12 (current)       │                   │
│ │ 28 members          │ 28 members          │                   │
│ │ ISHB 200 (cols)     │ ISHB 250 (cols) ← ∆│                   │
│ │ 4 members FAIL      │ 0 members FAIL   ← ∆│                  │
│ └─────────────────────┴─────────────────────┘                   │
│                                                                   │
│ Changes: 4 section upgrades, 0 geometry changes                 │
│                                                                   │
│ [📥 Download v10]  [↩️ Restore v10]  [Close Compare]           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Version indicators:
  ● = Manual save (named, important)
  ○ = Auto-save (every 5 minutes)
  Current version: blue highlight
```

---

## 16.5 Activity Feed

```
┌───────────────────────────────────────────────────────┐
│ Activity                                        [✕]   │
├───────────────────────────────────────────────────────┤
│                                                       │
│ ── Today ──                                          │
│                                                       │
│ 🟢 Ankit S. optimized sections (4 members)   2m ago  │
│ 🔵 You ran steel design check               15m ago  │
│ 🔵 You ran analysis (all load cases)         32m ago  │
│ 🟢 Ankit S. added seismic loads (IS 1893)    1h ago  │
│ 🟡 Priya M. added a comment on M20          2h ago  │
│ 🟢 Ankit S. modified members M15-M20        3h ago  │
│ 🔵 You created load combinations (12)        4h ago  │
│                                                       │
│ ── Yesterday ──                                      │
│                                                       │
│ 🟢 Ankit S. added wind loads (IS 875)        18h ago │
│ 🔵 You assigned sections to all members      20h ago │
│ 🔵 You created the model geometry            21h ago │
│ 🔵 You created this project                  22h ago │
│                                                       │
│ [Load more...]                                       │
│                                                       │
└───────────────────────────────────────────────────────┘
```
