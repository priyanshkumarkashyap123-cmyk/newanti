import base64
import json
import ssl
import subprocess
import urllib.request


def main() -> None:
	cmd = [
		"az",
		"webapp",
		"deployment",
		"list-publishing-credentials",
		"--resource-group",
		"beamlab-prod-rg",
		"--name",
		"beamlab-backend-python-prod",
		"-o",
		"json",
	]
	res = subprocess.run(cmd, capture_output=True, text=True)
	if res.returncode != 0:
		print("cred_error", res.stderr)
		raise SystemExit(1)

	cred = json.loads(res.stdout)
	user = cred.get("publishingUserName")
	pwd = cred.get("publishingPassword")
	scm = "https://beamlab-backend-python-prod.scm.azurewebsites.net"

	auth = base64.b64encode(f"{user}:{pwd}".encode()).decode()

	list_url = scm.rstrip("/") + "/api/vfs/LogFiles/"
	ctx = ssl._create_unverified_context()

	req = urllib.request.Request(list_url, headers={"Authorization": f"Basic {auth}"})
	with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
		entries = json.loads(r.read().decode())

	targets = []
	for item in entries:
		name = item.get("name", "")
		if name.endswith("_default_docker.log") or name.endswith("_docker.log"):
			targets.append((item.get("mtime", ""), name))

	selected = sorted(targets)[-20:]
	print("Selected log files:")
	for mtime, name in selected:
		print(mtime, name)

	for _, name in selected:
		file_url = scm.rstrip("/") + "/api/vfs/LogFiles/" + name
		req2 = urllib.request.Request(file_url, headers={"Authorization": f"Basic {auth}"})
		with urllib.request.urlopen(req2, timeout=30, context=ctx) as rr:
			text = rr.read().decode("utf-8", "replace")

		print(f"\n=== {name} ===")
		lines = text.splitlines()
		for line in lines[-500:]:
			if line.strip():
				print(line)


if __name__ == "__main__":
	main()
