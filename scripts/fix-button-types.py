#!/usr/bin/env python3
"""Fix all <button> elements missing type="button" attribute."""
import os
import re

fixed_count = 0
files_fixed = 0
root_dir = '/Users/rakshittiwari/Desktop/newanti/apps/web/src'

for dirpath, dirnames, filenames in os.walk(root_dir):
    for fname in filenames:
        if not fname.endswith('.tsx'):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, 'r') as f:
            content = f.read()

        parts = content.split('<button')
        if len(parts) <= 1:
            continue

        result = parts[0]
        file_fixes = 0
        for part in parts[1:]:
            # Find closing > of opening tag
            tag_end = -1
            for j, ch in enumerate(part):
                if ch == '>':
                    tag_end = j
                    break
            if tag_end == -1:
                result += '<button' + part
                continue

            tag_content = part[:tag_end]
            if 'type=' in tag_content or 'type =' in tag_content:
                result += '<button' + part
            else:
                result += '<button type="button"' + part
                file_fixes += 1

        if file_fixes > 0:
            with open(fpath, 'w') as f:
                f.write(result)
            files_fixed += 1
            fixed_count += file_fixes
            print(f"  Fixed {file_fixes} buttons in {os.path.relpath(fpath, root_dir)}")

print(f"\nTotal: Fixed {fixed_count} buttons across {files_fixed} files")
