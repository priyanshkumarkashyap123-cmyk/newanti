import os
import sys
from pathlib import Path

# Ensure project root is on sys.path for module imports in tests
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = PROJECT_ROOT
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Also allow "analysis" and "routers" absolute imports within backend-python
os.environ.setdefault("PYTHONPATH", str(BACKEND_ROOT))
