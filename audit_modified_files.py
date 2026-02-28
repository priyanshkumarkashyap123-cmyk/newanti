#!/usr/bin/env python3
"""Audit externally-modified files for reverted dark-mode fixes."""
import re, os

os.chdir('/Users/rakshittiwari/Desktop/newanti/apps/web/src')

files = [
    'components/dialogs/EnhancedFoundationDesignDialog.tsx',
    'components/results/PostProcessingDesignStudio.tsx',
    'components/Toolbar.tsx',
    'components/layout/EngineeringRibbon.tsx',
    'components/ui/ViewControlsOverlay.tsx',
    'components/PropertiesPanel.tsx',
    'components/ui/CoordinateInputBar.tsx',
    'components/layout/WorkflowSidebar.tsx',
    'components/FoundationDesignDialog.tsx',
    'components/ui/ProgressTracker.tsx',
    'components/ui/EnhancedNavbar.tsx',
    'components/ChatPanel.tsx',
    'components/ui/LoadInputDialog.tsx',
    'components/AdvancedAnalysisDialog.tsx',
    'components/SelectionToolbar.tsx',
    'components/ui/KeyboardShortcutsOverlay.tsx',
    'components/InteroperabilityDialog.tsx',
    'components/StructureWizard.tsx',
    'components/IntegrationDiagnostics.tsx',
    'components/FeatureOverviewPanel.tsx',
    'components/BoundaryConditionsDialog.tsx',
    'components/CurvedStructureDialog.tsx',
    'components/RailwayBridgeDialog.tsx',
    'components/QuickStartModal.tsx',
    'components/ui/KeyboardShortcuts.tsx',
    'components/ui/professional/CommandPalette.tsx',
    'components/ai/AuditTrailViewer.tsx',
    'components/ui/NodeInputDialog.tsx',
    'components/IS875LoadDialog.tsx',
    'components/DesignCodesDialog.tsx',
    'components/ProjectSaveDialog.tsx',
    'components/ui/SettingsPanel.tsx',
    'components/DetailedDesignPanel.tsx',
]

# Patterns that indicate dark-only styling (should have dark: prefix)
dark_bg_patterns = [
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)bg-zinc-900(?!/)', 'bare bg-zinc-900'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)bg-zinc-800(?!/)', 'bare bg-zinc-800'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)bg-slate-900(?!/)', 'bare bg-slate-900'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)bg-slate-800(?!/)', 'bare bg-slate-800'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)border-zinc-700\b', 'bare border-zinc-700'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)border-zinc-800\b', 'bare border-zinc-800'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)border-slate-700\b', 'bare border-slate-700'),
    (r'(?<!dark:)(?<!hover:)(?<!dark:hover:)border-white\b', 'bare border-white'),
    (r'(?<!dark:)(?<!hover:)text-white\b', 'bare text-white'),
    (r'(?<!dark:)(?<!hover:)text-zinc-300\b', 'bare text-zinc-300'),
    (r'(?<!dark:)(?<!hover:)text-zinc-400\b', 'bare text-zinc-400'),
    (r'(?<!dark:)(?<!hover:)text-slate-300\b', 'bare text-slate-300'),
    (r'(?<!dark:)(?<!hover:)text-slate-400\b', 'bare text-slate-400'),
]

total_issues = 0
for fp in files:
    if not os.path.exists(fp):
        print(f"MISSING: {fp}")
        continue
    with open(fp) as f:
        content = f.read()
    
    file_issues = []
    for pattern, name in dark_bg_patterns:
        matches = re.findall(pattern, content)
        if matches:
            # Check which are genuinely bare (not inside dark: context)
            count = len(matches)
            file_issues.append(f"  {name}: {count}")
    
    if file_issues:
        print(f"\n{fp}:")
        for issue in file_issues:
            print(issue)
        total_issues += len(file_issues)

print(f"\n--- Total categories with issues: {total_issues} ---")
