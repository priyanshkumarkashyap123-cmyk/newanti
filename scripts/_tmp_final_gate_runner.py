import json
import ssl
import subprocess
import time
import urllib.error
import urllib.request

REPO = "priyanshkumarkashyap123-cmyk/newanti"
WF_BACKEND = "azure-deploy.yml"
WF_FRONTEND = "azure-static-web-apps-brave-mushroom-0eae8ec00.yml"
TIMEOUT_SECONDS = 40 * 60
POLL_INTERVAL = 10
URLS = [
    "https://beamlabultimate.tech",
    "https://beamlab-backend-node.azurewebsites.net/health",
    "https://beamlab-backend-python.azurewebsites.net/health",
    "https://beamlab-rust-api.azurewebsites.net/health",
]


summary = {
    "repo": REPO,
    "workflows": {WF_BACKEND: {}, WF_FRONTEND: {}},
    "endpoint_statuses": [],
    "final_visibility": None,
    "complete": False,
    "notes": [],
}


def run_gh(args, check=True):
    p = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip() or f"gh failed: {' '.join(args)}")
    return p


def gh_visibility():
    p = run_gh(["repo", "view", REPO, "--json", "visibility", "--jq", ".visibility"])
    return (p.stdout or "").strip().upper()


def set_visibility(level):
    run_gh([
        "repo",
        "edit",
        REPO,
        "--visibility",
        level.lower(),
        "--accept-visibility-change-consequences",
    ])


def ensure_public():
    vis = gh_visibility()
    if vis != "PUBLIC":
        set_visibility("PUBLIC")
        vis = "PUBLIC"
    return vis


def latest_run_id(workflow):
    p = run_gh(
        [
            "run",
            "list",
            "--repo",
            REPO,
            "--workflow",
            workflow,
            "--limit",
            "1",
            "--json",
            "databaseId",
            "--jq",
            ".[0].databaseId",
        ]
    )
    out = (p.stdout or "").strip()
    return int(out) if out and out != "null" else None


def trigger_and_get_new_id(workflow):
    prev = latest_run_id(workflow)
    run_gh(["workflow", "run", workflow, "--repo", REPO])
    deadline = time.time() + 180
    while time.time() < deadline:
        cur = latest_run_id(workflow)
        if cur and cur != prev:
            return cur
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for run registration for {workflow}")


def run_view(run_id):
    p = run_gh(
        [
            "run",
            "view",
            str(run_id),
            "--repo",
            REPO,
            "--json",
            "databaseId,url,status,conclusion,jobs",
        ]
    )
    return json.loads((p.stdout or "{}").strip())


def failed_jobs(run_obj):
    out = []
    for job in run_obj.get("jobs", []) or []:
        jc = (job.get("conclusion") or "").lower()
        if jc == "failure":
            steps = []
            for st in job.get("steps", []) or []:
                if (st.get("conclusion") or "").lower() == "failure":
                    steps.append(st.get("name") or "(unnamed step)")
            out.append({"job": job.get("name") or "(unnamed job)", "failed_steps": steps})
    return out


def poll_until_complete(run_ids):
    start = time.time()
    latest = {}
    while True:
        done = True
        for wf, rid in run_ids.items():
            info = run_view(rid)
            latest[wf] = info
            if (info.get("status") or "").lower() != "completed":
                done = False
        if done:
            return latest, False
        if time.time() - start > TIMEOUT_SECONDS:
            return latest, True
        time.sleep(POLL_INTERVAL)


def check_endpoints():
    ctx = ssl._create_unverified_context()
    rows = []
    for url in URLS:
        status = None
        err = None
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
                status = int(r.status)
        except urllib.error.HTTPError as e:
            status = int(e.code)
        except Exception as e:
            err = str(e)
        rows.append({"url": url, "status": status, "error": err})
    return rows


try:
    summary["notes"].append(f"visibility_after_public_enforce={ensure_public()}")

    run_ids = {
        WF_BACKEND: trigger_and_get_new_id(WF_BACKEND),
        WF_FRONTEND: trigger_and_get_new_id(WF_FRONTEND),
    }
    for wf, rid in run_ids.items():
        summary["workflows"][wf]["run_id"] = rid

    run_data, timed_out = poll_until_complete(run_ids)

    if timed_out:
        for wf, info in run_data.items():
            summary["workflows"][wf].update(
                {
                    "status": info.get("status"),
                    "conclusion": info.get("conclusion"),
                    "url": info.get("url"),
                    "failed_jobs": failed_jobs(info),
                }
            )
        summary["notes"].append("Timed out waiting for completion (40 min)")
        summary["final_visibility"] = ensure_public()
        summary["complete"] = False
    else:
        any_failed = False
        for wf, info in run_data.items():
            concl = (info.get("conclusion") or "").lower()
            summary["workflows"][wf].update(
                {
                    "status": info.get("status"),
                    "conclusion": info.get("conclusion"),
                    "url": info.get("url"),
                    "failed_jobs": failed_jobs(info),
                }
            )
            if concl != "success":
                any_failed = True

        if any_failed:
            summary["notes"].append("At least one workflow failed; left/re-enforced PUBLIC")
            summary["final_visibility"] = ensure_public()
            summary["complete"] = False
        else:
            rows = check_endpoints()
            summary["endpoint_statuses"] = rows
            all_200 = all((r.get("status") == 200) for r in rows)
            if all_200:
                set_visibility("PRIVATE")
                summary["final_visibility"] = gh_visibility()
                summary["complete"] = summary["final_visibility"] == "PRIVATE"
                summary["notes"].append("All endpoints HTTP 200 and repo set PRIVATE")
            else:
                summary["final_visibility"] = ensure_public()
                summary["complete"] = False
                summary["notes"].append("Endpoint gate failed (non-200), repo kept PUBLIC")

except Exception as e:
    summary["notes"].append(f"Execution error: {e}")
    try:
        summary["final_visibility"] = ensure_public()
    except Exception as ee:
        summary["notes"].append(f"Failed enforcing PUBLIC after error: {ee}")
    summary["complete"] = False

print(json.dumps(summary, indent=2))
