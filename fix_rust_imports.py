#!/usr/bin/env python3
"""Fix all broken Rust imports by adding missing local functions."""

import re

# Files that need standard_normal_inverse added
files_need_inverse = [
    "apps/backend-rust/src/reliability_analysis.rs",
    "apps/backend-rust/src/component_fragility_database.rs",
    "apps/backend-rust/src/fragility_analysis.rs",
    "apps/backend-rust/src/incremental_dynamic_analysis.rs",
    "apps/backend-rust/src/model_uncertainty.rs",
    "apps/backend-rust/src/partial_factor_calibration.rs",
    "apps/backend-rust/src/sls_reliability.rs",
]

files_need_inverse_cdf = [
    "apps/backend-rust/src/advanced_reliability.rs",
    "apps/backend-rust/src/advanced_sampling.rs",
    "apps/backend-rust/src/nongaussian_transforms.rs",
    "apps/backend-rust/src/probabilistic_analysis.rs",
    "apps/backend-rust/src/six_sigma_quality.rs",
    "apps/backend-rust/src/system_reliability.rs",
]

# Standard normal inverse implementation (uses erfinv from special_functions)
inverse_impl = """
fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}
"""

inverse_cdf_impl = """
fn standard_normal_inverse_cdf(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}
"""

pdf_impl = """
fn standard_normal_pdf(x: f64) -> f64 {
    (-0.5 * x * x).exp() / (2.0 * std::f64::consts::PI).sqrt()
}
"""

print("Fixing Rust files...")

for filepath in files_need_inverse:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if already has the function
        if 'fn standard_normal_inverse(' in content:
            print(f"○ {filepath} already has standard_normal_inverse")
            continue
        
        # Find the imports section and add after it
        # Look for the line after "use" statements
        lines = content.split('\n')
        insert_pos = 0
        for i, line in enumerate(lines):
            if line.startswith('use ') or line.startswith('use crate::'):
                insert_pos = i + 1
        
        # Find end of use statements
        while insert_pos < len(lines) and (lines[insert_pos].strip() == '' or lines[insert_pos].startswith('use ')):
            insert_pos += 1
        
        # Insert the function
        lines.insert(insert_pos, inverse_impl)
        content = '\n'.join(lines)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Added standard_normal_inverse to {filepath}")
    except Exception as e:
        print(f"✗ Error: {filepath}: {e}")

for filepath in files_need_inverse_cdf:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if already has the function
        if 'fn standard_normal_inverse_cdf(' in content:
            print(f"○ {filepath} already has standard_normal_inverse_cdf")
            continue
        
        # Also check if needs PDF
        needs_pdf = 'standard_normal_pdf(' in content and 'fn standard_normal_pdf(' not in content
        
        lines = content.split('\n')
        insert_pos = 0
        for i, line in enumerate(lines):
            if line.startswith('use ') or line.startswith('use crate::'):
                insert_pos = i + 1
        
        while insert_pos < len(lines) and (lines[insert_pos].strip() == '' or lines[insert_pos].startswith('use ')):
            insert_pos += 1
        
        # Insert functions
        funcs_to_add = inverse_cdf_impl
        if needs_pdf:
            funcs_to_add = pdf_impl + "\n" + inverse_cdf_impl
        
        lines.insert(insert_pos, funcs_to_add)
        content = '\n'.join(lines)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        msg = f"✓ Added standard_normal_inverse_cdf"
        if needs_pdf:
            msg += " and standard_normal_pdf"
        print(f"{msg} to {filepath}")
    except Exception as e:
        print(f"✗ Error: {filepath}: {e}")

print("\nDone!")
