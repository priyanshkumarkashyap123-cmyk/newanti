"""
pinn_routes.py - FastAPI Routes for PINN Beam Solver

Endpoints:
- POST /pinn/train - Train a PINN for beam configuration
- POST /pinn/predict - Fast inference on trained model
- POST /pinn/compare - Compare PINN vs FEM results
- GET /pinn/status/{job_id} - Training job status
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uuid
import asyncio
from dataclasses import asdict

try:
    import jax.numpy as jnp
    HAS_JAX = True
except ImportError:
    jnp = None
    HAS_JAX = False

try:
    from pinn_solver import (
        EulerBernoulliConfig,
        TimoshenkoConfig,
        LoadConfig,
        BoundaryCondition,
        LoadType,
        PINNTrainer,
        TrainingConfig,
        PINNPredictor,
    )
    from pinn_solver.inference import compare_with_analytical
    HAS_PINN = True
except ImportError:
    HAS_PINN = False

router = APIRouter()

# In-memory storage for training jobs and models
# In production, use Redis or a database
training_jobs: Dict[str, Dict] = {}
trained_models: Dict[str, PINNPredictor] = {}


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class LoadConfigRequest(BaseModel):
    """Load configuration for training request."""
    load_type: str = Field(default="uniform", description="Load type: uniform, point, triangular")
    magnitude: float = Field(default=-10000.0, description="Load magnitude (N/m for distributed, N for point)")
    position: float = Field(default=0.5, description="Position for point load (0-1)")


class BeamTrainRequest(BaseModel):
    """Request to train a PINN model."""
    beam_type: str = Field(default="euler_bernoulli", description="euler_bernoulli or timoshenko")
    length: float = Field(default=10.0, ge=0.1, description="Beam length in meters")
    E: float = Field(default=200e9, gt=0, description="Young's modulus (Pa)")
    I: float = Field(default=1e-4, gt=0, description="Second moment of area (m^4)")
    A: float = Field(default=0.01, gt=0, description="Cross-section area (m^2)")
    G: Optional[float] = Field(default=77e9, description="Shear modulus (Pa) - for Timoshenko")
    kappa: Optional[float] = Field(default=0.833, description="Shear correction factor - for Timoshenko")
    load: LoadConfigRequest = Field(default_factory=LoadConfigRequest)
    boundary_conditions: str = Field(default="simply_supported", description="Boundary condition type")
    
    # Training options
    num_epochs: int = Field(default=3000, ge=100, le=20000, description="Training epochs")
    learning_rate: float = Field(default=1e-3, gt=0, description="Initial learning rate")
    hidden_layers: List[int] = Field(default=[64, 64, 64], description="Hidden layer dimensions")


class BeamPredictRequest(BaseModel):
    """Request for prediction using trained model."""
    model_id: str = Field(..., description="Trained model ID from training response")
    x_positions: Optional[List[float]] = Field(default=None, description="Positions to predict at")
    num_points: int = Field(default=100, ge=10, le=1000, description="Number of evenly spaced points")
    include_full: bool = Field(default=False, description="Include moment and shear")


class CompareRequest(BaseModel):
    """Request for PINN vs FEM comparison."""
    beam_config: BeamTrainRequest
    num_points: int = Field(default=50, description="Comparison points")


class TrainingJobResponse(BaseModel):
    """Response for training job creation."""
    job_id: str
    status: str
    message: str
    estimated_time_seconds: Optional[float] = None


class TrainingStatusResponse(BaseModel):
    """Response for training job status."""
    job_id: str
    status: str  # "pending", "training", "completed", "failed"
    progress: float  # 0.0 to 1.0
    current_epoch: Optional[int] = None
    current_loss: Optional[float] = None
    model_id: Optional[str] = None
    error: Optional[str] = None


class PredictionResponse(BaseModel):
    """Response for prediction request."""
    success: bool
    x: List[float]
    deflection: List[float]
    rotation: Optional[List[float]] = None
    moment: Optional[List[float]] = None
    shear: Optional[List[float]] = None
    max_deflection: float
    max_deflection_position: float
    inference_time_ms: float


class CompareResponse(BaseModel):
    """Response for comparison request."""
    success: bool
    pinn_max_deflection: float
    analytical_max_deflection: float
    max_error_percent: float
    mean_error_percent: float
    pinn_inference_time_ms: float
    x: List[float]
    pinn_deflection: List[float]
    analytical_deflection: List[float]


# ============================================
# HELPER FUNCTIONS
# ============================================

def create_beam_config(request: BeamTrainRequest):
    """Create beam config from request."""
    # Parse load type
    try:
        load_type = LoadType(request.load.load_type.lower())
    except ValueError:
        load_type = LoadType.UNIFORM
    
    # Parse boundary condition
    try:
        bc = BoundaryCondition(request.boundary_conditions.lower())
    except ValueError:
        bc = BoundaryCondition.SIMPLY_SUPPORTED
    
    load_config = LoadConfig(
        load_type=load_type,
        magnitude=request.load.magnitude,
        position=request.load.position,
    )
    
    if request.beam_type.lower() == "timoshenko":
        return TimoshenkoConfig(
            length=request.length,
            E=request.E,
            I=request.I,
            A=request.A,
            G=request.G or 77e9,
            kappa=request.kappa or 5/6,
            boundary=bc,
            load=load_config,
        )
    else:
        return EulerBernoulliConfig(
            length=request.length,
            E=request.E,
            I=request.I,
            A=request.A,
            boundary=bc,
            load=load_config,
        )


async def train_pinn_async(job_id: str, beam_config, training_config: TrainingConfig):
    """Background training task."""
    try:
        training_jobs[job_id]['status'] = 'training'
        
        def progress_callback(epoch, metrics):
            training_jobs[job_id]['current_epoch'] = epoch
            training_jobs[job_id]['current_loss'] = metrics.get('loss', 0)
            training_jobs[job_id]['progress'] = metrics.get('progress', 0)
        
        trainer = PINNTrainer(beam_config, training_config, progress_callback)
        
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, trainer.train)
        
        # Store trained model
        model_id = f"model_{job_id}"
        trained_models[model_id] = PINNPredictor(
            params=trainer.params,
            config=beam_config,
            network=trainer.network
        )
        
        training_jobs[job_id].update({
            'status': 'completed',
            'progress': 1.0,
            'model_id': model_id,
            'final_loss': result.final_loss,
            'training_time': result.training_time_seconds,
        })
        
    except Exception as e:
        training_jobs[job_id].update({
            'status': 'failed',
            'error': str(e)
        })


# ============================================
# ENDPOINTS
# ============================================

@router.post("/train", response_model=TrainingJobResponse)
async def train_pinn(request: BeamTrainRequest, background_tasks: BackgroundTasks):
    """
    Start training a PINN for the given beam configuration.
    
    Training runs in the background. Use GET /pinn/status/{job_id} to check progress.
    
    Returns:
        Job ID for tracking training progress
    """
    if not HAS_JAX or not HAS_PINN:
        raise HTTPException(status_code=503, detail="PINN solver not available (JAX not installed)")
    job_id = str(uuid.uuid4())[:8]
    
    # Create configurations
    beam_config = create_beam_config(request)
    training_config = TrainingConfig(
        num_epochs=request.num_epochs,
        learning_rate=request.learning_rate,
        hidden_dims=request.hidden_layers,
    )
    
    # Initialize job status
    training_jobs[job_id] = {
        'status': 'pending',
        'progress': 0.0,
        'current_epoch': 0,
        'current_loss': None,
        'model_id': None,
        'error': None,
    }
    
    # Estimate training time (rough: ~3ms per epoch on CPU)
    estimated_time = request.num_epochs * 0.003
    
    # Start background training
    background_tasks.add_task(train_pinn_async, job_id, beam_config, training_config)
    
    return TrainingJobResponse(
        job_id=job_id,
        status="pending",
        message="Training started. Use GET /pinn/status/{job_id} to check progress.",
        estimated_time_seconds=estimated_time
    )


@router.get("/status/{job_id}", response_model=TrainingStatusResponse)
async def get_training_status(job_id: str):
    """
    Get the status of a training job.
    
    Args:
        job_id: Job ID from training request
        
    Returns:
        Current training status, progress, and model_id if completed
    """
    if job_id not in training_jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    job = training_jobs[job_id]
    
    return TrainingStatusResponse(
        job_id=job_id,
        status=job['status'],
        progress=job['progress'],
        current_epoch=job.get('current_epoch'),
        current_loss=job.get('current_loss'),
        model_id=job.get('model_id'),
        error=job.get('error'),
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict_deflection(request: BeamPredictRequest):
    """
    Get deflection prediction from a trained model.
    
    Args:
        request: Model ID and prediction parameters
        
    Returns:
        Deflection values at requested positions
    """
    if not HAS_JAX or not HAS_PINN:
        raise HTTPException(status_code=503, detail="PINN solver not available (JAX not installed)")
    if request.model_id not in trained_models:
        raise HTTPException(status_code=404, detail=f"Model {request.model_id} not found")
    
    predictor = trained_models[request.model_id]
    L = predictor.config.length
    
    # Determine x positions
    if request.x_positions:
        x = jnp.array(request.x_positions)
    else:
        x = jnp.linspace(0, L, request.num_points)
    
    # Get prediction
    if request.include_full:
        result = predictor.predict_full(x)
    else:
        result = predictor.predict(x)
    
    return PredictionResponse(
        success=True,
        x=result.x,
        deflection=result.deflection,
        rotation=result.rotation,
        moment=result.moment,
        shear=result.shear,
        max_deflection=result.max_deflection,
        max_deflection_position=result.max_deflection_position,
        inference_time_ms=result.inference_time_ms,
    )


@router.post("/compare", response_model=CompareResponse)
async def compare_pinn_analytical(request: CompareRequest):
    """
    Train a PINN and compare with analytical solution.
    
    Only works for simply supported beam with uniform load.
    Useful for validating PINN accuracy.
    """
    if not HAS_JAX or not HAS_PINN:
        raise HTTPException(status_code=503, detail="PINN solver not available (JAX not installed)")
    beam_config = create_beam_config(request.beam_config)
    
    # Quick training for comparison
    training_config = TrainingConfig(
        num_epochs=2000,
        hidden_dims=[64, 64],
    )
    
    trainer = PINNTrainer(beam_config, training_config)
    
    try:
        # Synchronous training for comparison
        result = trainer.train()
        
        predictor = PINNPredictor(
            params=trainer.params,
            config=beam_config,
            network=trainer.network
        )
        
        # Compare with analytical
        comparison = compare_with_analytical(predictor, request.num_points)
        
        # Calculate max analytical deflection
        L = beam_config.length
        x_mid = L / 2
        q = beam_config.load.magnitude
        EI = beam_config.EI
        w_max_analytical = (5 * q * L**4) / (384 * EI)
        
        return CompareResponse(
            success=True,
            pinn_max_deflection=comparison['w_pinn'][len(comparison['w_pinn'])//2],
            analytical_max_deflection=w_max_analytical,
            max_error_percent=comparison['max_relative_error_percent'],
            mean_error_percent=comparison['mean_absolute_error'] / abs(w_max_analytical) * 100 if w_max_analytical != 0 else 0,
            pinn_inference_time_ms=comparison['inference_time_ms'],
            x=comparison['x'],
            pinn_deflection=comparison['w_pinn'],
            analytical_deflection=comparison['w_analytical'],
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training/comparison failed: {str(e)}")


@router.get("/models")
async def list_trained_models():
    """
    List all trained models in memory.
    
    Returns:
        List of model IDs and their configurations
    """
    models = []
    for model_id, predictor in trained_models.items():
        models.append({
            'model_id': model_id,
            'theory': predictor.theory,
            'length': predictor.config.length,
            'boundary': predictor.config.boundary.value,
        })
    
    return {'models': models, 'count': len(models)}


@router.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """
    Delete a trained model from memory.
    
    Args:
        model_id: Model ID to delete
    """
    if model_id not in trained_models:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    
    del trained_models[model_id]
    return {'success': True, 'message': f"Model {model_id} deleted"}
