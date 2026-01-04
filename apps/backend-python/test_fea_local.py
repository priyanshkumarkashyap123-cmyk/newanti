import sys
import os
import json

# Add module path
sys.path.append(os.getcwd())

from analysis.fea_engine import analyze_frame

payload = {
  "nodes": [{"id": "N1", "x": 0, "y": 0, "z": 0, "support": "pinned"}, {"id": "N2", "x": 5, "y": 0, "z": 0, "support": "roller"}],
  "members": [{"id": "M1", "startNodeId": "N1", "endNodeId": "N2", "E": 200e6, "A": 0.01}],
  "settings": {"self_weight": False}
}

print("Running analysis...")
try:
    result = analyze_frame(payload)
    print(json.dumps(result, indent=2))
except Exception as e:
    import traceback
    traceback.print_exc()
