#!/usr/bin/env python3
"""
Fix dark-mode-only color classes to be responsive (light + dark).
Handles backgrounds, borders, text, hover states, opacity variants.
Skips instances already prefixed with dark:, and won't double-apply.
"""

import re
import os
import sys
from pathlib import Path

SRC_DIR = "apps/web/src"

# Mapping: (pattern, light_equivalent)
# We'll match these as whole "words" in class strings, preceded by space/quote/backtick/newline
# and NOT preceded by dark: or similar prefix

BG_REPLACEMENTS = {
    # bg-zinc-900 variants
    'bg-zinc-900': 'bg-white dark:bg-zinc-900',
    'bg-zinc-900/10': 'bg-zinc-100/10 dark:bg-zinc-900/10',
    'bg-zinc-900/20': 'bg-zinc-100/20 dark:bg-zinc-900/20',
    'bg-zinc-900/30': 'bg-zinc-100/30 dark:bg-zinc-900/30',
    'bg-zinc-900/40': 'bg-zinc-100/40 dark:bg-zinc-900/40',
    'bg-zinc-900/50': 'bg-white/50 dark:bg-zinc-900/50',
    'bg-zinc-900/60': 'bg-white/60 dark:bg-zinc-900/60',
    'bg-zinc-900/70': 'bg-white/70 dark:bg-zinc-900/70',
    'bg-zinc-900/80': 'bg-white/80 dark:bg-zinc-900/80',
    'bg-zinc-900/90': 'bg-white/90 dark:bg-zinc-900/90',
    'bg-zinc-900/95': 'bg-white/95 dark:bg-zinc-900/95',
    
    # bg-zinc-800 variants
    'bg-zinc-800': 'bg-zinc-100 dark:bg-zinc-800',
    'bg-zinc-800/10': 'bg-zinc-100/10 dark:bg-zinc-800/10',
    'bg-zinc-800/20': 'bg-zinc-100/20 dark:bg-zinc-800/20',
    'bg-zinc-800/30': 'bg-zinc-100/30 dark:bg-zinc-800/30',
    'bg-zinc-800/40': 'bg-zinc-100/40 dark:bg-zinc-800/40',
    'bg-zinc-800/50': 'bg-zinc-100/50 dark:bg-zinc-800/50',
    'bg-zinc-800/60': 'bg-zinc-100/60 dark:bg-zinc-800/60',
    'bg-zinc-800/70': 'bg-zinc-100/70 dark:bg-zinc-800/70',
    'bg-zinc-800/80': 'bg-zinc-100/80 dark:bg-zinc-800/80',
    'bg-zinc-800/90': 'bg-zinc-100/90 dark:bg-zinc-800/90',
    
    # bg-zinc-700 variants
    'bg-zinc-700': 'bg-zinc-200 dark:bg-zinc-700',
    'bg-zinc-700/50': 'bg-zinc-200/50 dark:bg-zinc-700/50',
    'bg-zinc-700/30': 'bg-zinc-200/30 dark:bg-zinc-700/30',
    
    # bg-slate-900 variants
    'bg-slate-900': 'bg-slate-50 dark:bg-slate-900',
    'bg-slate-900/50': 'bg-slate-50/50 dark:bg-slate-900/50',
    'bg-slate-900/80': 'bg-slate-50/80 dark:bg-slate-900/80',
    'bg-slate-900/90': 'bg-slate-50/90 dark:bg-slate-900/90',
    'bg-slate-900/95': 'bg-slate-50/95 dark:bg-slate-900/95',
    
    # bg-slate-800 variants
    'bg-slate-800': 'bg-slate-100 dark:bg-slate-800',
    'bg-slate-800/10': 'bg-slate-100/10 dark:bg-slate-800/10',
    'bg-slate-800/20': 'bg-slate-100/20 dark:bg-slate-800/20',
    'bg-slate-800/30': 'bg-slate-100/30 dark:bg-slate-800/30',
    'bg-slate-800/40': 'bg-slate-100/40 dark:bg-slate-800/40',
    'bg-slate-800/50': 'bg-slate-100/50 dark:bg-slate-800/50',
    'bg-slate-800/60': 'bg-slate-100/60 dark:bg-slate-800/60',
    'bg-slate-800/70': 'bg-slate-100/70 dark:bg-slate-800/70',
    'bg-slate-800/80': 'bg-slate-100/80 dark:bg-slate-800/80',
    'bg-slate-800/90': 'bg-slate-100/90 dark:bg-slate-800/90',
    
    # bg-slate-700 variants
    'bg-slate-700': 'bg-slate-200 dark:bg-slate-700',
    'bg-slate-700/50': 'bg-slate-200/50 dark:bg-slate-700/50',
    
    # bg-gray-900 variants
    'bg-gray-900': 'bg-gray-50 dark:bg-gray-900',
    'bg-gray-900/50': 'bg-gray-50/50 dark:bg-gray-900/50',
    'bg-gray-900/80': 'bg-gray-50/80 dark:bg-gray-900/80',
    'bg-gray-900/90': 'bg-gray-50/90 dark:bg-gray-900/90',
    'bg-gray-900/95': 'bg-gray-50/95 dark:bg-gray-900/95',
    
    # bg-gray-800 variants
    'bg-gray-800': 'bg-gray-100 dark:bg-gray-800',
    'bg-gray-800/50': 'bg-gray-100/50 dark:bg-gray-800/50',
}

HOVER_BG_REPLACEMENTS = {
    'hover:bg-zinc-900': 'hover:bg-zinc-200 dark:hover:bg-zinc-900',
    'hover:bg-zinc-800': 'hover:bg-zinc-200 dark:hover:bg-zinc-800',
    'hover:bg-zinc-800/50': 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50',
    'hover:bg-zinc-800/30': 'hover:bg-zinc-200/30 dark:hover:bg-zinc-800/30',
    'hover:bg-zinc-700': 'hover:bg-zinc-200 dark:hover:bg-zinc-700',
    'hover:bg-zinc-700/50': 'hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50',
    'hover:bg-slate-800': 'hover:bg-slate-200 dark:hover:bg-slate-800',
    'hover:bg-slate-800/50': 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50',
    'hover:bg-slate-700': 'hover:bg-slate-200 dark:hover:bg-slate-700',
    'hover:bg-slate-700/50': 'hover:bg-slate-200/50 dark:hover:bg-slate-700/50',
    'hover:bg-gray-800': 'hover:bg-gray-200 dark:hover:bg-gray-800',
    'hover:bg-gray-700': 'hover:bg-gray-200 dark:hover:bg-gray-700',
}

BORDER_REPLACEMENTS = {
    'border-zinc-700': 'border-zinc-200 dark:border-zinc-700',
    'border-zinc-700/50': 'border-zinc-200/50 dark:border-zinc-700/50',
    'border-zinc-800': 'border-zinc-200 dark:border-zinc-800',
    'border-slate-700': 'border-slate-200 dark:border-slate-700',
    'border-slate-700/50': 'border-slate-200/50 dark:border-slate-700/50',
    'border-slate-800': 'border-slate-200 dark:border-slate-800',
    'border-white': 'border-zinc-200 dark:border-white',
}

HOVER_BORDER_REPLACEMENTS = {
    'hover:border-zinc-600': 'hover:border-zinc-300 dark:hover:border-zinc-600',
    'hover:border-zinc-500': 'hover:border-zinc-400 dark:hover:border-zinc-500',
    'hover:border-slate-600': 'hover:border-slate-300 dark:hover:border-slate-600',
}

TEXT_REPLACEMENTS = {
    'text-zinc-300': 'text-zinc-600 dark:text-zinc-300',
    'text-zinc-400': 'text-zinc-500 dark:text-zinc-400',
    'text-slate-300': 'text-slate-600 dark:text-slate-300',
    'text-slate-400': 'text-slate-500 dark:text-slate-400',
    'text-gray-300': 'text-gray-600 dark:text-gray-300',
    'text-gray-400': 'text-gray-500 dark:text-gray-400',
}

HOVER_TEXT_REPLACEMENTS = {
    'hover:text-zinc-300': 'hover:text-zinc-600 dark:hover:text-zinc-300',
    'hover:text-zinc-200': 'hover:text-zinc-700 dark:hover:text-zinc-200',
    'hover:text-slate-300': 'hover:text-slate-600 dark:hover:text-slate-300',
    'hover:text-slate-200': 'hover:text-slate-700 dark:hover:text-slate-200',
}

PLACEHOLDER_REPLACEMENTS = {
    'placeholder-zinc-500': 'placeholder-zinc-400 dark:placeholder-zinc-500',
    'placeholder-zinc-400': 'placeholder-zinc-400 dark:placeholder-zinc-500',
    'placeholder-slate-500': 'placeholder-slate-400 dark:placeholder-slate-500',
    'placeholder-white': 'placeholder-zinc-400 dark:placeholder-white',
}

RING_REPLACEMENTS = {
    'ring-white': 'ring-zinc-300 dark:ring-white',
    'ring-zinc-700': 'ring-zinc-300 dark:ring-zinc-700',
    'ring-zinc-800': 'ring-zinc-300 dark:ring-zinc-800',
}

DIVIDE_REPLACEMENTS = {
    'divide-zinc-800': 'divide-zinc-200 dark:divide-zinc-800',
    'divide-zinc-700': 'divide-zinc-200 dark:divide-zinc-700',
    'divide-slate-800': 'divide-slate-200 dark:divide-slate-800',
    'divide-slate-700': 'divide-slate-200 dark:divide-slate-700',
}

FOCUS_REPLACEMENTS = {
    'focus:ring-zinc-700': 'focus:ring-zinc-300 dark:focus:ring-zinc-700',
    'focus:border-zinc-500': 'focus:border-zinc-400 dark:focus:border-zinc-500',
}

ALL_REPLACEMENTS = {}
ALL_REPLACEMENTS.update(HOVER_BG_REPLACEMENTS)  # Process hover first (longer patterns)
ALL_REPLACEMENTS.update(HOVER_BORDER_REPLACEMENTS)
ALL_REPLACEMENTS.update(HOVER_TEXT_REPLACEMENTS)
ALL_REPLACEMENTS.update(FOCUS_REPLACEMENTS)
ALL_REPLACEMENTS.update(BG_REPLACEMENTS)
ALL_REPLACEMENTS.update(BORDER_REPLACEMENTS)
ALL_REPLACEMENTS.update(TEXT_REPLACEMENTS)
ALL_REPLACEMENTS.update(PLACEHOLDER_REPLACEMENTS)
ALL_REPLACEMENTS.update(RING_REPLACEMENTS)
ALL_REPLACEMENTS.update(DIVIDE_REPLACEMENTS)

def should_skip(line, match_start, pattern):
    """Check if this match should be skipped (already has dark: prefix, etc.)"""
    # Check if preceded by dark: (with possible hover:/focus: in between)
    before = line[:match_start]
    # Check last ~30 chars before match for dark:
    prefix = before[-30:] if len(before) > 30 else before
    
    # Skip if dark: appears right before this class (allowing hover:/focus: between)
    if re.search(r'dark:(?:hover:|focus:)?$', prefix):
        return True
    
    # Skip if this is inside a comment
    stripped = line.strip()
    if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
        return True
    
    return False

def process_file(filepath, replacements, dry_run=False):
    """Process a single file, applying all replacements."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (UnicodeDecodeError, FileNotFoundError):
        return 0
    
    original = content
    total_changes = 0
    
    # Sort replacements by pattern length (longest first) to avoid partial matches
    sorted_replacements = sorted(replacements.items(), key=lambda x: len(x[0]), reverse=True)
    
    for pattern, replacement in sorted_replacements:
        # Skip if pattern not in file at all
        if pattern not in content:
            continue
        
        # Skip if replacement already in file (already processed)
        # Actually don't skip - there might be some done and some not
        
        # Build regex that matches the pattern as a whole "word" in class context
        # Pattern should be preceded by: space, quote, backtick, newline, {, (, or start of string
        # Pattern should be followed by: space, quote, backtick, newline, }, ), or end of string
        escaped = re.escape(pattern)
        
        # Negative lookbehind for dark: prefix (with optional hover:/focus: etc.)
        # We use a callback to check context
        regex = re.compile(
            r'(?<=["\'\s`{(\n,])' + escaped + r'(?=["\'\s`})\n,]|$)'
        )
        
        def replace_match(m):
            nonlocal total_changes
            # Check if this should be skipped
            start = m.start()
            line_start = content.rfind('\n', 0, start)
            if line_start == -1:
                line_start = 0
            line_end = content.find('\n', start)
            if line_end == -1:
                line_end = len(content)
            line = content[line_start:line_end]
            
            # Get what's before the match in the line
            before_in_line = content[line_start:start]
            
            # Check for dark: prefix (with optional hover:/focus:/group-hover: between)
            if re.search(r'dark:(?:hover:|focus:|group-hover:|active:|disabled:)?$', before_in_line):
                return m.group(0)  # Don't change
            
            # Check if already has the replacement nearby (dedup)
            if replacement in line:
                return m.group(0)  # Already processed
            
            total_changes += 1
            return replacement
        
        content = regex.sub(replace_match, content)
    
    if content != original and not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return total_changes

def find_files(src_dir, extensions=('.tsx', '.ts')):
    """Find all TypeScript/React files."""
    files = []
    for root, dirs, filenames in os.walk(src_dir):
        # Skip node_modules
        dirs[:] = [d for d in dirs if d != 'node_modules' and d != 'node_modules 2']
        for fname in filenames:
            if any(fname.endswith(ext) for ext in extensions):
                files.append(os.path.join(root, fname))
    return sorted(files)

def main():
    dry_run = '--dry-run' in sys.argv
    category = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != '--dry-run' else 'all'
    
    if category == 'bg':
        replacements = {**BG_REPLACEMENTS, **HOVER_BG_REPLACEMENTS}
        print("Processing: Background colors")
    elif category == 'border':
        replacements = {**BORDER_REPLACEMENTS, **HOVER_BORDER_REPLACEMENTS}
        print("Processing: Border colors")
    elif category == 'text':
        replacements = {**TEXT_REPLACEMENTS, **HOVER_TEXT_REPLACEMENTS}
        print("Processing: Text colors")
    elif category == 'misc':
        replacements = {**PLACEHOLDER_REPLACEMENTS, **RING_REPLACEMENTS, **DIVIDE_REPLACEMENTS, **FOCUS_REPLACEMENTS}
        print("Processing: Misc (placeholder, ring, divide, focus)")
    elif category == 'all':
        replacements = ALL_REPLACEMENTS
        print("Processing: ALL categories")
    else:
        print(f"Unknown category: {category}")
        sys.exit(1)
    
    if dry_run:
        print("  (DRY RUN - no files will be modified)")
    
    src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), SRC_DIR)
    files = find_files(src_path)
    print(f"Found {len(files)} files to scan")
    
    total_files_changed = 0
    total_changes = 0
    
    for filepath in files:
        changes = process_file(filepath, replacements, dry_run)
        if changes > 0:
            rel = os.path.relpath(filepath, src_path)
            print(f"  {rel}: {changes} changes")
            total_files_changed += 1
            total_changes += changes
    
    print(f"\nTotal: {total_changes} changes across {total_files_changed} files")

if __name__ == '__main__':
    main()
