# BeamLab Structural Engine - Python Backend

A FastAPI-based structural model generation service.

## Features

- **Template-based Generation**: Mathematically generates common structural configurations
- **AI-assisted Generation**: Placeholder for LLM-based structure generation
- **Model Validation**: Validates structural models for common issues

## Templates Available

| Template | Description |
|----------|-------------|
| `beam` | Simple beam (simply supported, cantilever, fixed) |
| `portal_frame` | Portal frame with pitched roof |
| `pratt_truss` | Pratt truss with compression verticals |
| `warren_truss` | Warren truss with diagonal members |
| `multi_story_frame` | Multi-story building frame |

## Installation

```bash
cd apps/backend-python
pip install -r requirements.txt

# Optional: enable JAX acceleration for PINN paths/tests (CPU)
pip install -r requirements-jax.txt
```

### PINN / JAX Behavior

- If JAX is installed, PINN tests run normally.
- If JAX is not installed, PINN tests are auto-skipped by test configuration,
  and the code falls back to NumPy-compatible behavior where supported.
- For consistent JAX-enabled CI/local runs, use Python 3.11–3.13.

## Running the Server

```bash
# Development
uvicorn main:app --reload --port 8080

# Production
python main.py
```

## API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health with available templates

### Generation
- `POST /generate/template` - Generate from template
- `POST /generate/ai` - Generate from natural language (placeholder)

### Validation
- `POST /validate` - Validate a structural model

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

## Example Usage

```bash
# Generate a portal frame
curl -X POST http://localhost:8080/generate/template \
  -H "Content-Type: application/json" \
  -d '{"type": "portal_frame", "params": {"width": 12, "height": 6, "roof_angle": 15}}'

# Generate from AI prompt
curl -X POST http://localhost:8080/generate/ai \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a 3-story building frame"}'
```
