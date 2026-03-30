/**
 * DeviceSessionService - Manages device sessions for BeamLab Ultimate
 *
 * Core Rules:
 * 1. A user can BROWSE (view projects, dashboards) from multiple devices simultaneously.
 * 2. A user can RUN ANALYSIS from only ONE device at a time.
 * 3. To run analysis from a new device, the user must explicitly release the lock
 *    on the previous device (or let it auto-expire).
 * 4. All sessions are tracked for admin monitoring.
 *
 * Device Identification:
 * - Each device gets a unique `deviceId` (UUID generated client-side, stored in localStorage).
 * - Combined with Clerk sessionId for uniqueness.
 */

import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { DeviceSession, IDeviceSession, User, UsageLog, isMasterUser } from '../models.js';
import { UsageMonitoringService } from './UsageMonitoringService.js';
import { logger } from '../utils/logger.js';

const isConnected = () => mongoose.connection.readyState === 1;

// Session TTL: 7 days for active sessions, 24h for stale heartbeats
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HEARTBEAT_STALE_MS = 5 * 60 * 1000; // 5 minutes without heartbeat = stale
const HEARTBEAT_WRITE_MIN_INTERVAL_MS = 60 * 1000; // throttle heartbeat writes to reduce churn

// Device/session limits per tier
const DEVICE_LIMITS: Record<'free' | 'pro' | 'enterprise', number> = {
    free: 1,
    pro: 2,
    enterprise: 10,
};

// Helper: hash IP with salt for privacy
const IP_SALT = process.env['IP_HASH_SALT'] || 'beamlab-default-ip-salt';
function hashIp(ip: string): string {
    try {
        if (!ip) return '';
        return createHash('sha256').update(ip + IP_SALT).digest('hex');
    } catch {
        return '';
    }
}

export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    userAgent: string;
}

export interface SessionCheckResult {
    allowed: boolean;
    session?: IDeviceSession;
    activeSessions?: Array<{
        deviceId: string;
        deviceName: string;
        isAnalysisLocked: boolean;
        loginAt: Date;
        lastHeartbeat: Date;
    }>;
    reason?: string;
}

export interface AnalysisLockResult {
    granted: boolean;
    reason?: string;
    currentLockDevice?: {
        deviceId: string;
        deviceName: string;
        lockedSince: Date;
    };
}

export class DeviceSessionService {

    // ========================================
    // SESSION LIFECYCLE
    // ========================================

    /**
     * Register a new device session on login.
     * Allows multiple browse sessions. Does NOT auto-grant analysis lock.
     */
    static async registerSession(
        clerkId: string,
        clerkSessionId: string,
        device: DeviceInfo
    ): Promise<SessionCheckResult> {
        if (!isConnected()) return { allowed: true };

        try {
            const user = await User.findOne({ clerkId }).lean();
            if (!user) {
                return { allowed: false, reason: 'User not found' };
            }

            const effectiveTier = user ? user.tier : 'free';
            const maxDevices = DEVICE_LIMITS[effectiveTier as keyof typeof DEVICE_LIMITS] ?? DEVICE_LIMITS.free;

            // Check for existing session with same deviceId
            let session = await DeviceSession.findOne({
                clerkId,
                deviceId: device.deviceId,
                isActive: true
            });

            if (session) {
                // Update existing session
                session.clerkSessionId = clerkSessionId;
                session.ipAddress = hashIp(device.ipAddress);
                session.ipHash = hashIp(device.ipAddress);
                session.userAgent = (device.userAgent || '').slice(0, 256);
                session.lastHeartbeat = new Date();
                session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
                await session.save();
            } else {
                // Create new session
                session = await DeviceSession.create({
                    userId: user._id,
                    clerkId,
                    clerkSessionId,
                    deviceId: device.deviceId,
                    deviceName: device.deviceName,
                    ipAddress: hashIp(device.ipAddress),
                    ipHash: hashIp(device.ipAddress),
                    userAgent: (device.userAgent || '').slice(0, 256),
                    isActive: true,
                    isAnalysisLocked: false,
                    lastHeartbeat: new Date(),
                    loginAt: new Date(),
                    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
                });

                // Add to user's active devices
                await User.findByIdAndUpdate(user._id, {
                    $addToSet: { activeDevices: session._id }
                });
            }

            // Enforce device cap: if over limit, revoke oldest sessions (excluding current)
            const activeSessionsForCap = await DeviceSession.find({ clerkId, isActive: true })
                .sort({ lastHeartbeat: 1 }) // oldest first
                .lean();

            if (maxDevices !== Infinity && activeSessionsForCap.length > maxDevices) {
                const overBy = activeSessionsForCap.length - maxDevices;
                const toTerminate = activeSessionsForCap
                    .filter(s => s.deviceId !== device.deviceId) // keep current if possible
                    .slice(0, overBy);

                if (toTerminate.length > 0) {
                    const ids = toTerminate.map(s => s._id);
                    await DeviceSession.updateMany(
                        { _id: { $in: ids } },
                        { $set: { isActive: false, isAnalysisLocked: false, logoutAt: new Date() } }
                    );
                    await User.findByIdAndUpdate(user._id, {
                        $pull: { activeDevices: { $in: ids } },
                        $set: { activeAnalysisDeviceId: null }
                    });
                }
            }

            // Log the session registration
            await this.logUsage(user, clerkId, 'session_start', 'auth', {
                deviceId: device.deviceId,
                deviceName: device.deviceName,
                ipHash: hashIp(device.ipAddress)
            });

            // Increment usage counter for distinct device tracking (per-day)
            await UsageMonitoringService.bumpCounter({
                clerkId,
                email: user.email,
                deviceId: device.deviceId,
            });

            // Get all active sessions for the user
            const activeSessions = await this.getActiveSessions(clerkId);

            return {
                allowed: true,
                session,
                activeSessions
            };
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] registerSession error');
            return { allowed: true }; // Fail open
        }
    }

    /**
     * Heartbeat — keep session alive, update lastHeartbeat timestamp.
     * Called periodically from the frontend (every 60 seconds).
     */
    static async heartbeat(clerkId: string, deviceId: string): Promise<boolean> {
        if (!isConnected()) return true;

        try {
            const existing = await DeviceSession.findOne({ clerkId, deviceId, isActive: true });
            if (!existing) return false;

            const now = Date.now();
            const last = existing.lastHeartbeat ? existing.lastHeartbeat.getTime() : 0;
            if (now - last < HEARTBEAT_WRITE_MIN_INTERVAL_MS) {
                // Skip write to reduce churn
                return true;
            }

            const result = await DeviceSession.findOneAndUpdate(
                { clerkId, deviceId, isActive: true },
                {
                    $set: {
                        lastHeartbeat: new Date(),
                        expiresAt: new Date(now + SESSION_TTL_MS)
                    }
                },
                { new: true }
            );

            // Also update user's lastActiveAt
            if (result) {
                await User.findOneAndUpdate(
                    { clerkId },
                    { $set: { lastActiveAt: new Date() } }
                );
            }

            return !!result;
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] heartbeat error');
            return true;
        }
    }

    /**
     * End a specific device session (logout from device).
     */
    static async endSession(clerkId: string, deviceId: string): Promise<boolean> {
        if (!isConnected()) return true;

        try {
            const session = await DeviceSession.findOneAndUpdate(
                { clerkId, deviceId, isActive: true },
                {
                    $set: {
                        isActive: false,
                        isAnalysisLocked: false,
                        logoutAt: new Date()
                    }
                },
                { new: true }
            );

            if (session) {
                // Remove from user's active devices
                await User.findOneAndUpdate(
                    { clerkId },
                    {
                        $pull: { activeDevices: session._id },
                        // If this device held the analysis lock, clear it
                        ...(session.isAnalysisLocked ? { $set: { activeAnalysisDeviceId: null } } : {})
                    }
                );

                const user = await User.findOne({ clerkId }).lean();
                if (user) {
                    await this.logUsage(user, clerkId, 'session_end', 'auth', {
                        deviceId, deviceName: session.deviceName
                    });

                    // Update distinct device counter (no decrement, counts distinct per day)
                    await UsageMonitoringService.bumpCounter({
                        clerkId,
                        email: user.email,
                        deviceId,
                    });
                }
            }

            return true;
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] endSession error');
            return false;
        }
    }

    /**
     * End ALL active sessions for a user (force logout everywhere).
     */
    static async endAllSessions(clerkId: string, exceptDeviceId?: string): Promise<number> {
        if (!isConnected()) return 0;

        try {
            const filter: Record<string, unknown> = { clerkId, isActive: true };
            if (exceptDeviceId) {
                filter.deviceId = { $ne: exceptDeviceId };
            }

            const result = await DeviceSession.updateMany(filter, {
                $set: {
                    isActive: false,
                    isAnalysisLocked: false,
                    logoutAt: new Date()
                }
            });

            // Clear user's active devices (keep current if specified)
            if (exceptDeviceId) {
                const currentSession = await DeviceSession.findOne({
                    clerkId, deviceId: exceptDeviceId, isActive: true
                }).lean();
                await User.findOneAndUpdate(
                    { clerkId },
                    {
                        $set: {
                            activeDevices: currentSession ? [currentSession._id] : [],
                            activeAnalysisDeviceId: null
                        }
                    }
                );
            } else {
                await User.findOneAndUpdate(
                    { clerkId },
                    { $set: { activeDevices: [], activeAnalysisDeviceId: null } }
                );
            }

            return result.modifiedCount;
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] endAllSessions error');
            return 0;
        }
    }

    // ========================================
    // ANALYSIS LOCK MANAGEMENT
    // ========================================

    /**
     * Acquire the analysis lock for a specific device.
     * Only ONE device can hold this lock at a time per user.
     *
     * Returns:
     * - granted: true if lock acquired or already held by this device
     * - granted: false if another device holds the lock (returns lock info)
     */
    static async acquireAnalysisLock(clerkId: string, deviceId: string): Promise<AnalysisLockResult> {
        if (!isConnected()) return { granted: true };

        try {
            const user = await User.findOne({ clerkId }).lean();
            if (!user) return { granted: false, reason: 'User not found' };

            // Master users bypass device limits
            if (isMasterUser(user.email)) {
                return { granted: true };
            }

            // Clean up stale sessions first
            await this.cleanStaleSessions(clerkId);

            // Check if this device already has the lock
            const currentLock = await DeviceSession.findOne({
                clerkId,
                isActive: true,
                isAnalysisLocked: true
            });

            if (currentLock) {
                if (currentLock.deviceId === deviceId) {
                    // This device already has the lock — renew it
                    currentLock.lastHeartbeat = new Date();
                    await currentLock.save();
                    return { granted: true };
                }

                // Another device holds the lock
                return {
                    granted: false,
                    reason: `Analysis is currently active on another device: "${currentLock.deviceName}". Please release the analysis session on that device first, or terminate it from your active sessions.`,
                    currentLockDevice: {
                        deviceId: currentLock.deviceId,
                        deviceName: currentLock.deviceName,
                        lockedSince: currentLock.lastHeartbeat
                    }
                };
            }

            // No lock exists — grant to this device
            // Use atomic findOneAndUpdate to prevent race conditions
            const session = await DeviceSession.findOneAndUpdate(
                { clerkId, deviceId, isActive: true },
                { $set: { isAnalysisLocked: true, lastHeartbeat: new Date() } },
                { new: true }
            );

            if (!session) {
                return { granted: false, reason: 'No active session for this device. Please refresh and try again.' };
            }

            // Update user's analysis device
            await User.findOneAndUpdate(
                { clerkId },
                { $set: { activeAnalysisDeviceId: deviceId } }
            );

            await this.logUsage(user, clerkId, 'analysis_lock_acquired', 'analysis', {
                deviceId, deviceName: session.deviceName
            });

            return { granted: true };
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] acquireAnalysisLock error');
            return { granted: true }; // Fail open
        }
    }

    /**
     * Release the analysis lock from a specific device.
     */
    static async releaseAnalysisLock(clerkId: string, deviceId: string): Promise<boolean> {
        if (!isConnected()) return true;

        try {
            await DeviceSession.findOneAndUpdate(
                { clerkId, deviceId, isActive: true },
                { $set: { isAnalysisLocked: false } }
            );

            await User.findOneAndUpdate(
                { clerkId, activeAnalysisDeviceId: deviceId },
                { $set: { activeAnalysisDeviceId: null } }
            );

            return true;
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] releaseAnalysisLock error');
            return false;
        }
    }

    /**
     * Force-release the analysis lock from ANY device (used when user
     * wants to move analysis to a different device).
     */
    static async forceReleaseAnalysisLock(clerkId: string): Promise<boolean> {
        if (!isConnected()) return true;

        try {
            await DeviceSession.updateMany(
                { clerkId, isAnalysisLocked: true },
                { $set: { isAnalysisLocked: false } }
            );

            await User.findOneAndUpdate(
                { clerkId },
                { $set: { activeAnalysisDeviceId: null } }
            );

            return true;
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] forceReleaseAnalysisLock error');
            return false;
        }
    }

    /**
     * Check if a device can run analysis (without acquiring the lock).
     */
    static async canRunAnalysis(clerkId: string, deviceId: string): Promise<AnalysisLockResult> {
        if (!isConnected()) return { granted: true };

        try {
            const user = await User.findOne({ clerkId }).lean();
            if (!user) return { granted: false, reason: 'User not found' };

            if (isMasterUser(user.email)) {
                return { granted: true };
            }

            const currentLock = await DeviceSession.findOne({
                clerkId,
                isActive: true,
                isAnalysisLocked: true
            }).lean();

            if (!currentLock || currentLock.deviceId === deviceId) {
                return { granted: true };
            }

            return {
                granted: false,
                reason: `Analysis is locked to device: "${currentLock.deviceName}"`,
                currentLockDevice: {
                    deviceId: currentLock.deviceId,
                    deviceName: currentLock.deviceName,
                    lockedSince: currentLock.lastHeartbeat
                }
            };
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] canRunAnalysis error');
            return { granted: true };
        }
    }

    // ========================================
    // SESSION QUERIES
    // ========================================

    /**
     * Get all active sessions for a user.
     */
    static async getActiveSessions(clerkId: string): Promise<Array<{
        deviceId: string;
        deviceName: string;
        isAnalysisLocked: boolean;
        loginAt: Date;
        lastHeartbeat: Date;
        ipAddress: string;
    }>> {
        if (!isConnected()) return [];

        try {
            const sessions = await DeviceSession.find({
                clerkId,
                isActive: true
            }).sort({ lastHeartbeat: -1 }).lean();

            return sessions.map(s => ({
                deviceId: s.deviceId,
                deviceName: s.deviceName,
                isAnalysisLocked: s.isAnalysisLocked,
                loginAt: s.loginAt,
                lastHeartbeat: s.lastHeartbeat,
                ipAddress: s.ipAddress
            }));
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] getActiveSessions error');
            return [];
        }
    }

    /**
     * Get session history for a user (including expired/ended sessions).
     */
    static async getSessionHistory(clerkId: string, limit: number = 50): Promise<IDeviceSession[]> {
        if (!isConnected()) return [];

        try {
            return await DeviceSession.find({ clerkId })
                .sort({ loginAt: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] getSessionHistory error');
            return [];
        }
    }

    // ========================================
    // CLEANUP & MAINTENANCE
    // ========================================

    /**
     * Clean up sessions that haven't sent a heartbeat in HEARTBEAT_STALE_MS.
     */
    static async cleanStaleSessions(clerkId: string): Promise<number> {
        if (!isConnected()) return 0;

        try {
            const staleThreshold = new Date(Date.now() - HEARTBEAT_STALE_MS);

            const result = await DeviceSession.updateMany(
                {
                    clerkId,
                    isActive: true,
                    lastHeartbeat: { $lt: staleThreshold }
                },
                {
                    $set: {
                        isActive: false,
                        isAnalysisLocked: false,
                        logoutAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                // Clean up user's referenced devices
                const activeSessionIds = await DeviceSession.find(
                    { clerkId, isActive: true }
                ).distinct('_id');

                await User.findOneAndUpdate(
                    { clerkId },
                    { $set: { activeDevices: activeSessionIds } }
                );

                // Check if analysis lock was on a stale session
                const hasActiveLock = await DeviceSession.findOne({
                    clerkId, isActive: true, isAnalysisLocked: true
                }).lean();
                if (!hasActiveLock) {
                    await User.findOneAndUpdate(
                        { clerkId },
                        { $set: { activeAnalysisDeviceId: null } }
                    );
                }
            }

            return result.modifiedCount;
        } catch (error) {
            logger.error({ err: error }, '[DeviceSessionService] cleanStaleSessions error');
            return 0;
        }
    }

    // ========================================
    // USAGE LOGGING HELPER
    // ========================================

    private static async logUsage(
        user: { _id: any; email: string },
        clerkId: string,
        action: string,
        category: 'auth' | 'analysis' | 'project' | 'export' | 'report' | 'ai' | 'billing' | 'admin' | 'system',
        details?: Record<string, unknown>
    ): Promise<void> {
        try {
            await UsageLog.create({
                userId: user._id,
                clerkId,
                email: user.email,
                action,
                category,
                details,
                success: true
            });
        } catch (error) {
            // Non-critical — log and continue
            logger.error({ err: error }, '[DeviceSessionService] logUsage error');
        }
    }
}

export default DeviceSessionService;
