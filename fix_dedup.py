#!/usr/bin/env python3
"""Quick dedup fix for cascading dark: patterns."""
import os
os.chdir('apps/web/src')

fixes = [
    ('pages/ResetPasswordPage.tsx', 'bg-white dark:bg-white dark:bg-zinc-900', 'bg-white dark:bg-zinc-900'),
    ('pages/ResetPasswordPage.tsx', 'border-zinc-200 dark:border-zinc-200 dark:border-zinc-800', 'border-zinc-200 dark:border-zinc-800'),
    ('pages/TermsOfServicePage.tsx', 'bg-white dark:bg-white dark:bg-zinc-900', 'bg-white dark:bg-zinc-900'),
    ('pages/TermsOfServicePage.tsx', 'border-zinc-200 dark:border-zinc-200 dark:border-zinc-800', 'border-zinc-200 dark:border-zinc-800'),
    ('components/DetailedDesignPanel.tsx', 'hover:bg-zinc-100 dark:bg-zinc-800', 'hover:bg-zinc-200 dark:hover:bg-zinc-800'),
]

for fp, old, new in fixes:
    with open(fp, 'r') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(fp, 'w') as f:
            f.write(content)
        print(f'Fixed {fp}')
    else:
        print(f'Pattern not found in {fp} (may already be fixed)')
print('Done!')
