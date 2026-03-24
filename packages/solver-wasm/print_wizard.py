with open("apps/web/src/components/StructureWizard.tsx", "r") as f:
    lines = f.readlines()
    for i, l in enumerate(lines):
        if "STEEL" in l or "properties" in l:
            print(f"{i}: {l.strip()}")
