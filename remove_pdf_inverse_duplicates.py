#!/usr/bin/env python3
"""Remove duplicate standard_normal_pdf and standard_normal_inverse functions."""

import re
import sys

files = [
    "apps/backend-rust/src/advanced_reliability.rs",
    "apps/backend-rust/src/advanced_sampling.rs",
    "apps/backend-rust/src/component_fragility_database.rs",
    "apps/backend-rust/src/fragility_analysis.rs",
    "apps/backend-rust/src/incremental_dynamic_analysis.rs",
    "apps/backend-rust/src/model_uncertainty.rs",
    "apps/backend-rust/src/nongaussian_transforms.rs",
    "apps/backend-rust/src/partial_factor_calibration.rs",
    "apps/backend-rust/src/probabilistic_analysis.rs",
    "apps/backend-rust/src/reliability_analysis.rs",
    "apps/backend-rust/src/six_sigma_quality.rs",
    "apps/backend-rust/src/sls_reliability.rs",
    "apps/backend-rust/src/system_reliability.rs",
]

# Pattern for standard_normal_pdf
pdf_pattern = re.compile(
    r'fn standard_normal_pdf\(x: f64\) -> f64 \{\n'
    r'    \(-0\.5 \* x \* x\)\.exp\(\) / \(2\.0 \* PI\)\.sqrt\(\)\n'
    r'\}\n\n',
    re.MULTILINE
)

# Pattern for standard_normal_inverse with various names
inverse_patterns = [
    # standard_normal_inverse_cdf (long form)
    re.compile(
        r'fn standard_normal_inverse_cdf\(p: f64\) -> f64 \{.*?\n^}\n\n',
        re.MULTILINE | re.DOTALL
    ),
    # standard_normal_inverse (short form)
    re.compile(
        r'fn standard_normal_inverse\(p: f64\) -> f64 \{.*?\n^}\n\n',
        re.MULTILINE | re.DOTALL
    ),
]

total_removed = 0

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Remove PDF duplicates
        content = pdf_pattern.sub('', content)
        
        # Remove inverse duplicates (try both patterns)
        for pattern in inverse_patterns:
            content = pattern.sub('', content)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            removed = len(original_content) - len(content)
            total_removed += removed
            print(f"✓ Removed {removed} bytes from {filepath}")
        else:
            print(f"○ No changes needed in {filepath}")
    except Exception as e:
        print(f"✗ Error processing {filepath}: {e}", file=sys.stderr)

print(f"\nTotal: {total_removed} bytes removed")
