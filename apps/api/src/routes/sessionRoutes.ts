/**
 * Device Session API Routes
 *
 * Manages device sessions and analysis lock for multi-device enforcement.
 *
 * Rules:
 * - Users can browse on multiple devices
 * - Only ONE device at a time can run analysis
 * - Users must explicitly release or terminate sessions to move analysis
 */

import { Router, Request, Response } from 'express';
import { requireAuth, getAuth, verifySocketToken } from '../middleware/authMiddleware.js';
import { DeviceSessionService } from '../services/DeviceSessionService.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const router: Router = Router();

// ============================================
// HELPER: Extract device info from request
// ============================================

function extractDeviceInfo(req: Request): {
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    userAgent: string;
} {
    const ua = req.headers['user-agent'] || '';
    const deviceId = (req.body?.deviceId || req.headers['x-device-id'] || '') as string;

    // Parse user agent for human-readable device name (lightweight, no deps)
    let browser = 'Browser';
    let os = 'Unknown OS';

    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    const deviceName = req.body?.deviceName || `${browser} on ${os}`;

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || '';

    return { deviceId, deviceName, ipAddress, userAgent: ua };
}

// ============================================
// POST /session/register - Register a new device session
// ============================================

router.post('/register', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId, sessionId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const deviceInfo = extractDeviceInfo(req);
    if (!deviceInfo.deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    const result = await DeviceSessionService.registerSession(
        userId,
        sessionId || 'unknown',
        deviceInfo
    );

    return res.ok(result);
}));

// ============================================
// POST /session/heartbeat - Keep session alive
// ============================================

router.post('/heartbeat', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const deviceId = (req.body?.deviceId || req.headers['x-device-id'] || '') as string;
    if (!deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    const alive = await DeviceSessionService.heartbeat(userId, deviceId);
    return res.ok({ alive });
}));

// ============================================
// POST /session/end - End current device session
// ============================================

router.post('/end', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const deviceId = (req.body?.deviceId || req.headers['x-device-id'] || '') as string;
    if (!deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    await DeviceSessionService.endSession(userId, deviceId);
    return res.ok({ ended: true });
}));

// ============================================
// POST /session/end-all - End all sessions (except current)
// ============================================

router.post('/end-all', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const exceptDeviceId = req.body?.exceptDeviceId as string | undefined;
    const count = await DeviceSessionService.endAllSessions(userId, exceptDeviceId);

    return res.ok({ terminated: count });
}));

// ============================================
// GET /session/active - Get all active sessions
// ============================================

router.get('/active', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const sessions = await DeviceSessionService.getActiveSessions(userId);
    return res.ok({ sessions });
}));

// ============================================
// GET /session/history - Get session history
// ============================================

router.get('/history', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const sessions = await DeviceSessionService.getSessionHistory(userId, limit);
    return res.ok({ sessions });
}));

// ============================================
// POST /session/analysis-lock/acquire - Acquire analysis lock
// ============================================

router.post('/analysis-lock/acquire', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const deviceId = (req.body?.deviceId || req.headers['x-device-id'] || '') as string;
    if (!deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    const result = await DeviceSessionService.acquireAnalysisLock(userId, deviceId);

    if (!result.granted) {
        return res.fail('ANALYSIS_LOCKED', result.reason, 409);
    }

    return res.ok({ granted: true });
}));

// ============================================
// POST /session/analysis-lock/release - Release analysis lock
// ============================================

router.post('/analysis-lock/release', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const deviceId = (req.body?.deviceId || req.headers['x-device-id'] || '') as string;
    if (!deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    await DeviceSessionService.releaseAnalysisLock(userId, deviceId);
    return res.ok({ released: true });
}));

// ============================================
// POST /session/analysis-lock/force-release - Force release from any device
// ============================================

router.post('/analysis-lock/force-release', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    await DeviceSessionService.forceReleaseAnalysisLock(userId);
    return res.ok({ released: true });
}));

// ============================================
// GET /session/analysis-lock/check - Check analysis lock status
// ============================================

router.get('/analysis-lock/check', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const deviceId = (req.query.deviceId || req.headers['x-device-id'] || '') as string;
    if (!deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    const result = await DeviceSessionService.canRunAnalysis(userId, deviceId);
    return res.ok(result);
}));

// ============================================
// DELETE /session/:deviceId - Terminate a specific session
// ============================================

router.delete('/:deviceId', requireAuth(), asyncHandler(async (req: Request, res: Response) => {
    const { userId } = getAuth(req);
    if (!userId) {
        throw new HttpError(401, 'Unauthorized');
    }

    const { deviceId } = req.params;
    if (!deviceId) {
        throw new HttpError(400, 'deviceId is required');
    }

    await DeviceSessionService.endSession(userId, deviceId);
    return res.ok({ terminated: true });
}));

// ============================================
// POST /session/beacon-end - End session via sendBeacon (no auth header)
//
// sendBeacon() cannot set custom headers, so this endpoint
// accepts the JWT token in the request body and verifies it
// manually. Used on page unload (beforeunload event).
// ============================================

router.post('/beacon-end', asyncHandler(async (req: Request, res: Response) => {
    const { deviceId, token } = req.body || {};
    if (!deviceId || !token) {
        throw new HttpError(400, 'deviceId and token required');
    }

    // Verify the JWT token from the body
    const payload = await verifySocketToken(token);
    if (!payload?.userId) {
        throw new HttpError(401, 'Invalid token');
    }

    await DeviceSessionService.endSession(payload.userId, deviceId);
    return res.status(200).json({ success: true });
}));

export default router;
