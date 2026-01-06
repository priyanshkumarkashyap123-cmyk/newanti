#!/bin/bash
# Setup script for BeamLab Backend - Sets App Service configuration in Azure

# Configuration
APP_SERVICE_NAME="beamlab-backend-python"
RESOURCE_GROUP="beamlab"  # Change if your RG is different
GEMINI_API_KEY="AIzaSyDFYavn0QKWTJ8OjQkoe8IalmQijA6BRhw"
FRONTEND_URL="https://beamlabultimate.tech"
ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

echo "==================================="
echo "BeamLab Backend Configuration"
echo "==================================="
echo "App Service: $APP_SERVICE_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo ""

# Check if Azure CLI is available
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Please:"
    echo "   1. Go to https://portal.azure.com"
    echo "   2. Click the Cloud Shell icon (>_) at the top"
    echo "   3. Paste this script and run it"
    exit 1
fi

echo "🔍 Checking App Service exists..."
if ! az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    echo "❌ App Service '$APP_SERVICE_NAME' not found in resource group '$RESOURCE_GROUP'"
    echo "   Please update RESOURCE_GROUP in this script if needed."
    exit 1
fi

echo "✅ App Service found!"
echo ""
echo "📝 Setting application settings..."

# Set the environment variables
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_SERVICE_NAME" \
  --settings \
    GEMINI_API_KEY="$GEMINI_API_KEY" \
    USE_MOCK_AI="false" \
    FRONTEND_URL="$FRONTEND_URL" \
    ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
    PYTHONPATH="/home/site/wwwroot" \
    PORT="8000"

if [ $? -eq 0 ]; then
    echo "✅ Application settings updated successfully!"
    echo ""
    echo "🔄 Restarting App Service..."
    az webapp restart \
      --resource-group "$RESOURCE_GROUP" \
      --name "$APP_SERVICE_NAME"
    
    echo ""
    echo "✅ App Service restarted!"
    echo ""
    echo "🎉 Configuration Complete!"
    echo ""
    echo "Next steps:"
    echo "1. Wait 30 seconds for the app to start"
    echo "2. Check status: https://beamlab-backend-python.azurewebsites.net/ai/status"
    echo "3. Should show: gemini_configured: true, mock_mode: false"
    echo "4. Test on: https://beamlabultimate.tech"
else
    echo "❌ Failed to set application settings"
    exit 1
fi
