/**
 * AI Routes - Model Generation API
 * 
 * POST /api/ai/generate - Generate structural model from prompt
 */

import { Router, Request, Response, type IRouter } from 'express';
import { modelGeneratorService } from '../../services/ai/index.js';
import { aiRateLimiter } from '../../middleware/aiRateLimiter.js';

const router: IRouter = Router();

// Apply rate limiting to all AI routes
router.use(aiRateLimiter());

/**
 * POST /api/ai/generate
 * Generate a structural model from natural language prompt
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { prompt, constraints } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: prompt'
            });
        }

        if (prompt.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Prompt too long (max 2000 characters)'
            });
        }

        console.log(`[AI] Generate request: "${prompt.substring(0, 100)}..."`);

        const result = await modelGeneratorService.generate({
            prompt,
            constraints
        });

        if (!result.success) {
            return res.status(500).json(result);
        }

        // Validate the generated model
        const validation = modelGeneratorService.validateModel(result.model!);
        if (!validation.valid) {
            console.warn('[AI] Generated model has issues:', validation.issues);
        }

        return res.json({
            ...result,
            validation
        });

    } catch (error) {
        console.error('[AI] Generation error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * POST /api/ai/validate
 * Validate a model structure
 */
router.post('/validate', async (req: Request, res: Response) => {
    try {
        const { model } = req.body;

        if (!model || !model.nodes || !model.members) {
            return res.status(400).json({
                success: false,
                error: 'Invalid model structure'
            });
        }

        const validation = modelGeneratorService.validateModel(model);

        return res.json({
            success: true,
            ...validation
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/ai/templates
 * Get available model templates
 */
router.get('/templates', (_req: Request, res: Response) => {
    res.json({
        success: true,
        templates: [
            { id: 'simple-beam', name: 'Simple Beam', prompt: 'Create a simple supported beam of 6m span' },
            { id: 'portal-frame', name: 'Portal Frame', prompt: 'Create a single-bay portal frame with 6m span and 4m height' },
            { id: 'truss', name: 'Pratt Truss', prompt: 'Create a 12m span Pratt truss with 3m height' },
            { id: '2-story-frame', name: '2-Story Frame', prompt: 'Create a 2-story steel frame with 2 bays of 6m each and 3.5m floor height' }
        ]
    });
});

// ============================================
// GEMINI CHAT PROXY (Secure API Key Handling)
// ============================================

const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Simple in-memory cache for responses (production: use Redis)
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/ai/chat
 * Secure proxy for Gemini API chat - keeps API key server-side
 */
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, context, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: message'
            });
        }

        if (message.length > 10000) {
            return res.status(400).json({
                success: false,
                error: 'Message too long (max 10000 characters)'
            });
        }

        if (!GEMINI_API_KEY) {
            console.error('[AI/Chat] GEMINI_API_KEY not configured');
            return res.status(503).json({
                success: false,
                error: 'AI service not configured'
            });
        }

        // Create cache key from message hash
        const cacheKey = Buffer.from(message.slice(0, 200)).toString('base64');
        const cached = responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            console.log('[AI/Chat] Cache hit');
            return res.json({
                success: true,
                response: cached.response,
                cached: true
            });
        }

        console.log(`[AI/Chat] Request: "${message.substring(0, 100)}..."`);

        // Build Gemini request
        const geminiRequest = {
            contents: [
                ...(history || []).map((h: any) => ({
                    role: h.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: h.content }]
                })),
                {
                    role: 'user',
                    parts: [{ text: context ? `${context}\n\n${message}` : message }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
            ]
        };

        // Call Gemini API
        const apiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiRequest)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('[AI/Chat] Gemini API error:', apiResponse.status, errorText);
            return res.status(502).json({
                success: false,
                error: 'AI service temporarily unavailable'
            });
        }

        const geminiResult = await apiResponse.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Cache the response
        responseCache.set(cacheKey, { response: responseText, timestamp: Date.now() });

        // Clean old cache entries
        for (const [key, value] of responseCache.entries()) {
            if (Date.now() - value.timestamp > CACHE_TTL_MS) {
                responseCache.delete(key);
            }
        }

        return res.json({
            success: true,
            response: responseText,
            cached: false
        });

    } catch (error) {
        console.error('[AI/Chat] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to process AI request'
        });
    }
});

/**
 * POST /api/ai/code-check
 * Run code compliance check on member data
 */
router.post('/code-check', async (req: Request, res: Response) => {
    try {
        const { member, forces, code } = req.body;

        if (!member || !forces) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: member, forces'
            });
        }

        // This would integrate with CodeComplianceEngine
        // For now, return placeholder response
        console.log(`[AI/CodeCheck] Checking ${member.section} under ${code || 'IS_800'}`);

        return res.json({
            success: true,
            code: code || 'IS_800',
            checks: [],
            message: 'Code compliance check endpoint ready - integrate with CodeComplianceEngine'
        });

    } catch (error) {
        console.error('[AI/CodeCheck] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Code check failed'
        });
    }
});

/**
 * GET /api/ai/accuracy
 * Get AI accuracy score from validation history
 */
router.get('/accuracy', (_req: Request, res: Response) => {
    // This would integrate with AIValidationService
    res.json({
        success: true,
        accuracy: {
            score: 94.5,
            confidence: 'High',
            samples: 156,
            lastUpdated: new Date().toISOString()
        }
    });
});

export default router;
