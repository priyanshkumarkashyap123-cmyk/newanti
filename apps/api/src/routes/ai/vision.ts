/**
 * Vision API Route
 * 
 * POST /api/ai/vision - Process image with Gemini Vision for sketch recognition
 */

import { Router, Request, Response, type IRouter } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router: IRouter = Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * POST /api/ai/vision
 * Process image with Gemini Vision
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { image, prompt, mimeType = 'image/png' } = req.body;

        if (!image || !prompt) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: image, prompt'
            });
        }

        // Use Gemini Pro Vision
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const imagePart = {
            inlineData: {
                data: image.replace(/^data:image\/\w+;base64,/, ''),
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log('[Vision API] Processed image successfully');

        return res.json({
            success: true,
            response: text
        });

    } catch (error) {
        console.error('[Vision API] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Vision processing failed'
        });
    }
});

export default router;
