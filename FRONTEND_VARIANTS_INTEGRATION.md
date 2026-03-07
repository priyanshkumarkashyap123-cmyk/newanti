# 🎨 Frontend Integration Guide — Workflow Variants UI

This guide explains how to integrate the new 5-variant design system into the Space Planning UI, allowing users to explore and choose their preferred layout philosophy.

---

## Overview: What Users Will See

**Current UX (Single Solution)**:
1. User fills wizard
2. Clicks "Generate Layout"
3. Gets ONE best solution
4. Either accepts or starts over

**New UX (5 Variants)**:
1. User fills wizard
2. Clicks "Generate Multiple Designs" (or toggle checkbox)
3. Gets 5 competing solutions with scores
4. Sees comparison table, visual previews
5. Selects favorite → detailed view + export

---

## Components to Add/Update

### 1. `layoutApiService.ts` — API Wrapper

**Add new function**:
```typescript
export async function generateLayoutVariants(
  request: LayoutVariantsRequest,
): Promise<LayoutVariantsResponse> {
  return layoutApiClient.post(
    '/layout/v2/variants',
    request,
    { timeout: 180000 } // 3 min timeout for 5 solutions
  );
}
```

**Request Type**:
```typescript
interface LayoutVariantsRequest extends LayoutV2Request {
  strategies_to_generate?: string[];
  // Inherits: site, nodes, adjacency_matrix, penalty_weights, etc.
}
```

**Response Type**:
```typescript
interface VariantScore {
  variant_id: string;
  strategy_name: string;
  strategy_description: string;
  composite_score: number;  // 0-100
  compactness: number;
  zone_coherence: number;
  adjacency_satisfaction: number;
  circulation_efficiency: number;
  usable_area_ratio: number;
}

interface DesignVariant {
  variant_id: string;
  strategy_key: string;
  strategy_name: string;
  strategy_description: string;
  score: VariantScore | null;
  placements: PlacementResponse[];
  penalty_weights_used: Record<string, number>;
}

interface LayoutVariantsResponse {
  success: boolean;
  total_variants_generated: number;
  variants: DesignVariant[];
  best_variant_id: string | null;
  recommendation: string;
  generated_at_ms: number;
}
```

---

### 2. `SpacePlanningPage.tsx` — State Management

**Add state variables**:
```typescript
const [generationMode, setGenerationMode] = useState<'single' | 'variants'>('single');
const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
const [allVariants, setAllVariants] = useState<DesignVariant[]>([]);
const [variantComparison, setVariantComparison] = useState<Record<string, number>>({});
const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
```

**Add generation function**:
```typescript
const generateVariants = async () => {
  setIsGeneratingVariants(true);
  try {
    const request = buildVariantsRequest();
    const response = await layoutApiService.generateLayoutVariants(request);
    
    if (response.success) {
      setAllVariants(response.variants);
      setSelectedVariantId(response.best_variant_id);
      
      // Build comparison scorecard
      const comparison = {};
      response.variants.forEach(v => {
        if (v.score) {
          comparison[v.variant_id] = {
            name: v.strategy_name,
            composite: v.score.composite_score,
            compactness: v.score.compactness,
            zones: v.score.zone_coherence,
            adjacency: v.score.adjacency_satisfaction,
            flow: v.score.circulation_efficiency,
          };
        }
      });
      setVariantComparison(comparison);
      
      // Show recommendation toast
      toast.success(response.recommendation);
    }
  } catch (error) {
    toast.error(`Variant generation failed: ${error.message}`);
  } finally {
    setIsGeneratingVariants(false);
  }
};
```

---

### 3. New Component: `VariantSelector.tsx`

**Purpose**: Let user choose between generation modes and view scores

```typescript
import React, { useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';

interface Props {
  variants: DesignVariant[];
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
  isLoading: boolean;
  onGenerateVariants: () => void;
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelectVariant,
  isLoading,
  onGenerateVariants,
}: Props) {
  if (variants.length === 0) {
    return (
      <Card className="p-6 bg-blue-50">
        <h3 className="text-lg font-semibold mb-2">
          🎯 Generate Multiple Design Variants
        </h3>
        <p className="text-gray-700 mb-4">
          Instead of one solution, get 5 competing designs based on different 
          architectural philosophies. Compare and choose your preferred approach.
        </p>
        <Button
          onClick={onGenerateVariants}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2" />
              Generating 5 Variants... (2-3 min)
            </>
          ) : (
            '✨ Generate Design Variants'
          )}
        </Button>
      </Card>
    );
  }

  // Sort by score descending
  const sorted = [...variants].sort(
    (a, b) => (b.score?.composite_score ?? 0) - (a.score?.composite_score ?? 0)
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Design Variants (5 Solutions)</h3>

      {/* Comparison Scorecard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((variant) => (
          <div
            key={variant.variant_id}
            onClick={() => onSelectVariant(variant.variant_id)}
            className={`
              p-4 border-2 rounded-lg cursor-pointer
              transition-all duration-200
              ${selectedVariantId === variant.variant_id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-300'
              }
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900">
                  {variant.strategy_name}
                </h4>
                <p className="text-sm text-gray-600">
                  {variant.strategy_description}
                </p>
              </div>
              {variant.score?.composite_score && (
                <Badge
                  className="text-lg font-bold"
                  variant={
                    variant.score.composite_score >= 85 ? 'success' :
                    variant.score.composite_score >= 75 ? 'info' : 'warning'
                  }
                >
                  {variant.score.composite_score.toFixed(1)}
                </Badge>
              )}
            </div>

            {/* Score Breakdown */}
            {variant.score && (
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Compactness:</span>
                  <span>{variant.score.compactness.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Zone Coherence:</span>
                  <span>{variant.score.zone_coherence.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Adjacency:</span>
                  <span>{variant.score.adjacency_satisfaction.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Circulation Flow:</span>
                  <span>{variant.score.circulation_efficiency.toFixed(0)}</span>
                </div>
              </div>
            )}

            {selectedVariantId === variant.variant_id && (
              <div className="mt-2 text-blue-600 font-semibold flex items-center">
                ✓ Selected
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Philosophy Guide */}
      <Card className="p-4 bg-amber-50">
        <h4 className="font-semibold mb-2">Which variant should I choose?</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>
            <strong>Private Sleeping Wing:</strong> Best for quiet, separated bedrooms
          </li>
          <li>
            <strong>Open Living Concept:</strong> Best for entertaining and visibility
          </li>
          <li>
            <strong>Sequential Entry Flow:</strong> Best for traditional layouts
          </li>
          <li>
            <strong>Hub & Spoke Layout:</strong> Best for efficient corridors
          </li>
          <li>
            <strong>Compact Clustering:</strong> Best for small plots
          </li>
        </ul>
      </Card>
    </div>
  );
}
```

---

### 4. New Component: `VariantComparison.tsx`

**Purpose**: Side-by-side visualization of metrics

```typescript
import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface Props {
  variants: DesignVariant[];
  selectedVariantId: string | null;
}

export function VariantComparison({ variants, selectedVariantId }: Props) {
  const data = variants
    .filter(v => v.score)
    .map(v => ({
      variant: v.strategy_name.substring(0, 15), // truncate
      'Compactness': v.score!.compactness,
      'Zone': v.score!.zone_coherence,
      'Adjacency': v.score!.adjacency_satisfaction,
      'Flow': v.score!.circulation_efficiency,
      'selected': v.variant_id === selectedVariantId,
    }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Metric Comparison</h3>
      <ResponsiveBar
        data={data}
        keys={['Compactness', 'Zone', 'Adjacency', 'Flow']}
        indexBy="variant"
        margin={{ top: 20, right: 130, bottom: 60, left: 60 }}
        padding={0.3}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={{ scheme: 'nivo' }}
        defs={[
          {
            id: 'dots',
            type: 'patternDots',
            background: 'inherit',
            color: '#38bcb2',
            size: 4,
            padding: 1,
            stagger: true,
          },
        ]}
        fill={[
          {
            match: {
              id: 'Compactness',
            },
            id: 'dots',
          },
        ]}
        borderColor={{
          from: 'color',
          modifiers: [['darker', 1.6]],
        }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 45,
          legend: 'Design Variant',
          legendPosition: 'middle',
          legendOffset: 32,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Score (0-100)',
          legendPosition: 'middle',
          legendOffset: -40,
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor={{
          from: 'color',
          modifiers: [['darker', 1.6]],
        }}
        legends={[
          {
            dataFrom: 'keys',
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 120,
            translateY: 0,
            itemsSpacing: 2,
            itemWidth: 100,
            itemHeight: 20,
            itemDirection: 'left-to-right',
            itemOpacity: 0.85,
            symbolSize: 20,
            effects: [
              {
                on: 'hover',
                style: {
                  itemOpacity: 1,
                },
              },
            ],
          },
        ]}
        animate={true}
        motionConfig="gentle"
        role="application"
      />
    </Card>
  );
}
```

---

### 5. Update `SpacePlanningPage.tsx` Layout

**Add to wizard**:
```typescript
return (
  <div className="space-y-6">
    {/* Existing wizard fields... */}

    {/* NEW: Generation Mode Toggle */}
    <Card className="p-4">
      <label className="flex items-center space-x-3 cursor-pointer">
        <input
          type="checkbox"
          checked={generationMode === 'variants'}
          onChange={(e) => setGenerationMode(e.target.checked ? 'variants' : 'single')}
          className="rounded"
        />
        <span className="font-medium">
          ✨ Generate 5 Design Variants (instead of single solution)
        </span>
      </label>
      <p className="text-sm text-gray-600 mt-2">
        Get multiple architectural interpretations and choose your preferred approach.
        Takes ~2-3 minutes instead of 30 seconds.
      </p>
    </Card>

    {/* Generate Button */}
    <Button
      onClick={
        generationMode === 'variants'
          ? generateVariants
          : generateSingleLayout
      }
      disabled={isGeneratingVariants || isLoading}
      size="lg"
      className="w-full"
    >
      {isGeneratingVariants ? (
        <>
          <Spinner className="mr-2" />
          Generating 5 Variants... (2-3 min)
        </>
      ) : generationMode === 'variants' ? (
        '✨ Generate Design Variants'
      ) : (
        '🚀 Generate Single Best Layout'
      )}
    </Button>

    {/* Variant Selector (shown if variants exist) */}
    {allVariants.length > 0 && (
      <>
        <VariantSelector
          variants={allVariants}
          selectedVariantId={selectedVariantId}
          onSelectVariant={setSelectedVariantId}
          isLoading={isGeneratingVariants}
          onGenerateVariants={generateVariants}
        />

        <VariantComparison
          variants={allVariants}
          selectedVariantId={selectedVariantId}
        />

        {/* Show selected variant detail */}
        {selectedVariantId && (
          <VariantDetail
            variant={allVariants.find(v => v.variant_id === selectedVariantId)!}
            onExport={exportSelectedVariant}
          />
        )}
      </>
    )}
  </div>
);
```

---

### 6. New Component: `VariantDetail.tsx`

**Purpose**: Show full details of selected variant

```typescript
interface Props {
  variant: DesignVariant;
  onExport: (variant: DesignVariant) => void;
}

export function VariantDetail({ variant, onExport }: Props) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold">{variant.strategy_name}</h3>
          <p className="text-gray-600">{variant.strategy_description}</p>
        </div>
        <Button onClick={() => onExport(variant)} variant="primary">
          📥 Export This Design
        </Button>
      </div>

      {/* Room Placements Table */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Room</th>
              <th className="text-right">Target (m²)</th>
              <th className="text-right">Actual (m²)</th>
              <th className="text-right">Position</th>
              <th className="text-right">Dimensions</th>
            </tr>
          </thead>
          <tbody>
            {variant.placements.map(p => (
              <tr key={p.room_id} className="border-b hover:bg-gray-50">
                <td className="py-2 font-medium">{p.name}</td>
                <td className="text-right">{p.target_area_sqm.toFixed(1)}</td>
                <td className="text-right">{p.actual_area_sqm.toFixed(1)}</td>
                <td className="text-right text-xs">
                  ({p.position.x.toFixed(1)}, {p.position.y.toFixed(1)})
                </td>
                <td className="text-right text-xs">
                  {p.dimensions.width.toFixed(1)} × {p.dimensions.height.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Variant Attributes */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
        {variant.score && (
          <>
            <div>
              <p className="text-gray-600">Overall Score</p>
              <p className="text-3xl font-bold text-blue-600">
                {variant.score.composite_score.toFixed(1)}/100
              </p>
            </div>
            <div>
              <p className="text-gray-600">Best For</p>
              <p className="text-lg font-semibold">
                {variant.variant_id === 'active_first' ? 'Open Living' :
                 variant.variant_id === 'sleeping_refuge' ? 'Quiet Bedrooms' :
                 variant.variant_id === 'central_circulation' ? 'Efficient Flow' :
                 variant.variant_id === 'compact_zones' ? 'Space Efficiency' :
                 'Traditional Layout'}
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
```

---

### 7. Export Flow Update

**Modify `exportLayout()` function**:
```typescript
const exportSelectedVariant = async (variant: DesignVariant) => {
  try {
    // If user has selected a variant, use those placements
    const placements = variant.placements;
    
    // Generate BOQ, drawing, schedule with these placements
    await exportBOQ(placements, `layout_${variant.variant_id}`);
    await exportFloorPlan(placements, `floorplan_${variant.variant_id}`);
    
    toast.success(`✓ Exported ${variant.strategy_name}`);
  } catch (error) {
    toast.error(`Export failed: ${error.message}`);
  }
};
```

---

## Integration Checklist

- [ ] Add `generateLayoutVariants()` to `layoutApiService.ts`
- [ ] Add variant state to `SpacePlanningPage.tsx`
- [ ] Create `VariantSelector.tsx` component
- [ ] Create `VariantComparison.tsx` component  
- [ ] Create `VariantDetail.tsx` component
- [ ] Add generation mode toggle to wizard
- [ ] Wire up variant selection → display detail
- [ ] Update export flow to use selected variant
- [ ] Add "Generate Variants" button
- [ ] Test end-to-end (generate → select → export)
- [ ] Add loading spinner during 2-3 min generation
- [ ] Add toast notifications for results

---

## User Experience Flow

```
1. User fills Space Planning wizard
   ↓
2. Toggles "Generate 5 Design Variants" checkbox
   ↓
3. Clicks "Generate Design Variants" button
   ↓  
4. System shows loading screen: "Generating 5 Variants (2-3 min)..."
   ↓
5. After 120-150 seconds, displays:
   - 5 variant cards with scores
   - Comparison chart
   - Recommendation banner
   ↓
6. User clicks preferred variant card to see details
   ↓
7. Views room placements table, score breakdown
   ↓
8. Clicks "Export This Design" → downloads BOQ, PDF, schedule
```

---

## Testing Scenarios

### Scenario 1: Quick Single Solution
- User generates SINGLE solution (old behavior)
- Should work exactly as before
- No changes to existing flow

### Scenario 2: Variants from Scratch
- User selects "Generate 5 Variants"
- System generates all 5
- User sees ranking and comparison
- Selects best variant
- Exports successfully

### Scenario 3: Variants with Custom Weights
- User modifies penalty weights in advanced settings
- Generates variants with custom base weights
- Each variant modulates base weights per strategy
- Results reflect custom settings

### Scenario 4: Timeout Handling
- If generating takes >180 sec, show timeout dialog
- Offer option to cancel or wait 1 more minute
- Return partial results if available

---

## Performance Notes

- First variant (~25 sec) will dominate the response time
- Remaining 4 variants (~20 sec each) can parallelize
- **Theoretical min time**: ~25 + 20 = 45 sec (with parallel solving)
- **Practical current time**: ~25 + 20×4 = 105 sec (sequential)
- **With optimization**: Could reduce to ~50-60 sec

---

## Future UI Enhancements

1. **Hybrid Variant Creator**
   - Slider: "50% active_first, 50% sleeping_refuge"
   - Generate blended solution

2. **Constraint Explainer**
   - Click "Why did it choose this layout?"
   - Shows constraint satisfaction details

3. **Interactive Adjustment**
   - Select variant, then drag rooms to new positions
   - Solver validates new arrangement
   - Re-scores modified variant

4. **Bookmarking**
   - Save favorite variants
   - Compare across projects
   - Learn personal design preferences

5. **Cost Comparison**
   - Variants scored by construction cost
   - "This layout saves ₹50,000 in plumbing"
