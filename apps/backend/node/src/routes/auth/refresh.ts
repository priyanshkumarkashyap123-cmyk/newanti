import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { validateBody } from '../../middleware/validation.js';
import { z } from 'zod';
import { RefreshTokenModel, UserModel } from '../../models/index.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';

const router: Router = Router();
const JWT_SECRET = process.env['JWT_SECRET'] || 'default-beamlab-jwt-secret-please-set-in-production';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'default-beamlab-refresh-secret-please-set-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';

const generateAccessToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });

router.post('/', validateBody(refreshTokenSchema), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };

  const stored = await RefreshTokenModel.findOne({ token: refreshToken });
  if (!stored) throw new HttpError(401, 'Invalid refresh token');

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    const user = await UserModel.findById(decoded.userId);
    if (!user) throw new HttpError(401, 'Invalid refresh token');

    const accessToken = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role });
    res.json({ accessToken });
  } catch {
    throw new HttpError(401, 'Invalid refresh token');
  }
}));

export default router;