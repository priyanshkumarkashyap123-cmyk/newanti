from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET


def clean(value: str) -> str:
    value = value.strip()
    if (value.startswith("'") and value.endswith("'")) or (
        value.startswith('"') and value.endswith('"')
    ):
        value = value[1:-1]
    return value


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        values[k.strip()] = clean(v)
    return values


def parse_user_pass(xml_text: str) -> tuple[str, str]:
    if not xml_text.strip():
        return "", ""
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return "", ""

    best = ("", "")
    for node in root.findall(".//publishProfile"):
        user = (node.attrib.get("userName") or "").strip()
        pwd = (node.attrib.get("userPWD") or "").strip()
        if user and pwd:
            best = (user, pwd)
            profile_name = (
                (node.attrib.get("publishMethod", "") + " " + node.attrib.get("profileName", ""))
                .lower()
                .strip()
            )
            if "zip" in profile_name or "msdeploy" in profile_name:
                return best
    return best


REPO = "priyanshkumarkashyap123-cmyk/newanti"


def set_secret(name: str, value: str) -> None:
    proc = subprocess.run(
        ["gh", "secret", "set", name, "-R", REPO],
        input=value.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Failed setting secret {name}: {proc.stdout.decode('utf-8', 'ignore')}")


def main() -> None:
    env_file = Path(".env.deploy")
    if not env_file.exists():
        raise SystemExit("Missing .env.deploy in repository root")

    vals = parse_env_file(env_file)

    secrets: dict[str, str] = {
        "AZURE_WEBAPP_PUBLISH_PROFILE_API": vals.get("AZURE_WEBAPP_PUBLISH_PROFILE_API", ""),
        "AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON": vals.get("AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON", ""),
        "AZURE_WEBAPP_PUBLISH_PROFILE_RUST": vals.get("AZURE_WEBAPP_PUBLISH_PROFILE_RUST", ""),
        # Workflows use both names; set both to the same value
        "AZURE_PUBLISH_PROFILE_RUST": vals.get("AZURE_PUBLISH_PROFILE_RUST", "")
        or vals.get("AZURE_WEBAPP_PUBLISH_PROFILE_RUST", ""),
    }

    api_user, api_pass = parse_user_pass(secrets["AZURE_WEBAPP_PUBLISH_PROFILE_API"])
    py_user, py_pass = parse_user_pass(secrets["AZURE_WEBAPP_PUBLISH_PROFILE_PYTHON"])

    if api_user and api_pass:
        secrets["AZURE_NODE_DEPLOY_USER"] = api_user
        secrets["AZURE_NODE_DEPLOY_PASS"] = api_pass
    if py_user and py_pass:
        secrets["AZURE_PY_DEPLOY_USER"] = py_user
        secrets["AZURE_PY_DEPLOY_PASS"] = py_pass

    updated = 0
    skipped = 0
    for key, value in secrets.items():
        if not value:
            skipped += 1
            continue
        set_secret(key, value)
        updated += 1

    print(f"SECRETS_UPDATED={updated}")
    print(f"SECRETS_SKIPPED_EMPTY={skipped}")


if __name__ == "__main__":
    main()
