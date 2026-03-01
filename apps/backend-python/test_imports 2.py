#!/usr/bin/env python3
"""Quick import tester for backend-python modules."""
import sys
print(f"Python: {sys.version}")
errors = []

mods = [
    ("logging_config", "setup_logging, get_logger"),
    ("models", "StructuralModel"),
    ("factory", "StructuralFactory"),
    ("security_middleware", "RateLimitMiddleware"),
    ("request_logging", "RequestLoggingMiddleware"),
    ("ai_assistant", "AIModelAssistant"),
    ("enhanced_ai_brain", "EnhancedAIBrain"),
    ("ai_architect", "EnhancedAIArchitect"),
    ("ai_power_module", "ai_power_engine"),
    ("analysis_routes", "router"),
    ("design_routes", "router"),
    ("pinn_routes", "router"),
    ("ws_routes", "router"),
    ("db_routes", "router"),
]

for mod, names in mods:
    try:
        __import__(mod)
        print(f"  OK: {mod}")
    except Exception as e:
        errors.append(f"{mod}: {type(e).__name__}: {e}")
        print(f"  FAIL: {mod} -> {e}")

print(f"\nTotal errors: {len(errors)}")
for e in errors:
    print(f"  {e}")
