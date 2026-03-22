import json
import ssl
import subprocess
import sys
import time
import urllib.request
import urllib.error

REPO = "priyanshkumarkashyap123-cmyk/newanti"
RUN_IDS = {
    "azure_deploy": "23402442254",
    "swa_deploy": "23402442972",
}
URLS = [
    "https://beamlab-backend-node.azurewebsites.net/health",
    "https://beamlab-backend-python.azurewebsites.net/health",
    "https://beamlab-rust-api.azurewebsites.net/health",
    "https://beamlabultimate.tech",
]
POLL_INTERVAL_SEC = 15
TIMEOUT_SEC = 1800


def run_cmd(args):
    p = subprocess.run(args, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def gh_run_view(run_id):
    rc, out, err = run_cmd([
        "gh", "run", "view", run_id,
        "--repo", REPO,
        "--json", "databaseId,status,conclusion,workflowName,url,jobs"
    ])
    if rc != 0:
        return None, f"gh run view failed for {run_id}: {err.strip() or out.strip()}"
    try:
        return json.loads(out), None
    except Exception as e:
        return None, f"json parse failed for {run_id}: {e}"


def summarize_failures(run_obj):
    reasons = []
    jobs = run_obj.get("jobs") or []
    for j in jobs:
        concl = (j.get("conclusion") or "").lower()
        if concl in {"failure", "cancelled", "timed_out", "action_required", "startup_failure"}:
            step_names = []
            for s in (j.get("steps") or []):
                s_concl = (s.get("conclusion") or "").lower()
                if s_concl == "failure":
                    step_names.append(s.get("name") or "<unnamed step>")
            reasons.append({
                "job": j.get("name") or "<unnamed job>",
                "job_conclusion": concl,
                "failed_steps": step_names,
            })
    return reasons


def check_url(url):
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"User-Agent": "beamlab-deploy-validator/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=ctx) as r:
            code = int(getattr(r, "status", 0) or 0)
            return {
                "url": url,
                "http_status": code,
                "ok_200": code == 200,
                "error": "",
            }
    except urllib.error.HTTPError as e:
        return {
            "url": url,
            "http_status": int(e.code),
            "ok_200": False,
            "error": f"HTTPError: {e.reason}",
        }
    except Exception as e:
        return {
            "url": url,
            "http_status": 0,
            "ok_200": False,
            "error": f"{type(e).__name__}: {e}",
        }


def get_repo_visibility():
    rc, out, err = run_cmd(["gh", "repo", "view", REPO, "--json", "visibility"])
    if rc != 0:
        return "unknown", f"gh repo view failed: {err.strip() or out.strip()}"
    try:
        return (json.loads(out).get("visibility") or "unknown").lower(), ""
    except Exception as e:
        return "unknown", f"repo visibility parse error: {e}"


def main():
    result = {
        "repo": REPO,
        "runs": {},
        "health": [],
        "repo_visibility": "unknown",
        "deployment_100_percent_complete": False,
        "stopped_before_privatize": False,
        "notes": [],
    }

    start = time.time()
    latest = {}
    while True:
        all_completed = True
        for key, rid in RUN_IDS.items():
            obj, err = gh_run_view(rid)
            if err:
                result["runs"][key] = {
                    "run_id": rid,
                    "status": "unknown",
                    "conclusion": "unknown",
                    "error": err,
                }
                all_completed = False
                continue
            latest[key] = obj
            status = (obj.get("status") or "").lower()
            conclusion = (obj.get("conclusion") or "").lower() if obj.get("conclusion") else ""
            result["runs"][key] = {
                "run_id": str(obj.get("databaseId") or rid),
                "workflow": obj.get("workflowName") or "",
                "status": status,
                "conclusion": conclusion,
                "url": obj.get("url") or "",
            }
            if status != "completed":
                all_completed = False

        if all_completed:
            break

        if time.time() - start > TIMEOUT_SEC:
            result["notes"].append("Timeout while waiting for one or both workflow runs to complete.")
            vis, verr = get_repo_visibility()
            result["repo_visibility"] = vis
            if verr:
                result["notes"].append(verr)
            print(json.dumps(result, indent=2))
            return 2

        time.sleep(POLL_INTERVAL_SEC)

    failed = []
    for key in RUN_IDS:
        concl = (result["runs"].get(key, {}).get("conclusion") or "").lower()
        if concl != "success":
            failed.append(key)

    if failed:
        for key in failed:
            run_obj = latest.get(key)
            if run_obj:
                result["runs"][key]["failure_reasons"] = summarize_failures(run_obj)
        result["stopped_before_privatize"] = True
        vis, verr = get_repo_visibility()
        result["repo_visibility"] = vis
        if verr:
            result["notes"].append(verr)
        print(json.dumps(result, indent=2))
        return 10

    for url in URLS:
        result["health"].append(check_url(url))

    all_200 = all(x.get("ok_200") for x in result["health"])

    if all_200:
        rc, out, err = run_cmd([
            "gh", "repo", "edit", REPO,
            "--visibility", "private",
            "--accept-visibility-change-consequences"
        ])
        if rc != 0:
            result["notes"].append(f"Repo privatization command failed: {err.strip() or out.strip()}")

    vis, verr = get_repo_visibility()
    result["repo_visibility"] = vis
    if verr:
        result["notes"].append(verr)

    result["deployment_100_percent_complete"] = bool(
        all((result["runs"][k].get("conclusion") == "success") for k in RUN_IDS)
        and all_200
        and result["repo_visibility"] == "private"
    )

    print(json.dumps(result, indent=2))
    return 0 if result["deployment_100_percent_complete"] else 11


if __name__ == "__main__":
    raise SystemExit(main())
