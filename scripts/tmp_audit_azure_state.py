import json
import subprocess

CHECKS = [
    ("old", "2131a61f-38e0-40e6-a666-457c912974d1", "beamlab-ci-rg"),
    ("new", "6eef4608-7e34-4237-834f-0e66cbd72ccd", "beamlab-prod-rg"),
]

for label, sub, rg in CHECKS:
    print(f"=== {label.upper()} {rg} ===")
    subprocess.run(["az", "account", "set", "--subscription", sub], check=False)

    apps_raw = subprocess.run(
        ["az", "webapp", "list", "-g", rg, "-o", "json"],
        capture_output=True,
        text=True,
    ).stdout
    apps = json.loads(apps_raw or "[]")
    for a in apps:
        plan = (a.get("serverFarmId") or "").split("/")[-1]
        print("WEBAPP", a.get("name"), "state", a.get("state"), "plan", plan)

    plans_raw = subprocess.run(
        ["az", "appservice", "plan", "list", "-g", rg, "-o", "json"],
        capture_output=True,
        text=True,
    ).stdout
    plans = json.loads(plans_raw or "[]")
    for p in plans:
        sku = p.get("sku") or {}
        print(
            "PLAN",
            p.get("name"),
            "tier",
            sku.get("tier"),
            "sku",
            sku.get("name"),
            "workers",
            p.get("numberOfWorkers"),
        )

    vms_raw = subprocess.run(
        ["az", "vm", "list", "-g", rg, "-d", "-o", "json"],
        capture_output=True,
        text=True,
    ).stdout
    vms = json.loads(vms_raw or "[]")
    for v in vms:
        size = (v.get("hardwareProfile") or {}).get("vmSize")
        print("VM", v.get("name"), "power", v.get("powerState"), "size", size)

    sched_raw = subprocess.run(
        [
            "az",
            "resource",
            "list",
            "-g",
            rg,
            "--resource-type",
            "Microsoft.DevTestLab/schedules",
            "-o",
            "json",
        ],
        capture_output=True,
        text=True,
    ).stdout
    schedules = json.loads(sched_raw or "[]")
    for s in schedules:
        print("SCHEDULE", s.get("name"))
