"""Rust-proxy analysis endpoints split from analysis router to reduce size."""

from fastapi import APIRouter

from routers.analysis_proxies import proxy_to_rust
from routers.analysis_schemas import (
    DAMAnalysisRequest,
    InfluenceSurfaceRequest,
    MassSourceRequest,
    NonlinearSolveRequest,
    SpectrumDirectionalRequest,
    StagedConstructionRequest,
    WindTunnelRequest,
)

__all__ = [
    "router",
    "staged_construction",
    "dam_analysis",
    "nonlinear_solve",
    "mass_source",
    "wind_tunnel",
    "influence_surface",
    "spectrum_directional",
    "auto_design_optimization",
    "cracked_section_analysis",
    "floor_walking_vibration",
    "rebar_detailing_analysis",
]

router = APIRouter(tags=["Analysis"])


@router.post("/analysis/staged-construction")
async def staged_construction(req: StagedConstructionRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("staged-construction", payload)


@router.post("/analysis/dam")
async def dam_analysis(req: DAMAnalysisRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("dam", payload)


@router.post("/analysis/nonlinear-solve")
async def nonlinear_solve(req: NonlinearSolveRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("nonlinear", payload)


@router.post("/analysis/mass-source")
async def mass_source(req: MassSourceRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("mass-source", payload)


@router.post("/analysis/wind-tunnel")
async def wind_tunnel(req: WindTunnelRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("wind-tunnel", payload)


@router.post("/analysis/influence-surface")
async def influence_surface(req: InfluenceSurfaceRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("influence-surface", payload)


@router.post("/analysis/spectrum-directional")
async def spectrum_directional(req: SpectrumDirectionalRequest):
    payload = req.model_dump(mode="json")
    return await proxy_to_rust("spectrum-directional", payload)


@router.post("/analysis/auto-design")
async def auto_design_optimization(req: dict):
    return await proxy_to_rust("auto-design", req)


@router.post("/analysis/cracked-section")
async def cracked_section_analysis(req: dict):
    return await proxy_to_rust("cracked-section", req)


@router.post("/analysis/floor-walking")
async def floor_walking_vibration(req: dict):
    return await proxy_to_rust("floor-walking", req)


@router.post("/analysis/rebar-detailing")
async def rebar_detailing_analysis(req: dict):
    return await proxy_to_rust("rebar-detailing", req)
