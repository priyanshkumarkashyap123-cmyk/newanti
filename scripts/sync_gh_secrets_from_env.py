from pathlib import Path
import subprocess

REPO = 'priyanshkumarkashyap123-cmyk/newanti'
ENV_PATH = Path('/Users/rakshittiwari/Desktop/newanti/.env.deploy')

content = ENV_PATH.read_text().splitlines()
vals: dict[str, str] = {}
for line in content:
    s = line.strip()
    if not s or s.startswith('#') or '=' not in s:
        continue
    key, value = s.split('=', 1)
    value = value.strip()
    if (value.startswith("'") and value.endswith("'")) or (value.startswith('"') and value.endswith('"')):
        value = value[1:-1]
    vals[key.strip()] = value

mapping = {
    'AZURE_STATIC_WEB_APPS_API_TOKEN': 'AZURE_STATIC_WEB_APPS_API_TOKEN',
    'AZURE_WEBAPP_PUBLISH_PROFILE_API': 'AZURE_WEBAPP_PUBLISH_PROFILE_API',
    'AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON': 'AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON',
    'AZURE_WEBAPP_PUBLISH_PROFILE_RUST': 'AZURE_WEBAPP_PUBLISH_PROFILE_RUST',
    'VITE_RAZORPAY_KEY_ID': 'VITE_RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_ID': 'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET': 'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET': 'RAZORPAY_WEBHOOK_SECRET',
}

for source_key, target_secret in mapping.items():
    value = vals.get(source_key, '').strip()
    if not value:
        print(f'SKIP {source_key} empty')
        continue

    proc = subprocess.Popen(
        ['gh', 'secret', 'set', target_secret, '--repo', REPO],
        stdin=subprocess.PIPE,
        text=True,
    )
    assert proc.stdin is not None
    proc.stdin.write(value)
    proc.stdin.close()
    rc = proc.wait()
    if rc != 0:
        raise SystemExit(f'FAILED setting {target_secret}')

    print(f'SET {target_secret} LEN={len(value)}')
