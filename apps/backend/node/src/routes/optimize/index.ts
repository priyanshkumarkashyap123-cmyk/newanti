import { Router } from 'express';
import { proxyRequest } from '../../services/serviceProxy.js';
import { env } from '../../config/env.js';

const router: Router = Router();

/**
 * Unified optimization endpoint: selects best section per code.
 * Queries Python backend SectionOptimizer or Rust FSD engine.
 * Expects JSON body: { code: string, shape: string, params: object, forces: object }
 */
router.post('/', async (req, res) => {
  const { code, shape, params, forces } = req.body;
  if (!code || !shape || !params || !forces) {
    return res.status(400).json({ error: 'Missing required fields: code, shape, params, forces' });
  }

  try {
    const backend = env.OPTIMIZATION_BACKEND || 'python';
    const service = backend === 'rust' ? 'rust' : 'python';
    const proxyRes = await proxyRequest({
      service,
      method: 'POST',
      path: '/optimize/section',
      body: { code, shape, params, forces },
      timeoutMs: 120000,
    });

    if (!proxyRes.success) {
      return res.status(proxyRes.status).json({ error: proxyRes.error });
    }
    res.json(proxyRes.data);
  } catch (err) {
    console.error('Optimization error:', err);
    res.status(500).json({ error: 'Optimization failed' });
  }
});

export default router;