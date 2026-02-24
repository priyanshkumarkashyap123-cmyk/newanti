
import sys
import os
import json

# Add apps/backend-python to path
sys.path.append(os.path.join(os.getcwd(), 'apps/backend-python'))

try:
    from analysis.model_validator import validate_model
    from analysis.fea_engine import analyze_frame
    from is_codes import check_member_is800, design_beam_flexure
    print("✅ Successfully imported all modules")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    sys.exit(1)

# 1. Test Model Internal Validation
print("\n--- Testing Model Validation ---")
bad_model = {
    "nodes": [{"id": "N1", "x": 0, "y": 0, "z": 0}], # No supports, no members
    "members": []
}
res = validate_model(bad_model)
if res['is_valid'] is False:
    print(f"✅ Validation correctly caught errors: {res['summary']}")
else:
    print("❌ Validation failed to catch errors")

# 2. Test IS 800 Steel Design
print("\n--- Testing IS 800 Steel Design ---")
try:
    steel_res = check_member_is800("ISMB400", "E250", Pu=100, Mux=50)
    print(f"✅ Steel design check ran successfully. Result keys: {steel_res.keys()}")
except Exception as e:
    print(f"❌ Steel design check failed: {e}")

# 3. Test IS 456 Concrete Design
print("\n--- Testing IS 456 Concrete Design ---")
try:
    conc_res = design_beam_flexure(b=230, D=450, cover=25, fck="M20", fy="Fe415", Mu=60)
    print(f"✅ Concrete design check ran successfully. Ast required: {conc_res.get('Ast_required', 'N/A')}")
except Exception as e:
    print(f"❌ Concrete design check failed: {e}")

print("\n--- Verification Complete ---")
