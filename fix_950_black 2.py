#!/usr/bin/env python3
"""
Fix bare bg-slate-950 and bg-zinc-950 → responsive light/dark.
Context-aware: skips shadcn primitives, instances already with dark: prefix.
"""
import re, os

SRC = '/Users/rakshittiwari/Desktop/newanti/apps/web/src'

REPLACEMENTS = {
    # bg-zinc-950 variants
    'bg-zinc-950': 'bg-white dark:bg-zinc-950',
    'bg-zinc-950/50': 'bg-white/50 dark:bg-zinc-950/50',
    'bg-zinc-950/60': 'bg-white/60 dark:bg-zinc-950/60',
    'bg-zinc-950/80': 'bg-white/80 dark:bg-zinc-950/80',
    'bg-zinc-950/90': 'bg-white/90 dark:bg-zinc-950/90',
    'bg-zinc-950/95': 'bg-white/95 dark:bg-zinc-950/95',
    # bg-slate-950 variants
    'bg-slate-950': 'bg-white dark:bg-slate-950',
    'bg-slate-950/50': 'bg-white/50 dark:bg-slate-950/50',
    'bg-slate-950/60': 'bg-white/60 dark:bg-slate-950/60',
    'bg-slate-950/80': 'bg-slate-100/80 dark:bg-slate-950/80',
    'bg-slate-950/90': 'bg-white/90 dark:bg-slate-950/90',
    'bg-slate-950/95': 'bg-white/95 dark:bg-slate-950/95',
    # bg-black (solid)
    'bg-black': 'bg-white dark:bg-black',
}

# Skip these files (shadcn primitives with their own dark: system)
SKIP_FILES = {'tabs.tsx', 'switch.tsx', 'checkbox.tsx', 'radio-group.tsx'}

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
            
            if re.search(r'dark:(?:hover:|focus:|group-hover:)?$', before):
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
    print(f"Scanning {len(files)} files...")
    total_c = 0
    total_f = 0
    for fp in files:
        c = process(fp, REPLACEMENTS)
        if c > 0:
            print(f"  {os.path.relpath(fp, SRC)}: {c}")
            total_c += c
            total_f += 1
    print(f"\nTotal: {total_c} changes across {total_f} files")

if __name__ == '__main__':
    main()
