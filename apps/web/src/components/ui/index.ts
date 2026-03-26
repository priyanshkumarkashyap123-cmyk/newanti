/**
 * UI Components Index
 * 
 * Design system exports for engineering interfaces.
 */

// Typography
export { Typography, typographyVariants, H1, H2, H3, H4, ValueDisplay } from './typography';

// Forms
export { Input, NumberInput } from './input';
export { Label, FormField } from './label';

// Buttons
export { Button, buttonVariants } from './button';

// Cards
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card';

// Dialog
export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from './dialog';

// Select
export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
    SelectScrollUpButton,
    SelectScrollDownButton,
} from './select';

// Table
export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
} from './table';

// Tabs (core Radix)
export { Tabs as RadixTabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants } from './tabs';

// Alert
export { Alert, AlertTitle, AlertDescription, alertVariants } from './alert';

// Badge (core)
export { Badge as CoreBadge, badgeVariants } from './badge';

// Checkbox
export { Checkbox, checkboxVariants } from './checkbox';

// Switch
export { Switch, switchVariants } from './switch';

// Slider
export { Slider } from './slider';

// Radio Group
export { RadioGroup, RadioGroupItem } from './radio-group';

// Scroll Area
export { ScrollArea, ScrollBar } from './scroll-area';

// Data Display - Using DataTable.tsx (uppercase)
export { DataTable } from './DataTable';
export { DataTable as InteractiveDataTable } from './DataTable';
export { DataTable as VirtualDataTable } from './data-table';

// Property Inspector
export { PropertyInspector } from './PropertyInspector';

// Advanced UI Components (Template-based)
export { AdvancedToggle } from './AdvancedToggle';
export type { AdvancedToggleProps } from './AdvancedToggle';

export { RangeSlider } from './RangeSlider';
export type { RangeSliderProps } from './RangeSlider';

export { StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, BadgeVariant } from './StatusBadge';

// Theme & Settings
export { ThemeProvider, useTheme, ThemeSwitcher, designTokens } from './ThemeProvider';
export { default as SettingsPanel, defaultSettings } from './SettingsPanel';
export type { DesignSettings } from './SettingsPanel';

// Animation Utilities
export {
    PageTransition,
    FadeIn,
    StaggerContainer,
    StaggerItem,
    ScaleOnHover,
    SlideIn,
} from './PageTransition';

// Loading States
export {
    Skeleton,
    SkeletonText,
    SkeletonCard,
    SkeletonTable,
    SkeletonProjectCard,
} from './Skeleton';

// Results & Feedback
export { ResultsReveal, SuccessBanner } from './ResultsReveal';

// Onboarding
export { Spotlight, QuickTip } from './Spotlight';

// Form Validation
export {
    ValidatedInput,
    PasswordStrength,
    SubmitButton,
    FormErrorSummary,
} from './FormValidation';

// Command Palette & Shortcuts
export { CommandPalette, useCommandPalette } from './CommandPalette';
export { KeyboardShortcuts, useKeyboardShortcuts } from './KeyboardShortcuts';

// Context Menu
export {
    ContextMenu,
    useContextMenu,
    createNodeContextMenu,
    createMemberContextMenu,
} from './ContextMenu';

// Drag & Drop Feedback
export {
    DragHandle,
    DragGhost,
    DropZone,
    SelectionBox,
    SelectionHighlight,
    CursorIndicator,
} from './DragFeedback';

// Notification System
export {
    NotificationProvider,
    useNotifications,
    createNotificationHelpers,
} from './NotificationManager';

// Confirmation Dialogs
export {
    ConfirmDialog,
    ConfirmProvider,
    useConfirm,
} from './ConfirmDialog';

// Viewport Controls (Phase 9)
export {
    ViewportControls,
    ZoomControls,
    ViewCube,
    DisplayToggles,
    CoordinateDisplay,
    ViewportCrosshair,
    ScaleBar,
} from './ViewportControls';

// MiniMap & Viewport UI (Phase 9)
export {
    MiniMap,
    ViewportStatusBar,
    FloatingToolbar,
} from './MiniMap';

// Data Visualization (Phase 10)
export {
    ProgressRing,
    ProgressBar,
    StatCard,
    Sparkline,
    BarChart,
    Gauge,
} from './DataViz';

// Modal System (Phase 11)
export {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useModal,
} from './Modal';

// Drawer & Sheet (Phase 11)
export {
    Drawer,
    Sheet,
    useDrawer,
    useSheet,
} from './Drawer';

// Navigation (Phase 12)
export {
    Tabs,
    TabPanel,
    Breadcrumbs,
    Pagination,
    Stepper,
    SegmentedControl,
} from './Navigation';

// Utilities (Phase 13)
export {
    Tooltip,
    Avatar,
    AvatarGroup,
    Badge,
    Accordion,
    Divider,
    EmptyState,
} from './Utilities';

// ============================================================================
// NEW INDUSTRY-STANDARD COMPONENTS (CTO Session)
// ============================================================================

// Virtual Scrolling
export {
    VirtualList,
    VirtualGrid,
    VirtualTable,
    useInfiniteScroll,
} from './VirtualScroll';

// Optimized Images
export {
    OptimizedImage,
    Picture,
    BackgroundImage,
    preloadImage,
    preloadImages,
    generateBlurPlaceholder,
    useImage,
    useIntersectionObserver,
} from './OptimizedImage';

// Enhanced Drag and Drop
export {
    DndProvider,
    Draggable,
    Droppable,
    SortableList,
    useDndContext,
    useDragAndDrop,
} from './DragAndDrop';

// Toast Notifications (Legacy)
export {
    NotificationProvider as LegacyNotificationProvider,
    useNotifications as useToasts,
    usePushNotifications,
} from './Notifications';

// Form Components (Industry Standard)
export {
    FormField as FormFieldIndustry,
    Input as FormInput,
    TextArea as FormTextarea,
    Select as FormSelect,
    Checkbox as FormCheckbox,
    RadioGroup as FormRadioGroup,
    SubmitButton as FormSubmitButton,
    useFormValidation as useFormValidationLegacy,
    type FormFieldProps,
    type InputProps,
    type TextAreaProps,
    type SelectProps,
    type CheckboxProps,
    type RadioGroupProps,
} from './Form';

// New Empty States (Session 3)
export {
    EmptyState as EmptyStateComponent,
    NoData,
    SearchNoResults,
    OfflineState,
    PermissionDenied,
    OnboardingState,
    MaintenanceState,
    ComingSoon,
    UploadState,
} from './EmptyStates';

// Toast System (Session 3)
export {
    ToastProvider,
    useToast,
} from './ToastSystem';
export {
    ToastProvider as NotificationToastProvider,
    useToast as useAppToast,
} from './ToastSystem';

// Progress Tracking (Session 3)
export {
    StepIndicator,
    ProgressCard,
    StatusBadge as ProgressStatusBadge,
    ProgressModal,
    BackgroundTaskIndicator,
    InlineProgress,
    CircularProgressIndicator,
} from './ProgressTracker';

// Responsive Layout (Session 3)
export {
    Container,
    Grid,
    GridItem,
    Stack,
    Show,
    Hide,
    SidebarLayout,
    DashboardLayout,
    SplitPane,
    AspectRatio,
    Center,
    Spacer,
} from '../layout/ResponsiveLayout';
