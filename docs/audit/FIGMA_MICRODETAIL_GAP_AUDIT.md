# Figma Micro-Detail Gap Audit

> Gaps between Figma specs 11–16, 18, 20 and the existing codebase.  
> Only actionable items in **existing files** — no new features.

---

## 1. ResultsControlPanel.tsx — Toggle Button Colors

**File:** `apps/web/src/components/results/ResultsControlPanel.tsx`

### 1a. Active toggle button background & text

| | Current (line ~242) | Figma 11.1 |
|--|--|--|
| **Active bg** | `bg-cyan-600/30` + inline `color + "20"` | `bg-blue-500` (#3b82f6, solid) |
| **Active text** | `text-cyan-300` | `text-white` |
| **Active border** | `border border-cyan-500/50` + inline `color + "80"` | `ring-2 ring-blue-400` (#60a5fa) |

**What to change (line 242–243):**
```diff
- "bg-cyan-600/30 text-cyan-300 border border-cyan-500/50"
+ "bg-blue-500 text-white ring-2 ring-blue-400"
```
Remove the inline `style` override on active state (line 248–250) that appends `color + "20"` / `color + "80"`.

### 1b. Inactive toggle button

| | Current (line 243) | Figma 11.1 |
|--|--|--|
| **Inactive bg** | `bg-slate-200/50 dark:bg-slate-700/50` | `bg-slate-800` (#1e293b) |
| **Inactive text** | `text-slate-500 dark:text-slate-400` | `text-slate-300` |
| **Hover** | `hover:border-slate-500` | `hover:bg-slate-700` |

**What to change (line 243):**
```diff
- "bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border border-slate-600 hover:border-slate-500"
+ "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
```

### 1c. Diagram option colors don't match Figma

| Diagram | Current (lines 100–148) | Figma 11.2–11.5 |
|---|---|---|
| SFD | `#00aaff` | `#22c55e` (positive green), `#f97316` (negative orange) |
| BMD | `#ff8800` | `#3b82f6` (positive blue), `#ef4444` (negative red) |
| AFD | `#00ff00` | Compression `#1e40af` (dark blue), Tension `#dc2626` (red) |

**What to change:** Update `color` values in the `diagramOptions` array (lines 100, 108, 116).

---

## 2. DiagramRenderer.tsx — Fill Colors

**File:** `apps/web/src/components/DiagramRenderer.tsx`

| | Current (lines 19–21) | Figma 11.2–11.3 |
|---|---|---|
| `FILL_OPACITY` | `0.15` | `0.20` (20% opacity fill) |
| `FILL_COLOR_MOMENT` | `#ff8800` (orange) | BMD positive: `#3b82f6` (blue), negative: `#ef4444` (red) |
| `FILL_COLOR_SHEAR` | `#00aaff` (light blue) | SFD positive: `#22c55e` (green), negative: `#f97316` (orange) |

**What to change (lines 19–21):**
```diff
- const FILL_OPACITY = 0.15;
- const FILL_COLOR_MOMENT = '#ff8800';
- const FILL_COLOR_SHEAR = '#00aaff';
+ const FILL_OPACITY = 0.20;
+ const FILL_COLOR_MOMENT_POS = '#3b82f6'; // Blue for positive BMD
+ const FILL_COLOR_MOMENT_NEG = '#ef4444'; // Red for negative BMD
+ const FILL_COLOR_SHEAR_POS = '#22c55e';  // Green for positive SFD
+ const FILL_COLOR_SHEAR_NEG = '#f97316';  // Orange for negative SFD
```
Figma also specifies a **2px stroke outline** on diagram outlines (current: no explicit stroke width defined in the renderer).

---

## 3. StressContourRenderer.tsx — Contour Color Scale

**File:** `apps/web/src/components/results/StressContourRenderer.tsx`

| Stop | Current (lines 104–115) | Figma 11.7 |
|---|---|---|
| 0.0 | `#0000ff` (pure blue) | `#1e3a8a` (blue-900) |
| 0.17 | `#0066ff` | `#2563eb` (blue-600) |
| 0.33 | `#00ccff` (cyan) | `#06b6d4` (cyan-500) |
| 0.50 | `#00ff66` → `#66ff00` | `#22c55e` (green-500) |
| 0.67 | `#ccff00` | `#eab308` (yellow-500) |
| 0.83 | `#ff6600` | `#f97316` (orange-500) |
| 1.0 | `#cc0000` (dark red) | `#dc2626` (red-600) |

**What to change (lines 103–116):** Replace the entire `CONTOUR_COLORS` array with the Figma-specified 7-stop engineering rainbow scale:
```ts
const CONTOUR_COLORS = [
    { value: 0.0,   color: new THREE.Color('#1e3a8a') },
    { value: 0.167, color: new THREE.Color('#2563eb') },
    { value: 0.333, color: new THREE.Color('#06b6d4') },
    { value: 0.5,   color: new THREE.Color('#22c55e') },
    { value: 0.667, color: new THREE.Color('#eab308') },
    { value: 0.833, color: new THREE.Color('#f97316') },
    { value: 1.0,   color: new THREE.Color('#dc2626') },
];
```

---

## 4. MemberDetailPanel.tsx — Width, Shadow, Utilization Thresholds

**File:** `apps/web/src/components/results/MemberDetailPanel.tsx`

### 4a. Panel width & shadow

| | Current | Figma 11.9 |
|---|---|---|
| Width | No constraint (fills parent) | `w-[400px]` (400px fixed width) |
| Shadow | None applied | `shadow-xl` (elevation-4) |
| Border | `border-b border-slate-200 dark:border-slate-700` (header only) | `border border-slate-700` (full panel, 1px solid) |

**What to change (line ~248):** On the root `<div>`:
```diff
- <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
+ <div className="flex flex-col h-full w-[400px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xl border border-slate-200 dark:border-slate-700">
```

### 4b. Utilization bar thresholds

| Threshold | Current (lines ~455–460) | Figma 12.2 |
|---|---|---|
| Green | ≤ 0.7 | 0 – 0.6 |
| Yellow/Blue | 0.7 – 0.9 | 0.6 – 0.8 (Figma uses blue #3b82f6) |
| Orange/Amber | 0.9 – 1.0 | 0.8 – 0.9 (Figma uses amber #f59e0b) |
| Orange | — | 0.9 – 1.0 (Figma uses orange #f97316) |
| Red | > 1.0 | > 1.0 |

**What to change:** Adjust threshold breakpoints in the utilization bar (lines ~455–460):
```diff
- check.utilization <= 0.7 ? 'bg-green-500' :
-   check.utilization <= 0.9 ? 'bg-yellow-500' :
-     check.utilization <= 1.0 ? 'bg-orange-500' :
+ check.utilization <= 0.6 ? 'bg-green-500' :
+   check.utilization <= 0.8 ? 'bg-blue-500' :
+     check.utilization <= 0.9 ? 'bg-amber-500' :
+       check.utilization <= 1.0 ? 'bg-orange-500' :
```
Also update the companion text colors at lines ~462–468:
```diff
- check.utilization <= 0.7 ? 'text-green-400' :
-   check.utilization <= 0.9 ? 'text-yellow-400' :
-     check.utilization <= 1.0 ? 'text-orange-400' :
+ check.utilization <= 0.6 ? 'text-green-400' :
+   check.utilization <= 0.8 ? 'text-blue-400' :
+     check.utilization <= 0.9 ? 'text-amber-400' :
+       check.utilization <= 1.0 ? 'text-orange-400' :
```

### 4c. Value text font size

| | Current | Figma 11.9 |
|---|---|---|
| Values text size | `text-lg font-bold font-mono` | `11px Inter` |

**What to change (line ~370):**
```diff
- <div className={`text-lg font-bold font-mono ${item.color}`}>
+ <div className={`text-[11px] font-semibold font-sans ${item.color}`}>
```

---

## 5. CodeCompliancePanel.tsx — Utilization Bar Thresholds & Color Palette

**File:** `apps/web/src/components/ai/CodeCompliancePanel.tsx`

### 5a. Utilization thresholds (same issue as MemberDetailPanel)

| | Current (lines 48–52) | Figma 12.2 |
|---|---|---|
| Green boundary | `ratio <= 0.7` | `ratio <= 0.6` |
| Next color | Yellow (`bg-yellow-500`) | Blue (`bg-blue-500` / #3b82f6) |
| Next boundary | `ratio <= 0.9` | `ratio <= 0.8` |
| Amber range | — | 0.8–0.9 (`bg-amber-500` / #f59e0b) |

**What to change (lines 48–52):**
```diff
- if (ratio <= 0.7) return 'bg-green-500';
- if (ratio <= 0.9) return 'bg-yellow-500';
- if (ratio <= 1.0) return 'bg-orange-500';
+ if (ratio <= 0.6) return 'bg-green-500';
+ if (ratio <= 0.8) return 'bg-blue-500';
+ if (ratio <= 0.9) return 'bg-amber-500';
+ if (ratio <= 1.0) return 'bg-orange-500';
```
Same for `getBgColor()` (lines 54–58):
```diff
- if (ratio <= 0.7) return 'bg-green-900/30';
- if (ratio <= 0.9) return 'bg-yellow-900/30';
+ if (ratio <= 0.6) return 'bg-green-900/30';
+ if (ratio <= 0.8) return 'bg-blue-900/30';
+ if (ratio <= 0.9) return 'bg-amber-900/30';
```

### 5b. Uses `gray-*` instead of `slate-*`

Throughout the file, backgrounds and text use `gray-*` (e.g., `bg-gray-100 dark:bg-gray-800`, `text-gray-500 dark:text-gray-400`, `border-gray-700`) whereas the Figma design system uses `slate-*` consistently.

**Instances to change:**
- Line 155: `bg-gray-100 dark:bg-gray-800 hover:bg-gray-750` → `bg-slate-100 dark:bg-slate-800 hover:bg-slate-750`
- Line 173: `bg-gray-850` → `bg-slate-850` (or `bg-slate-900`)
- Line 174: `text-gray-600 dark:text-gray-300` → `text-slate-600 dark:text-slate-300`
- Line 177: `text-gray-500 dark:text-gray-400` → `text-slate-500 dark:text-slate-400`
- Lines 194, 244, 258, 269, 275, 282, 284: All `gray-*` → `slate-*`
- Panel root (line 244): `bg-gray-50 dark:bg-gray-900` → `bg-slate-50 dark:bg-slate-900`
- Header (line 246): `bg-gray-100 dark:bg-gray-800` → `bg-slate-100 dark:bg-slate-800`
- Borders throughout: `border-gray-700` → `border-slate-700`

---

## 6. AIArchitectPanel.tsx — Panel Width, Background, Chat Bubbles

**File:** `apps/web/src/components/ai/AIArchitectPanel.tsx`

### 6a. Panel background & width

| | Current (line 1112) | Figma 14.1 |
|---|---|---|
| Background | `bg-white dark:bg-slate-900` | `bg-slate-900` (#0f172a) always |
| Width | No width set (fills parent) | `w-[380px]` (380px) |

**What to change (line 1112):**
```diff
- <div className="h-full flex flex-col bg-white dark:bg-slate-900">
+ <div className="h-full flex flex-col w-[380px] bg-white dark:bg-slate-900">
```
*(The light mode variant is acceptable; Figma primarily specifies dark mode.)*

### 6b. Chat bubble styling (user vs. assistant)

| | Current (lines ~1617–1622) | Figma 14.2 |
|---|---|---|
| User bubble bg | `bg-purple-600 text-white` | `bg-slate-700` (#334155) |
| AI bubble bg | `bg-slate-100 dark:bg-slate-800 text-slate-200 border border-slate-200 dark:border-slate-700` | `bg-slate-800` with `border-l-2 border-blue-500` |

**What to change (lines ~1617–1622):**
```diff
  msg.role === "user"
-   ? "bg-purple-600 text-white"
-   : "bg-slate-100 dark:bg-slate-800 text-slate-200 border border-slate-200 dark:border-slate-700"
+   ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
+   : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-l-2 border-blue-500"
```

### 6c. Header padding

| | Current (line 1114) | Figma 14.1 |
|---|---|---|
| Header padding | `px-3 py-3` | `px-4 py-3` (16px horizontal) |

**What to change (line 1114):**
```diff
- <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800">
+ <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
```

---

## 7. VoiceInputButton.tsx — gray→slate, No Backdrop Blur

**File:** `apps/web/src/components/ai/VoiceInputButton.tsx`

### 7a. Uses `gray-*` instead of `slate-*` throughout

| | Current | Figma 14.5 |
|---|---|---|
| Idle button bg | `bg-gray-100 dark:bg-gray-800` (line 48) | `bg-slate-100 dark:bg-slate-800` |
| Idle text | `text-gray-500 dark:text-gray-400` | `text-slate-500 dark:text-slate-400` |
| Hover | `hover:bg-gray-200 dark:hover:bg-gray-700` | `hover:bg-slate-200 dark:hover:bg-slate-700` |
| Tooltip bg | `bg-gray-100 dark:bg-gray-800` (line 74) | `bg-slate-800` |
| Panel backgrounds | `bg-gray-50 dark:bg-gray-900` (line 117) | `bg-slate-50 dark:bg-slate-900` |
| Panel header | `bg-gray-100 dark:bg-gray-800` (line 118) | `bg-slate-100 dark:bg-slate-800` |
| Command chips | `bg-gray-100 dark:bg-gray-800` (line 161) | `bg-slate-100 dark:bg-slate-800` |

**What to change:** Global find-replace in this file: `gray-` → `slate-` for all Tailwind classes.

### 7b. Missing backdrop-blur on listening overlay

| | Current | Figma 14.5 |
|---|---|---|
| Listening state | `bg-red-500 text-white animate-pulse` (line 47) | `bg-slate-900/95 backdrop-blur-xl` |

**What to change (line 47):**
```diff
- ? 'bg-red-500 text-white animate-pulse'
+ ? 'bg-red-500 text-white animate-pulse backdrop-blur-sm'
```

### 7c. Borders use `gray-700` not `slate-700`

Lines 117, 118, 163: `border-gray-700` → `border-slate-700`

---

## 8. ScriptEditor.tsx — Monaco Theme Colors

**File:** `apps/web/src/components/ScriptEditor.tsx`

### 8a. Syntax highlighting colors

| Token | Current (lines 75–84) | Figma 20.1 |
|---|---|---|
| `comment` foreground | `6A9955` (VS Code green) | Slate-500 ≈ `64748B` |
| `keyword` foreground | `569CD6` (VS Code blue) | Purple `C084FC` (#c084fc) |
| `number` foreground | `B5CEA8` (green) | Gold `FBBF24` (#fbbf24) |
| `keyword.support` | `C586C0` (pink) | Functions blue `60A5FA` (#60a5fa) |
| Strings (not defined) | — | Cyan `22D3EE` (#22d3ee) |

**What to change (lines 75–84):**
```diff
- { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
- { token: 'keyword.control', foreground: '569CD6', fontStyle: 'bold' },
+ { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
+ { token: 'keyword.control', foreground: 'C084FC', fontStyle: 'bold' },
```
```diff
- { token: 'number', foreground: 'B5CEA8' },
+ { token: 'number', foreground: 'FBBF24' },
```
```diff
- { token: 'keyword', foreground: '569CD6' },
+ { token: 'keyword', foreground: 'C084FC' },
```
Add string token rule:
```ts
{ token: 'string', foreground: '22D3EE' },
```
Update functions:
```diff
- { token: 'keyword.support', foreground: 'C586C0' },
+ { token: 'keyword.support', foreground: '60A5FA' },
```

### 8b. Line number color

| | Current (line 92) | Figma 20.1 |
|---|---|---|
| Line number foreground | `#858585` | Slate-500 `#64748B` |

**What to change (line 92):**
```diff
- 'editorLineNumber.foreground': '#858585',
+ 'editorLineNumber.foreground': '#64748B',
```

### 8c. Run button color

| | Current (line ~327) | Figma 20.1 |
|---|---|---|
| Run button bg | `#4CAF50` → `#45a049` (Material green gradient) | `#22c55e` (Tailwind green-500) |

**What to change (line ~327 `buttonStyle`):**
```diff
- background: isRunning ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
+ background: isRunning ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
```

### 8d. Console/status panel height

| | Current | Figma 20.1 |
|---|---|---|
| Status panel maxHeight | `100px` (line ~340) | `200px` |

**What to change (line ~340 `statusStyle`):**
```diff
- maxHeight: '100px',
+ maxHeight: '200px',
```

---

## 9. Collaborators.tsx / RemoteCursors.tsx — Cursor Shape & Name Tag

**File:** `apps/web/src/components/collaborators/RemoteCursors.tsx`

### 9a. Cursor shape

| | Current | Figma 16.1 |
|---|---|---|
| Shape | 3D cone `args=[0.2, 0.6, 8]` | Arrow pointer (2D triangle cursor icon) |

**What to change:** The cone approximation is acceptable for 3D viewports, but if matching Figma exactly, use a 2D arrow geometry or sprite. Low priority since it's a 3D context.

### 9b. Name tag offset

| | Current | Figma 16.1 |
|---|---|---|
| Name tag position | `position={[0, 0.5, 0]}` | "8px below cursor" — in 3D space this should be `[0, -0.3, 0]` (below, not above) |

**What to change:** Adjust the Y position of the name tag to place it below the cursor tip, not above.

### 9c. Name tag font size

| | Current | Figma 16.1 |
|---|---|---|
| Font size | `fontSize: '10px'` | `12px` for name labels |

---

## 10. ExportManager.tsx — Selected Format Card Border

**File:** `apps/web/src/components/export/ExportManager.tsx`

| | Current | Figma 13.3 |
|---|---|---|
| Selected card | `border-cyan-500 bg-cyan-500/10` | `border-blue-500 bg-blue-500/10` |
| Unselected card | `border-slate-200 dark:border-slate-700` | `border-slate-700` (dark mode only specified) |

**What to change:** Replace `cyan-500` → `blue-500` for consistency with Figma's blue primary accent:
```diff
- border-cyan-500 bg-cyan-500/10
+ border-blue-500 bg-blue-500/10
```

---

## 11. SteelMemberDesigner.tsx — Tab Active Color

**File:** `apps/web/src/components/steel-design/SteelMemberDesigner.tsx`

| | Current (line ~284) | Figma 12 Design Modules |
|---|---|---|
| Active tab | `bg-blue-500 text-white` | Matches ✅ |
| Inactive tab | `text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-600/50` | hover should be `hover:bg-slate-700/50` not `hover:bg-slate-600/50` |

**What to change (line ~284):**
```diff
- hover:bg-slate-600/50
+ hover:bg-slate-700/50
```

---

## 12. Cross-File: `gray-*` → `slate-*` Consistency

Figma uses `slate` throughout. The following files use `gray-*` which should be `slate-*`:

| File | Line(s) | Example |
|---|---|---|
| VoiceInputButton.tsx | 48, 74, 110, 117, 118, 161 | `bg-gray-100 dark:bg-gray-800` |
| CodeCompliancePanel.tsx | 155, 173, 177, 194, 244, 246, 258, 269, 275, 282, 284 | `bg-gray-100 dark:bg-gray-800` |

---

## Summary Table

| # | File | Gap Type | Severity |
|---|---|---|---|
| 1a | ResultsControlPanel.tsx | Active button: cyan → blue | 🔴 High |
| 1b | ResultsControlPanel.tsx | Inactive button bg/text | 🟡 Medium |
| 1c | ResultsControlPanel.tsx | Diagram option color hex values | 🔴 High |
| 2 | DiagramRenderer.tsx | Fill opacity 0.15→0.20, colors wrong | 🔴 High |
| 3 | StressContourRenderer.tsx | Entire contour color scale wrong | 🔴 High |
| 4a | MemberDetailPanel.tsx | Missing w-[400px], shadow-xl, border | 🟡 Medium |
| 4b | MemberDetailPanel.tsx | UR thresholds 0.7/0.9 → 0.6/0.8/0.9 | 🔴 High |
| 4c | MemberDetailPanel.tsx | Value text size `text-lg` → `text-[11px]` | 🟡 Medium |
| 5a | CodeCompliancePanel.tsx | UR thresholds (same as 4b) | 🔴 High |
| 5b | CodeCompliancePanel.tsx | All `gray-*` → `slate-*` | 🟡 Medium |
| 6a | AIArchitectPanel.tsx | Missing w-[380px] | 🟡 Medium |
| 6b | AIArchitectPanel.tsx | Chat bubble bg: purple→slate-700, missing border-l-2 blue | 🔴 High |
| 6c | AIArchitectPanel.tsx | Header px-3 → px-4 | 🟢 Low |
| 7a | VoiceInputButton.tsx | All `gray-*` → `slate-*` | 🟡 Medium |
| 7b | VoiceInputButton.tsx | Missing backdrop-blur on listening | 🟢 Low |
| 8a | ScriptEditor.tsx | Monaco theme: 5 token colors wrong | 🔴 High |
| 8b | ScriptEditor.tsx | Line number color #858585 → #64748B | 🟢 Low |
| 8c | ScriptEditor.tsx | Run button green #4CAF50 → #22c55e | 🟢 Low |
| 8d | ScriptEditor.tsx | Console maxHeight 100px → 200px | 🟢 Low |
| 9b | RemoteCursors.tsx | Name tag position above→below cursor | 🟡 Medium |
| 9c | RemoteCursors.tsx | Name tag font 10px → 12px | 🟢 Low |
| 10 | ExportManager.tsx | Selected border cyan→blue | 🟢 Low |
| 11 | SteelMemberDesigner.tsx | Hover bg slate-600→slate-700 | 🟢 Low |

**Total: 23 actionable gaps across 10 existing files.**
