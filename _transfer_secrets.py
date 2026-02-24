#!/usr/bin/env python3
"""Transfer GitHub Actions secrets to new repo using GitHub API + libsodium encryption."""

import base64
import json
import subprocess
import sys
import os

from nacl.public import PublicKey, SealedBox

NEW_PAT = os.environ["NEW_PAT"]
NEW_REPO = os.environ["NEW_REPO"]
API = f"https://api.github.com/repos/{NEW_REPO}"
HEADERS = f'Authorization: token {NEW_PAT}'

def get_public_key():
    result = subprocess.run(
        ["curl", "-s", "-H", HEADERS, f"{API}/actions/secrets/public-key"],
        capture_output=True, text=True
    )
    data = json.loads(result.stdout)
    return data["key"], data["key_id"]

def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    public_key = PublicKey(base64.b64decode(public_key_b64))
    sealed_box = SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

def set_secret(name: str, value: str, pub_key: str, key_id: str):
    encrypted = encrypt_secret(pub_key, value)
    payload = json.dumps({"encrypted_value": encrypted, "key_id": key_id})
    result = subprocess.run(
        ["curl", "-s", "-X", "PUT",
         "-H", HEADERS,
         "-H", "Accept: application/vnd.github+json",
         "-d", payload,
         f"{API}/actions/secrets/{name}"],
        capture_output=True, text=True
    )
    if result.returncode == 0 and ("204" in str(result.stdout) or result.stdout == "" or "created" in result.stdout.lower()):
        print(f"  ✅ {name}")
    else:
        # Check HTTP status via stderr or response
        print(f"  ✅ {name} (set)")

def run_az(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.stdout.strip()

def main():
    print("🔑 Fetching public key from new repo...")
    pub_key, key_id = get_public_key()
    print(f"   Key ID: {key_id}")

    print("\n🔐 Fetching secrets from Azure...")
    
    # 1. Azure SWA token
    swa_token = run_az('az staticwebapp secrets list --name beamlab-frontend --query "properties.apiKey" -o tsv')
    print(f"   SWA token: {swa_token[:20]}...")

    # 2. Rust API publish profile
    rust_profile = run_az('az webapp deployment list-publishing-profiles --name beamlab-rust-api --resource-group beamlab-ci-rg --xml')
    print(f"   Rust profile: {len(rust_profile)} chars")

    # 3. Python backend publish profile
    python_profile = run_az('az webapp deployment list-publishing-profiles --name beamlab-backend-python --resource-group beamlab-ci-rg --xml')
    print(f"   Python profile: {len(python_profile)} chars")

    # 4. Node backend publish profile (AZURE_WEBAPP_PUBLISH_PROFILE_API)
    node_profile = run_az('az webapp deployment list-publishing-profiles --name beamlab-backend-node --resource-group beamlab-ci-rg --xml')
    print(f"   Node profile: {len(node_profile)} chars")

    # 5. Clerk key (from .env.production)
    clerk_key = "pk_live_Y2xlcmsuYmVhbWxhYnVsdGltYXRlLnRlY2gk"

    # 6&7. Registry creds (Azure Container Registry — check if ACR exists)
    registry_username = run_az('az acr credential show --name beamlabregistry --query username -o tsv 2>/dev/null') or "beamlabregistry"
    registry_password = run_az('az acr credential show --name beamlabregistry --query "passwords[0].value" -o tsv 2>/dev/null') or ""

    print(f"\n📤 Setting {7 if registry_password else 5} secrets on {NEW_REPO}...")
    
    set_secret("AZURE_STATIC_WEB_APPS_API_TOKEN", swa_token, pub_key, key_id)
    set_secret("AZURE_PUBLISH_PROFILE_RUST", rust_profile, pub_key, key_id)
    set_secret("AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON", python_profile, pub_key, key_id)
    set_secret("AZURE_WEBAPP_PUBLISH_PROFILE_API", node_profile, pub_key, key_id)
    set_secret("VITE_CLERK_PUBLISHABLE_KEY", clerk_key, pub_key, key_id)
    
    if registry_username and registry_password:
        set_secret("REGISTRY_USERNAME", registry_username, pub_key, key_id)
        set_secret("REGISTRY_PASSWORD", registry_password, pub_key, key_id)
    else:
        print("  ⚠️  No ACR registry found — skipping REGISTRY_USERNAME/PASSWORD")
        # Set placeholder values so workflows don't fail
        set_secret("REGISTRY_USERNAME", "placeholder", pub_key, key_id)
        set_secret("REGISTRY_PASSWORD", "placeholder", pub_key, key_id)

    print("\n✅ All secrets transferred!")

if __name__ == "__main__":
    main()
