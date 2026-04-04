/**
 * Vision API Route
 * 
 * POST /api/ai/vision - Process image with Gemini Vision for sketch recognition
 */

import { Router, Request, Response, type IRouter } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler, HttpError } from '../../utils/asyncHandler.js';
import { logger } from '../../utils/logger.js';

const router: IRouter = Router();

// All vision routes require authentication
router.use(requireAuth());

// Maximum base64 image size: 5MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * POST /api/ai/vision
 * Process image with Gemini Vision
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const { image, prompt, mimeType = 'image/png' } = req.body;

    if (!image || !prompt) {
        throw new HttpError(400, 'Missing required fields: image, prompt');
    }

    // Validate image size
    if (typeof image === 'string' && image.length > MAX_IMAGE_SIZE) {
        throw new HttpError(413, `Image too large. Maximum size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    // Use Gemini Pro Vision
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imagePart = {
        inlineData: {
            data: image.replace(/^data:image\/\w+;base64,/, ''),
            mimeType
        }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    logger.info('[Vision API] Processed image successfully');

    return res.json({
        success: true,
        response: text
    });
}));

export default router;
