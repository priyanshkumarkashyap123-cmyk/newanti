import { Router } from 'express';
import { validateBody } from '../../middleware/validation.js';
import { updateProfileSchema } from '../../middleware/validation.js';
import { requireAuth, getAuth } from '../../middleware/authMiddleware.js';
import { UserModel } from '../../models/index.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const router = Router();

router.put('/', requireAuth, validateBody(updateProfileSchema), asyncHandler(async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');

  const { firstName, lastName, phone, company } = req.body;
  const user = await UserModel.findByIdAndUpdate(auth.userId, { firstName, lastName, phone, company }, { new: true });
  if (!user) throw new HttpError(404, 'User not found');

  res.json({ user: { id: String(user._id), email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, phone: user.phone, company: user.company } });
}));

export default router;