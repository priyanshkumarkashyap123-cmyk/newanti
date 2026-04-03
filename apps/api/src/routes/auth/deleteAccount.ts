import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, getAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { UserModel, RefreshTokenModel } from '../../models/index.js';

const router: ExpressRouter = Router();

router.delete('/', requireAuth, asyncHandler(async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');

  await RefreshTokenModel.deleteMany({ userId: auth.userId });
  const deleted = await UserModel.findByIdAndDelete(auth.userId);
  if (!deleted) throw new HttpError(404, 'User not found');

  res.json({ ok: true });
}));

export default router;