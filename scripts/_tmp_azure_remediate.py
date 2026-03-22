import re
import ssl
import subprocess
import urllib.request
from pathlib import Path

RG = "beamlab-ci-rg"
APPS = ["beamlab-backend-node", "beamlab-backend-python", "beamlab-rust-api"]
HEALTH_URLS = [
    ("https://beamlab-backend-node.azurewebsites.net/health", "beamlab-backend-node"),
    ("https://beamlab-backend-python.azurewebsites.net/health", "beamlab-backend-python"),
    ("https://beamlab-rust-api.azurewebsites.net/health", "beamlab-rust-api"),
    ("https://beamlabultimate.tech", "beamlabultimate.tech"),
]


def strip_surrounding_quotes(v: str) -> str:
    v = v.strip()
    if len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
        return v[1:-1]
    return v


def parse_env(path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = strip_surrounding_quotes(v)
    return data


def run_az(args: list[str]) -> tuple[int, str, str]:
    p = subprocess.run(args, capture_output=True, text=True)
    return p.returncode, (p.stdout or ""), (p.stderr or "")


def main() -> None:
    env_path = Path(".env.deploy")
    if not env_path.exists():
        print("APPSETTING_UPDATE beamlab-backend-node FAIL .env.deploy not found")
        print("APPSETTING_UPDATE beamlab-backend-python FAIL .env.deploy not found")
        print("APPSETTING_UPDATE beamlab-rust-api FAIL .env.deploy not found")
        return

    env = parse_env(env_path)
    settings = {
        "MONGODB_URI": strip_surrounding_quotes(env.get("MONGODB_URI") or env.get("MONGODB_URL") or ""),
        "SENTRY_DSN": strip_surrounding_quotes(env.get("SENTRY_DSN", "")),
        "INTERNAL_SERVICE_SECRET": strip_surrounding_quotes(env.get("INTERNAL_SERVICE_SECRET", "")),
        "JWT_SECRET": strip_surrounding_quotes(env.get("JWT_SECRET", "")),
    }

    for app in APPS:
        missing = [k for k, v in settings.items() if not v]
        if missing:
            print(f"APPSETTING_UPDATE {app} FAIL missing_keys={','.join(missing)}")
            continue

        cmd = [
            'az', 'webapp', 'config', 'appsettings', 'set',
            '--resource-group', RG,
            '--name', app,
            '--settings',
            *[f"{k}={v}" for k, v in settings.items()],
            '-o', 'none',
        ]
        rc, so, se = run_az(cmd)
        if rc == 0:
            print(f'APPSETTING_UPDATE {app} OK')
        else:
            err = (se.strip() or so.strip() or 'unknown error').replace('\n', ' ')
            if len(err) > 180:
                err = err[:180] + '...'
            print(f'APPSETTING_UPDATE {app} FAIL {err}')

    for app in APPS:
        run_az(['az', 'webapp', 'restart', '--resource-group', RG, '--name', app, '-o', 'none'])

    ctx = ssl._create_unverified_context()
    for url, label in HEALTH_URLS:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'health-check'})
            with urllib.request.urlopen(req, timeout=45, context=ctx) as r:
                code = r.status
                if code == 200:
                    print(f'HEALTH {label} {code}')
                else:
                    print(f'HEALTH {label} {code} non-200 response')
        except Exception as e:
            msg = str(e).replace('\n', ' ')
            if len(msg) > 180:
                msg = msg[:180] + '...'
            m = re.search(r'HTTP Error\s+(\d+)', msg, re.IGNORECASE)
            if m:
                print(f'HEALTH {label} {m.group(1)} {msg}')
            else:
                print(f'HEALTH {label} ERROR {msg}')


if __name__ == "__main__":
    main()