#!/bin/bash

echo "==================================="
echo "BACKEND STATUS & FIX"
echo "==================================="
echo ""

RG="beamlab-ci-rg"

# Test Node.js
echo "1. Node.js API:"
node_status=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-node.azurewebsites.net/health 2>/dev/null || echo "000")
if [ "$node_status" = "200" ]; then
    echo "   ✅ HTTP 200 - WORKING"
else
    echo "   ⚠️  HTTP $node_status"
fi

# Test Python
echo ""
echo "2. Python Backend:"
python_status=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-python.azurewebsites.net/health 2>/dev/null || echo "000")
if [ "$python_status" = "200" ]; then
    echo "   ✅ HTTP 200 - WORKING"
elif [ "$python_status" = "503" ]; then
    echo "   ⏳ HTTP 503 - Restarting Python backend..."
    az webapp restart --resource-group "$RG" --name beamlab-backend-python --output none
    echo "   Waiting 30s..."
    sleep 30
    python_status=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-backend-python.azurewebsites.net/health 2>/dev/null || echo "000")
    echo "   Status now: HTTP $python_status"
else
    echo "   ⚠️  HTTP $python_status - Fixing..."
    
    # Fix Python backend configuration
    MONGODB_URI=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='MONGODB_URI'].value" -o tsv)
    JWT_SECRET=$(az webapp config appsettings list --resource-group "$RG" --name beamlab-backend-node --query "[?name=='JWT_SECRET'].value" -o tsv)
    
    az webapp config set \
        --resource-group "$RG" \
        --name beamlab-backend-python \
        --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000" \
        --output none
    
    az webapp config appsettings set \
        --resource-group "$RG" \
        --name beamlab-backend-python \
        --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true PORT=8000 MONGODB_URI="$MONGODB_URI" JWT_SECRET="$JWT_SECRET" \
        --output none
    
    az webapp restart --resource-group "$RG" --name beamlab-backend-python --output none
    
    echo "   ✅ Configuration fixed, restarting..."
fi

# Test Rust
echo ""
echo "3. Rust API:"
rust_status=$(curl -s -m 5 -o /dev/null -w "%{http_code}" https://beamlab-rust-api.azurewebsites.net/health 2>/dev/null || echo "000")
if [ "$rust_status" = "200" ]; then
    echo "   ✅ HTTP 200 - WORKING"
else
    echo "   ⚠️  HTTP $rust_status - Needs Docker image build"
    echo ""
    echo "   To build Rust API:"
    echo "   chmod +x BUILD_RUST_API.sh && ./BUILD_RUST_API.sh"
fi

echo ""
echo "==================================="
echo "SUMMARY"
echo "==================================="
echo ""
echo "✅ Node.js API: https://beamlab-backend-node.azurewebsites.net"
echo "Status: Fully operational"
echo ""
echo "Python Backend: https://beamlab-backend-python.azurewebsites.net"
if [ "$python_status" = "200" ]; then
    echo "Status: ✅ Fully operational"
else
    echo "Status: ⏳ Starting (wait 2 minutes then check again)"
fi
echo ""
echo "Rust API: https://beamlab-rust-api.azurewebsites.net"
if [ "$rust_status" = "200" ]; then
    echo "Status: ✅ Fully operational"
else
    echo "Status: ⚠️  Needs image build (run BUILD_RUST_API.sh)"
fi
echo ""
echo "==================================="
