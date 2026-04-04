import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validateBody } from '../../middleware/validation.js';
import { forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from '../../middleware/validation.js';
import { UserModel, VerificationCodeModel } from '../../models/index.js';
import { emailService } from '../../services/emailService.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { requireAuth, getAuth } from '../../middleware/authMiddleware.js';

const router: ExpressRouter = Router();
const SALT_ROUNDS = 12;

const generateVerificationCode = (): string => crypto.randomInt(100000, 999999).toString();

router.post('/forgot', validateBody(forgotPasswordSchema), asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new HttpError(404, 'User not found');

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await VerificationCodeModel.create({ userId: user._id, code, type: 'password_reset', expiresAt });
  await emailService.sendPasswordResetEmail(user.email, user.firstName ?? user.email, code);
  res.json({ ok: true });
}));

router.post('/reset', validateBody(resetPasswordSchema), asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new HttpError(404, 'User not found');

  const record = await VerificationCodeModel.findOne({ userId: user._id, code, type: 'password_reset' });
  if (!record) throw new HttpError(400, 'Invalid code');

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  (user as any).passwordHash = passwordHash;
  await user.save();
  await VerificationCodeModel.deleteMany({ userId: user._id, type: 'password_reset' });
  res.json({ ok: true });
}));

router.post('/change', requireAuth, validateBody(changePasswordSchema), asyncHandler(async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) throw new HttpError(401, 'Unauthorized');
  const { currentPassword, newPassword } = req.body;

  const user = await UserModel.findById(auth.userId);
  if (!user) throw new HttpError(404, 'User not found');
  const match = await bcrypt.compare(currentPassword, (user as any).passwordHash || '');
  if (!match) throw new HttpError(400, 'Current password incorrect');

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  (user as any).passwordHash = passwordHash;
  await user.save();
  res.json({ ok: true });
}));

export default router;