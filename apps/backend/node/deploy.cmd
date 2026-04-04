@echo off
REM Deploy.cmd for Azure App Service Node.js deployment
REM This ensures dependencies are installed and app starts correctly

echo.
echo ====================================
echo BeamLab API - Custom Deploy Script
echo ====================================
echo.

REM Navigate to the project directory
cd /d "%DEPLOYMENT_TARGET%"

REM Check if node_modules exists, if not install dependencies
if not exist "node_modules" (
    echo node_modules not found, installing dependencies...
    call npm ci --legacy-peer-deps --verbose
    if errorlevel 1 (
        echo Failed to install dependencies
        exit /b 1
    )
) else (
    echo node_modules already exists, skipping install
)

REM Check if dist exists
if not exist "dist" (
    echo Error: dist folder not found
    exit /b 1
)

if not exist "dist\index.js" (
    echo Error: dist/index.js not found
    exit /b 1
)

echo.
echo Deployment completed successfully
echo.

REM Copy the startup script if using custom startup
if exist "startup.sh" (
    echo Using custom startup.sh script
)

goto end

:error
echo An error occurred during deployment.
exit /b 1

:end
