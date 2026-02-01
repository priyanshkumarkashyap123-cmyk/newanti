#!/usr/bin/env python3
"""Restore standard_normal_inverse functions that were incorrectly removed."""

import re

# The working standard_normal_inverse implementation
inverse_impl = '''fn standard_normal_inverse(p: f64) -> f64 {
    // Rational approximation
    if p <= 0.0 {
        return f64::NEG_INFINITY;
    }
    if p >= 1.0 {
        return f64::INFINITY;
    }
    
    let a = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.383577518672690e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00,
    ];
    let b = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01,
    ];
    let c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00,
    ];
    let d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e+00,
        3.754408661907416e+00,
    ];
    
    if p < 0.02425 {
        let q = (-2.0 * p.ln()).sqrt();
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
    } else if p <= 0.97575 {
        let q = p - 0.5;
        let r = q * q;
        (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
            / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
    } else {
        let q = (-2.0 * (1.0 - p).ln()).sqrt();
        -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
    }
}

'''

inverse_cdf_impl = inverse_impl.replace('fn standard_normal_inverse(', 'fn standard_normal_inverse_cdf(')

files_need_inverse = [
    ("apps/backend-rust/src/reliability_analysis.rs", "standard_normal_inverse", "/// Standard normal inverse CDF\n"),
    ("apps/backend-rust/src/component_fragility_database.rs", "standard_normal_inverse", "\nfn standard_normal_inverse"),
    ("apps/backend-rust/src/fragility_analysis.rs", "standard_normal_inverse", "\nfn standard_normal_inverse"),
    ("apps/backend-rust/src/incremental_dynamic_analysis.rs", "standard_normal_inverse", "\nfn standard_normal_inverse"),
    ("apps/backend-rust/src/model_uncertainty.rs", "standard_normal_inverse", "\nfn standard_normal_inverse"),
    ("apps/backend-rust/src/partial_factor_calibration.rs", "standard_normal_inverse", "\nfn standard_normal_inverse"),
    ("apps/backend-rust/src/sls_reliability.rs", "standard_normal_inverse", "\nfn standard_normal_inverse"),
]

files_need_inverse_cdf = [
    ("apps/backend-rust/src/advanced_reliability.rs", "standard_normal_inverse_cdf", "\nfn standard_normal_inverse_cdf"),
    ("apps/backend-rust/src/advanced_sampling.rs", "standard_normal_inverse_cdf", "\nfn standard_normal_inverse_cdf"),
    ("apps/backend-rust/src/nongaussian_transforms.rs", "standard_normal_inverse_cdf", "\nfn standard_normal_inverse_cdf"),
    ("apps/backend-rust/src/probabilistic_analysis.rs", "standard_normal_inverse_cdf", "\nfn standard_normal_inverse_cdf"),
    ("apps/backend-rust/src/six_sigma_quality.rs", "standard_normal_inverse_cdf", "\nfn standard_normal_inverse_cdf"),
    ("apps/backend-rust/src/system_reliability.rs", "standard_normal_inverse_cdf", "\nfn standard_normal_inverse_cdf"),
]

print("Restoring standard_normal_inverse functions...")

for filepath, func_name, marker in files_need_inverse:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if function already exists
        if f'fn {func_name}(' in content:
            print(f"○ {filepath} already has {func_name}")
            continue
        
        # Remove the broken import alias
        content = content.replace(
            f', standard_normal_inverse_cdf as {func_name}',
            ''
        )
        content = content.replace(
            f'standard_normal_inverse_cdf as {func_name}',
            ''
        )
        
        # Find a good place to insert - typically before the first function that uses it or before tests
        if '#[cfg(test)]' in content:
            insert_pos = content.find('#[cfg(test)]')
            content = content[:insert_pos] + inverse_impl + '\n' + content[insert_pos:]
        else:
            # Insert at the end
            content = content + '\n' + inverse_impl
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Restored {func_name} in {filepath}")
    except Exception as e:
        print(f"✗ Error: {filepath}: {e}")

for filepath, func_name, marker in files_need_inverse_cdf:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if function already exists
        if f'fn {func_name}(' in content:
            print(f"○ {filepath} already has {func_name}")
            continue
        
        # Remove the broken import
        content = content.replace(
            f', {func_name}',
            ''
        )
        
        # Find a good place to insert
        if '#[cfg(test)]' in content:
            insert_pos = content.find('#[cfg(test)]')
            content = content[:insert_pos] + inverse_cdf_impl + '\n' + content[insert_pos:]
        else:
            content = content + '\n' + inverse_cdf_impl
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Restored {func_name} in {filepath}")
    except Exception as e:
        print(f"✗ Error: {filepath}: {e}")

print("\nDone!")
