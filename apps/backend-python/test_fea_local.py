import sys
import os
import json

# Add current directory to path to allow imports
sys.path.append(os.getcwd())

from analysis.fea_engine import analyze_frame

def test_simple_beam_udl():
    print("Testing Simple Beam with UDL...")
    
    model = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "pinned"},
            {"id": "N2", "x": 10, "y": 0, "z": 0, "support": "roller"},
        ],
        "members": [
            {
                "id": "M1",
                "startNodeId": "N1",
                "endNodeId": "N2",
                "E": 200e6, # 200 GPa
                "G": 77e6,
                "A": 0.01,
                "Iy": 1e-4, # Strong axis
                "Iz": 1e-4,  # Weak axis
                "J": 1e-5
            }
        ],
        "distributed_loads": [
            {
                "memberId": "M1",
                "direction": "Fy", # Vertical load
                "magnitude": -10,  # 10 kN/m downwards
                "startPos": 0,
                "endPos": 1,
                "isRatio": True
            }
        ],
        "options": {
            "direct_analysis": False
        }
    }

    result = analyze_frame(model)
    
    if not result['success']:
        print(f"FAILED: {result.get('error')}")
        return

    # Check Max Results
    # WL^2/8 = 10 * 10^2 / 8 = 125 kNm
    # WL/2 = 10 * 10 / 2 = 50 kN
    
    print(f"Max Moment: {result['max_moment']:.4f} (Expected ~125.0)")
    print(f"Max Shear: {result['max_shear']:.4f} (Expected ~50.0)")
    
    # Check Diagram Data Points
    member_res = result['members'][0]
    points = len(member_res['x_values'])
    print(f"Data Points: {points}")
    print(f"Shear Y: {member_res['shear_y']}")
    print(f"Moment Z: {member_res['moment_z']}")
    
    if points < 10:
        print("ERROR: Too few data points returned!")
        return

    # Check midpoint moment (should be max)
    mid_idx = points // 2
    mid_moment = member_res['moment_z'][mid_idx]
    print(f"Mid-span Moment (Mz): {mid_moment:.4f}")
    
    # Check start shear
    start_shear = member_res['shear_y'][0]
    print(f"Start Shear (Vy): {start_shear:.4f}")

    if abs(mid_moment - 125.0) < 1.0:
        print("✅ Moment Accuracy OK")
    else:
        print("❌ Moment Accuracy FAILED")
        
    # Dump full result to file for inspection
    import json
    with open("test_results_beam.json", "w") as f:
        # Convert NumPy arrays to list if any
        class NpEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(NpEncoder, self).default(obj)
        
        json.dump(result, f, cls=NpEncoder, indent=2)
    print("Results dumped to test_results_beam.json")

def test_cantilever_point_load():
    print("\nTesting Cantilever with Point Load...")
    model = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "fixed"},
            {"id": "N2", "x": 5, "y": 0, "z": 0, "support": "none"},
        ],
        "members": [
            {
                "id": "M1",
                "startNodeId": "N1",
                "endNodeId": "N2",
                "E": 200e6,
                "A": 0.01,
                "Iy": 1e-4,
                "Iz": 1e-4
            }
        ],
        "point_loads": [
            {
                "memberId": "M1",
                "direction": "Fy",
                "magnitude": -20, # 20 kN down at tip
                "position": 1.0,
                "isRatio": True
            }
        ]
    }
    
    result = analyze_frame(model)
    if not result['success']:
        print(f"FAILED: {result.get('error')}")
        return

    # PL = 20 * 5 = 100 kNm
    # Self weight = ~9.6 kNm
    print(f"Max Moment: {result['max_moment']:.4f} (Expected ~110.0)")
    
    member_res = result['members'][0]
    # Check Moment at support (x=0)
    # PyNite conventions can vary, usually Moment is negative for Hogging?
    # Let's check magnitude
    moment_0 = member_res['moment_z'][0]
    moment_last = member_res['moment_z'][-1]
    
    print(f"Moment at start: {moment_0:.4f}")
    print(f"Moment at end: {moment_last:.4f}")
    
    if abs(abs(moment_0) - 109.6) < 1.0:
        print("✅ Cantilever Accuracy OK")
    else:
        print("❌ Cantilever Accuracy FAILED")
        
    # Dump full result to file for inspection
    import json
    with open("test_results.json", "w") as f:
        # Convert NumPy arrays to list if any
        class NpEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                return super(NpEncoder, self).default(obj)
        
        json.dump(result, f, cls=NpEncoder, indent=2)
    print("Results dumped to test_results.json")

if __name__ == "__main__":
    test_simple_beam_udl()
    test_cantilever_point_load()
