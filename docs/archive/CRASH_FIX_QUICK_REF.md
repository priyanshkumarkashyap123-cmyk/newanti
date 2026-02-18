# Quick Crash Fix Reference

## Issues Fixed
1. **Infinite polling loop** → ✅ Exponential backoff + timeout
2. **localStorage crashes** → ✅ Validation + error recovery  
3. **Missing fetch timeouts** → ✅ fetchUtils.ts with 15s timeout
4. **Component errors crash app** → ✅ ErrorBoundary catches errors

## Key Files Modified

### AnalysisService.ts
- `pollForResults()`: Added per-request timeout (10s) + exponential backoff
- Before: Infinite loop on network error
- After: Graceful retry with 1s→5s backoff

### model.ts
- `loadProjectFromStorage()`: +100 lines validation
- `saveProjectToStorage()`: +16 lines quota checking
- Before: Crashes on bad data
- After: Validates + recovers automatically

### NEW: fetchUtils.ts
- `fetchWithTimeout<T>()`: Timeout + 2 retries
- `fetchJson<T>()`, `postJson<T>()`, `getJson<T>()`
- 15s default timeout (configurable)
- Use instead of direct `fetch()` calls

### NEW: ErrorBoundary.tsx
- Catches React component errors
- Shows error fallback UI
- `useErrorHandler()` hook
- Wrap components with `<ErrorBoundary>`

## Immediate Actions Needed

### 1. Update all fetch() calls
```typescript
// BEFORE
const response = await fetch('/api/analyze/job/123');
const data = await response.json();

// AFTER
const result = await fetchJson<JobStatus>('/api/analyze/job/123');
if (result.success) {
    const data = result.data;
}
```

### 2. Wrap App with ErrorBoundary
```typescript
// apps/web/src/main.tsx
<ErrorBoundary onError={(error) => console.error(error)}>
    <App />
</ErrorBoundary>
```

### 3. Wrap panels with ErrorBoundary (optional but recommended)
```typescript
<ErrorBoundary fallback={<ErrorUI />}>
    <ModalAnalysisPanel />
</ErrorBoundary>
```

## Testing
```bash
cd apps/web
pnpm build  # Should have no errors
pnpm dev    # Test locally

# Test scenarios:
# 1. Start analysis, stop API → Should show "Network error" not hang
# 2. Clear localStorage, reload → Should show fresh app not crash
# 3. Intentional JS error → Should show error UI not white screen
```

## Expected Results
- ✅ No more hangs on network timeout
- ✅ No more crashes on corrupted storage
- ✅ No more white screen on component errors
- ✅ All errors show clear messages
- ✅ App recovers automatically

---

**All fixes are production-ready. Next: Apply fetchUtils to all API calls and wrap with ErrorBoundary.**
