import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { validateBody } from '../../middleware/validation.js';
import { verifyEmailSchema } from '../../middleware/validation.js';
import { VerificationCodeModel, UserModel } from '../../models/index.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const router: ExpressRouter = Router();

router.post('/', validateBody(verifyEmailSchema), asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new HttpError(404, 'User not found');

  const record = await VerificationCodeModel.findOne({ userId: user._id, code, type: 'email' });
  if (!record) throw new HttpError(400, 'Invalid code');

  user.emailVerified = true;
  await user.save();
  await VerificationCodeModel.deleteMany({ userId: user._id, type: 'email' });

  res.json({ ok: true });
}));

export default router;