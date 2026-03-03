#!/usr/bin/env python3
"""Replace inline sub-components in RCBeamDesigner.tsx with imports from extracted files."""
import re

filepath = "/Users/rakshittiwari/Desktop/newanti/apps/web/src/components/rc-design/RCBeamDesigner.tsx"

with open(filepath, 'r') as f:
    content = f.read()
lines = content.split('\n')

# Find the line numbers for the sub-components to remove
# BeamPreview starts at line 559, QuickSummary at 935, ResultsPanel at 972,
# ResultCard at 1143, ResultRow at 1171, ReinforcementDrawing at 1180

# We want to keep:
# - Lines 1-85 (interface + defaultFormData) - but update imports
# - Lines 86-458 (main component + return JSX) 
# - Lines 459-524 (InputCard + CollapsibleSection - small, keep)
# - Lines 525-558 (InputField - small, keep)
# - Lines 559-934 (BeamPreview - REMOVE, extracted)
# - Lines 935-971 (QuickSummary - keep, only 37 lines)
# - Lines 972-1179 (ResultsPanel + ResultCard + ResultRow - REMOVE, extracted)
# - Lines 1180-2509 (ReinforcementDrawing - REMOVE, extracted)

# Strategy: Keep lines 1-558, then 935-971, then remove the rest

# Build new content
kept_lines = []
# Keep lines 1-558 (0-indexed: 0-557)
kept_lines.extend(lines[0:558])
# Skip BeamPreview (559-934, 0-indexed: 558-933)
# Keep QuickSummary (935-971, 0-indexed: 934-970)
kept_lines.extend(lines[934:971])
# Skip everything after (ResultsPanel, ResultCard, ResultRow, ReinforcementDrawing)
# But we need the final closing of the file if any

new_content = '\n'.join(kept_lines) + '\n'

# Now add imports for the extracted components
# Find where to add new imports - after the existing imports
import_insert = "import type { BeamFormData } from \"./rcBeamTypes\";\nimport BeamPreview from \"./BeamPreview\";\nimport ResultsPanel from \"./ResultsPanel\";\nimport ReinforcementDrawing from \"./ReinforcementDrawing\";\n"

# Insert after the RCDesignConstants import block (after line 49 in original)
# Find the closing of the last import
last_import_end = new_content.rfind('} from "@/modules/concrete/RCDesignConstants";\n')
if last_import_end > 0:
    insert_pos = new_content.index('\n', last_import_end) + 1
    new_content = new_content[:insert_pos] + '\n' + import_insert + '\n' + new_content[insert_pos:]

# Remove the local BeamFormData interface since it's now imported
# Find "// Types\ninterface BeamFormData {" and remove until the closing }
types_start = new_content.find("// Types\ninterface BeamFormData {")
if types_start > 0:
    # Find the closing of the interface
    brace_count = 0
    i = new_content.index('{', types_start)
    while i < len(new_content):
        if new_content[i] == '{':
            brace_count += 1
        elif new_content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                # Remove from types_start to i+1 (including the closing brace and newline)
                end_pos = i + 1
                if end_pos < len(new_content) and new_content[end_pos] == '\n':
                    end_pos += 1
                new_content = new_content[:types_start] + new_content[end_pos:]
                break
        i += 1

# Remove unused imports that were only used in extracted components
# Remove AlertTriangle, CheckCircle (only used in ResultsPanel)
# Remove FileText, Download (only used in ResultsPanel) 
# Keep all other icons since they're used in the main component

with open(filepath, 'w') as f:
    f.write(new_content)

print(f"Done! New file has {new_content.count(chr(10))} lines")
