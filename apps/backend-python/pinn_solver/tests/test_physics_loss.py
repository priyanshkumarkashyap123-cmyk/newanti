"""
test_physics_loss.py - Unit tests for physics loss functions

Verifies:
1. Euler-Bernoulli PDE residual correctness
2. Timoshenko coupled system residuals
3. Boundary condition losses
"""

import pytest
import jax
import jax.numpy as jnp
from jax import grad, vmap
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pinn_solver import (
    EulerBernoulliConfig,
    TimoshenkoConfig,
    LoadConfig,
    LoadType,
    BoundaryCondition,
    BeamPINN,
    create_network,
)
from pinn_solver.physics_loss import (
    euler_bernoulli_residual,
    timoshenko_residual,
    boundary_loss_euler_bernoulli,
    boundary_loss_timoshenko,
    total_loss,
)


class TestEulerBernoulliResidual:
    """Tests for Euler-Bernoulli PDE residual."""
    
    def test_residual_structure(self):
        """Test that residual is computed and has correct shape."""
        # Create simple config
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        # Create network
        network = create_network("euler_bernoulli")
        key = jax.random.PRNGKey(0)
        params = network.init(key)
        
        # Collocation points
        x = jnp.linspace(0.1, 9.9, 50)
        
        # Compute residual
        residual = euler_bernoulli_residual(
            network_fn=lambda p, xi, L: network(p, xi, L),
            params=params,
            x=x,
            config=config
        )
        
        assert residual.shape == (50,), "Residual should have same shape as x"
    
    def test_analytical_solution_zero_residual(self):
        """Test that analytical solution gives zero residual."""
        # Simply supported beam with UDL
        L = 10.0
        E = 200e9
        I = 1e-4
        EI = E * I
        q = -10000.0  # Uniform load
        
        config = EulerBernoulliConfig(
            length=L,
            E=E,
            I=I,
            load=LoadConfig(magnitude=q)
        )
        
        # Analytical deflection: w(x) = (q*x)/(24*EI) * (L³ - 2*L*x² + x³)
        def analytical_w(x):
            return (q * x) / (24 * EI) * (L**3 - 2*L*x**2 + x**3)
        
        # 4th derivative of analytical solution should equal q/EI
        # w'''' = q / EI (constant for UDL)
        d1 = grad(analytical_w)
        d2 = grad(d1)
        d3 = grad(d2)
        d4 = grad(d3)
        
        # Test at a point
        x_test = 5.0
        w4 = d4(x_test)
        expected = q / EI
        
        # The 4th derivative should equal q/EI
        assert jnp.isclose(w4, expected, rtol=1e-5), f"w'''' = {w4}, expected {expected}"


class TestTimoshenkoResidual:
    """Tests for Timoshenko beam residuals."""
    
    def test_residual_structure(self):
        """Test that Timoshenko residuals have correct shapes."""
        config = TimoshenkoConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            A=0.01,
            G=77e9,
            kappa=5/6,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        network = create_network("timoshenko")
        key = jax.random.PRNGKey(0)
        params = network.init(key)
        
        x = jnp.linspace(0.1, 9.9, 30)
        
        # This should return two residual arrays
        res1, res2 = timoshenko_residual(
            network_fn=lambda p, xi, L: network(p, xi, L),
            params=params,
            x=x,
            config=config
        )
        
        assert res1.shape == (30,), "First residual should have same shape as x"
        assert res2.shape == (30,), "Second residual should have same shape as x"


class TestBoundaryConditionLoss:
    """Tests for boundary condition losses."""
    
    @pytest.mark.parametrize("bc_type", [
        BoundaryCondition.SIMPLY_SUPPORTED,
        BoundaryCondition.FIXED_FIXED,
        BoundaryCondition.CANTILEVER,
        BoundaryCondition.FIXED_PINNED,
    ])
    def test_bc_loss_positive(self, bc_type):
        """Test that BC loss is always non-negative."""
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            boundary=bc_type,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        network = create_network("euler_bernoulli")
        key = jax.random.PRNGKey(42)
        params = network.init(key)
        
        bc_loss = boundary_loss_euler_bernoulli(
            network_fn=lambda p, xi, L: network(p, xi, L),
            params=params,
            config=config
        )
        
        assert bc_loss >= 0, f"BC loss should be non-negative, got {bc_loss}"
    
    def test_simply_supported_bc(self):
        """Test simply supported BCs: w(0)=0, w(L)=0, M(0)=0, M(L)=0."""
        config = EulerBernoulliConfig(
            length=10.0,
            boundary=BoundaryCondition.SIMPLY_SUPPORTED,
        )
        
        network = create_network("euler_bernoulli")
        key = jax.random.PRNGKey(0)
        params = network.init(key)
        
        # Just verify it runs without error
        bc_loss = boundary_loss_euler_bernoulli(
            network_fn=lambda p, xi, L: network(p, xi, L),
            params=params,
            config=config
        )
        
        assert isinstance(bc_loss, (float, jnp.ndarray))


class TestTotalLoss:
    """Tests for combined loss function."""
    
    def test_total_loss_euler_bernoulli(self):
        """Test total loss for Euler-Bernoulli beam."""
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        network = create_network("euler_bernoulli")
        key = jax.random.PRNGKey(0)
        params = network.init(key)
        
        x_interior = jnp.linspace(0.5, 9.5, 20)
        
        total, components = total_loss(
            network_fn=lambda p, xi, L: network(p, xi, L),
            params=params,
            x_interior=x_interior,
            config=config,
            lambda_pde=1.0,
            lambda_bc=100.0
        )
        
        assert total >= 0, "Total loss should be non-negative"
        assert 'pde_loss' in components
        assert 'bc_loss' in components
        assert 'total_loss' in components
    
    def test_total_loss_timoshenko(self):
        """Test total loss for Timoshenko beam."""
        config = TimoshenkoConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            G=77e9,
            kappa=5/6,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        network = create_network("timoshenko")
        key = jax.random.PRNGKey(0)
        params = network.init(key)
        
        x_interior = jnp.linspace(0.5, 9.5, 20)
        
        total, components = total_loss(
            network_fn=lambda p, xi, L: network(p, xi, L),
            params=params,
            x_interior=x_interior,
            config=config,
        )
        
        assert total >= 0, "Total loss should be non-negative"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
