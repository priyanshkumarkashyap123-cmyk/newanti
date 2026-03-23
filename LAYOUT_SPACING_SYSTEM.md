# Professional Layout & Spacing System

## Current State (Before)
```
Space-y: 7-8 units (28-32px) - inconsistent
Gaps: 3-3.5 units (12-14px) - TOO TIGHT
Padding: 4-6 px units - asymmetric
Header height: 48px (h-12) - cramped
```

## New Professional Standard

### Vertical Rhythm (Hierarchical)
```
Section-to-section:  32px (space-y-8) ← page-level sections
Container top/bot:   24px (py-6) ← major containers
Component group:     20px (gap-5) ← cards, items
Element spacing:     16px (gap-4) ← within component
Tight spacing:       12px (gap-3) ← icon-text proximity only
```

### Horizontal Pad (Asymmetric Reserved)
```
Page container:      px-8 sm:px-10 lg:px-12 ← breathing room
Card/panel:          px-6 py-5 ← generous internal margin
Compact element:     px-4 py-3 ← form inputs, badges
List item:           px-4 ← sidebar items (left-aligned)
```

### Grid Gaps (card-to-card spacing)
```
Primary cards:       gap-6 ← projects, bundles (20px)
Secondary cards:     gap-5 ← stats, actions (16px)
Compact elements:    gap-4 ← badges, pills (12px)
```

### Component Heights
```
Header/Top bar:      h-16 (64px) ← professional, room for hierarchy
Sidebar:             h-screen flex flex-col
Inspector toggle:    h-10 (40px) ← clickable area
List items:          min-h-12 (48px) ← touch-friendly
Filter bar:          py-4 ← breathing room above grid
```

### Section Structure
```
Section container:
  - Top spacing: mb-8 (page-level separator)
  - Title line:  mb-4 (title to subtitle)
  - Subtitle:    text-[13px] text-muted
  - Content gap: gap-6 (between items)
  - Footer:      mt-6 pt-6 border-t (visual separator)
```

## Changes to Make

### UnifiedDashboard.tsx
1. Main container: `px-8 sm:px-10 lg:px-12` (was px-4 sm:px-6)
2. Section spacing: `space-y-8 sm:space-y-10` (was space-y-7 sm:space-y-8)
3. Card grids: `gap-6` (was gap-3.5)
4. Stat pills: `gap-5` (was gap-3)
5. Section headers: `mb-6 pb-4 border-b` → `mb-8 pb-6 border-b`
6. Welcome row: `mb-8` (was mb-4)

### ModernWorkspace.tsx
1. Header height: `h-16` (was h-12)
2. Umbrella tabs padding: `px-6` (was px-4)
3. Sidebar item spacing: `py-3` (was py-2)
4. Sidebar section dividers: `mt-6 mb-4` between groups
5. Context sidebar padding: `px-4 py-3` (was px-3 py-2)

### WorkspaceLayout.tsx
1. Header height: `h-14` (56px) (was h-10)
2. Ribbon padding: `px-6 py-4` (was px-4)
3. Panel text: improve readability through spacing

### Component Library (ui/*)
1. Form inputs: `px-4 py-3` (was px-3 py-2)
2. Buttons: `px-5 py-3` (was px-4 py-2)
3. List items: `py-3` (was py-2)

## Implementation Order
1. Dashboard main container padding
2. Dashboard section spacing
3. Dashboard card grids
4. Workspace header heights
5. Workspace sidebar item spacing
6. Workspace section dividers
