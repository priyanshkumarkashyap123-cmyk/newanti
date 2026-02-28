#!/usr/bin/env python3
"""
Context-aware audit: show each bare text-white / border instance with surrounding context
to determine if it's on a colored background (OK) or needs dark: variant (FIX).
"""
import re, os

os.chdir('/Users/rakshittiwari/Desktop/newanti/apps/web/src')

files_with_issues = {
    'components/dialogs/EnhancedFoundationDesignDialog.tsx': ['text-white'],
    'components/results/PostProcessingDesignStudio.tsx': ['text-white'],
    'components/Toolbar.tsx': ['border-slate-700', 'text-white'],
    'components/layout/EngineeringRibbon.tsx': ['border-slate-700', 'text-white'],
    'components/ui/ViewControlsOverlay.tsx': ['border-slate-700'],
    'components/PropertiesPanel.tsx': ['border-slate-700', 'text-white'],
    'components/layout/WorkflowSidebar.tsx': ['text-white'],
    'components/FoundationDesignDialog.tsx': ['text-white'],
    'components/ui/ProgressTracker.tsx': ['text-white'],
    'components/ui/EnhancedNavbar.tsx': ['border-white', 'text-white'],
    'components/ChatPanel.tsx': ['text-white'],
    'components/ui/LoadInputDialog.tsx': ['text-white'],
    'components/AdvancedAnalysisDialog.tsx': ['text-white', 'text-zinc-400'],
    'components/SelectionToolbar.tsx': ['text-white'],
    'components/InteroperabilityDialog.tsx': ['text-white'],
    'components/StructureWizard.tsx': ['text-white'],
    'components/FeatureOverviewPanel.tsx': ['text-white'],
    'components/CurvedStructureDialog.tsx': ['text-white'],
    'components/RailwayBridgeDialog.tsx': ['text-white'],
    'components/ai/AuditTrailViewer.tsx': ['text-white'],
    'components/ui/NodeInputDialog.tsx': ['text-white'],
    'components/IS875LoadDialog.tsx': ['text-white'],
    'components/DesignCodesDialog.tsx': ['text-white'],
    'components/ProjectSaveDialog.tsx': ['text-white'],
    'components/ui/SettingsPanel.tsx': ['text-white'],
    'components/DetailedDesignPanel.tsx': ['text-white'],
}

# Colored bg patterns that make text-white OK
colored_bg = re.compile(r'(bg-(blue|green|red|purple|indigo|cyan|emerald|teal|amber|orange|yellow|pink|rose|violet|fuchsia|sky|lime)-(400|500|600|700|800|900)|bg-gradient|from-|to-|bg-black)')

for fp, patterns in files_with_issues.items():
    if not os.path.exists(fp):
        continue
    with open(fp) as f:
        lines = f.readlines()
    
    for pat in patterns:
        if pat == 'text-white':
            regex = re.compile(r'(?<!dark:)(?<!hover:)(?<!dark:hover:)text-white\b')
        elif pat == 'text-zinc-400':
            regex = re.compile(r'(?<!dark:)(?<!hover:)text-zinc-400\b')
        elif pat.startswith('border-'):
            regex = re.compile(r'(?<!dark:)(?<!hover:)' + re.escape(pat) + r'\b')
        else:
            continue
        
        for i, line in enumerate(lines):
            if regex.search(line):
                # Check context: is there a colored bg nearby?
                ctx = ''.join(lines[max(0,i-3):i+4])
                has_colored = colored_bg.search(ctx) or colored_bg.search(line)
                status = "OK-colored" if has_colored else "NEEDS-FIX"
                print(f"{status} | {fp}:{i+1} | {line.strip()[:120]}")

print("\n--- DONE ---")
