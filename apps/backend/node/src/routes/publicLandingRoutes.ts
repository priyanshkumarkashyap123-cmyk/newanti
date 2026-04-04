import { Router, Request, Response, type IRouter } from "express";

const router: IRouter = Router();

interface LandingShowcaseCard {
  id: string;
  title: string;
  description: string;
  category: string;
  windowTitle: string;
  bgGradient: string;
  highlights: string[];
}

const LANDING_SHOWCASE_CARDS: LandingShowcaseCard[] = [
  {
    id: "modeling-3d-frame",
    title: "3D Frame Model with Loads Applied",
    description:
      "Multi-story steel frame with UDL, point loads, and supports visualized on the 3D canvas.",
    category: "Modelling",
    windowTitle: "beamlab.app/workspace — Project: G+3 Office Block",
    bgGradient: "bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950",
    highlights: ["3D Nodes/Members", "Supports", "Load Cases", "Section Assignment"],
  },
  {
    id: "analysis-diagrams",
    title: "Bending Moment & Shear Force Diagrams",
    description:
      "Color-coded SFD/BMD overlays with peak values and deflection indicators.",
    category: "Analysis Results",
    windowTitle: "beamlab.app/workspace — BMD/SFD View",
    bgGradient: "bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-950",
    highlights: ["BMD", "SFD", "Deflection", "Envelope Checks"],
  },
  {
    id: "steel-design",
    title: "Steel Section Design Check Results",
    description:
      "IS 800 / AISC checks with utilization, governing clauses, and optimization cues.",
    category: "Design",
    windowTitle: "beamlab.app/design-hub — Steel Design Checks",
    bgGradient: "bg-gradient-to-br from-emerald-900 via-slate-900 to-teal-950",
    highlights: ["Utilization", "Pass/Fail", "Governing Clause", "Optimization Hint"],
  },
  {
    id: "rcc-detailing",
    title: "RCC Detailing Drawing — Beam Section",
    description:
      "Automated detailing with rebar layout, stirrup spacing, cover, and section dimensions.",
    category: "Detailing",
    windowTitle: "beamlab.app/design/detailing — RCC Beam B1",
    bgGradient: "bg-gradient-to-br from-amber-900 via-slate-900 to-orange-950",
    highlights: ["Bar Layout", "Stirrups", "Cover", "Drawing Export"],
  },
];

router.get("/landing-showcase", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      cards: LANDING_SHOWCASE_CARDS,
      updatedAt: new Date().toISOString(),
    },
  });
});

export default router;
