#!/usr/bin/env python3
"""Quick audit of formatter-edited files."""
import re, os
os.chdir('/Users/rakshittiwari/Desktop/newanti/apps/web/src')

files = [
    'components/SectionPropertiesDialog.tsx',
    'components/LoadDialog.tsx',
    'components/ui/Drawer.tsx',
    'components/ai/FeedbackPanel.tsx',
    'components/design/EnhancedColumnDesignDialog.tsx',
    'components/ui/HistoryPanel.tsx',
    'components/design/EnhancedSlabDesignDialog.tsx',
    'components/reporting/ReportGenerationDashboard.tsx',
]

patterns = [
    (r'(?<!dark:)(?<!hover:)bg-zinc-950\b', 'bare bg-zinc-950'),
    (r'(?<!dark:)(?<!hover:)bg-slate-950\b', 'bare bg-slate-950'),
    (r'(?<!dark:)(?<!hover:)bg-zinc-900\b', 'bare bg-zinc-900'),
    (r'(?<!dark:)(?<!hover:)bg-zinc-800\b', 'bare bg-zinc-800'),
    (r'(?<!dark:)(?<!hover:)bg-slate-900\b', 'bare bg-slate-900'),
    (r'(?<!dark:)(?<!hover:)bg-slate-800\b', 'bare bg-slate-800'),
    (r'(?<!dark:)(?<!hover:)border-zinc-700\b', 'bare border-zinc-700'),
    (r'(?<!dark:)(?<!hover:)border-slate-700\b', 'bare border-slate-700'),
    (r'(?<!dark:)(?<!hover:)text-zinc-300\b', 'bare text-zinc-300'),
    (r'(?<!dark:)(?<!hover:)text-zinc-400\b', 'bare text-zinc-400'),
    (r'(?<!dark:)(?<!hover:)text-slate-300\b', 'bare text-slate-300'),
    (r'(?<!dark:)(?<!hover:)text-slate-400\b', 'bare text-slate-400'),
]

ok_contexts = re.compile(r'(bg-(blue|green|red|purple|indigo|cyan|emerald|teal|amber|orange|yellow|pink|rose|violet|fuchsia|sky|lime)-(400|500|600|700|800|900)|bg-gradient|from-|to-)')

total = 0
for fp in files:
    if not os.path.exists(fp):
        print(f"MISSING: {fp}")
        continue
    with open(fp) as f:
        lines = f.readlines()
    issues = []
    for pat, name in patterns:
        r = re.compile(pat)
        for i, line in enumerate(lines):
            if r.search(line):
                # Skip if on colored bg or shadcn data-[] attribute
                if ok_contexts.search(line) or 'data-[' in line:
                    continue
                issues.append(f"  L{i+1} {name}: {line.strip()[:100]}")
    if issues:
        print(f"\n{fp}:")
        for x in issues:
            print(x)
            total += 1
    else:
        print(f"OK: {fp}")
print(f"\n--- Total issues: {total} ---")
