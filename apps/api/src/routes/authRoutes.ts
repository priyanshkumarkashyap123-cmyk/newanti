/**
 * authRoutes.ts - Thin aggregator delegating to modular auth subroutes.
 * Legacy mount point /api/auth/* remains unchanged.
 */

import { Router } from 'express';
import authRouter from './auth/index.js';

const router: Router = Router();

router.use('/', authRouter);

export default router;
