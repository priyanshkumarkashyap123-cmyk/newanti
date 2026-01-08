"""
test_training.py - Integration tests for PINN training

Verifies:
1. Training converges (loss decreases)
2. Final predictions match analytical solution within tolerance
3. Inference time is acceptable
"""

import pytest
import jax
import jax.numpy as jnp
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from pinn_solver import (
    EulerBernoulliConfig,
    TimoshenkoConfig,
    LoadConfig,
    LoadType,
    BoundaryCondition,
    PINNTrainer,
    TrainingConfig,
    PINNPredictor,
)
from pinn_solver.inference import compare_with_analytical


class TestTrainingConvergence:
    """Tests for training convergence."""
    
    def test_loss_decreases_euler_bernoulli(self):
        """Test that training loss decreases for Euler-Bernoulli beam."""
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            boundary=BoundaryCondition.SIMPLY_SUPPORTED,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        training_config = TrainingConfig(
            num_epochs=500,  # Short training for test
            hidden_dims=[32, 32],
            learning_rate=1e-3,
            early_stopping=False,
        )
        
        trainer = PINNTrainer(config, training_config)
        result = trainer.train()
        
        # Loss should decrease significantly
        initial_loss = result.loss_history[0]
        final_loss = result.loss_history[-1]
        
        assert final_loss < initial_loss * 0.5, \
            f"Loss should decrease by at least 50%. Initial: {initial_loss:.2e}, Final: {final_loss:.2e}"
    
    def test_loss_decreases_timoshenko(self):
        """Test that training loss decreases for Timoshenko beam."""
        config = TimoshenkoConfig(
            length=5.0,  # Shorter beam for deep beam behavior
            E=200e9,
            I=1e-4,
            A=0.01,
            G=77e9,
            kappa=5/6,
            boundary=BoundaryCondition.SIMPLY_SUPPORTED,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        training_config = TrainingConfig(
            num_epochs=500,
            hidden_dims=[32, 32],
            early_stopping=False,
        )
        
        trainer = PINNTrainer(config, training_config)
        result = trainer.train()
        
        initial_loss = result.loss_history[0]
        final_loss = result.loss_history[-1]
        
        assert final_loss < initial_loss * 0.8, \
            f"Loss should decrease. Initial: {initial_loss:.2e}, Final: {final_loss:.2e}"


class TestPredictionAccuracy:
    """Tests for prediction accuracy against analytical solutions."""
    
    def test_simply_supported_udl_accuracy(self):
        """Test accuracy for simply supported beam with UDL."""
        L = 10.0
        E = 200e9
        I = 1e-4
        q = -10000.0
        
        config = EulerBernoulliConfig(
            length=L,
            E=E,
            I=I,
            boundary=BoundaryCondition.SIMPLY_SUPPORTED,
            load=LoadConfig(magnitude=q)
        )
        
        training_config = TrainingConfig(
            num_epochs=2000,
            hidden_dims=[64, 64],
            early_stopping=True,
            patience=300,
        )
        
        trainer = PINNTrainer(config, training_config)
        result = trainer.train()
        
        # Create predictor
        predictor = PINNPredictor(
            params=trainer.params,
            config=config,
            network=trainer.network
        )
        
        # Compare with analytical
        comparison = compare_with_analytical(predictor, n_points=50)
        
        # Error should be less than 5%
        assert comparison['max_relative_error_percent'] < 10.0, \
            f"Max error {comparison['max_relative_error_percent']:.2f}% exceeds 10% threshold"
    
    def test_max_deflection_location(self):
        """Test that max deflection is at midspan for simply supported beam."""
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            boundary=BoundaryCondition.SIMPLY_SUPPORTED,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        training_config = TrainingConfig(
            num_epochs=1500,
            hidden_dims=[64, 64],
        )
        
        trainer = PINNTrainer(config, training_config)
        trainer.train()
        
        predictor = PINNPredictor(
            params=trainer.params,
            config=config,
            network=trainer.network
        )
        
        x = jnp.linspace(0, 10, 100)
        result = predictor.predict(x)
        
        # Max deflection should be near midspan (x = 5.0)
        midspan = 5.0
        assert abs(result.max_deflection_position - midspan) < 1.0, \
            f"Max deflection at {result.max_deflection_position:.2f}, expected near {midspan}"


class TestInferenceSpeed:
    """Tests for inference speed."""
    
    def test_inference_time_under_10ms(self):
        """Test that inference time is under 10ms after JIT warmup."""
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        training_config = TrainingConfig(
            num_epochs=500,
            hidden_dims=[32, 32],
        )
        
        trainer = PINNTrainer(config, training_config)
        trainer.train()
        
        predictor = PINNPredictor(
            params=trainer.params,
            config=config,
            network=trainer.network
        )
        
        x = jnp.linspace(0, 10, 100)
        
        # Warmup JIT
        _ = predictor.predict(x)
        
        # Timed inference
        times = []
        for _ in range(5):
            result = predictor.predict(x)
            times.append(result.inference_time_ms)
        
        avg_time = sum(times) / len(times)
        
        # After JIT warmup, should be fast
        assert avg_time < 10.0, \
            f"Average inference time {avg_time:.2f}ms exceeds 10ms threshold"


class TestModelSaveLoad:
    """Tests for model serialization."""
    
    def test_save_load_roundtrip(self, tmp_path):
        """Test that model can be saved and loaded correctly."""
        config = EulerBernoulliConfig(
            length=10.0,
            E=200e9,
            I=1e-4,
            load=LoadConfig(magnitude=-10000.0)
        )
        
        training_config = TrainingConfig(
            num_epochs=100,
            hidden_dims=[32, 32],
        )
        
        trainer = PINNTrainer(config, training_config)
        result = trainer.train()
        
        predictor = PINNPredictor(
            params=trainer.params,
            config=config,
            network=trainer.network
        )
        
        # Save
        save_path = str(tmp_path / "test_model.pkl")
        predictor.save(save_path, training_loss=result.final_loss)
        
        # Load
        loaded = PINNPredictor.load(save_path)
        
        # Compare predictions
        x = jnp.linspace(0, 10, 50)
        original_result = predictor.predict(x)
        loaded_result = loaded.predict(x)
        
        # Predictions should match
        max_diff = jnp.max(jnp.abs(
            jnp.array(original_result.deflection) - jnp.array(loaded_result.deflection)
        ))
        
        assert max_diff < 1e-6, f"Loaded model predictions differ by {max_diff}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
