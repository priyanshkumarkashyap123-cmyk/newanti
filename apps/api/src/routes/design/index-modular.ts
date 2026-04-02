/**
 * Design Routes - Main Router
 * Aggregates all design code sub-routes (steel, concrete, connections, geotech)
 *
 * Modular Structure:
 *  - steel/ → IS 800 / AISC 360 design checks
 *  - concrete/ → IS 456 / ACI 318 design checks
 *  - connections/ → Bolted, welded, moment connections
 *  - geotech/ → Foundation, slope, settlement, liquid soil checks
 *  - middleware/ → Common forwarding utilities and validation
 */

import { Router, type IRouter } from "express";
import steelRoutes from "./steel/index.js";
import concreteRoutes from "./concrete/index.js";
import connectionRoutes from "./connections/index.js";
import geotechRoutes from "./geotech/index.js";
import legacyCompatRoutes from "./legacyCompat.js";

const router: IRouter = Router();

/**
 * Design Code Sub-routers
 * Each handles its domain (material/standard) independently
 */

// Steel Design (IS 800, AISC 360)
router.use("/steel", steelRoutes);

// Concrete Design (IS 456, ACI 318)
router.use("/concrete", concreteRoutes);

// Connections (bolted, welded, moment)
router.use("/connections", connectionRoutes);

// Geotechnical (foundations, slopes, settlements)
router.use("/geotech", geotechRoutes);

// Legacy endpoint compatibility layer (aliases + historical paths)
router.use("/", legacyCompatRoutes);

export default router;

/**
 * Path Pattern Reference:
 *
 * Steel:           POST /api/design/steel/{beam|column|optimize}
 * Concrete:        POST /api/design/concrete/{beam|column|slab|optimize}
 * Connections:     POST /api/design/connections/{bolted|welded|moment}
 * Geotech:         POST /api/design/geotech/{foundation|spt|bearing-capacity|slope-stability|retaining-wall|settlement|liquefaction|pile-axial}
 */
