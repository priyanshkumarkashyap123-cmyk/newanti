#!/usr/bin/env bash
set -euo pipefail

echo "Parsing publish profile for Kudu credentials..."

if [ -z "${PUBLISH_PROFILE:-}" ]; then
  echo "::warning::PUBLISH_PROFILE empty; skipping app settings sync"
  exit 0
fi

parsed=$(python3 - <<'PY'
import os,sys,xml.etree.ElementTree as ET
p=os.environ.get('PUBLISH_PROFILE','')
if not p:
    sys.exit(0)
try:
    root=ET.fromstring(p)
    for node in root.findall('.//publishProfile'):
        un=node.attrib.get('userName','').strip()
        pw=node.attrib.get('userPWD','').strip()
        if un and pw:
            print(un)
            print(pw)
            sys.exit(0)
except Exception as e:
    print(f"::warning::Failed to parse publish profile: {e}", file=sys.stderr)
    sys.exit(0)
PY
)

KUDU_USER=$(printf '%s\n' "$parsed" | sed -n '1p' || true)
KUDU_PASS=$(printf '%s\n' "$parsed" | sed -n '2p' || true)

if [ -z "${KUDU_USER:-}" ] || [ -z "${KUDU_PASS:-}" ]; then
  echo "::warning::Could not extract Kudu creds from publish profile; skipping app settings sync"
  exit 0
fi

KUDU_URL="https://${AZURE_WEBAPP_NAME_API}.scm.azurewebsites.net/api/settings"

echo "Building appsettings JSON payload..."
python3 - <<'PY' > /tmp/appsettings.json
import os,json
def add(settings,k,v):
    if v:
        settings.append({"name":k,"value":v})

settings = [
    {"name":"NODE_ENV","value":"production"},
    {"name":"USE_CLERK","value":"true"},
    {"name":"FRONTEND_URL","value":"https://beamlabultimate.tech"},
    {"name":"CORS_ALLOWED_ORIGINS","value":"https://beamlabultimate.tech,https://www.beamlabultimate.tech"},
    {"name":"PYTHON_API_URL","value":"https://beamlab-backend-python-prod.azurewebsites.net"},
    {"name":"RUST_API_URL","value":"https://beamlab-rust-api-prod.azurewebsites.net"},
]

add(settings,'MONGODB_URI', os.environ.get('MONGODB_URI') or os.environ.get('SECRET_MONGODB_URI'))
add(settings,'JWT_SECRET', os.environ.get('JWT_SECRET') or os.environ.get('SECRET_JWT_SECRET'))
add(settings,'JWT_REFRESH_SECRET', os.environ.get('JWT_REFRESH_SECRET') or os.environ.get('SECRET_JWT_REFRESH_SECRET'))
add(settings,'CLERK_SECRET_KEY', os.environ.get('CLERK_SECRET_KEY') or os.environ.get('SECRET_CLERK_SECRET_KEY'))
add(settings,'CLERK_PUBLISHABLE_KEY', os.environ.get('CLERK_PUBLISHABLE_KEY') or os.environ.get('SECRET_CLERK_PUBLISHABLE_KEY'))
add(settings,'SENTRY_DSN', os.environ.get('SENTRY_DSN') or os.environ.get('SECRET_SENTRY_DSN'))

print(json.dumps(settings))
PY

echo "Uploading appsettings payload to $KUDU_URL"
curl -s -u "$KUDU_USER:$KUDU_PASS" -H "Content-Type: application/json" -X PUT -d @/tmp/appsettings.json "$KUDU_URL" || true

echo "App settings sync step completed."
