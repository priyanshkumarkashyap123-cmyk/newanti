import sys
import types
import pytest


def _install_jax_shim():
    """If real JAX is absent, install a lightweight shim to allow test
    collection to succeed and then mark PINN tests as skipped.
    The shim provides the minimal names imported by the tests so imports
    don't error during collection.
    """
    import numpy as _np

    shim = types.ModuleType("jax")
    shim.numpy = _np

    # Minimal random namespace
    class _Random:
        @staticmethod
        def PRNGKey(seed: int):
            return int(seed)

    shim.random = _Random()

    # Dummy autodiff helpers (exist so 'from jax import grad, vmap' works).
    def grad(fn):
        def _grad(*args, **kwargs):
            raise RuntimeError("jax.grad not available in this environment")
        return _grad

    def vmap(fn):
        def _vmap(*args, **kwargs):
            raise RuntimeError("jax.vmap not available in this environment")
        return _vmap

    # JIT can be identity in shim (no JAX acceleration)
    def jit(fn=None, *args, **kwargs):
        if fn is None:
            def _decorator(f):
                return f
            return _decorator
        return fn

    shim.jit = jit

    shim.grad = grad
    shim.vmap = vmap

    # Insert into sys.modules so 'import jax' succeeds
    sys.modules.setdefault("jax", shim)
    sys.modules.setdefault("jax.numpy", _np)


def pytest_configure(config):
    try:
        import jax as _jax  # pragma: no cover
        config._beamlab_jax_available = True
    except Exception:
        _install_jax_shim()
        config._beamlab_jax_available = False


def pytest_collection_modifyitems(config, items):
    """Skip all tests under the pinn_solver tests directory when real
    JAX is not available — they are expensive/optional and the CI/test
    environment may not include them.
    """
    if getattr(config, "_beamlab_jax_available", False):
        return

    skip_marker = pytest.mark.skip(reason="JAX not installed — skipping PINN tests")
    for item in items:
        if "pinn_solver" in str(item.fspath):
            item.add_marker(skip_marker)
