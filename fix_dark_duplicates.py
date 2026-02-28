#!/usr/bin/env python3
"""
Fix conflicting dark: class duplicates where two dark: prefixed classes
of the same type appear. E.g. 'dark:text-zinc-300 dark:text-zinc-600'
Keep the LAST one (Tailwind's behavior) but clean up the first.
Also handles dark:hover:, dark:focus: etc.
"""
import re
import os

SRC_DIR = '/Users/rakshittiwari/Desktop/newanti/apps/web/src'

# Match patterns like: dark:text-COLOR-NUM ... dark:text-COLOR-NUM
# or dark:bg-COLOR-NUM ... dark:bg-COLOR-NUM
# or dark:border-COLOR-NUM ... dark:border-COLOR-NUM
# or dark:hover:text-COLOR-NUM ... dark:hover:text-COLOR-NUM
# Also handles opacity variants like dark:text-zinc-300/50

PREFIXES = [
    'dark:text-',
    'dark:bg-',
    'dark:border-',
    'dark:hover:text-',
    'dark:hover:bg-',
    'dark:hover:border-',
    'dark:focus:text-',
    'dark:focus:bg-',
    'dark:focus:border-',
    'dark:focus:ring-',
    'dark:ring-',
    'dark:divide-',
    'dark:placeholder-',
]

def dedup_dark_classes(content):
    """Remove duplicate dark: classes, keeping the last occurrence."""
    changes = 0
    
    for prefix in PREFIXES:
        escaped_prefix = re.escape(prefix)
        # Pattern: find two occurrences of the same prefix in a single class string
        # Match within quotes, backticks, or template literals
        # We look for: prefix + word chars (color-number/opacity) + ... + prefix + word chars
        pattern = re.compile(
            r'(' + escaped_prefix + r'[\w-]+(?:/[\d]+)?)' +  # First dark:X class
            r'(\s+(?:[\w:/-]+\s+)*)' +  # Other classes in between
            r'(' + escaped_prefix + r'[\w-]+(?:/[\d]+)?)'    # Second dark:X class
        )
        
        def replace_dup(m):
            nonlocal changes
            first = m.group(1)
            middle = m.group(2)
            second = m.group(3)
            # Keep the second (last) one, remove the first
            changes += 1
            return middle.lstrip() + second
        
        # Keep iterating until no more duplicates found
        prev = content
        content = pattern.sub(replace_dup, content)
        while content != prev:
            prev = content
            content = pattern.sub(replace_dup, content)
    
    return content, changes

def find_files(src_dir, extensions=('.tsx', '.ts')):
    files = []
    for root, dirs, filenames in os.walk(src_dir):
        dirs[:] = [d for d in dirs if d != 'node_modules' and d != 'node_modules 2']
        for fname in filenames:
            if any(fname.endswith(ext) for ext in extensions):
                files.append(os.path.join(root, fname))
    return sorted(files)

def main():
    files = find_files(SRC_DIR)
    print(f"Scanning {len(files)} files for dark: class duplicates...")
    
    total_changes = 0
    total_files = 0
    
    for filepath in files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        
        new_content, changes = dedup_dark_classes(content)
        
        if changes > 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            rel = os.path.relpath(filepath, SRC_DIR)
            print(f"  {rel}: {changes} duplicates removed")
            total_changes += changes
            total_files += 1
    
    print(f"\nTotal: {total_changes} duplicates removed across {total_files} files")

if __name__ == '__main__':
    main()
