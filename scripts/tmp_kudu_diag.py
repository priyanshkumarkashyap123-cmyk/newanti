import base64
import json
import ssl
import subprocess
import urllib.request
from urllib.error import HTTPError

SUB = "6eef4608-7e34-4237-834f-0e66cbd72ccd"
RG = "beamlab-prod-rg"
APP = "beamlab-backend-node-prod"

subprocess.check_call(["az", "account", "set", "--subscription", SUB])
user = subprocess.check_output([
    "az", "webapp", "deployment", "list-publishing-credentials",
    "-g", RG, "-n", APP, "--query", "publishingUserName", "-o", "tsv"
], text=True).strip()
pwd = subprocess.check_output([
    "az", "webapp", "deployment", "list-publishing-credentials",
    "-g", RG, "-n", APP, "--query", "publishingPassword", "-o", "tsv"
], text=True).strip()

ctx = ssl._create_unverified_context()
auth = "Basic " + base64.b64encode(f"{user}:{pwd}".encode()).decode()


def get(path: str) -> str:
    req = urllib.request.Request(
        f"https://{APP}.scm.azurewebsites.net/api/vfs/{path}",
        headers={"Authorization": auth},
    )
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

for folder in ["LogFiles/", "LogFiles/Application/", "LogFiles/nodejs/"]:
    print("===", folder, "===")
    try:
        print(get(folder)[:4000])
    except HTTPError as e:
        print("HTTP", e.code)
        try:
            print(e.read().decode("utf-8", "replace")[:1000])
        except Exception:
            pass
    except Exception as e:
        print("ERR", e)

# Print tail of newest docker log
try:
    entries = json.loads(get("LogFiles/"))
    docker_logs = [x for x in entries if x.get("name", "").endswith("_docker.log")]
    docker_logs.sort(key=lambda x: x.get("mtime", ""))
    if docker_logs:
        latest = docker_logs[-1]["name"]
        print("=== latest docker:", latest, "===")
        print(get(f"LogFiles/{latest}")[-8000:])
except Exception as e:
    print("ERR reading docker logs", e)
