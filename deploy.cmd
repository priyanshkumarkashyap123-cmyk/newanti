@if "%SCM_TRACE_LEVEL%" NEQ "4" @echo off
REM ⚠️ DEPRECATED: This script is a legacy Windows deployment mechanism.
REM Use GitHub Actions (azure-deploy.yml) for production deployments.
REM This file is retained only for reference. DO NOT USE IN PRODUCTION.

:: ============================================================
:: BeamLab Node.js API Deployment Script
:: ============================================================
:: This script runs during Azure App Service deployment

setlocal enabledelayedexpansion

echo ============================================================
echo BeamLab Node.js API - Deploy Script Starting
echo ============================================================
echo Current directory: %CD%
echo HOME: %HOME%
echo PATH: %PATH%

:: Set environment
set NODE_ENV=production
if "%WEBSITE_INSTANCE_ID%"=="" (set WEBSITE_INSTANCE_ID=local)
echo WEBSITE_INSTANCE_ID: %WEBSITE_INSTANCE_ID%

:: Change to the apps/api directory
cd /d "%DEPLOYMENT_TARGET%\apps\api"
if ERRORLEVEL 1 goto error

echo Working directory: %CD%
dir /b /s | findstr "dist" | findstr "index.js" | findstr /c:"\" > nul
if ERRORLEVEL 1 (
    echo ERROR: dist/index.js not found, running build...
    call npm run build
    if ERRORLEVEL 1 goto error
)

echo ============================================================
echo BUILD COMPLETE - API Ready
echo dist/index.js exists: %CD%\dist\index.js
echo ============================================================

:: Create startup script
set "STARTUP_SCRIPT=%DEPLOYMENT_TARGET%\startup.sh"
echo Creating startup script: %STARTUP_SCRIPT%

(
    echo #!/bin/bash
    echo cd "%DEPLOYMENT_TARGET%/apps/api"
    echo export NODE_ENV=production
    echo export PORT=8080
    echo exec node dist/index.js
) > %STARTUP_SCRIPT%

exit /b 0

:error
echo DEPLOYMENT FAILED
exit /b 1
