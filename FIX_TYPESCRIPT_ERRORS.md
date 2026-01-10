# ⚡ QUICK FIX GUIDE - TypeScript Errors

## Step-by-Step Resolution

### Step 1: Install Missing Dependencies
```bash
cd /Users/rakshittiwari/Desktop/newanti/apps/web

# Check current package.json
cat package.json | grep -E '"(axios|shadcn|ui-)"'

# Install missing packages
pnpm add axios
pnpm add @radix-ui/react-primitive react-slots  # for shadcn components
```

**Affected Components**:
- `src/components/DesignSettingsPanel.tsx`
- `src/components/DynamicsPanel.tsx`
- `src/components/MaterialSelector.tsx`
- `src/components/NonLinearAnalysisPanel.tsx`
- `src/components/PlateDesignerDialog.tsx`
- `src/components/SectionDesignerDialog.tsx`

---

### Step 2: Fix Map vs Array Type Issues

**Root Cause**: Store uses `Map<string, Node>` and `Map<string, Member>` but components expect arrays.

**Option A: Update Store to Export Array Helpers** (Recommended)

Add to `src/store/model.ts`:
```typescript
// Selectors that convert Maps to Arrays
export const selectNodesArray = (state: ModelState) => Array.from(state.nodes.values());
export const selectMembersArray = (state: ModelState) => Array.from(state.members.values());
export const selectPlatesArray = (state: ModelState) => state.plates ? Array.from(state.plates.values()) : [];
```

**Option B: Update Components to Use Maps Directly**

Example fix for `ModalAnalysisPanel.tsx` (line 80):
```tsx
// Before (❌ wrong - Map doesn't have .map)
const nodesList = Array.from(nodes).map((n: [string, Node]) => n[1]);

// After (✅ correct)
const nodesList = Array.from(nodes.values());
```

**Files to Fix**:
1. `src/components/analysis/ModalAnalysisPanel.tsx` - lines 80, 99, 198
2. `src/api/analysis.ts` - lines 70-77 (displacement/reaction conversions)
3. `src/api/localAnalysis.ts` - line 39

---

### Step 3: Fix Property Name Mismatches

**File**: `src/api/analysis.ts`

```tsx
// Issue at line 77
- memberForces: Map.from(result.member_forces)  // ❌ wrong property name
+ memberForces: result.member_forces  // ✅ correct

// Type conversion fix (lines 70-74)
- const displacements = new Map(result.displacements as unknown[]);
+ const displacements = new Map(
+   Object.entries(result.displacements).map(([nodeId, disp]: [string, Displacement]) => 
+     [nodeId, { dx: disp.dx, dy: disp.dy, dz: disp.dz, rx: disp.rx, ry: disp.ry, rz: disp.rz }]
+   )
+ );
```

**Files to Fix**:
1. `src/api/analysis.ts` - memberForces, displacement/reaction conversions
2. `src/components/results/MemberDetailPanel.tsx` - missing startNode, endNode properties
3. `src/components/specifications/MemberSpecificationsDialog.tsx` - property names for forces

---

### Step 4: Fix ErrorBoundary Override Modifiers

**File**: `src/components/ErrorBoundary.tsx`

```tsx
// Add 'override' keyword (lines 38, 103)

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    // ...
  }

  override render() {
    // ...
  }
}
```

---

### Step 5: Add Null Checks for Undefined Values

**File**: `src/components/results/DiagramOverlay.tsx` (multiple lines)

```tsx
// Before (❌ possibly undefined)
const value = values[i];

// After (✅ with null check)
const values = forcePoints?.map(p => p.shear) ?? [];
const value = values?.[i] ?? 0;
```

**Pattern**: Add `?? []` or `?? 0` for fallbacks

---

## Run Verification

After fixes, run:

```bash
# Check for remaining errors
cd /Users/rakshittiwari/Desktop/newanti
pnpm type-check

# If 0 errors, try build
pnpm build

# If build succeeds, test locally
pnpm dev

# Verify no errors in console
```

---

## Priority Order

1. **Install dependencies** (5 min)
2. **Fix Map/Array issues** (30-45 min)
3. **Fix property mismatches** (30 min)
4. **Add override modifiers** (5 min)
5. **Add null checks** (15-20 min)
6. **Fix remaining imports** (as needed)

**Total Estimated Time**: 1.5-2.5 hours
