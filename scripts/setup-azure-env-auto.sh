#!/bin/bash

###############################################################################
# BeamLab Azure Configuration Script
# Automatically sets environment variables in Azure App Service
# Usage: ./setup-azure-env.sh <resource-group> <app-name> <api-key> [--dry-run]
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
RESOURCE_GROUP="${1}"
APP_NAME="${2}"
GEMINI_API_KEY="${3}"
DRY_RUN="${4:-}"

if [[ -z "$RESOURCE_GROUP" || -z "$APP_NAME" || -z "$GEMINI_API_KEY" ]]; then
    echo -e "${RED}❌ Error: Missing required arguments${NC}"
    echo "Usage: $0 <resource-group> <app-name> <gemini-api-key> [--dry-run]"
    echo ""
    echo "Example:"
    echo "  $0 beamlab-ci-rg beamlab-backend-python 'AIza_YOUR_KEY'"
    echo "  $0 beamlab-ci-rg beamlab-backend-python 'AIza_YOUR_KEY' --dry-run"
    exit 1
fi

FRONTEND_URL="https://beamlabultimate.tech"
ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BeamLab Azure App Service Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Resource Group:${NC} $RESOURCE_GROUP"
echo -e "${YELLOW}App Name:${NC} $APP_NAME"
echo -e "${YELLOW}Frontend URL:${NC} $FRONTEND_URL"
echo ""

# Show settings that will be applied
echo -e "${BLUE}Settings to apply:${NC}"
echo "  • GEMINI_API_KEY: [REDACTED]"
echo "  • USE_MOCK_AI: false"
echo "  • FRONTEND_URL: $FRONTEND_URL"
echo "  • ALLOWED_ORIGINS: $ALLOWED_ORIGINS"
echo ""

# If dry-run, just show what would happen
if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo -e "${YELLOW}[DRY-RUN MODE]${NC} No changes will be made."
    echo ""
    echo "Command that would be executed:"
    echo ""
    echo "az webapp config appsettings set \\"
    echo "  -g '$RESOURCE_GROUP' \\"
    echo "  -n '$APP_NAME' \\"
    echo "  --settings \\"
    echo "    GEMINI_API_KEY='[REDACTED]' \\"
    echo "    USE_MOCK_AI=false \\"
    echo "    FRONTEND_URL='$FRONTEND_URL' \\"
    echo "    ALLOWED_ORIGINS='$ALLOWED_ORIGINS'"
    echo ""
    echo -e "${GREEN}✓ Dry-run complete. Run without --dry-run to apply changes.${NC}"
    exit 0
fi

# Confirm before applying
echo -e "${YELLOW}⚠️  This will update Azure App Service settings.${NC}"
read -p "Continue? (yes/no): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}❌ Cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}[1/3]${NC} Setting environment variables..."

# Apply settings
az webapp config appsettings set \
    -g "$RESOURCE_GROUP" \
    -n "$APP_NAME" \
    --settings \
        GEMINI_API_KEY="$GEMINI_API_KEY" \
        USE_MOCK_AI=false \
        FRONTEND_URL="$FRONTEND_URL" \
        ALLOWED_ORIGINS="$ALLOWED_ORIGINS"

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Failed to set app settings${NC}"
    exit 1
fi

echo -e "${GREEN}✓ App settings updated${NC}"
echo ""

# Restart the app
echo -e "${BLUE}[2/3]${NC} Restarting app..."
az webapp restart -g "$RESOURCE_GROUP" -n "$APP_NAME"

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Failed to restart app${NC}"
    exit 1
fi

echo -e "${GREEN}✓ App restarted${NC}"
echo ""

# Verify settings
echo -e "${BLUE}[3/3]${NC} Verifying settings..."
echo ""

SETTINGS=$(az webapp config appsettings list \
    -g "$RESOURCE_GROUP" \
    -n "$APP_NAME" \
    --query "[?name=='GEMINI_API_KEY' || name=='USE_MOCK_AI' || name=='FRONTEND_URL' || name=='ALLOWED_ORIGINS']")

echo "$SETTINGS" | jq '.' || echo "$SETTINGS"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Configuration Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Wait 30 seconds for the app to fully restart"
echo "  2. Check logs: az webapp log tail -g '$RESOURCE_GROUP' -n '$APP_NAME'"
echo "  3. Test: curl https://${APP_NAME}.azurewebsites.net/health"
echo "  4. Test AI: curl https://${APP_NAME}.azurewebsites.net/ai/status"
echo ""
