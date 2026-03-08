# BeamLab Ultimate — Complete UI Component Inventory

**Audit Date:** 1 March 2026  
**Scope:** `apps/web/src/components/ui/`, `apps/web/src/components/`, `apps/web/src/pages/`, `apps/web/src/index.css`  
**Total UI component files:** 76 (in `ui/` directory) + 9 professional sub-components + 10 layout components  
**Total lines of component code:** ~20,800 LOC (ui/) + ~6,870 LOC (professional/) + ~4,080 LOC (layout/)

---

## 1. PRIMITIVE / SHADCN-BASED COMPONENTS (`ui/`)

These are Radix UI + CVA based primitives following shadcn/ui patterns.

---

### 1.1 `button.tsx` (291 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Button`, `buttonVariants` |
| **Variants** | 10: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `success`, `premium`, `glow`, `glass` |
| **Sizes** | 7: `xs`, `sm`, `default`, `lg`, `xl`, `icon`, `icon-sm` |
| **Props** | `asChild`, `loading`, `loadingText`, `icon`, `iconRight`, plus all button HTML attributes |
| **Accessibility** | `aria-busy` on loading, `aria-disabled`, `focus-visible:ring-2 ring-offset-2`, `sr-only` "Loading" text, icons are `aria-hidden` |
| **Animations** | CSS ripple burst on `:active`, shimmer keyframe, glow-pulse keyframe, spinner-pulse animation, hover translate-y, active scale-down |
| **Dark Mode** | ✅ Full — all 10 variants have explicit dark mode styles, ring-offset adjusts |
| **Responsive** | No explicit breakpoints — relies on Tailwind utility composition |
| **Loading State** | ✅ Spinner replaces content, button disabled |
| **Gaps** | No error state; no `aria-label` enforcement; no RTL support |

---

### 1.2 `badge.tsx` (112 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Badge`, `badgeVariants` |
| **Variants** | 8: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `premium`, `info` |
| **Sizes** | 3: `sm`, `default`, `lg` |
| **Props** | `dot`, `dotPulse`, `dotColor`, `onDismiss`, `icon`, `live` |
| **Accessibility** | `role="status"` when `live` prop is true; dismiss button has `aria-label="Dismiss"` |
| **Animations** | `animate-ping` on pulsing dot indicator |
| **Dark Mode** | ✅ Full |
| **Gaps** | No keyboard handling for dismiss button; no focus-visible on badge itself when interactive |

---

### 1.3 `alert.tsx` (58 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Alert`, `AlertTitle`, `AlertDescription` |
| **Variants** | 2: `default`, `destructive` |
| **Accessibility** | `role="alert"` on root |
| **Dark Mode** | Uses CSS custom properties (`text-foreground`); partial — relies on theme variables |
| **Gaps** | No size variants; no success/warning/info variants; no icon slot; no dismiss functionality; no animation |

---

### 1.4 `card.tsx` (96 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` |
| **Variants** | 4: `default`, `elevated`, `interactive`, `outlined` |
| **Accessibility** | Interactive variant auto-gets `role="button"` and `tabIndex={0}` |
| **Animations** | Interactive variant: hover translate-y & shadow transition, active press effect |
| **Dark Mode** | ✅ Full — explicit dark:bg, dark:border, dark:text on all sub-components |
| **Gaps** | No loading/skeleton state built in; no focus ring on interactive variant |

---

### 1.5 `input.tsx` (148 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Input`, `NumberInput` |
| **Props (Input)** | `error`, `errorMessage`, `leftIcon`, `rightIcon`, `label` |
| **Props (NumberInput)** | `value`, `onChange`, `min`, `max`, `step`, `unit` |
| **Accessibility** | `aria-invalid`, `aria-describedby` linking to error text, auto-generated `id` from label, `role="alert"` on error message, icons have `aria-hidden` |
| **Animations** | Error shake animation (`inputShake 300ms`) |
| **Dark Mode** | ✅ Full — explicit dark bg/border/text styles |
| **Gaps** | NumberInput missing `aria-invalid`/`aria-describedby`; no character count; no input masking |

---

### 1.6 `label.tsx` (74 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Label`, `FormField` |
| **Built on** | Radix `@radix-ui/react-label` |
| **Props** | `required` (shows red asterisk) |
| **FormField** | Combo: label + children + error + hint |
| **Dark Mode** | ✅ |
| **Gaps** | No tooltip/info icon support on label; FormField error is not linked via `aria-describedby` |

---

### 1.7 `checkbox.tsx` (88 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Checkbox`, `checkboxVariants` |
| **Built on** | Radix `@radix-ui/react-checkbox` |
| **Sizes** | 3: `sm`, `default`, `lg` |
| **States** | Checked, unchecked, indeterminate |
| **Accessibility** | Radix handles `role="checkbox"`, `aria-checked`; `focus-visible:ring-2` |
| **Animations** | Checkmark pop-in animation (`animate-checkbox-pop`) |
| **Dark Mode** | ✅ |
| **Gaps** | No label integration; no group/fieldset support |

---

### 1.8 `dialog.tsx` (121 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Dialog`, `DialogPortal`, `DialogOverlay`, `DialogClose`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` |
| **Built on** | Radix `@radix-ui/react-dialog` |
| **Sizes** | 6: `sm`, `md`, `default`, `lg`, `xl`, `full` |
| **Accessibility** | Radix provides focus trap, Escape to close, `aria-labelledby`, `aria-describedby`; close button has `sr-only` text |
| **Animations** | `animate-in/animate-out`, `fade-in/fade-out`, `zoom-in/zoom-out`, `slide-in-from/slide-out-to` with `motion-safe:` prefix |
| **Dark Mode** | ✅ Full |
| **Gaps** | No built-in loading state; no stacking/nested dialog management |

---

### 1.9 `select.tsx` (175 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` |
| **Built on** | Radix `@radix-ui/react-select` |
| **Accessibility** | Full Radix keyboard navigation (arrow keys, Home, End, typeahead); ARIA roles built-in |
| **Animations** | `animate-in/animate-out`, `fade-in/out`, `zoom-in/out`, `slide-in-from` per side |
| **Dark Mode** | ✅ Full |
| **Gaps** | No multi-select; no async search/filter; no size variants; no error state |

---

### 1.10 `switch.tsx` (96 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Switch`, `switchVariants` |
| **Built on** | Radix `@radix-ui/react-switch` |
| **Sizes** | 3: `sm`, `default`, `lg` |
| **Accessibility** | Radix provides `role="switch"`, `aria-checked`; `focus-visible:ring-2` |
| **Animations** | Spring bounce on thumb transition (cubic-bezier overshoot), active scale-down |
| **Dark Mode** | ✅ |
| **Gaps** | No on/off labels; no loading state |

---

### 1.11 `slider.tsx` (114 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Slider` |
| **Built on** | Radix `@radix-ui/react-slider` |
| **Sizes** | 3: `sm`, `default`, `lg` |
| **Props** | `showTooltip`, `formatValue` |
| **Accessibility** | Radix provides `role="slider"`, `aria-valuemin`, `aria-valuenow`, `aria-valuemax`; focus ring |
| **Animations** | Thumb hover scale-110, active scale-125; tooltip fades in |
| **Dark Mode** | ✅ |
| **Gaps** | No min/max labels; no step markers; no disabled styling beyond Radix default |

---

### 1.12 `tabs.tsx` (144 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| **Built on** | Radix `@radix-ui/react-tabs` |
| **Variants** | 3: `pill`, `line`, `enclosed` |
| **Sizes** | 3: `sm`, `default`, `lg` |
| **Accessibility** | Radix handles `role="tablist"`, `role="tab"`, `role="tabpanel"`, arrow key navigation |
| **Animations** | `transition-all duration-250ms` on triggers |
| **Dark Mode** | ✅ Full |
| **Gaps** | No badge/count display; no closable tabs; no overflow scroll |

---

### 1.13 `table.tsx` (107 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` |
| **Features** | Basic HTML table wrapper with responsive overflow-auto |
| **Dark Mode** | Uses `muted` CSS custom property — may rely on theme setup |
| **Gaps** | No sorting; no selection; no sticky header; no empty/loading states; semantic but minimal |

---

### 1.14 `radio-group.tsx` (52 lines)

| Aspect | Details |
|---|---|
| **Exports** | `RadioGroup`, `RadioGroupItem` |
| **Built on** | Radix `@radix-ui/react-radio-group` |
| **Accessibility** | Radix handles `role="radiogroup"`, arrow keys, focus management |
| **Dark Mode** | ✅ (border/text invert) |
| **Gaps** | No size variants; no horizontal layout option; no description text per item |

---

### 1.15 `scroll-area.tsx` (48 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ScrollArea`, `ScrollBar` |
| **Built on** | Radix `@radix-ui/react-scroll-area` |
| **Orientations** | Vertical, horizontal |
| **Dark Mode** | Partial — scrollbar uses `bg-gray-300` without dark variant |
| **Gaps** | ScrollBar thumb doesn't have dark mode colors; no custom styling options |

---

### 1.16 `typography.tsx` (117 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Typography`, `typographyVariants`, `H1`, `H2`, `H3`, `H4`, `ValueDisplay` |
| **Variants** | 12: `h1`–`h6`, `body`, `bodySmall`, `caption`, `code`, `label`, `value`, `unit` |
| **Props** | `as` prop for semantic HTML element selection |
| **Dark Mode** | ✅ Full |
| **Gaps** | No `H5`/`H6` shortcut components; no truncation prop; no responsive font sizing |

---

### 1.17 `data-table.tsx` (305 lines)

| Aspect | Details |
|---|---|
| **Exports** | Shadcn data-table pattern (basic) |
| **Dark Mode** | Partial |
| **Gaps** | Minimal wrapper; real functionality is in `DataTable.tsx` |

---

## 2. CUSTOM COMPOSITE COMPONENTS (`ui/`)

---

### 2.1 `DataTable.tsx` (544 lines)

| Aspect | Details |
|---|---|
| **Exports** | `DataTable` (generic) |
| **Features** | Sorting, pagination, row selection (checkbox), search/filtering, row click, row actions |
| **Props** | `data`, `columns`, `keyField`, `loading`, `emptyMessage`, `emptyAction`, `selectable`, `pagination`, `pageSize`, `searchable`, `defaultSort`, `striped`, `hoverable`, `compact`, `stickyHeader`, `onRowClick`, `rowActions` |
| **Accessibility** | Sort buttons, keyboard navigable pagination |
| **Animations** | Framer Motion `AnimatePresence` for row transitions |
| **Dark Mode** | ✅ Full |
| **Loading State** | ✅ Shows skeleton placeholders |
| **Empty State** | ✅ Delegates to `EmptyState` component |
| **Gaps** | No column resizing; no column reordering; no virtualization (use `VirtualTable` instead); no export functionality |

---

### 2.2 `Tooltip.tsx` (142 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Tooltip` |
| **Props** | `content`, `shortcut`, `description`, `side`, `delay`, `className` |
| **Positioning** | 4 sides: top, bottom, left, right; portal-rendered to body |
| **Accessibility** | `role="tooltip"`, `aria-describedby` linking, unique `useId()`, focus/blur triggers |
| **Animations** | CSS `tooltipIn 150ms ease-out` keyframe |
| **Dark Mode** | ✅ |
| **Gaps** | No collision detection/auto-repositioning; no arrow color inheritance in all themes |

---

### 2.3 `Accordion.tsx` (150 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Accordion` |
| **Variants** | 3: `default`, `bordered`, `ghost` |
| **Props** | `items`, `multiple`, `defaultExpanded` |
| **Accessibility** | ✅ Full WAI-ARIA accordion pattern: `<h3>` wrapping `<button>`, `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`, `id` linking |
| **Animations** | Smooth max-height + opacity transition (200ms) |
| **Dark Mode** | ✅ |
| **Disabled State** | ✅ Per-item disabled |
| **Gaps** | No keyboard Home/End navigation (only button focus defaults) |

---

### 2.4 `Modal.tsx` (323 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`, `useModal`, also `ConfirmModal` |
| **Sizes** | 5: `sm`, `md`, `lg`, `xl`, `full` |
| **Props** | `isOpen`, `onClose`, `title`, `description`, `size`, `showCloseButton`, `closeOnBackdrop`, `closeOnEscape`, `footer` |
| **Confirm Variants** | 5: `default`, `danger`, `warning`, `success`, `info` |
| **Accessibility** | Delegates to Radix Dialog — focus trap, `sr-only` title fallback when no title provided |
| **Animations** | Via Dialog component (zoom + fade + slide) |
| **Dark Mode** | ✅ |
| **Loading State** | ✅ ConfirmModal supports `loading` prop |
| **Gaps** | No stacked/nested modal management; no fullscreen mode transition |

---

### 2.5 `Drawer.tsx` (220 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Drawer`, `Sheet`, `useDrawer`, `useSheet` |
| **Drawer Sides** | `left`, `right` |
| **Drawer Sizes** | 4: `sm`, `md`, `lg`, `xl` |
| **Sheet Heights** | 5: `sm`, `md`, `lg`, `auto`, `full` |
| **Accessibility** | Uses Radix Dialog for focus trap; directional close button icons |
| **Animations** | `slide-in-from-left/right/bottom`, `slide-out-to-left/right/bottom` |
| **Dark Mode** | ✅ |
| **Gaps** | No drag-to-dismiss on Sheet; no responsive breakpoint adaptation; Sheet handle has no ARIA label |

---

### 2.6 `Navigation.tsx` (466 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Tabs`, `TabPanel`, `Breadcrumbs`, `Pagination`, `Stepper`, `SegmentedControl` |
| **Tabs Variants** | 3: `default`, `pills`, `underline` |
| **Tabs Sizes** | 3: `sm`, `md`, `lg` |
| **Tabs Features** | Badge counts, disabled tabs, Framer Motion `layoutId` animating indicator |
| **Breadcrumbs** | Custom separator, click handlers |
| **Pagination** | Page numbers with ellipsis, sibling count, prev/next buttons |
| **Stepper** | Current/completed/upcoming visual states |
| **Animations** | Framer `AnimatePresence` on tab panel transitions, `layoutId` spring animation on tab indicator |
| **Dark Mode** | ✅ |
| **Gaps** | Missing `role="tablist"` / `role="tab"` / `role="tabpanel"` ARIA (uses custom implementation, not Radix); Breadcrumbs missing `aria-current="page"` on last item; Pagination missing `aria-label` |

---

### 2.7 `CommandPalette.tsx` (388 lines)

| Aspect | Details |
|---|---|
| **Exports** | `CommandPalette`, `useCommandPalette` |
| **Features** | Fuzzy search, categorized commands, keyboard navigation (arrow keys, Enter, Escape), custom commands extensibility |
| **Trigger** | ⌘K / Ctrl+K |
| **Accessibility** | Uses Dialog as container; search input auto-focused; keyboard list navigation |
| **Animations** | Via Dialog component |
| **Dark Mode** | ✅ |
| **Gaps** | No recent commands history; no nested command groups; `role="listbox"` / `role="option"` not explicitly set |

---

### 2.8 `ContextMenu.tsx` (382 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ContextMenu`, `useContextMenu`, `createNodeContextMenu`, `createMemberContextMenu` |
| **Features** | Right-click trigger, portal rendering, submenu support, presets for structural elements |
| **Accessibility** | ✅ `role="menu"`, `role="menuitem"`, `aria-haspopup`, `aria-expanded`; full keyboard navigation (ArrowUp/Down, Home, End, Enter, Escape) |
| **Animations** | Framer Motion scale + opacity entrance/exit |
| **Dark Mode** | ✅ |
| **Gaps** | No checkbox/radio menu items; no disabled state visual on danger items |

---

### 2.9 `ConfirmDialog.tsx` (263 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ConfirmDialog`, `ConfirmProvider`, `useConfirm` |
| **Variants** | 4: `danger`, `warning`, `info`, `success` |
| **Features** | Promise-based `useConfirm()` hook, standalone `ConfirmDialog` component, loading state |
| **Accessibility** | Delegates to Radix Dialog |
| **Animations** | Spring icon scale-in animation |
| **Dark Mode** | ✅ |

---

### 2.10 `DragFeedback.tsx` (382 lines)

| Aspect | Details |
|---|---|
| **Exports** | `DragHandle`, `DragGhost`, `DropZone`, `SelectionBox`, `SelectionHighlight`, `CursorIndicator` |
| **Accessibility** | DragHandle: `role="button"`, `aria-roledescription="Drag handle"`, `aria-label` with instructions, `focus-visible:ring-2`; DropZone: `aria-dropeffect`, `aria-label` |
| **Animations** | Framer Motion on DragGhost (scale), DropZone overlay (opacity), SelectionBox (rubber band) |
| **Dark Mode** | ✅ |
| **Gaps** | No ARIA live region for announcing drag results |

---

### 2.11 `DragAndDrop.tsx` (491 lines)

| Aspect | Details |
|---|---|
| **Exports** | `DndProvider`, `Draggable`, `Droppable`, `SortableList`, `useDndContext`, `useDragAndDrop` |
| **Features** | Context-based DnD system, sortable lists, multi-item selection, keyboard navigation, drag preview customization |
| **Dark Mode** | ✅ |
| **Gaps** | No announced drag start/end for screen readers |

---

### 2.12 `VirtualScroll.tsx` (544 lines)

| Aspect | Details |
|---|---|
| **Exports** | `VirtualList`, `VirtualGrid`, `VirtualTable`, `useInfiniteScroll` |
| **Features** | Windowed rendering, variable height items, binary search visible range, scroll-to-index (start/center/end), ResizeObserver container, infinite scroll via `onEndReached` |
| **Dark Mode** | ✅ (inherits from rendered items) |
| **Gaps** | No ARIA `role="feed"` for infinite scroll; no keyboard navigation helpers |

---

### 2.13 `EmptyStates.tsx` (621 lines)

| Aspect | Details |
|---|---|
| **Exports** | `EmptyState`, `NoData`, `SearchNoResults`, `OfflineState`, `PermissionDenied`, `OnboardingState`, `MaintenanceState`, `ComingSoon`, `UploadState` |
| **Sizes** | 3: `sm`, `md`, `lg` |
| **Props** | `icon`, `title`, `description`, `action`, `secondaryAction`, `children` |
| **Presets** | 8 domain-specific empty states with unique icons and default copy |
| **Accessibility** | `role="status"`, `aria-label`, icons `aria-hidden` |
| **Dark Mode** | ✅ |
| **Gaps** | Buttons in `focus:ring-offset-slate-900` hardcoded (wrong for light mode) |

---

### 2.14 `ErrorBoundary.tsx` (252 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ErrorBoundary` (class component), `InlineError` |
| **Features** | Catches errors, fallback UI prop, onError callback, retry button, home link, copy stack trace, toggle technical details |
| **Accessibility** | Error message visible; copy confirmation |
| **Animations** | Framer Motion entrance (opacity + scale + y) with spring icon |
| **Dark Mode** | ✅ |
| **Gaps** | No `role="alert"` on fallback; no automatic error reporting integration |

---

### 2.15 `LoadingSpinner.tsx` (385 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Spinner`, `Skeleton`, `SkeletonText`, `SkeletonCard`, `Progress`, `PulsingDots`, `EngineeringLoader`, `FullPageLoader`, `InlineLoader`, `OverlayLoader` |
| **Spinner Sizes** | 5: `xs`, `sm`, `md`, `lg`, `xl` |
| **Spinner Colors** | 6: `primary`, `secondary`, `success`, `warning`, `danger`, `white` |
| **Skeleton Variants** | 6: `text`, `title`, `avatar`, `thumbnail`, `button`, `card` |
| **Progress** | `role="progressbar"`, `aria-valuenow/min/max`, animated bar, 4 colors, 3 sizes |
| **Accessibility** | `role="status"`, `aria-label`, `sr-only` text |
| **Dark Mode** | ✅ |

---

### 2.16 `Skeleton.tsx` (205 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonAnalysisResults`, `SkeletonToolbar`, `SkeletonSidebar`, `SkeletonProjectCard`, `SkeletonForm` |
| **Features** | Domain-specific skeleton shapes (analysis results, toolbar, sidebar, project card, form) |
| **Accessibility** | `role="status"`, `aria-label`, `sr-only` loading text |
| **Dark Mode** | ✅ |

---

### 2.17 `ThemeProvider.tsx` (512 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ThemeProvider`, `useTheme`, `ThemeSwitcher`, `designTokens` |
| **Themes** | `dark`, `light`, `system` |
| **Accent Colors** | 5: `blue`, `emerald`, `purple`, `amber`, `rose` |
| **Features** | CSS variable integration, localStorage persistence, system preference detection, full color palette per accent per theme |
| **Accessibility** | Theme switcher buttons |
| **Dark Mode** | ✅ This IS the dark mode system |

---

### 2.18 `PageTransition.tsx` (213 lines)

| Aspect | Details |
|---|---|
| **Exports** | `PageTransition`, `FadeIn`, `StaggerContainer`, `StaggerItem`, `ScaleOnHover`, `SlideIn` |
| **Features** | Route-keyed AnimatePresence transitions, staggered children, hover/tap effects, slide from any direction |
| **Accessibility** | ✅ `useReducedMotion()` — disables all animations for users who prefer reduced motion |
| **Dark Mode** | N/A (wrapper components) |

---

### 2.19 `ToastSystem.tsx` (746 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ToastProvider`, `useToast` |
| **Toast Types** | 5: `success`, `error`, `warning`, `info`, `loading` |
| **Positions** | 6: `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right` |
| **Features** | Queue management, max 5 visible, pause on hover, action buttons, promise-based (`toast.promise()`), custom renderers, auto-dismiss with progress bar |
| **Accessibility** | ARIA live regions (`announce()` utility), dismissible |
| **Dark Mode** | ✅ |

---

### 2.20 `NotificationManager.tsx` (246 lines)

| Aspect | Details |
|---|---|
| **Exports** | `NotificationProvider`, `useNotifications`, `createNotificationHelpers` |
| **Types** | 5: `success`, `error`, `warning`, `info`, `loading` |
| **Features** | Context-based, stacking toasts, auto-dismiss, action buttons, update in-place, dismiss all |
| **Animations** | Framer Motion slide + fade |
| **Dark Mode** | ✅ |
| **Gaps** | Duplicate functionality with ToastSystem — consolidation recommended |

---

### 2.21 `Notifications.tsx` (615 lines)

| Aspect | Details |
|---|---|
| **Exports** | `NotificationProvider` (legacy), `useNotifications`, `usePushNotifications` |
| **Features** | Third notification system with push notification integration, queue management |
| **Dark Mode** | ✅ |
| **Gaps** | ⚠️ THREE separate notification/toast systems exist — needs consolidation |

---

### 2.22 `FormValidation.tsx` (409 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ValidatedInput`, `PasswordStrength`, `SubmitButton`, `FormErrorSummary` |
| **Features** | Real-time validation, async validation, password strength meter, error summary with links, loading state on submit |
| **Animations** | Framer Motion on validation icons, shake on error |
| **Dark Mode** | ✅ |
| **Gaps** | No integration with React Hook Form or Zod (separate Form.tsx handles that) |

---

### 2.23 `Form.tsx` (577 lines)

| Aspect | Details |
|---|---|
| **Exports** | `FormField`, `Input`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`, `SubmitButton`, `useFormValidation` |
| **Features** | Zod schema validation, accessible form controls, error states, loading states |
| **Dark Mode** | ✅ |
| **Gaps** | Overlaps with `FormValidation.tsx` and primitive `input.tsx`/`select.tsx` |

---

### 2.24 `FormInputs.tsx` (678 lines)

| Aspect | Details |
|---|---|
| **Exports** | Complete form input component set (Checkbox, Radio, Select, TextArea, etc.) |
| **Dark Mode** | ✅ |
| **Gaps** | ⚠️ Another form system — overlaps with Form.tsx and primitive components |

---

### 2.25 `Dropdown.tsx` (627 lines)

| Aspect | Details |
|---|---|
| **Exports** | Comprehensive dropdown with click/hover triggers, nested menus, search, multi-select |
| **Features** | Multiple placements, keyboard navigation, portal rendering |
| **Dark Mode** | ✅ |
| **Gaps** | Does not use Radix; custom positioning logic |

---

### 2.26 `DataViz.tsx` (463 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ProgressRing`, `ProgressBar`, `StatCard`, `Sparkline`, `BarChart`, `Gauge` |
| **Features** | SVG ring progress, animated bars, trend indicators, live value counters |
| **Animations** | Framer Motion on all chart elements (stroke-dashoffset, width, y transitions) |
| **Dark Mode** | ✅ |
| **Gaps** | No axis labels on charts; no responsive sizing; no accessibility for charts (no `role="img"` or descriptions) |

---

### 2.27 `ViewportControls.tsx` (363 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ViewportControls`, `ZoomControls`, `ViewCube`, `DisplayToggles`, `CoordinateDisplay`, `ViewportCrosshair`, `ScaleBar` |
| **Features** | Floating 3D viewport controls, zoom, view presets (front/top/right/iso), grid/axes/labels toggles |
| **Animations** | Framer Motion whileHover/whileTap on control buttons |
| **Dark Mode** | ✅ Glass-morphism backgrounds |
| **Gaps** | No keyboard shortcuts for view switching; no `aria-label` on toggle buttons |

---

### 2.28 `MiniMap.tsx` (320 lines)

| Aspect | Details |
|---|---|
| **Exports** | `MiniMap`, `ViewportStatusBar`, `FloatingToolbar` |
| **Features** | Miniature viewport navigation, click to navigate, node visualization |
| **Dark Mode** | ✅ |
| **Gaps** | No keyboard navigation; no ARIA role |

---

### 2.29 `OptimizedImage.tsx` (437 lines)

| Aspect | Details |
|---|---|
| **Exports** | `OptimizedImage`, `Picture`, `BackgroundImage`, `preloadImage`, `preloadImages`, `generateBlurPlaceholder`, `useImage`, `useIntersectionObserver` |
| **Features** | Lazy loading via IntersectionObserver, blur-up placeholder, WebP/AVIF detection, error fallback, responsive `srcSet` |
| **Accessibility** | `alt` prop required; error state shows alt text |
| **Dark Mode** | Skeleton placeholder respects dark mode |
| **Gaps** | No `loading="lazy"` native attribute fallback |

---

### 2.30 `Spotlight.tsx` (276 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Spotlight`, `QuickTip` |
| **Features** | Multi-step onboarding flow, spotlight overlay highlighting DOM elements, step counter, skip/complete |
| **Animations** | Framer Motion on tooltip and highlight |
| **Dark Mode** | ✅ |
| **Gaps** | No keyboard navigation between steps; no `aria-live` for step announcements |

---

### 2.31 `ResultsReveal.tsx` (263 lines)

| Aspect | Details |
|---|---|
| **Exports** | `ResultsReveal`, `SuccessBanner` |
| **Features** | Animated value counters (ease-out cubic), staggered card reveal, status indicators (pass/warning/fail), trend arrows |
| **Animations** | Counter animation via `requestAnimationFrame`, stagger timing, Framer Motion scale+opacity entrance |
| **Dark Mode** | ✅ |

---

### 2.32 `ProgressTracker.tsx` (704 lines)

| Aspect | Details |
|---|---|
| **Exports** | `StepIndicator`, `ProgressCard`, `StatusBadge`, `ProgressModal`, `BackgroundTaskIndicator`, `InlineProgress`, `CircularProgressIndicator` |
| **Features** | Step progress (horizontal/vertical), ETA display, cancellation support, modal and inline variants |
| **Sizes** | 3: `sm`, `md`, `lg` |
| **Dark Mode** | ✅ |

---

### 2.33 `StatusBadge.tsx` (65 lines)

| Aspect | Details |
|---|---|
| **Exports** | `StatusBadge` |
| **Variants** | 9: `pass`, `fail`, `warning`, `info`, `analyzing`, `draft`, `final`, `ok`, `critical` |
| **Sizes** | 3: `sm`, `md`, `lg` |
| **Dark Mode** | ✅ |
| **Gaps** | No `role="status"`; no animation on variant change |

---

### 2.34 `AdvancedToggle.tsx` (78 lines)

| Aspect | Details |
|---|---|
| **Exports** | `AdvancedToggle` |
| **Props** | `label`, `description`, `statusText`, `enabled`, `onChange`, `icon`, `disabled` |
| **Accessibility** | Uses native checkbox (`sr-only`); peer focus ring |
| **Dark Mode** | ✅ |
| **Gaps** | Toggle visual states are CSS hacks, not using actual switch positioning; no `role="switch"` |

---

### 2.35 `RangeSlider.tsx` (73 lines)

| Aspect | Details |
|---|---|
| **Exports** | `RangeSlider` |
| **Props** | `label`, `value`, `onChange`, `min`, `max`, `step`, `labels`, `valueLabel`, `unit` |
| **Features** | Gradient fill track, step labels |
| **Dark Mode** | ✅ |
| **Gaps** | Uses native `<input type="range">` without ARIA; no focus ring; gradient background hardcoded dark |

---

### 2.36 `Utilities.tsx` (444 lines)

| Aspect | Details |
|---|---|
| **Exports** | `Tooltip` (alt), `Avatar`, `AvatarGroup`, `Badge` (alt), `Accordion` (alt), `Divider`, `EmptyState` (alt) |
| **Avatar** | 5 sizes, status indicators, image fallback to initials, deterministic color from name |
| **AvatarGroup** | Overlap styling, "+N more" overflow |
| **Dark Mode** | ✅ |
| **Gaps** | Duplicate Tooltip, Badge, Accordion, EmptyState with other files — creates ambiguity |

---

### 2.37 `SettingsPanel.tsx` (640 lines)

| Aspect | Details |
|---|---|
| **Exports** | `SettingsPanel`, `defaultSettings` |
| **Features** | Tabbed settings interface, design preferences, unit system, section defaults, export configuration |
| **Animations** | Framer Motion AnimatePresence on tab transitions |
| **Dark Mode** | ✅ |

---

### 2.38 `HistoryPanel.tsx` (517 lines)

| Aspect | Details |
|---|---|
| **Exports** | `HistoryPanel` |
| **Features** | Undo/redo history, version timeline, action grouping |
| **Dark Mode** | ✅ |

---

### 2.39 `SkipLink.tsx` (35 lines)

| Aspect | Details |
|---|---|
| **Exports** | `SkipLink` |
| **Accessibility** | ✅ WCAG best practice — off-screen link, visible on `focus-visible`, customizable target and label |
| **Dark Mode** | N/A (blue background always visible) |

---

### 2.40 `PropertyInspector.tsx` (492 lines)

| Aspect | Details |
|---|---|
| **Exports** | `PropertyInspector` |
| **Features** | Property editor for structural elements, grouped sections, editable fields |
| **Dark Mode** | ✅ |

---

### 2.41 Additional Small Components

| Component | Lines | Key Notes |
|---|---|---|
| `ActionToast.tsx` | ~80 | Inline action toast with feedback |
| `BottomSheet.tsx` | ~120 | Mobile bottom sheet |
| `ColorLegend.tsx` | ~60 | Color legend for visualization |
| `CoordinateInputBar.tsx` | ~90 | STAAD-style XYZ input bar |
| `DashboardSkeleton.tsx` | ~80 | Full dashboard loading skeleton |
| `EnhancedNavbar.tsx` | ~461 | Full-featured nav with responsive menu |
| `FeatureCard.tsx` | ~80 | Marketing feature card |
| `KeyboardShortcuts.tsx` | ~150 | Global keyboard shortcut manager |
| `KeyboardShortcutsOverlay.tsx` | ~100 | Visual shortcut guide overlay |
| `LoadInputDialog.tsx` | ~200 | Structural load input dialog |
| `NodeInputDialog.tsx` | ~180 | Node coordinate input dialog |
| `States.tsx` | ~100 | State machine utilities |
| `ViewControlsOverlay.tsx` | ~120 | Floating viewport controls |
| `Avatar.tsx` | ~459 | Extended avatar with upload support |

---

## 3. PROFESSIONAL UI SUITE (`ui/professional/`)

Enterprise-grade components (6,871 LOC total) replicating STAAD.Pro/SkyCiv/ETABS interfaces:

| Component | Lines | Key Features |
|---|---|---|
| `ProfessionalRibbon.tsx` | 951 | Tabbed ribbon toolbar, large/small tool buttons, dropdown menus, split buttons, QAT, contextual tabs, keyboard shortcuts, responsive collapse |
| `DockablePanel.tsx` | 867 | Multi-panel docking, drag-to-dock, resizable with min/max, collapsible headers, tab groups, floating/pinned modes, persistent layout |
| `CommandPalette.tsx` | 826 | Enhanced ⌘P palette with categorized commands |
| `StatusBar.tsx` | 792 | Analysis progress, model stats, coordinate display, unit selector, zoom, memory metrics, snap/grid/ortho toggles |
| `PropertyInspector.tsx` | 807 | Advanced property editor with grouped sections |
| `ModelTreeView.tsx` | 731 | Hierarchical tree with drag-to-select, context menus, icons per node type |
| `QuickAccessToolbar.tsx` | 655 | Customizable top toolbar with pin/unpin |
| `ContextMenu.tsx` | 628 | Enhanced context menus with nested items |
| `ViewCube.tsx` | 614 | 3D navigation cube with face/edge/corner clicks, smooth rotation |

---

## 4. LAYOUT COMPONENTS (`components/layout/`)

| Component | Lines | Features |
|---|---|---|
| `SmartSidebar.tsx` | 1,841 | Collapsible multi-section sidebar, search, favorites, tooltips |
| `ResponsiveLayout.tsx` | 714 | `Container`, `Grid`, `GridItem`, `Stack`, `Show`, `Hide`, `SidebarLayout`, `DashboardLayout`, `SplitPane`, `AspectRatio`, `Center`, `Spacer` — full responsive layout primitives |
| `EngineeringRibbon.tsx` | 742 | Ribbon toolbar for engineering workspace |
| `Ribbon.tsx` | 230 | Basic ribbon layout |
| `DataTablesPanel.tsx` | 159 | Tabbed data panel |
| `WorkflowSidebar.tsx` | 185 | Workflow step sidebar |
| `RightPropertiesPanel.tsx` | 153 | Right-side property panel |
| `RequireAuth.tsx` | 30 | Auth guard wrapper |
| `CanvasWrapper.tsx` | 27 | Canvas container |

---

## 5. PAGE-LEVEL COMPONENTS (`pages/`)

65+ page components covering:

**Core App:** `Dashboard`, `UnifiedDashboard`, `LandingPage`, `UIShowcase`  
**Auth:** `SignInPage`, `SignUpPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, `OAuthCallbackPage`, `AccountLockedPage`, `LinkExpiredPage`  
**Engineering:** `SteelDesignPage`, `ConcreteDesignPage`, `ConnectionDesignPage`, `FoundationDesignPage`, `DynamicAnalysisPage`, `NonlinearAnalysisPage`, `ModalAnalysisPage`, `PushoverAnalysisPage`, `TimeHistoryAnalysisPage`, `PlateShellAnalysisPage`  
**Visualization:** `Visualization3DEngine`, `VisualizationHubPage`, `ResultAnimationViewer`  
**CAD/BIM:** `BIMIntegrationPage`, `BIMExportEnhanced`, `CADIntegrationHub`  
**Reports:** `ProfessionalReportGenerator`, `PrintExportCenter`, `ReportBuilderPage`  
**Settings:** `AdvancedSettingsPage`, `SettingsPage`, `SettingsPageEnhanced`  
**Reference:** `MaterialsDatabasePage`, `SectionDatabasePage`, `ConnectionDesignDatabase`, `CodeComplianceChecker`  
**Legal:** `PrivacyPolicyPageNew`, `TermsAndConditionsPage`, `TermsOfServicePage`, `RefundCancellationPage`  
**Other:** `ContactPage`, `HelpPage`, `PricingPage`, `EnhancedPricingPage`, `AboutPage`, `CollaborationHub`, `RustWasmDemo`, etc.

---

## 6. CSS DESIGN SYSTEM (`index.css`) — 1,642 Lines

### 6.1 Custom Properties / Tokens

| Category | Count | Examples |
|---|---|---|
| **Primary Colors** | 10 | `--color-primary` through `--color-primary-900` |
| **Secondary Colors** | 3 | `--color-secondary`, `-light`, `-dark` |
| **Accent Colors** | 5 | `--color-accent`, `-light`, `-dark`, `--color-teal`, `--color-emerald` |
| **Gold/Construction** | 3 | `--color-gold`, `-light`, `-dark` |
| **Status Colors** | 7 | `--color-success`, `-light`, `--color-warning`, `-light`, `--color-error`, `-light`, `--color-info` |
| **Dark Theme** | 5 | `--color-background-dark`, `--color-surface-dark`, `--color-surface-elevated`, `--color-border-dark`, `--color-border-subtle` |
| **Dark Text** | 4 | `--color-text-primary`, `-secondary`, `-muted`, `-disabled` |
| **Light Theme** | 6 | `--color-background-light`, `--color-surface-light`, `--color-border-light`, text variants |
| **Engineering** | 12 | `--color-stress-*`, `--color-deformation`, `--color-support-color`, `--color-load-color`, etc. |
| **Fonts** | 3 | `--font-family-display`, `--font-family-body`, `--font-family-mono` |
| **Duration Tokens** | 8 | `--duration-instant` (75ms) through `--duration-loop` (2000ms) |
| **Easing Tokens** | 6 | `--ease-default`, `-in`, `-out`, `-in-out`, `-spring`, `-overshoot` |

### 6.2 @keyframes Animations (20)

| Animation | Purpose |
|---|---|
| `inputShake` | Error field shake (4px oscillation) |
| `tooltipIn` | Tooltip entrance (opacity+translateY) |
| `waveform` | Voice input bar animation |
| `fadeIn` | Generic fade+slide up |
| `pulse` | Opacity pulse (1→0.5→1) |
| `spin` | 360° rotation |
| `slideIn` | Slide from right |
| `slideUp` | Slide from bottom |
| `float` | Floating bobble (translateY+scale) |
| `buttonPress` | Button micro-press (scale 0.97) |
| `slideInRight` | Toast slide in |
| `slideOutRight` | Toast slide out |
| `successPop` | Success celebration (scale 0.8→1.1→1) |
| `shimmer` | Loading shimmer sweep |
| `skeletonPulse` | Skeleton opacity pulse |
| `bounceIn` | Modal/dialog bounce (scale 0.3→1.05→0.9→1) |
| `gradientShift` | Animated gradient position |
| `checkboxPop` | Checkbox checkmark pop-in |
| `pulse-ring` | Status dot expanding ring |
| `glowPulse` | Button glow pulse |

### 6.3 Utility Classes (32+)

| Category | Classes |
|---|---|
| **Animation** | `.fade-in`, `.animate-fadeIn`, `.slide-up`, `.animate-slideUp`, `.animate-slideIn`, `.animate-float`, `.animate-checkbox-pop`, `.animate-press`, `.animate-slide-in`, `.animate-slide-out`, `.animate-success`, `.animate-bounce-in`, `.animate-shimmer`, `.animate-gradient` |
| **Loading** | `.loading-spinner`, `.skeleton`, `.loading-overlay`, `.loading-text`, `.progress-bar`, `.analysis-progress` |
| **Interaction** | `.hover-lift`, `.hover-scale`, `.interactive`, `.focus-ring`, `.focus-visible-enhanced` |
| **Gradient** | `.gradient-sidebar`, `.gradient-text`, `.gradient-hero`, `.gradient-button-primary`, `.gradient-button-premium`, `.gradient-card-glow`, `.gradient-success-bar`, `.gradient-stress-spectrum` |
| **Status** | `.pulse-dot`, `.badge`, `.badge-success`, `.badge-warning`, `.badge-error` |
| **Cards** | `.card`, `.card-light`, `.card-premium`, `.card-glow` |
| **Engineering** | `.eng-panel`, `.eng-panel-header`, `.eng-data-grid`, `.coord-input-bar`, `.eng-unit`, `.eng-tooltip`, `.eng-scroll`, `.eng-context-menu`, `.eng-context-menu-item`, `.selection-highlight` |
| **Premium** | `.btn-shimmer`, `.btn-glow`, `.btn-glass`, `.text-gradient-premium`, `.pricing-highlight` |
| **Layout** | `.grid-pattern`, `.viewport-grid-overlay`, `.section-fade`, `.scroll-indicator`, `.input-float-label` |
| **A11y** | `.skip-link`, `.skip-to-content` |

### 6.4 Media Queries

| Query | Purpose |
|---|---|
| `@media (prefers-reduced-motion: reduce)` | ✅ Applied 3× — collapses ALL animation durations to 0.01ms, removes custom animation classes, removes premium button effects |
| `@media (prefers-contrast: high)` | ✅ Thicker borders, underlined links |
| `@media (pointer: coarse)` | ✅ Minimum 44×44px touch targets |

---

## 7. NOTABLE GAPS & ISSUES

### 7.1 Critical Gaps

| Issue | Severity | Details |
|---|---|---|
| **Triple notification system** | 🔴 High | `ToastSystem.tsx`, `NotificationManager.tsx`, and `Notifications.tsx` are THREE separate toast/notification implementations. Must consolidate to one. |
| **Triple form system** | 🔴 High | `Form.tsx`, `FormInputs.tsx`, and `FormValidation.tsx` overlap heavily with primitive `input.tsx`/`select.tsx`/`checkbox.tsx`. |
| **Duplicate utility components** | 🟡 Medium | `Utilities.tsx` re-exports Tooltip, Avatar, Badge, Accordion, EmptyState that also exist as separate files. Creates import ambiguity. |
| **scroll-area.tsx dark mode** | 🟡 Medium | ScrollBar thumb uses `bg-gray-300` without `dark:` variant — visually broken in dark mode. |

### 7.2 Accessibility Gaps

| Component | Missing ARIA |
|---|---|
| `Navigation.tsx` Tabs | Missing `role="tablist"`, `role="tab"`, `role="tabpanel"` — custom implementation without Radix |
| `Navigation.tsx` Breadcrumbs | Missing `aria-current="page"` on last item |
| `Navigation.tsx` Pagination | Missing `aria-label` on nav element |
| `DataViz.tsx` Charts | No `role="img"`, no `aria-label`, no descriptions for screen readers |
| `StatusBadge.tsx` | No `role="status"` (unlike `badge.tsx` which has it) |
| `RangeSlider.tsx` | No ARIA attributes on native range input |
| `AdvancedToggle.tsx` | No `role="switch"` — uses hidden checkbox pattern |
| `VirtualScroll.tsx` | No `role="feed"` or virtualization announcements |
| `MiniMap.tsx` | No keyboard navigation for minimap area |
| `Drawer.tsx` Sheet handle | No `aria-label` on handle div |

### 7.3 Missing Dark Mode

| Component | Issue |
|---|---|
| `alert.tsx` | Uses CSS custom properties (`text-foreground`) that may not be defined — relies on theme setup |
| `table.tsx` | Uses `muted` CSS variable — needs theme variable definitions |
| `scroll-area.tsx` | Scrollbar thumb missing dark variant |

### 7.4 Missing Animations

| Component | What's Missing |
|---|---|
| `alert.tsx` | No entrance/exit animation |
| `table.tsx` | No row transition animations |
| `radio-group.tsx` | No selection animation |
| `StatusBadge.tsx` | No variant change animation |

### 7.5 Missing Error/Loading/Empty States

| Component | Missing |
|---|---|
| `select.tsx` | No error state, no loading indicator for async options |
| `radio-group.tsx` | No error state |
| `tabs.tsx` (Radix) | No loading state per tab |
| `table.tsx` | No loading/empty/error states (raw HTML wrapper) |
| `card.tsx` | No built-in loading skeleton |

### 7.6 Missing Responsive Design

| Component | Issue |
|---|---|
| `button.tsx` | No responsive size breakpoints |
| `DataTable.tsx` | No mobile column hiding/stacking |
| `ViewportControls.tsx` | No mobile layout adaptation |
| `ProfessionalRibbon.tsx` | Collapse behavior exists but limited |

---

## 8. SUMMARY STATISTICS

| Metric | Count |
|---|---|
| Total component files (ui/) | 76 |
| Professional sub-components | 9 |
| Layout components | 9 |
| Page-level components | 65+ |
| CSS custom properties | ~80 |
| CSS @keyframes | 20 |
| CSS utility classes | 32+ |
| CSS media queries | 3 (reduced-motion, high-contrast, coarse-pointer) |
| Components with full dark mode | ~90% |
| Components with ARIA roles | ~75% |
| Components with animations | ~80% |
| Components with loading states | ~40% |
| Components with error states | ~30% |
| Duplicate/overlapping systems | 3 (notifications ×3, forms ×3, utility wrappers) |
