#!/usr/bin/env python3
"""Remove duplicate standard_normal_cdf functions from Rust files."""

import re
import sys

files = [
    "apps/backend-rust/src/advanced_sampling.rs",
    "apps/backend-rust/src/component_fragility_database.rs",
    "apps/backend-rust/src/fragility_analysis.rs",
    "apps/backend-rust/src/incremental_dynamic_analysis.rs",
    "apps/backend-rust/src/nongaussian_transforms.rs",
    "apps/backend-rust/src/partial_factor_calibration.rs",
    "apps/backend-rust/src/probabilistic_analysis.rs",
    "apps/backend-rust/src/six_sigma_quality.rs",
    "apps/backend-rust/src/sls_reliability.rs",
    "apps/backend-rust/src/system_reliability.rs",
]

pattern = re.compile(
    r'^fn standard_normal_cdf\(x: f64\) -> f64 \{\n'
    r'    0\.5 \* \(1\.0 \+ erf\(x / 2\.0_f64\.sqrt\(\)\)\)\n'
    r'\}\n',
    re.MULTILINE
)

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = pattern.sub('', content)
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"✓ Removed duplicate from {filepath}")
        else:
            print(f"✗ No match found in {filepath}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}", file=sys.stderr)

print("\nDone!")
