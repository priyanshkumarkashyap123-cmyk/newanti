#!/bin/bash
# Setup INTERNAL_SERVICE_SECRET for local development

set -e

echo "🔐 Setting up INTERNAL_SERVICE_SECRET for local development"
echo ""

# Generate a secure random secret (32 bytes = 256 bits)
SECRET=$(openssl rand -base64 32)

echo "Generated secret: $SECRET"
echo ""

# Update .env files
ENV_FILES=(
    ".env"
    "apps/api/.env"
    "apps/backend-python/.env"
)

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        # Check if INTERNAL_SERVICE_SECRET already exists
        if grep -q "^INTERNAL_SERVICE_SECRET=" "$env_file"; then
            # Update existing
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^INTERNAL_SERVICE_SECRET=.*|INTERNAL_SERVICE_SECRET=$SECRET|" "$env_file"
            else
                # Linux
                sed -i "s|^INTERNAL_SERVICE_SECRET=.*|INTERNAL_SERVICE_SECRET=$SECRET|" "$env_file"
            fi
            echo "✅ Updated $env_file"
        else
            # Add new
            echo "" >> "$env_file"
            echo "# Internal service-to-service authentication" >> "$env_file"
            echo "INTERNAL_SERVICE_SECRET=$SECRET" >> "$env_file"
            echo "✅ Added to $env_file"
        fi
    else
        echo "⚠️  $env_file not found (skipping)"
    fi
done

echo ""
echo "✅ INTERNAL_SERVICE_SECRET configured successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Restart all backend services"
echo "   2. Test spectrum analysis: Frontend → Node → Rust"
echo "   3. Verify no 401 errors in browser console"
echo ""
echo "🚀 For production, set the same secret in Azure App Service:"
echo ""
echo "   az webapp config appsettings set \\"
echo "       --resource-group beamlab-rg \\"
echo "       --name beamlab-backend-node \\"
echo "       --settings INTERNAL_SERVICE_SECRET=\"$SECRET\""
echo ""
echo "   az webapp config appsettings set \\"
echo "       --resource-group beamlab-rg \\"
echo "       --name beamlab-backend-python \\"
echo "       --settings INTERNAL_SERVICE_SECRET=\"$SECRET\""
echo ""
