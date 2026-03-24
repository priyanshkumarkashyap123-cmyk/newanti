with open("apps/backend-python/analysis/solvers/load_solver.py", "r") as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "def calculate_member_end_forces" in line:
        print(f"Line {i}: {line.strip()}")
