#!/bin/bash
cd /Users/rakshittiwari/Desktop/newanti
git add apps/web/src/services/AuthService.ts apps/web/src/services/DatabaseService.ts apps/web/src/services/GeminiAIService.ts
git commit -m "feat(services): Migrate AuthService, DatabaseService, GeminiAIService to fetchWithTimeout - 39 methods total"
git push origin main
