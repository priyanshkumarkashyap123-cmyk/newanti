# Complete Azure setup with deployment redeploy

# 1. Set app settings
echo "Setting application settings..."
az webapp config appsettings set \
  --resource-group "beamlab-ci-rg" \
  --name "beamlab-backend-python" \
  --settings \
    GEMINI_API_KEY="${GEMINI_API_KEY:?GEMINI_API_KEY env var required}" \
    USE_MOCK_AI="false" \
    FRONTEND_URL="https://beamlabultimate.tech" \
    ALLOWED_ORIGINS="https://beamlabultimate.tech,https://www.beamlabultimate.tech,https://brave-mushroom-0eae8ec00.4.azurestaticapps.net"

if [ $? -eq 0 ]; then
    echo "✅ Settings applied"
else
    echo "❌ Failed to set settings"
    exit 1
fi

# 2. Restart the app
echo ""
echo "Restarting app service..."
az webapp restart \
  --resource-group "beamlab-ci-rg" \
  --name "beamlab-backend-python"

if [ $? -eq 0 ]; then
    echo "✅ App restarted!"
    echo ""
    echo "⏳ Waiting 30 seconds for app to start..."
    sleep 30
    echo ""
    echo "🔍 Checking status..."
    STATUS=$(curl -s https://beamlab-backend-python.azurewebsites.net/ai/status)
    echo "📊 Status response:"
    echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"
    echo ""
    echo "✅ Setup complete! Try: https://beamlabultimate.tech"
else
    echo "❌ Failed to restart"
    exit 1
fi
