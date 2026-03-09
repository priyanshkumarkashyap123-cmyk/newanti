#!/bin/bash
set -e
cd /Users/rakshittiwari/Desktop/newanti
git add apps/web/src/pages/LandingPage.tsx
git commit -m "fix(landing): resilient showcase fallback when backend route unavailable"
git push origin main
