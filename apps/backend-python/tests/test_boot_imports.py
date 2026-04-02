import importlib
import pytest


@pytest.mark.parametrize(
    "module_name",
    [
        "main",
        "routers.analysis_router",
        "routers.sections.router",
        "analysis",
    ],
)
def test_module_imports(module_name):
    """Ensure core modules import without missing dependency errors."""
    importlib.import_module(module_name)
