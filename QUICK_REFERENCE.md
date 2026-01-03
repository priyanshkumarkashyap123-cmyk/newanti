# ⚡ Quick Reference - BeamLab Ultimate 2.1.0

## 🎯 What's New

| Feature | Before | After |
|---------|--------|-------|
| **Node IDs** | 550e8400-e29b-41d4-a716 | N1, N2, N3... |
| **Member IDs** | a987fbc9-4bed-3078-cf07 | M1, M2, M3... |
| **API Base** | http://localhost:3001 | https://api.beamlabultimate.tech |
| **Frontend** | http://localhost:5173 | https://beamlabultimate.tech |
| **Features** | Free tier limited | Enterprise - all unlocked |
| **PDF Export** | Requires upgrade | ✅ Free |
| **AI Features** | Requires upgrade | ✅ Free |
| **Design Codes** | Limited | ✅ Full access |

---

## 🚀 Getting Started

### 1. Visit the App
```
https://beamlabultimate.tech
```

### 2. Create a Structure
- Click **Member Tool**
- Click two points in the 3D view
- First nodes created: **N1, N2**
- First member created: **M1**

### 3. Add More Members
- Create another member
- Auto-names as: **N3, N4, M2**
- Continue drawing → **M3, M4, M5...**

### 4. Use Features
- **Export PDF** → Right-click → Export
- **Run Analysis** → Dashboard → Analyze
- **Design Check** → View results with design codes
- **AI Helper** → Get recommendations

---

## 🔐 Environment Variables

### Frontend (beamlabultimate.tech)
```bash
VITE_API_URL=https://api.beamlabultimate.tech
VITE_PYTHON_API_URL=https://api.beamlabultimate.tech
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY
```

### Backend API (api.beamlabultimate.tech)
```bash
MONGODB_URI=mongodb+srv://...
CLERK_SECRET_KEY=sk_live_YOUR_SECRET
FRONTEND_URL=https://beamlabultimate.tech
NODE_ENV=production
```

---

## 📊 Database

### Nodes
```javascript
{
  id: "N1",           // ← Sequential name
  x: 0,
  y: 0,
  z: 0,
  restraints: { fx: true, fy: true, ... }
}
```

### Members
```javascript
{
  id: "M1",           // ← Sequential name
  startNodeId: "N1",
  endNodeId: "N2",
  sectionId: "default",
  E: 200e6,
  A: 0.01,
  I: 1e-4
}
```

---

## 🛠️ Developer Commands

### Build for Production
```bash
cd apps/web
pnpm build          # Creates optimized dist/
```

### Check TypeScript
```bash
pnpm tsc --noEmit   # 0 errors expected
```

### Deploy Frontend
```bash
# Upload dist/ folder to beamlabultimate.tech
# Or use your hosting platform's CLI
```

### Deploy API
```bash
cd apps/api
pnpm build
# Upload to api.beamlabultimate.tech
```

---

## 🧪 Testing Sequential IDs

### In Browser Console
```javascript
// Get store
const store = useModelStore();

// Current counters
console.log(store.nextNodeNumber);      // 5
console.log(store.nextMemberNumber);    // 3

// Generate next IDs
console.log(store.getNextNodeId());     // "N5"
console.log(store.getNextMemberId());   // "M3"
```

### Manual Test
1. Open https://beamlabultimate.tech
2. Open DevTools (F12) → Console
3. Create a member (click two points)
4. Check network tab → should show api.beamlabultimate.tech
5. Right-click → Export PDF → verify N1, M1 in report

---

## 🐛 Common Issues

### Issue: Still using localhost
**Solution:** Clear browser cache and .env variables
```bash
# Clear env
unset VITE_API_URL
unset VITE_PYTHON_API_URL

# Restart dev server or redeploy
```

### Issue: IDs still showing UUIDs
**Solution:** Rebuild code
```bash
cd apps/web
rm -rf dist
pnpm build
```

### Issue: API not responding
**Solution:** Check environment variables
```bash
# Verify in hosting platform:
VITE_API_URL=https://api.beamlabultimate.tech
VITE_PYTHON_API_URL=https://api.beamlabultimate.tech
```

---

## 📚 Documentation

- **Full Guide:** IMPLEMENTATION_COMPLETE_FINAL.md
- **Deployment:** DEPLOYMENT_GUIDE.md
- **Migration Details:** PRODUCTION_MIGRATION_COMPLETE.md
- **Verification:** verify_production.sh

---

## ✅ Verification Checklist

Before going live:

- [ ] Visit https://beamlabultimate.tech
- [ ] Create a member → Check ID is N1, M1
- [ ] Check browser console → No localhost errors
- [ ] Network tab → All requests to api.beamlabultimate.tech
- [ ] Export PDF → Works without upgrade
- [ ] Run analysis → Works without upgrade
- [ ] Check design codes → All options available
- [ ] Test AI feature → Works without limitation

---

## 🎓 Examples

### PDF Report Headers
```
STRUCTURAL ANALYSIS REPORT
BeamLab Ultimate

Nodes: N1, N2, N3, N4, N5
Members: M1, M2, M3, M4
Analysis Time: 2.34 seconds
```

### Design Results
```
Member M3 - Design Check Results
=================================
Section: ISA 200x200x12
Utilization Ratio: 0.67
Status: ✅ PASS

Member M4 - Design Check Results
=================================
Section: ISA 150x150x10
Utilization Ratio: 1.24
Status: ❌ FAIL (Exceeds capacity)
```

### AI Recommendation
```
AI Analysis for M4
==================
🔴 Current section ISA 150x150x10 is oversized
✅ Recommended: Use ISA 175x175x11
💰 Cost savings: ~15%
⚡ Performance: Equivalent
```

---

## 🔗 URLs

### Frontend
```
https://beamlabultimate.tech
https://beamlabultimate.tech/dashboard
https://beamlabultimate.tech/analysis
https://beamlabultimate.tech/design
```

### API
```
https://api.beamlabultimate.tech/api/health
https://api.beamlabultimate.tech/api/analyze
https://api.beamlabultimate.tech/api/user/subscription
https://api.beamlabultimate.tech/api/export/pdf
```

---

## 📞 Support

- **Email:** support@beamlabultimate.tech
- **Status:** https://status.beamlabultimate.tech
- **Docs:** https://docs.beamlabultimate.tech
- **Contact:** https://beamlabultimate.tech/contact

---

## 🎉 You're All Set!

BeamLab Ultimate 2.1.0 is production-ready.

**Status:** ✅ LIVE  
**Domain:** beamlabultimate.tech  
**Features:** Enterprise (Unlimited)  
**Node IDs:** N1, N2, N3... ✨  
**Member IDs:** M1, M2, M3... ✨  

Happy analyzing! 🚀

---

**Last Updated:** 3 January 2026  
**Version:** 2.1.0  
**Maintainer:** BeamLab Team
