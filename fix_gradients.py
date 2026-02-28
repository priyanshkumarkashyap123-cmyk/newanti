#!/usr/bin/env python3
"""Fix dark gradient colors (from-/to-/via- with dark shades) to be responsive."""
import re, os

SRC = '/Users/rakshittiwari/Desktop/newanti/apps/web/src'

# Gradient direction color replacements (from-, to-, via-)
GRAD_COLORS = {
    # slate shades
    'from-slate-950': 'from-white dark:from-slate-950',
    'from-slate-900': 'from-slate-50 dark:from-slate-900',
    'to-slate-950': 'to-white dark:to-slate-950',
    'to-slate-900': 'to-slate-50 dark:to-slate-900',
    'via-slate-950': 'via-slate-100 dark:via-slate-950',
    'via-slate-900': 'via-slate-100 dark:via-slate-900',
    'via-slate-800': 'via-slate-100 dark:via-slate-800',
    # zinc shades
    'from-zinc-950': 'from-white dark:from-zinc-950',
    'from-zinc-900': 'from-zinc-50 dark:from-zinc-900',
    'to-zinc-950': 'to-white dark:to-zinc-950',
    'to-zinc-900': 'to-zinc-50 dark:to-zinc-900',
    'via-zinc-950': 'via-zinc-100 dark:via-zinc-950',
    'via-zinc-900': 'via-zinc-100 dark:via-zinc-900',
    'via-zinc-800': 'via-zinc-100 dark:via-zinc-800',
    # opacity variants
    'from-slate-900/30': 'from-slate-100/30 dark:from-slate-900/30',
    'from-slate-900/20': 'from-slate-100/20 dark:from-slate-900/20',
    'to-slate-900/50': 'to-slate-100/50 dark:to-slate-900/50',
    'from-zinc-800/50': 'from-zinc-100/50 dark:from-zinc-800/50',
    'to-zinc-900/50': 'to-zinc-50/50 dark:to-zinc-900/50',
    'to-zinc-800/50': 'to-zinc-100/50 dark:to-zinc-800/50',
    # colored dark variants for gradients
    'from-blue-950/80': 'from-blue-100/80 dark:from-blue-950/80',
    'from-blue-950': 'from-blue-100 dark:from-blue-950',
    'to-blue-950/20': 'to-blue-50/20 dark:to-blue-950/20',
    'via-blue-950': 'via-blue-100 dark:via-blue-950',
    'from-orange-950/50': 'from-orange-100/50 dark:from-orange-950/50', 
    'via-indigo-950': 'via-indigo-100 dark:via-indigo-950',
    'via-emerald-950': 'via-emerald-100 dark:via-emerald-950',
    'via-purple-900': 'via-purple-100 dark:via-purple-900',
    'via-teal-950': 'via-teal-100 dark:via-teal-950',
    # colored dark from
    'from-green-900/20': 'from-green-100/20 dark:from-green-900/20',
    'from-yellow-900/20': 'from-yellow-100/20 dark:from-yellow-900/20',
    'from-red-900/20': 'from-red-100/20 dark:from-red-900/20',
    'from-red-900/30': 'from-red-100/30 dark:from-red-900/30',
    'via-orange-900/20': 'via-orange-100/20 dark:via-orange-900/20',
}

SKIP_FILES = {'tabs.tsx', 'switch.tsx'}

def find_files(d, exts=('.tsx', '.ts')):
    files = []
    for root, dirs, fnames in os.walk(d):
        dirs[:] = [x for x in dirs if x not in ('node_modules', 'node_modules 2')]
        for f in fnames:
            if any(f.endswith(e) for e in exts) and f not in SKIP_FILES:
                files.append(os.path.join(root, f))
    return sorted(files)

def process(filepath, repls):
    with open(filepath, 'r') as f:
        content = f.read()
    original = content
    changes = 0
    
    sorted_repls = sorted(repls.items(), key=lambda x: len(x[0]), reverse=True)
    for pat, repl in sorted_repls:
        if pat not in content:
            continue
        escaped = re.escape(pat)
        regex = re.compile(r'(?<=["\'\s`{(\n,])' + escaped + r'(?=["\'\s`})\n,]|$)')
        
        def do_replace(m):
            nonlocal changes, content
            start = m.start()
            line_start = content.rfind('\n', 0, start)
            if line_start < 0: line_start = 0
            before = content[line_start:start]
            if re.search(r'dark:$', before):
                return m.group(0)
            line_end = content.find('\n', start)
            if line_end < 0: line_end = len(content)
            line = content[line_start:line_end]
            if repl in line:
                return m.group(0)
            changes += 1
            return repl
        
        content = regex.sub(do_replace, content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
    return changes

def main():
    files = find_files(SRC)
    print(f"Scanning {len(files)} files for dark gradients...")
    total_c = total_f = 0
    for fp in files:
        c = process(fp, GRAD_COLORS)
        if c > 0:
            print(f"  {os.path.relpath(fp, SRC)}: {c}")
            total_c += c
            total_f += 1
    print(f"\nTotal: {total_c} changes across {total_f} files")

if __name__ == '__main__':
    main()
