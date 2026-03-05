#!/bin/bash
set -e

# Azure deployment script
cd apps/web/dist

# Create a simple deployment package
echo "Creating deployment package..."
tar -czf ../deploy.tar.gz .

echo "Package created: $(ls -lh ../deploy.tar.gz)"
echo ""
echo "Deployment package ready. Manual upload required to Azure Static Web Apps."
echo "Visit: https://portal.azure.com and upload the package manually."
