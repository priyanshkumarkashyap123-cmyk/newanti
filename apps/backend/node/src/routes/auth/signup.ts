import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validateBody } from '../../middleware/validation.js';
import { signUpSchema } from '../../middleware/validation.js';
import { UserModel, VerificationCodeModel } from '../../models/index.js';
import { emailService } from '../../services/emailService.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const router: Router = Router();
const SALT_ROUNDS = 12;

const generateVerificationCode = (): string => crypto.randomInt(100000, 999999).toString();

router.post('/', validateBody(signUpSchema), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, company, phone } = req.body;
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) throw new HttpError(409, 'Email already registered');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    firstName,
    lastName,
    company,
    phone,
    role: 'user',
  });

  const code = generateVerificationCode();
  await VerificationCodeModel.create({ userId: user._id, code, type: 'email' });
  await emailService.sendVerificationEmail(user.email, user.firstName, code);

  res.status(201).json({ user: { id: user._id.toString(), email: user.email, role: user.role }, verificationRequired: true });
}));

export default router;