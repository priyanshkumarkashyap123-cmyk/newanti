import { Router } from 'express';
import { validateBody } from '../../middleware/validation.js';
import { verifyEmailSchema } from '../../middleware/validation.js';
import { VerificationCodeModel, UserModel } from '../../models/index.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const router = Router();

router.post('/', validateBody(verifyEmailSchema), asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new HttpError(404, 'User not found');

  const record = await VerificationCodeModel.findOne({ userId: user.id, code, purpose: 'email_verification' });
  if (!record) throw new HttpError(400, 'Invalid code');

  user.emailVerified = true;
  await user.save();
  await VerificationCodeModel.deleteMany({ userId: user.id, purpose: 'email_verification' });

  res.json({ ok: true });
}));

export default router;