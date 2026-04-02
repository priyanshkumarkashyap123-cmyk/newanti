import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateBody } from '../../middleware/validation.js';
import { signInSchema } from '../../middleware/validation.js';
import { UserModel, RefreshTokenModel } from '../../models/index.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { recordAuthFailure, resetAuthFailures } from '../../middleware/accountLockout.js';

const router: Router = Router();

const JWT_SECRET = process.env['JWT_SECRET'] || 'default-beamlab-jwt-secret-please-set-in-production';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'default-beamlab-refresh-secret-please-set-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateAccessToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (user: { id: string }): string => {
  return jwt.sign({ userId: user.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

router.post('/', validateBody(signInSchema), recordAuthFailure, asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string; rememberMe?: boolean };

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) throw new HttpError(401, 'Invalid credentials');

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new HttpError(401, 'Invalid credentials');

  resetAuthFailures(req);

  const accessToken = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ id: user._id.toString() });

  await RefreshTokenModel.create({ userId: user._id, token: refreshToken });

  res.json({ accessToken, refreshToken, user: { id: user._id.toString(), email: user.email, role: user.role } });
}));

export default router;