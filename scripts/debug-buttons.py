#!/usr/bin/env python3
"""Debug: Check if buttons without type= exist."""
import os

root_dir = '/Users/rakshittiwari/Desktop/newanti/apps/web/src'
count = 0

for dirpath, _, filenames in os.walk(root_dir):
    for fname in filenames:
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, 'r') as f:
            content = f.read()
        
        if '<button' not in content:
            continue
        
        parts = content.split('<button')
        missing = 0
        for part in parts[1:]:
            tag_end = part.find('>')
            if tag_end == -1:
                continue
            tag_content = part[:tag_end]
            if 'type=' not in tag_content:
                missing += 1
        
        if missing > 0:
            count += missing
            rel = os.path.relpath(fpath, root_dir)
            print(f"  {missing} in {rel}")

print(f"\nTotal buttons missing type=: {count}")
