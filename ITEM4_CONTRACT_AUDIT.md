# Item 4: Contract/Parity Audit — Node vs Python APIs

**Date**: April 2, 2026  
**Status**: Audit Phase — Identifying Mismatches  
**Goal**: Ensure request/response shapes match across Node.js and Python services to prevent runtime errors and data corruption.

---

## Executive Summary

The Node.js API (Express) and Python API (FastAPI) handle structural analysis, design checks, and various engineering operations. They exchange requests/responses through HTTP proxying, but their schemas diverge in subtle ways:

- **Request schemas**: Node uses Zod (TypeScript), Python uses Pydantic (Python)
- **Response envelopes**: Node wraps responses with `success`, `error` fields; Python often returns raw Pydantic models
- **Error formats**: Node uses `{ success: false, error: string, code?: string }`, Python uses FastAPI's `HTTPException` (converts to `{ detail: string }`)
- **Field naming**: Node uses camelCase (`memberIds`), Python uses snake_case (`member_ids`)
- **Validation limits**: Different max sizes for node counts, member counts, payload sizes
- **Optional field behavior**: Node uses `.optional().default(value)`, Python uses `Optional[Type] = None`

---

## Critical Contract Mismatches

### 1. Analysis Request Schema

**Node.js** (`apps/api/src/validation/analysis.ts`):
```typescript
nodeSchema = z.object({
  id: idString,
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber.optional().default(0),
  restraints: restraintsSchema,  // optional
});

memberSchema = z.object({
  id: idString,
  startNodeId: idString,          // CamelCase
  endNodeId: idString,            // CamelCase
  E: positiveNumber.optional().default(200e6),
  A: positiveNumber.optional().default(0.01),
  I: positiveNumber.optional().default(1e-4),
});

analyzeRequestSchema = z.object({
  schema_version: z.number().int().optional().default(2),
  nodes: z.array(nodeSchema).max(50_000),
  members: z.array(memberSchema).max(100_000),
  loads: z.array(loadSchema).max(100_000).optional().default([]),
  memberLoads: z.array(memberLoadSchema).max(100_000).optional().default([]),
  // ... more fields
});
```

**Python** (`apps/backend-python/routers/analysis_schemas.py`):
```python
class FrameNodeInput(BaseModel):
    id: str
    x: float
    y: float
    z: Optional[float] = None     # Different: None vs default(0)
    restraints: Optional[Dict] = None

class FrameMemberInput(BaseModel):
    id: str
    start_node_id: str            # snake_case, not camelCase
    end_node_id: str              # snake_case, not camelCase
    E: Optional[float] = 200e6
    A: Optional[float] = 0.01
    I: Optional[float] = 1e-4

class FrameAnalysisRequest(BaseModel):
    nodes: List[FrameNodeInput]
    members: List[FrameMemberInput]
    node_loads: Optional[List[NodeLoadInput]] = []  # snake_case
    # Note: NO schema_version field
```

**Issues**:
- ❌ Field naming: Node uses `startNodeId` (camelCase), Python uses `start_node_id` (snake_case)
- ❌ Default for z: Node defaults z=0, Python defaults z=None (will cause "required field missing" on Python side if Node omits z)
- ❌ Schema versioning: Node includes `schema_version`, Python ignores it
- ❌ Max limits: Node allows 100k members, Python may have different limits in validation

---

### 2. Design Check Request Schema

**Node.js**:
```typescript
steelDesignSchema = z.object({
  code: z.enum(['IS800', 'AISC360', 'EC3']),
  method: z.enum(['LSM', 'LRFD', 'ASD']),
  members: z.array(z.object({
    id: idString,
    section: sectionMechanicsSchema,  // CamelCase
    forces: z.object({
      N: finiteNumber,
      Vy: finiteNumber,
      Vz: finiteNumber,
      My: finiteNumber,
      Mz: finiteNumber,
    }),
    // ...
  })),
});
```

**Python** (`apps/backend-python/routers/design_schemas.py`):
```python
class DesignCheckMemberInput(BaseModel):
    member_id: str                    # snake_case
    section_name: str = "Unknown"
    section_properties: Dict = Field(default_factory=dict)
    forces: Dict = Field(default_factory=dict)
    # Note: Different structure than Node expects
    Kx: float = Field(default=1.0, ge=0, le=10)
    Ky: float = Field(default=1.0, ge=0, le=10)
    Cb: float = Field(default=1.0, ge=0, le=10)

class DesignCheckRequest(BaseModel):
    code: str = Field(default="AISC360-16", max_length=64)
    method: str = Field(default="LRFD", max_length=32)
    members: List[DesignCheckMemberInput] = Field(default_factory=list)
```

**Issues**:
- ❌ Field naming: Node uses `memberId`, Python uses `member_id`
- ❌ Section representation: Node has `section: { A, I, Iy, Iz, Zy, Zz }`, Python expects `section_properties: Dict`
- ❌ Forces structure: Node sends typed `{ N, Vy, Vz, My, Mz }`, Python expects generic `Dict`
- ❌ Default values: Node allows unspecified defaults, Python has explicit defaults for every field

---

### 3. Response Envelope Format

**Node.js wraps all responses**:
```typescript
POST /api/analysis
Response 200:
{
  "success": true,
  "engine": "rust",
  "result": {
    "displacements": [...],
    "reactions": [...],
    "memberForces": [...]
  }
}

POST /api/design/steel/beam
Response 200:
{
  "success": true,
  "result": {
    "passed": true,
    "utilization": 0.85,
    "message": "IS 800 Clause 8.2.1.2 — Satisfactory"
  }
}
```

**Python returns raw responses or FastAPI HTTPException**:
```python
@router.post("/design/check")
async def check_design(request: DesignCheckRequest):
    # If error:
    raise HTTPException(status_code=400, detail="Design code not supported")
    # Returns: { "detail": "Design code not supported" }
    
    # If success: returns the Python model directly
    return {
        "success": True,
        "code": "AISC360",
        "results": {
            "member_id_1": {
                "ratio": 0.75,
                "status": "PASS",
                "governing": "Check A",
                "capacity": 500,
                "log": "..."
            }
        }
    }
```

**Issues**:
- ❌ Error field names: Node uses `error`, Python uses `detail` (from FastAPI HTTPException)
- ❌ Success envelope: Python sometimes returns `{ success: true }` in the response body, Node always wraps with `{ success: true, result: {...} }`
- ❌ HTTP status codes: Node may return 200 with `success: false`, Python returns appropriate 4xx/5xx

---

### 4. Sections Endpoint

**Node.js/Rust** (`POST /api/sections/standard/create`):
```json
{
  "shapeType": "I-BEAM",
  "dimensions": { "d": 300, "bf": 150, "tf": 10, "tw": 6 },
  "material": { "fy": 250, "fu": 410 },
  "grade": "Fe400",
  "code": "IS800"
}
```

**Python** (`routers/sections/sections.py`):
```python
# Uses different field names and structure
@router.post("/sections/custom/calculate")
async def calculate_section(...):
    # Expects: {shape_type, dimensions, material, ...}
    # vs. Node's {shapeType, dimensions, material, ...}
```

---

### 5. HTTP Status Code Inconsistencies

**Node.js**:
- 200 OK + error flag: `{ success: false, error: "...", code: "VALIDATION_ERROR" }` with HTTP 200
- 400 Bad Request: For invalid input
- 401 Unauthorized: For auth failures
- 429 Too Many Requests: For rate limiting

**Python/FastAPI**:
- 200 OK: Only for genuine success
- 400 Bad Request: FastAPI auto-converts validation errors to 400 with `{ "detail": "..." }`
- 401 Unauthorized: For auth failures
- 403 Forbidden: For CORS origin validation (new from Item 3)
- 422 Unprocessable Entity: For Pydantic validation errors (not always consistent)
- 500 Internal Server Error: Uncaught exceptions

**Issue**: Clients expecting HTTP 200 with error flags may not handle 4xx/5xx responses correctly.

---

## Audit Result: Critical Mismatches Found

| Category | Issue | Severity | Impact |
|----------|-------|----------|--------|
| Field Naming | camelCase vs snake_case | HIGH | Node sends `startNodeId`, Python expects `start_node_id` → 422 error |
| Response Envelope | Node wraps, Python raw | HIGH | Proxy unwraps, may miss response details |
| Error Format | Node: `error`, Python: `detail` | MEDIUM | Error handling code may fail to extract error messages |
| Defaults | Node: `default(0)`, Python: None | MEDIUM | Missing z field causes validation error in Python |
| Status Codes | 200+flag vs 4xx | MEDIUM | Clients may not handle error status codes |
| Limits | Different max array sizes | LOW | Will fail with >50k nodes on Node, >??? on Python |

---

## Solution: Three-Tier Approach

### Tier 1: Immediate Fix (Today)
Add a **normalization/adapter layer** in Node API to convert outgoing requests to Python-compatible format:

```typescript
// apps/api/src/services/requestNormalizer.ts
export function normalizeAnalysisForPython(nodeRequest: z.infer<typeof analyzeRequestSchema>) {
  return {
    nodes: nodeRequest.nodes.map(n => ({
      ...n,
      z: n.z ?? 0,  // Ensure z is always present
    })),
    members: nodeRequest.members.map(m => ({
      ...m,
      start_node_id: m.startNodeId,     // Convert to snake_case
      end_node_id: m.endNodeId,
      E: m.E ?? 200e6,
      A: m.A ?? 0.01,
      I: m.I ?? 1e-4,
    })),
    node_loads: nodeRequest.loads,      // snake_case
    backend: nodeRequest.backend ?? 'python',
  };
}
```

In the proxy request:
```typescript
// apps/api/src/services/serviceProxy.ts - in proxyRequest()
if (service === 'python' && path.includes('/analysis')) {
  const normalizedPayload = normalizeAnalysisForPython(body);
  // Send normalizedPayload instead of body
}
```

### Tier 2: Formal Contract Definition (This week)
Create a **shared contract specification** file:

```
docs/specs/04-node-python-contract-spec.md
```

This document will:
- Define request/response shapes for all critical endpoints
- Specify field naming conventions (snake_case for Python, camelCase for Node)
- Define validation limits and constraints
- Document error response formats for each service

### Tier 3: Automated Validation (Next week)
Add integration tests that:
- Generate test payloads for each endpoint
- Send the same payload to both Node and Python
- Compare responses for structural compatibility
- Fail CI if contract divergs

```typescript
// apps/api/src/routes/__tests__/contract.parity.test.ts
describe('Node-Python Contract Parity', () => {
  it('POST /analysis should accept same payload structure', async () => {
    const payload = { nodes: [...], members: [...] };
    const nodeRes = await app.post('/api/v1/analysis').send(payload);
    // Simulate Python response and validate envelope compatibility
  });
});
```

---

## Implementation Steps

### Step 1: Add Request Normalizer (Node API)
- Location: `apps/api/src/services/requestNormalizer.ts`
- Converts Node requests → Python-compatible format
- Handles field naming (camelCase → snake_case)
- Ensures all required fields have defaults

### Step 2: Add Response Denormalizer (Node API)
- Location: `apps/api/src/services/responseDenormalizer.ts`
- Converts Python responses → Node response envelope format
- Handles `detail` → `error` field mapping
- Normalizes HTTP status codes

### Step 3: Wire into Proxy
- Update `apps/api/src/services/serviceProxy.ts`
- Apply normalizer before sending request to Python
- Apply denormalizer after receiving response from Python

### Step 4: Add Contract Tests
- Location: `apps/api/src/routes/__tests__/contract-parity.test.ts`
- Test analysis, design, sections endpoints
- Validate request/response round-trip
- Ensure field naming consistency

### Step 5: Document in Spec
- Update `docs/specs/03-backend-api-contract-spec.md`
- Add Node vs Python compatibility section
- Document field mapping conventions
- Publish as internal API design guide

---

## Expected Outcomes

After implementing this solution:

✅ **Node → Python requests** will always be correctly formatted (snake_case fields, all required defaults present)
✅ **Python → Node responses** will match the expected envelope format (`{ success, result/error }`)
✅ **Error handling** will work consistently across both services
✅ **Field mapping** will be clearly documented and enforced
✅ **CI/CD** will catch contract divergence before deployment

---

## Risk Assessment

**If we do NOT fix this**:
- Design check requests with camelCase fields will 422 error on Python
- Error messages sent from Python won't be displayed to users (using wrong field name)
- Clients may receive 4xx status codes and fail to handle them gracefully
- Future changes to Python schema won't be caught until production

**Risk Level**: MEDIUM (impacts design workflows, error handling)

---

## Dependencies

✅ **Item 2** (Node API versioning) — Complete
✅ **Item 3** (Python origin validation) — Complete
🔄 **Item 4** (This contract parity work) — IN PROGRESS
⏭️ **Item 5** (Remaining hardening)

---

## Next Actions

1. **Today**: Review this audit with user, confirm approach
2. **Tomorrow**: Implement request/response normalizers
3. **Thursday**: Add contract parity tests
4. **Friday**: Document contracts in spec

---

## Appendix: Field Mapping Reference

| Concept | Node.js | Python | Mapping |
|---------|---------|--------|---------|
| Member start node | `startNodeId` | `start_node_id` | camelCase ↔ snake_case |
| Member end node | `endNodeId` | `end_node_id` | camelCase ↔ snake_case |
| Member loads | `memberLoads` | `distributed_loads` | Different names! |
| Node loads | `loads` | `node_loads` | Both exist, different naming |
| Z coordinate | `z` (default 0) | `z` (default None) | Different defaults |
| Design method | `designMethod` | `method` | Field name differs |
| Section props | `section: { A, I, ... }` | `section_properties: Dict` | Structure differs |
| Error message | `error` field | `detail` field (HTTPException) | Field name differs |

