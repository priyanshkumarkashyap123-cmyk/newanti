#!/bin/bash

# ============================================
# BeamLab Ultimate - Domain Setup Script
# ============================================
# Domain: https://beamlabultimate.tech
# This script configures your local development domain
# Requires: sudo access

echo "🌐 BeamLab Ultimate - Domain Setup"
echo "===================================="
echo "Production: https://beamlabultimate.tech"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Mac or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
    echo -e "${BLUE}ℹ️  Detected macOS${NC}"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo -e "${BLUE}ℹ️  Detected Linux${NC}"
else
    echo -e "${YELLOW}⚠️  Unsupported OS: $OSTYPE${NC}"
    exit 1
fi

echo ""
echo "This script will:"
echo "  1. Add Bheemla domain entries to /etc/hosts"
echo "  2. Flush DNS cache"
echo "  3. Verify domain resolution"
echo ""

# Check for sudo access
if ! sudo -n true 2>/dev/null; then
    echo -e "${YELLOW}⚠️  This script requires sudo access${NC}"
    echo "You'll be prompted for your password..."
    echo ""
fi

# Add domain entries
echo -e "${BLUE}1. Adding domain entries to /etc/hosts...${NC}"

HOSTS_FILE="/etc/hosts"
DOMAINS=(
    "app.beamlabultimate.local"
    "api.beamlabultimate.local"
    "www.beamlabultimate.local"
    "python-api.beamlabultimate.local"
    "beamlabultimate.local"
)

for domain in "${DOMAINS[@]}"; do
    # Check if already exists
    if grep -q "^127.0.0.1[[:space:]]*$domain" "$HOSTS_FILE" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $domain already in /etc/hosts"
    else
        echo -e "${BLUE}  Adding ${domain}...${NC}"
        echo "127.0.0.1    $domain" | sudo tee -a "$HOSTS_FILE" > /dev/null
        echo -e "${GREEN}✓${NC} Added $domain"
    fi
done

# Add IPv6 entries
echo ""
echo -e "${BLUE}2. Adding IPv6 entries...${NC}"
for domain in "${DOMAINS[@]}"; do
    if grep -q "^::1[[:space:]]*$domain" "$HOSTS_FILE" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $domain (IPv6) already in /etc/hosts"
    else
        echo -e "${BLUE}  Adding ${domain} (IPv6)...${NC}"
        echo "::1          $domain" | sudo tee -a "$HOSTS_FILE" > /dev/null
        echo -e "${GREEN}✓${NC} Added $domain (IPv6)"
    fi
done

# Flush DNS cache
echo ""
echo -e "${BLUE}3. Flushing DNS cache...${NC}"

if [[ "$OS" == "mac" ]]; then
    sudo dscacheutil -flushcache
    sudo killall -HUP mDNSResponder
    echo -e "${GREEN}✓${NC} DNS cache flushed (macOS)"
elif [[ "$OS" == "linux" ]]; then
    # Try different methods for Linux
    if command -v systemd-resolve &> /dev/null; then
        sudo systemctl restart systemd-resolved
        echo -e "${GREEN}✓${NC} DNS cache flushed (systemd)"
    elif command -v nscd &> /dev/null; then
        sudo service nscd restart
        echo -e "${GREEN}✓${NC} DNS cache flushed (nscd)"
    else
        echo -e "${YELLOW}⚠️  Could not find DNS cache tool${NC}"
    fi
fi

# Verify domains resolve
echo ""
echo -e "${BLUE}4. Verifying domain resolution...${NC}"
echo ""

all_ok=true
for domain in "${DOMAINS[@]}"; do
    if ping -c 1 "$domain" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $domain resolves correctly"
    else
        echo -e "${YELLOW}⚠️  Could not resolve $domain${NC}"
        all_ok=false
    fi
done

echo ""
echo "===================================="
if [ "$all_ok" = true ]; then
    echo -e "${GREEN}✅ Domain setup complete!${NC}"
    echo ""
    echo "Your domains are ready to use:"
    echo -e "${GREEN}  • Frontend:    http://app.beamlabultimate.local:5173${NC}"
    echo -e "${GREEN}  • API:         http://api.beamlabultimate.local:3001${NC}"
    echo -e "${GREEN}  • Python API:  http://python-api.beamlabultimate.local:3002${NC}"
    echo ""
    echo "Production domain: https://beamlabultimate.tech"
    echo ""
else
    echo -e "${YELLOW}⚠️  Some domains could not be verified${NC}"
    echo "This may be normal - try again in a moment"
    echo ""
fi

echo "===================================="
echo ""
echo "Next steps:"
echo "  1. Create .env.local from .env.local.example"
echo "  2. Start servers with: pnpm dev"
echo "  3. Access frontend at: http://app.beamlabultimate.local:5173"
echo "  4. Production URL: https://beamlabultimate.tech"
echo ""
echo "Documentation: See DOMAIN_SETUP_GUIDE.md"
echo ""
