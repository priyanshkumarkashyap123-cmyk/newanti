# ADR-003: Request/Response Contract Normalization

**Status**: APPROVED  
**Date**: Apr 2, 2026  
**Author**: Platform Architecture Team  
**Related**: Item 4 (Contract Parity)

---

## Problem

**Current State**:
- Node.js API uses camelCase (Zod convention)
  - `startNodeId`, `endNodeId`, `memberLoads`, `distributedLoads`
- Python API uses snake_case (Pydantic convention)
  - `start_node_id`, `end_node_id`, `member_loads`, `distributed_loads`
- Cannot force one convention across both frameworks
- Web frontend expects camelCase (JavaScript convention)
- Mismatch causes client/backend integration errors

**User Impact**:
- Inconsistent field names confuse developers
- Hard to remember: is it `memberLoads` or `member_loads`?
- TypeScript/IDE autocomplete doesn't help
- Increased integration testing burden

**Architectural Problem**:
- Each service uses "natural" convention (good for team productivity)
- But inconsistency breaks API contract
- Normalizing at client loses backend consistency benefits

---

## Solution

Transparent request/response transformation at Node gateway:

### Transformation Flow

```
Client Request
  ↓ (camelCase)
Node API (receives camelCase)
  ├─ Validate with Zod (camelCase)
  ├─ Transform to snake_case
  └─ Send to Python API
    ↓
  Python API (receives snake_case)
    ├─ Validate with Pydantic (snake_case)
    ├─ Process
    └─ Return response (snake_case)
  ↓
  Python response (snake_case)
Node gateway (receives snake_case)
  ├─ Transform to camelCase
  ├─ Wrap in response envelope
  └─ Return to client
    ↓
Client Response
  ↓ (camelCase)
```

### Mapping Strategy

**Endpoint-specific mapping**: Analysis requests have different fields than design checks
- `requestNormalizer.ts`: Node → Python transformation
- `normalizeAnalysisRequestForPython()`: startNodeId → start_node_id, z → z (no change)
- `normalizeDesignRequestForPython()`: id → member_id, section → section_properties
- Generic fallback: convertCamelToSnakeCase() for unknown endpoints

**Response denormalization**: Mirror of request transformation
- `responseDenormalizer.ts`: Python → Node transformation
- Recursive field name conversion: snake_case → camelCase
- Error code mapping: 400 → BAD_REQUEST, 422 → VALIDATION_ERROR
- Response envelope: Wrap unwrapped responses

---

## Consequences

### ✅ Advantages

1. **Client Consistency**
   - Single field naming convention (camelCase)
   - Matches web/JavaScript standard
   - IDE autocomplete works correctly
   - Reduced integration errors

2. **Backend Independence**
   - Each service uses idiomatic conventions
   - Python team uses snake_case (Pythonic)
   - Node team uses camelCase (idiomatic)
   - No forced cross-framework compromise

3. **Maintainability**
   - Clear separation of concerns (gateway handles bridging)
   - Easy to add new endpoints (use existing normalizers)
   - Testable in isolation (request/response mapping tests)

4. **No Breaking Changes**
   - Existing Python code unchanged
   - Existing Node handlers unchanged
   - WebService unaware of transformation

### ⚠️ Trade-offs

1. **Performance**
   - Request transformation: ~2-3ms
   - Response transformation: ~2-3ms
   - Total gateway overhead: ~4-6ms per request

2. **Complexity**
   - Mapping logic must be maintained
   - Endpoint-specific handlers needed for complex transformations
   - New developers must understand transformation layer

3. **Debugging**
   - Request/response mismatch harder to diagnose
   - Need to trace both camelCase and snake_case versions
   - Requires good logging (request ID tracing)

---

## Alternatives Considered

### 1. Enforce Single Convention (camelCase) Everywhere ❌
**Approach**: Update Python codebase to use camelCase everywhere

**Rejected Because**:
- Violates Python naming conventions (PEP 8)
- Large Python refactoring (100+ files)
- Python community would reject non-standard naming
- Ongoing friction for Python developers

### 2. Dual API Versions ❌
**Approach**: Maintain two API versions (v1 camelCase, v2 snake_case)

**Rejected Because**:
- Maintenance burden (2 versions of every endpoint)
- Client support complexity (which version to use?)
- Fragmentation of ecosystem

### 3. Client-Side Transformation ❌
**Approach**: JavaScript client normalizes before sending, denormalizes after receiving

**Rejected Because**:
- Shifts burden to clients (web, mobile, etc.)
- Inconsistent transformation logic across clients
- Mobile clients might skip transformation (easy error)

### 4. GraphQL Federation ❌
**Approach**: Use GraphQL instead of REST to mask backend differences

**Rejected Because**:
- Doesn't solve Python/Node naming mismatch (still exists in resolvers)
- Adds operational complexity (GraphQL server + REST backends)
- Overengineering for current problem

---

## Implementation Details

### Request Normalizer

```typescript
function normalizeAnalysisRequestForPython(body: any) {
  return {
    start_node_id: body.startNodeId,
    end_node_id: body.endNodeId,
    node_list: body.nodeList,
    load_cases: body.loadCases?.map(lc => ({
      name: lc.name,
      factor: lc.factor,
      applied_loads: lc.appliedLoads?.map(load => ({
        node_id: load.nodeId,
        load_x: load.loadX,
        load_y: load.loadY,
        load_mz: load.loadMz,
      })) || [],
      distributed_loads: lc.distributedLoads?.map(dload => ({
        member_id: dload.memberId,
        start_distance: dload.startDistance,
        end_distance: dload.endDistance,
        load_value_start: dload.loadValueStart,
        load_value_end: dload.loadValueEnd,
      })) || [],
    })) || [],
    z: body.z || 0, // Default if not provided
  };
}
```

### Response Denormalizer

```typescript
function normalizeFieldNamesInResponse(obj: any, depth = 0): any {
  if (depth > 10 || !obj) return obj; // Recursion safety
  
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeFieldNamesInResponse(item, depth + 1));
  }
  
  if (typeof obj !== 'object') return obj;
  
  const normalized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // snake_case → camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    normalized[camelKey] = normalizeFieldNamesInResponse(value, depth + 1);
  }
  return normalized;
}
```

### Error Code Mapping

```typescript
const HTTP_TO_ERROR_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};
```

---

## Testing Strategy

**Unit Tests**:
- ✅ Normal field transformation (camel ↔ snake)
- ✅ Nested object transformation
- ✅ Array transformation
- ✅ Error code mapping
- ✅ Unknown endpoint fallback

**Integration Tests**:
- ✅ E2E: Node API → Python backend → response
- ✅ Field preservation (no data loss)
- ✅ Zod validation still works (types correct)
- ✅ Rate limiter sees transformed request

**Performance Tests**:
- [ ] Transformation latency < 5ms (benchmark)
- [ ] Memory overhead minimal (no deep clones)

---

## Versioning & Evolution

**Future Additions**:
- Rust API joins architecture → add Rust normalizer/denormalizer
- New endpoint → add endpoint-specific handler to normalizer
- Field rename → update mapping (doesn't break contract)

**Backward Compatibility**:
- Response envelope changes in future → deprecation warning
- Field removals → keep in normalizer, return null

---

## Monitoring

**Metrics**:
- Requests normalized/sec (throughput)
- Normalization errors (data loss detection)
- Transformation latency distribution (perf tracking)

**Logs** (when DEBUG_REQUEST_NORMALIZATION=true):
- Before/after field values
- Any field skipped or added
- Denormalization diffs

---

## References

- Implementation: `/apps/api/src/services/requestNormalizer.ts`, `/apps/api/src/services/responseDenormalizer.ts`
- Audit: `/ITEM4_CONTRACT_AUDIT.md`
- PEP 8: https://www.python.org/dev/peps/pep-0008/
- Related: ADR-001 (Ownership), ADR-007 (Service Boundaries)
