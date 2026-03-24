from pathlib import Path
import subprocess

ENV_PATH = Path('/Users/rakshittiwari/Desktop/newanti/.env.deploy')
RG = 'beamlab-prod-rg'
NODE = 'beamlab-backend-node-prod'
PYAPP = 'beamlab-backend-python-prod'
RUST = 'beamlab-rust-api-prod'
SWA = 'beamlab-frontend-prod'


def az(*args: str) -> str:
    return subprocess.check_output(['az', *args], text=True).strip()


node_profile = az('webapp', 'deployment', 'list-publishing-profiles', '-g', RG, '-n', NODE, '--xml')
py_profile = az('webapp', 'deployment', 'list-publishing-profiles', '-g', RG, '-n', PYAPP, '--xml')
rust_profile = az('webapp', 'deployment', 'list-publishing-profiles', '-g', RG, '-n', RUST, '--xml')
swa_token = az('staticwebapp', 'secrets', 'list', '-g', RG, '-n', SWA, '--query', 'properties.apiKey', '-o', 'tsv')

updates = {
    'VITE_API_URL': 'https://beamlab-backend-node-prod.azurewebsites.net',
    'VITE_PYTHON_API_URL': 'https://beamlab-backend-python-prod.azurewebsites.net',
    'VITE_RUST_API_URL': 'https://beamlab-rust-api-prod.azurewebsites.net',
    'PYTHON_API_URL': 'https://beamlab-backend-python-prod.azurewebsites.net',
    'RUST_API_URL': 'https://beamlab-rust-api-prod.azurewebsites.net',
    'FRONTEND_URL': 'https://www.beamlabultimate.tech',
    'CORS_ALLOWED_ORIGINS': 'https://beamlabultimate.tech,https://www.beamlabultimate.tech',
    'AZURE_WEBAPP_PUBLISH_PROFILE_API': node_profile,
    'AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON': py_profile,
    'AZURE_WEBAPP_PUBLISH_PROFILE_RUST': rust_profile,
    'AZURE_PUBLISH_PROFILE_RUST': rust_profile,
    'AZURE_STATIC_WEB_APPS_API_TOKEN': swa_token,
}

text = ENV_PATH.read_text()
lines = text.splitlines()


def quote(v: str) -> str:
    return "'" + v.replace("'", "'\"'\"'") + "'"


seen = set()
out_lines = []
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        key = line.split('=', 1)[0].strip()
        if key in updates:
            out_lines.append(f"{key}={quote(updates[key])}")
            seen.add(key)
            continue
    out_lines.append(line)

for key, val in updates.items():
    if key not in seen:
        out_lines.append(f"{key}={quote(val)}")

ENV_PATH.write_text('\n'.join(out_lines) + '\n')

print('UPDATED_OK=1')
print('UPDATED_KEYS=' + str(len(updates)))
print('NODE_PROFILE_CONTAINS_PROD=' + str('beamlab-backend-node-prod' in node_profile))
print('PY_PROFILE_CONTAINS_PROD=' + str('beamlab-backend-python-prod' in py_profile))
print('RUST_PROFILE_CONTAINS_PROD=' + str('beamlab-rust-api-prod' in rust_profile))
print('SWA_TOKEN_LEN=' + str(len(swa_token)))
