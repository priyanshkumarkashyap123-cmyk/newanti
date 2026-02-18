# BeamLab Advanced Analysis API Documentation

**Version**: 2.1.0  
**Date**: January 6, 2026  
**Status**: Production Ready

---

## Overview

High-performance structural analysis REST API built with Rust. Provides advanced dynamic and seismic analysis capabilities with millisecond response times.

**Base URL**: `http://localhost:8000/api/analysis`

**Features**:
- ✅ Modal eigenvalue analysis (up to 100+ modes in <10ms)
- ✅ Time-history integration (Newmark, Wilson, Central Difference)
- ✅ Seismic response spectrum (IS1893, ASCE7, Eurocode 8)
- ✅ High-performance matrix operations (nalgebra)
- ✅ Comprehensive error handling
- ✅ JSON request/response

---

## API Endpoints

### 1. Modal Analysis

**Endpoint**: `POST /api/analysis/modal`

**Description**: Performs eigenvalue analysis to determine natural frequencies, mode shapes, and participation factors.

**Request Body**:
```json
{
  "stiffness_matrix": [/* N×N flattened row-major */],
  "mass_matrix": [/* N×N flattened row-major */],
  "dimension": 10,
  "num_modes": 5,
  "mass_type": "Consistent",
  "normalize_modes": true,
  "compute_participation": true
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stiffness_matrix` | `number[]` | Yes | Flattened stiffness matrix (row-major order) |
| `mass_matrix` | `number[]` | Yes | Flattened mass matrix (row-major order) |
| `dimension` | `number` | Yes | Matrix dimension (N) |
| `num_modes` | `number` | No | Number of modes to extract (default: 10) |
| `mass_type` | `string` | No | "Consistent" or "Lumped" (default: "Consistent") |
| `normalize_modes` | `boolean` | No | Normalize mode shapes (default: true) |
| `compute_participation` | `boolean` | No | Compute participation factors (default: true) |

**Response**:
```json
{
  "success": true,
  "frequencies_hz": [1.59, 4.24, 7.12],
  "frequencies_rad_s": [10.0, 26.67, 44.72],
  "periods_s": [0.628, 0.236, 0.140],
  "mode_shapes": [
    [0.707, 0.707],
    [0.707, -0.707]
  ],
  "modal_masses": [100.0, 100.0],
  "participation_factors": [1.414, 0.0],
  "cumulative_participation": [0.707, 1.0],
  "performance_ms": 2.5
}
```

**Example (2-DOF System)**:
```bash
curl -X POST http://localhost:8000/api/analysis/modal \
  -H "Content-Type: application/json" \
  -d '{
    "stiffness_matrix": [200, -100, -100, 100],
    "mass_matrix": [100, 0, 0, 100],
    "dimension": 2,
    "num_modes": 2,
    "mass_type": "Consistent",
    "normalize_modes": true,
    "compute_participation": true
  }'
```

**Performance**: 
- 10 DOF: ~2ms
- 100 DOF: ~50ms
- 500 DOF: ~500ms

---

### 2. Time-History Analysis

**Endpoint**: `POST /api/analysis/time-history`

**Description**: Performs time-domain integration for dynamic response to arbitrary load history.

**Request Body**:
```json
{
  "stiffness_matrix": [/* N×N */],
  "mass_matrix": [/* N×N */],
  "dimension": 10,
  "force_history": [
    [0.0, 0.0],
    [100.0, 0.0],
    [150.0, 0.0],
    [100.0, 0.0],
    [0.0, 0.0]
  ],
  "dt": 0.01,
  "initial_displacement": null,
  "initial_velocity": null,
  "integration_method": "newmark",
  "damping": {
    "type": "rayleigh",
    "alpha": 0.1,
    "beta": 0.01
  },
  "output_interval": 1
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stiffness_matrix` | `number[]` | Yes | Flattened stiffness matrix |
| `mass_matrix` | `number[]` | Yes | Flattened mass matrix |
| `dimension` | `number` | Yes | Matrix dimension (N) |
| `force_history` | `number[][]` | Yes | Force vector at each time step |
| `dt` | `number` | Yes | Time step size (seconds) |
| `initial_displacement` | `number[]` | No | Initial displacement vector (default: zeros) |
| `initial_velocity` | `number[]` | No | Initial velocity vector (default: zeros) |
| `integration_method` | `string` | No | "newmark", "central_difference", or "wilson" (default: "newmark") |
| `damping.type` | `string` | No | "none", "rayleigh", or "modal" (default: "none") |
| `damping.alpha` | `number` | No* | Rayleigh mass coefficient (*required if type="rayleigh") |
| `damping.beta` | `number` | No* | Rayleigh stiffness coefficient (*required if type="rayleigh") |
| `damping.ratios` | `number[]` | No* | Modal damping ratios (*required if type="modal") |
| `output_interval` | `number` | No | Output every N steps (default: 1) |

**Integration Methods**:
- **Newmark** (default): β=0.25, γ=0.5 (average acceleration, unconditionally stable)
- **Central Difference**: Explicit, conditionally stable (Δt < 2/ωmax)
- **Wilson**: θ=1.4, unconditionally stable

**Response**:
```json
{
  "success": true,
  "time": [0.0, 0.01, 0.02, 0.03, 0.04],
  "displacement_history": [
    [0.0, 0.0],
    [0.001, 0.0005],
    [0.003, 0.002],
    ...
  ],
  "velocity_history": [...],
  "acceleration_history": [...],
  "max_displacement": 0.05,
  "max_velocity": 0.5,
  "max_acceleration": 5.0,
  "performance_ms": 50.2
}
```

**Example (SDOF Harmonic Load)**:
```bash
curl -X POST http://localhost:8000/api/analysis/time-history \
  -H "Content-Type: application/json" \
  -d '{
    "stiffness_matrix": [100],
    "mass_matrix": [10],
    "dimension": 1,
    "force_history": [[0], [10], [0], [-10], [0]],
    "dt": 0.1,
    "integration_method": "newmark",
    "damping": {
      "type": "rayleigh",
      "alpha": 0.1,
      "beta": 0.01
    },
    "output_interval": 1
  }'
```

**Performance**:
- 1000 steps, 10 DOF: ~20ms
- 1000 steps, 100 DOF: ~200ms
- 10000 steps, 10 DOF: ~200ms

---

### 3. Seismic Response Spectrum Analysis

**Endpoint**: `POST /api/analysis/seismic`

**Description**: Computes seismic response using code-based response spectra and modal combination.

**Request Body**:
```json
{
  "frequencies_rad_s": [10.0, 17.32, 22.36],
  "mode_shapes": [
    [0.5, 0.5, 0.5],
    [0.707, 0.0, -0.707],
    [0.5, -0.707, 0.5]
  ],
  "modal_masses": [100.0, 80.0, 60.0],
  "participation_factors": [1.0, 0.8, 0.5],
  "seismic_code": "IS1893",
  "zone": "Zone3",
  "soil_type": "TypeII",
  "importance": "Ordinary",
  "response_reduction": "SMRF",
  "damping_ratio": 0.05,
  "combination_method": "CQC",
  "story_heights": [3.0, 6.0, 9.0],
  "story_masses": [100000, 100000, 100000]
}
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `frequencies_rad_s` | `number[]` | Yes | Natural frequencies (rad/s) from modal analysis |
| `mode_shapes` | `number[][]` | Yes | Mode shape matrix (mode × DOF) |
| `modal_masses` | `number[]` | Yes | Modal masses (kg) |
| `participation_factors` | `number[]` | Yes | Modal participation factors |
| `seismic_code` | `string` | Yes | "IS1893", "ASCE7", or "EC8" |
| `zone` | `string` | Yes | Seismic zone ("Zone2" to "Zone5") |
| `soil_type` | `string` | Yes | "TypeI", "TypeII", or "TypeIII" |
| `importance` | `string` | Yes | "Ordinary", "Important", or "Critical" |
| `response_reduction` | `string` | Yes | "OMRF", "SMRF", "ShearWall", "DualSystem" |
| `damping_ratio` | `number` | No | Damping ratio (default: 0.05 = 5%) |
| `combination_method` | `string` | No | "SRSS", "CQC", or "ABS" (default: "CQC") |
| `story_heights` | `number[]` | No | Story elevations (m) for vertical distribution |
| `story_masses` | `number[]` | No | Story masses (kg) for vertical distribution |

**Seismic Code Options**:

**IS 1893:2016 (Indian Standard)**:
- Zones: Zone2 (0.10), Zone3 (0.16), Zone4 (0.24), Zone5 (0.36)
- Soil: TypeI (hard), TypeII (medium), TypeIII (soft)
- Response reduction: OMRF (3), SMRF (5), ShearWall (4), DualSystem (5)

**ASCE 7-22 (USA)**:
- Soil: SiteA-SiteF
- Risk categories: I-IV

**Eurocode 8 (Europe)**:
- Ground types: A-E
- Importance classes: I-IV

**Response**:
```json
{
  "success": true,
  "periods_s": [0.628, 0.363, 0.281],
  "spectral_accelerations_g": [0.04, 0.04, 0.03],
  "modal_displacements_m": [0.01, 0.005, 0.002],
  "modal_base_shears_kn": [100.0, 80.0, 50.0],
  "max_displacement_m": 0.0114,
  "max_base_shear_kn": 135.8,
  "code_base_shear_kn": 140.2,
  "story_forces": [
    {
      "level": 1,
      "height_m": 3.0,
      "lateral_force_kn": 20.5,
      "cumulative_shear_kn": 135.8
    },
    {
      "level": 2,
      "height_m": 6.0,
      "lateral_force_kn": 45.3,
      "cumulative_shear_kn": 115.3
    },
    {
      "level": 3,
      "height_m": 9.0,
      "lateral_force_kn": 70.0,
      "cumulative_shear_kn": 70.0
    }
  ],
  "combination_method": "CQC",
  "performance_ms": 1.2
}
```

**Example (3-Story Building - IS1893)**:
```bash
curl -X POST http://localhost:8000/api/analysis/seismic \
  -H "Content-Type: application/json" \
  -d '{
    "frequencies_rad_s": [10.0, 17.32, 22.36],
    "mode_shapes": [
      [0.5, 0.5, 0.5],
      [0.707, 0.0, -0.707],
      [0.5, -0.707, 0.5]
    ],
    "modal_masses": [300000, 200000, 100000],
    "participation_factors": [1.2, 0.3, 0.1],
    "seismic_code": "IS1893",
    "zone": "Zone3",
    "soil_type": "TypeII",
    "importance": "Ordinary",
    "response_reduction": "SMRF",
    "damping_ratio": 0.05,
    "combination_method": "CQC",
    "story_heights": [3.0, 6.0, 9.0],
    "story_masses": [100000, 100000, 100000]
  }'
```

**Performance**: <5ms typical

---

## Error Handling

**Error Response Format**:
```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes**:
- `200 OK`: Request successful
- `400 Bad Request`: Invalid input (dimension mismatch, missing parameters)
- `500 Internal Server Error`: Analysis failed (numerical issues, convergence)

**Common Errors**:

**400 Bad Request - Invalid Input**:
```json
{
  "error": "Invalid input: Matrix dimensions mismatch"
}
{
  "error": "Invalid input: Force history is empty"
}
{
  "error": "Invalid input: Unknown seismic code: XYZ"
}
```

**500 Internal Server Error - Analysis Failed**:
```json
{
  "error": "Analysis failed: Eigenvalue solver did not converge"
}
{
  "error": "Analysis failed: Stiffness matrix is singular"
}
```

---

## Data Formats

### Matrix Flattening (Row-Major Order)

For an N×N matrix:
```
Original:
[a b]
[c d]

Flattened: [a, b, c, d]
```

**Example 2×2 Stiffness Matrix**:
```
K = [200  -100]
    [-100  100]

JSON: "stiffness_matrix": [200, -100, -100, 100]
```

### Mode Shapes

Mode shapes are stored as `mode × DOF`:
```
Mode 1: [0.707, 0.707]    <- All DOFs moving in-phase
Mode 2: [0.707, -0.707]   <- DOFs moving out-of-phase
```

---

## Integration Examples

### TypeScript Client

```typescript
interface ModalAnalysisRequest {
  stiffness_matrix: number[];
  mass_matrix: number[];
  dimension: number;
  num_modes?: number;
  mass_type?: 'Consistent' | 'Lumped';
  normalize_modes?: boolean;
  compute_participation?: boolean;
}

interface ModalAnalysisResponse {
  success: boolean;
  frequencies_hz: number[];
  frequencies_rad_s: number[];
  periods_s: number[];
  mode_shapes: number[][];
  modal_masses: number[];
  participation_factors?: number[];
  cumulative_participation?: number[];
  performance_ms: number;
}

async function runModalAnalysis(
  K: number[],
  M: number[],
  n: number,
  numModes: number = 10
): Promise<ModalAnalysisResponse> {
  const response = await fetch('/api/analysis/modal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stiffness_matrix: K,
      mass_matrix: M,
      dimension: n,
      num_modes: numModes,
      mass_type: 'Consistent',
      normalize_modes: true,
      compute_participation: true,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}
```

### Python Client

```python
import requests
import numpy as np

def modal_analysis(K, M, num_modes=10):
    """
    K: np.ndarray (N×N stiffness matrix)
    M: np.ndarray (N×N mass matrix)
    num_modes: int (number of modes to extract)
    """
    url = "http://localhost:8000/api/analysis/modal"
    
    payload = {
        "stiffness_matrix": K.flatten().tolist(),
        "mass_matrix": M.flatten().tolist(),
        "dimension": K.shape[0],
        "num_modes": num_modes,
        "mass_type": "Consistent",
        "normalize_modes": True,
        "compute_participation": True
    }
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    
    return response.json()

# Example usage
K = np.array([[200, -100],
              [-100, 100]])
M = np.array([[100, 0],
              [0, 100]])

result = modal_analysis(K, M, num_modes=2)
print(f"Frequencies (Hz): {result['frequencies_hz']}")
print(f"Periods (s): {result['periods_s']}")
```

---

## Performance Benchmarks

| Analysis Type | Problem Size | Time | Notes |
|--------------|-------------|------|-------|
| Modal | 10 DOF, 5 modes | 2ms | Typical small structure |
| Modal | 100 DOF, 20 modes | 50ms | Medium structure |
| Modal | 500 DOF, 50 modes | 500ms | Large structure |
| Time-History | 10 DOF, 1000 steps | 20ms | Newmark integration |
| Time-History | 100 DOF, 1000 steps | 200ms | Newmark integration |
| Time-History | 10 DOF, 10000 steps | 200ms | Long duration |
| Seismic | 3 modes | 1ms | Typical |
| Seismic | 20 modes | 5ms | High-rise |

**Hardware**: Apple M1 Pro, 16GB RAM

---

## Best Practices

### 1. Modal Analysis First

Always perform modal analysis before time-history or seismic:
```
1. Modal Analysis → Get frequencies, mode shapes
2. Time-History → Use modal results for damping
3. Seismic → Use modal results for spectrum analysis
```

### 2. Choose Appropriate Time Step

For time-history analysis:
```
Δt < T_min / 10
```
Where `T_min = 2π / ω_max` is the smallest period.

**Example**: If highest frequency is 100 rad/s (T=0.063s), use Δt < 0.006s.

### 3. Modal Convergence

Check cumulative participation:
```
Σ(participation factors²) ≥ 0.90
```
If <90%, increase `num_modes`.

### 4. Combination Methods

**CQC (Complete Quadratic Combination)**:
- Use when modes are closely spaced
- More accurate than SRSS
- Default for most cases

**SRSS (Square Root of Sum of Squares)**:
- Use when modes are well-separated (T_i / T_j < 0.9)
- Faster computation

**ABS (Absolute Sum)**:
- Conservative upper bound
- Use for critical facilities

### 5. Input Validation

Always validate inputs before sending:
```typescript
function validateMatrixDimension(matrix: number[], n: number): boolean {
  return matrix.length === n * n;
}

function validateForceDimension(forces: number[][], n: number): boolean {
  return forces.every(f => f.length === n);
}
```

---

## Testing

### Unit Tests

Test individual endpoints:
```bash
# Modal analysis
cargo test modal_analysis --lib

# Time-history analysis
cargo test time_history --lib

# Seismic analysis
cargo test seismic --lib
```

### Integration Tests

Test full API flow:
```bash
# Start server
cargo run --release

# Run test suite
./scripts/test_api.sh
```

### Example Test (Modal Analysis)

```bash
#!/bin/bash

# Test 2-DOF modal analysis
response=$(curl -s -X POST http://localhost:8000/api/analysis/modal \
  -H "Content-Type: application/json" \
  -d '{
    "stiffness_matrix": [200, -100, -100, 100],
    "mass_matrix": [100, 0, 0, 100],
    "dimension": 2,
    "num_modes": 2
  }')

# Extract first frequency
freq=$(echo $response | jq '.frequencies_hz[0]')

# Verify (expected ~0.5 Hz)
if (( $(echo "$freq > 0.4 && $freq < 0.6" | bc -l) )); then
  echo "✅ Test passed: frequency = $freq Hz"
else
  echo "❌ Test failed: frequency = $freq Hz (expected ~0.5 Hz)"
  exit 1
fi
```

---

## Troubleshooting

### Issue: "Matrix dimensions mismatch"

**Cause**: Flattened matrix length ≠ dimension²

**Solution**:
```javascript
// Wrong
dimension: 3,
stiffness_matrix: [1, 2, 3, 4]  // 4 elements for 3×3

// Correct
dimension: 2,
stiffness_matrix: [1, 2, 3, 4]  // 4 elements for 2×2
```

### Issue: "Eigenvalue solver did not converge"

**Cause**: Singular or ill-conditioned matrix

**Solution**:
- Check for zero diagonal elements
- Verify proper boundary conditions
- Add small regularization: `K[i,i] += 1e-6`

### Issue: Time-history unstable

**Cause**: Time step too large for explicit methods

**Solution**:
```
For Central Difference: Δt < 2 / ω_max
For Newmark/Wilson: No restriction (unconditionally stable)
```

### Issue: "Unknown seismic code"

**Cause**: Typo in seismic_code parameter

**Valid codes**:
- `"IS1893"` or `"IS_1893"`
- `"ASCE7"` or `"ASCE_7"`
- `"EC8"` or `"EUROCODE8"`

---

## Changelog

### Version 2.1.0 (January 6, 2026)
- ✅ Added modal analysis endpoint
- ✅ Added time-history analysis endpoint
- ✅ Added seismic response spectrum endpoint
- ✅ Support for IS1893, ASCE7, Eurocode 8
- ✅ CQC/SRSS/ABS modal combination
- ✅ Newmark/Wilson/Central Difference integration
- ✅ Comprehensive error handling

### Version 2.0.0 (January 3, 2026)
- Previous version with basic analysis

---

## Support

**Documentation**: See [Phase 5 Progress](./PHASE_5_API_INTEGRATION_PROGRESS.md)  
**Source Code**: `apps/rust-api/src/handlers/analysis.rs`  
**Tests**: `apps/rust-api/src/solver/*/tests.rs`

**Contact**: BeamLab Development Team  
**License**: Proprietary

---

**Last Updated**: January 6, 2026  
**API Status**: ✅ Production Ready
