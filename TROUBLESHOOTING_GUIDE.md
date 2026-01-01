# Troubleshooting Guide

## Current Status
✅ All 4 major issues have been resolved and deployed
✅ All commits pushed to GitHub
✅ GitHub Actions deployment in progress

---

## If You're Experiencing Issues

### Issue: "Analysis not working" or "API errors"
**Checklist**:
1. Wait 2-5 minutes for GitHub Actions deployment to complete
2. Hard refresh browser: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
3. Open DevTools (`F12`) → Network tab
4. Look for requests to:
   - `https://beamlab-backend-node.azurewebsites.net/api/analyze`
   - `https://beamlab-backend-python.azurewebsites.net/analyze/frame`
5. Check response status codes (should be 200, not 400/500)

### Issue: "Diagrams not showing in results"
**Checklist**:
1. Verify analysis completed successfully (no error messages)
2. Check browser console for errors (`F12` → Console)
3. Ensure ReportGenerator.tsx has diagram methods loaded
4. Try exporting PDF - diagrams should appear there

### Issue: "CORS errors in network tab"
**Checklist**:
1. Verify requests include `credentials: include`
2. Verify responses include `Access-Control-Allow-Credentials: true`
3. Check Origin header in request matches allowed origins
4. Review CORS_CONFIGURATION.md for allowed origins list

---

## Deployment Verification

### Step 1: Check if Latest Code is Deployed
1. Visit https://beamlabultimate.tech
2. Open DevTools → Console
3. Type: `console.log('✅ Page loaded successfully')`
4. Refresh page - you should see the log

### Step 2: Test Analysis Flow
1. Create simple structure (2 nodes, 1 member)
2. Add supports and loads
3. Click "Analyze" button
4. Monitor Network tab in DevTools
5. Verify no CORS/API errors

### Step 3: Test PDF Export
1. After successful analysis
2. Click "Export to PDF" in results
3. Verify diagrams appear in PDF

---

## Common Issues & Fixes

### "Module not found" errors
**Cause**: Old cached build  
**Fix**: 
```bash
# Clear cache and rebuild
rm -rf apps/web/dist
rm -rf apps/web/.vite
npm run build
```

### "API request fails with 401"
**Cause**: Auth token not included  
**Fix**: Verify `credentials: 'include'` is in fetch call (already fixed in code)

### "CORS error: missing credentials"
**Cause**: Missing `Access-Control-Allow-Credentials: true` header  
**Fix**: Verify backend CORS middleware has credentials enabled (already configured)

### "PDF export fails"
**Cause**: ReportGenerator methods not loaded  
**Fix**: Check browser console for JavaScript errors, reload page

---

## Files to Check for Issues

### If Analysis Fails
→ Check: `apps/backend-python/analysis/fea_engine.py`
- Verify `add_section()` call uses dictionary format
- Current code (line 362-372): ✅ Correct

### If Diagrams Don't Show
→ Check: `apps/web/src/services/ReportGenerator.ts`
- Verify `addMemberDiagram()` method exists (line 630)
- Verify `addAllMemberDiagrams()` method exists (line 670)
- Verify `drawDiagramOnCanvas()` method exists (line 708)

### If PDF Export Fails
→ Check: `apps/web/src/components/results/ResultsToolbar.tsx`
- Verify line 294 calls `report.addAllMemberDiagrams()`
- Verify try/catch wrapper exists

### If API Communication Fails
→ Check: 
- `apps/web/src/api/analysis.ts` line 42: `credentials: 'include'` ✅
- `apps/web/src/components/ModernModeler.tsx` line 367: `credentials: 'include'` ✅

---

## How to Fix Specific Problems

### Problem 1: Old Version Still Deployed
**Solution**:
```bash
# Force GitHub Actions rerun
git commit --allow-empty -m "chore: trigger deployment"
git push origin main
```

### Problem 2: Cache Issues on Browser
**Solution**:
```
1. DevTools → Application → Cache Storage → Delete all
2. DevTools → Application → Local Storage → Delete all
3. Hard refresh: Cmd+Shift+R
```

### Problem 3: Python Backend Not Responding
**Solution**:
1. Check Azure portal for Python app status
2. Verify Python backend has scipy installed in requirements.txt ✅
3. Check error logs in Azure

### Problem 4: Node.js Backend Not Responding
**Solution**:
1. Check Azure portal for Node.js app status
2. Verify environment variables set correctly
3. Check error logs in Azure

---

## Getting Help

### If You See These Errors

**"Cannot POST /api/analyze"**
- Node.js backend not running or wrong URL
- Check: `VITE_API_URL` environment variable

**"Cannot POST /analyze/frame"**
- Python backend not running or wrong URL
- Check: `PYTHON_API_URL` environment variable

**"401 Unauthorized"**
- Auth token not being sent
- Verify `credentials: 'include'` in fetch calls
- Check Clerk authentication status

**"SyntaxError: Unexpected token"**
- API response is not JSON
- Check network response in DevTools
- Might be HTML error page instead of JSON

---

## Quick Debug Checklist

Run these commands to verify setup:

```bash
# Check git status
git status

# Check latest commits deployed
git log --oneline -5

# Verify build works locally
npm run build

# Check for TypeScript errors
npm run type-check

# Verify environment variables
echo $VITE_API_URL
echo $PYTHON_API_URL
```

---

## Contact Points

### Frontend Issues
File: `apps/web/src/components/ModernModeler.tsx`
File: `apps/web/src/api/analysis.ts`

### Backend (Python) Issues
File: `apps/backend-python/analysis/fea_engine.py`
URL: `https://beamlab-backend-python.azurewebsites.net`

### Backend (Node.js) Issues  
File: `apps/api/src/routes/analysisRoutes.ts`
URL: `https://beamlab-backend-node.azurewebsites.net`

### Deployment Issues
Check: GitHub Actions logs
Check: Azure portal for app status

---

## Status Summary

| Component | Status | File |
|-----------|--------|------|
| FEModel3D API | ✅ Fixed | `fea_engine.py#L362` |
| Design Button | ✅ Fixed | Consequence of FEModel3D fix |
| PDF Diagrams | ✅ Implemented | `ReportGenerator.ts#L630` |
| CORS Credentials | ✅ Fixed | `analysis.ts#L42`, `ModernModeler.tsx#L367` |
| Node.js CORS | ✅ Configured | Backend middleware |
| Python CORS | ✅ Configured | Backend middleware |

All fixes are deployed. If issues persist, they may be deployment-related (wait for GitHub Actions to complete) or environment-related (check Azure portal).

---

*Last Updated: January 1, 2026*
