/**
 * SocketServer - Real-Time Collaboration Server
 * 
 * Handles socket.io events for real-time collaboration:
 * - Project room management
 * - Node/Member updates
 * - Cursor tracking
 * - User presence
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifySocketToken } from './middleware/authMiddleware.js';
import { logger } from './utils/logger.js';
import { setRealtimeMetrics } from './services/realtimeMetrics.js';

// ============================================
// TYPES
// ============================================

export interface User {
    id: string;
    socketId: string;
    name: string;
    color: string;
    projectId: string | null;
    cursor?: CursorPosition;
    lastActivity: Date;
}

export interface CursorPosition {
    x: number;
    y: number;
    z: number;
    screenX?: number;
    screenY?: number;
}

export interface NodeUpdate {
    nodeId: string;
    x?: number;
    y?: number;
    z?: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
    timestamp: number;
    userId: string;
}

export interface MemberUpdate {
    memberId: string;
    startNodeId?: string;
    endNodeId?: string;
    sectionId?: string;
    E?: number;
    A?: number;
    I?: number;
    timestamp: number;
    userId: string;
}

export interface LoadUpdate {
    loadId: string;
    nodeId?: string;
    memberId?: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
    timestamp: number;
    userId: string;
}

export interface ProjectState {
    projectId: string;
    users: Map<string, User>;
    lastModified: Date;
    version: number;
}

export interface SocketRealtimeMetrics {
    activeSocketUsers: number;
    activeProjects: number;
}

// ============================================
// USER COLORS (for cursor nametags)
// ============================================

const USER_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange-red
];

// ============================================
// SOCKET SERVER CLASS
// ============================================

/**
 * Per-socket rate limiter — sliding window counter per event type.
 * Drops events silently if the rate exceeds the configured limit.
 */
class SocketRateLimiter {
    /** Map<socketId:eventType, { count, windowStart }> */
    private windows: Map<string, { count: number; windowStart: number }> = new Map();
    /** Limits: { eventType → maxPerSecond } */
    private limits: Record<string, number>;
    private cleanupTimer: ReturnType<typeof setInterval>;

    constructor(limits: Record<string, number>) {
        this.limits = limits;
        // Purge stale entries every 30s to prevent memory leak
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [key, val] of this.windows) {
                if (now - val.windowStart > 5000) {
                    this.windows.delete(key);
                }
            }
        }, 30_000);
        this.cleanupTimer.unref();
    }

    /** Returns true if event should be ALLOWED, false if rate-limited */
    allow(socketId: string, eventType: string): boolean {
        const limit = this.limits[eventType];
        if (limit === undefined) return true; // No limit configured

        const key = `${socketId}:${eventType}`;
        const now = Date.now();
        const entry = this.windows.get(key);

        if (!entry || now - entry.windowStart >= 1000) {
            // Start new 1-second window
            this.windows.set(key, { count: 1, windowStart: now });
            return true;
        }

        entry.count++;
        if (entry.count > limit) {
            return false; // Rate limited
        }
        return true;
    }

    /** Clean up all entries for a disconnected socket */
    removeSocket(socketId: string): void {
        for (const key of this.windows.keys()) {
            if (key.startsWith(`${socketId}:`)) {
                this.windows.delete(key);
            }
        }
    }

    /** Stop the cleanup interval (used during graceful shutdown) */
    destroy(): void {
        clearInterval(this.cleanupTimer);
    }
}

export class SocketServer {
    private io: SocketIOServer;
    private users: Map<string, User> = new Map();
    private projects: Map<string, ProjectState> = new Map();
    private colorIndex: number = 0;
    private userCounter: number = 0;
    private rateLimiter: SocketRateLimiter;

    /**
     * Per-room event buffer for reconnection sync.
     * Stores the last MAX_BUFFER_PER_ROOM events per project room,
     * each tagged with the project version at the time of broadcast.
     */
    private static readonly MAX_BUFFER_PER_ROOM = 100;
    private eventBuffers: Map<string, Array<{ version: number; event: string; data: unknown }>> = new Map();

    constructor(httpServer: HTTPServer) {
        // Per-event rate limits (events per second per socket)
        this.rateLimiter = new SocketRateLimiter({
            cursor_move: 60,       // 60 cursor updates/sec max
            update_node: 10,       // 10 structural edits/sec max
            update_member: 10,
            update_load: 10,
            delete_node: 10,
            delete_member: 10,
            delete_load: 10,
            analysis_started: 2,
            analysis_complete: 2,
        });

        // Build CORS origin list from shared config
        const allOrigins = getAllowedOrigins();

        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: allOrigins,
                methods: ['GET', 'POST'],
                credentials: true
            },
            // Prefer WebSocket over long-polling to reduce HTTP overhead per connection.
            // Clients that can't upgrade stay on polling automatically.
            transports: ['websocket', 'polling'],
            // Cap incoming message size to 1 MB — prevents memory exhaustion attacks.
            maxHttpBufferSize: 1e6,
            // Compress WebSocket frames ≥ 1 KB — measurably reduces bandwidth at 10K users.
            perMessageDeflate: {
                threshold: 1024,
            },
            pingInterval: 10000,
            pingTimeout: 5000,
        });

        // ── Authentication middleware ──
        // Verify JWT/Clerk token before accepting any WebSocket connection.
        // Clients must send the token as `auth.token` in the handshake.
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token as string | undefined;
                if (!token) {
                    return next(new Error('Authentication required: provide auth.token in handshake'));
                }
                const payload = await verifySocketToken(token);
                if (!payload) {
                    return next(new Error('Invalid or expired authentication token'));
                }
                // Attach verified userId to socket data for downstream use
                socket.data.userId = payload.userId ?? payload.sub ?? payload.id;
                next();
            } catch (err) {
                logger.error({ err }, 'Socket auth failed');
                next(new Error('Authentication failed'));
            }
        });

        this.setupEventHandlers();
        logger.info('Socket.IO server initialized (with auth middleware)');
    }

    /**
     * Push an event into the per-room circular buffer.
     * Oldest entries are evicted when the buffer exceeds MAX_BUFFER_PER_ROOM.
     */
    private bufferEvent(projectId: string, version: number, event: string, data: unknown): void {
        let buf = this.eventBuffers.get(projectId);
        if (!buf) {
            buf = [];
            this.eventBuffers.set(projectId, buf);
        }
        buf.push({ version, event, data });
        if (buf.length > SocketServer.MAX_BUFFER_PER_ROOM) {
            buf.splice(0, buf.length - SocketServer.MAX_BUFFER_PER_ROOM);
        }
    }

    /**
     * Setup socket event handlers
     */
    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            logger.info(`User connected: ${socket.id}`);

            /** Rate-limited event handler — silently drops events over the limit */
            const onLimited = <T>(event: string, handler: (data: T) => void) => {
                socket.on(event, (data: T) => {
                    if (!this.rateLimiter.allow(socket.id, event)) return;
                    handler(data);
                });
            };

            // Create user with assigned color
            const user: User = {
                id: socket.id,
                socketId: socket.id,
                name: `User ${++this.userCounter}`,
                color: this.getNextColor(),
                projectId: null,
                lastActivity: new Date()
            };
            this.users.set(socket.id, user);

            // Publish realtime metrics snapshot after any change
            try {
                setRealtimeMetrics(this.getRealtimeMetrics());
            } catch (err) {
                logger.warn({ err }, 'Failed to publish realtime metrics');
            }

            // Send initial user info
            socket.emit('user_connected', {
                userId: user.id,
                name: user.name,
                color: user.color
            });

            // ========================================
            // PROJECT ROOM EVENTS
            // ========================================

            socket.on('join_project', (data: { projectId: string; userName?: string }) => {
                this.handleJoinProject(socket, data);
            });

            socket.on('leave_project', () => {
                this.handleLeaveProject(socket);
            });

            // ========================================
            // MODEL UPDATE EVENTS
            // ========================================

            onLimited<NodeUpdate>('update_node', (data) => {
                this.handleNodeUpdate(socket, data);
            });

            onLimited<{ nodeId: string; userId: string }>('delete_node', (data) => {
                this.handleDeleteNode(socket, data);
            });

            onLimited<MemberUpdate>('update_member', (data) => {
                this.handleMemberUpdate(socket, data);
            });

            onLimited<{ memberId: string; userId: string }>('delete_member', (data) => {
                this.handleDeleteMember(socket, data);
            });

            onLimited<LoadUpdate>('update_load', (data) => {
                this.handleLoadUpdate(socket, data);
            });

            onLimited<{ loadId: string; userId: string }>('delete_load', (data) => {
                this.handleDeleteLoad(socket, data);
            });

            // ========================================
            // CURSOR TRACKING
            // ========================================

            onLimited<CursorPosition>('cursor_move', (data) => {
                this.handleCursorMove(socket, data);
            });

            // ========================================
            // ANALYSIS EVENTS
            // ========================================

            onLimited<{ userId: string }>('analysis_started', (data) => {
                const user = this.users.get(socket.id);
                if (user?.projectId) {
                    socket.to(user.projectId).emit('analysis_started', {
                        userId: data.userId,
                        userName: user.name
                    });
                }
            });

            onLimited<{ results: Record<string, unknown>; userId: string }>('analysis_complete', (data) => {
                const user = this.users.get(socket.id);
                if (user?.projectId) {
                    socket.to(user.projectId).emit('analysis_complete', {
                        results: data.results,
                        userId: data.userId,
                        userName: user.name
                    });
                }
            });

            // ========================================
            // RECONNECTION SYNC
            // ========================================

            /**
             * Client sends last known project version on reconnect.
             * Server replays buffered events since that version.
             */
            socket.on('sync', (data: { projectId: string; lastVersion: number }) => {
                const user = this.users.get(socket.id);
                if (!user?.projectId || user.projectId !== data.projectId) return;

                const buf = this.eventBuffers.get(data.projectId);
                if (!buf || buf.length === 0) {
                    socket.emit('sync_complete', { events: [], currentVersion: this.projects.get(data.projectId)?.version ?? 0 });
                    return;
                }

                const missed = buf.filter(e => e.version > data.lastVersion);
                socket.emit('sync_complete', {
                    events: missed.map(e => ({ event: e.event, data: e.data, version: e.version })),
                    currentVersion: this.projects.get(data.projectId)?.version ?? 0,
                });

                logger.info(`Sync: replayed ${missed.length} events for ${user.name} in project ${data.projectId}`);
            });

            // ========================================
            // DISCONNECT
            // ========================================

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    /**
     * Handle user joining a project room
     */
    private handleJoinProject(socket: Socket, data: { projectId: string; userName?: string }): void {
        const user = this.users.get(socket.id);
        if (!user) return;

        // Leave previous project if any
        if (user.projectId) {
            socket.leave(user.projectId);
            this.broadcastUserLeft(socket, user.projectId, user);
        }

        // Update user with project and optional name
        user.projectId = data.projectId;
        if (data.userName) {
            user.name = data.userName;
        }
        user.lastActivity = new Date();

        // Join the project room
        socket.join(data.projectId);

        // Create project state if doesn't exist
        if (!this.projects.has(data.projectId)) {
            this.projects.set(data.projectId, {
                projectId: data.projectId,
                users: new Map(),
                lastModified: new Date(),
                version: 0
            });
        }

        const project = this.projects.get(data.projectId)!;
        project.users.set(user.id, user);

        // Publish realtime metrics snapshot after project membership changes
        try {
            setRealtimeMetrics(this.getRealtimeMetrics());
        } catch (err) {
            logger.warn({ err }, 'Failed to publish realtime metrics');
        }

        // Get all users in the project
        const usersInProject = Array.from(project.users.values()).map(u => ({
            id: u.id,
            name: u.name,
            color: u.color,
            cursor: u.cursor
        }));

        // Send current users to the joining user
        socket.emit('project_joined', {
            projectId: data.projectId,
            userId: user.id,
            users: usersInProject,
            version: project.version
        });

        // Notify other users in the room
        socket.to(data.projectId).emit('user_joined', {
            userId: user.id,
            name: user.name,
            color: user.color
        });

        logger.info(`${user.name} joined project: ${data.projectId}`);
    }

    /**
     * Handle user leaving a project
     */
    private handleLeaveProject(socket: Socket): void {
        const user = this.users.get(socket.id);
        if (!user || !user.projectId) return;

        const projectId = user.projectId;
        socket.leave(projectId);

        const project = this.projects.get(projectId);
        if (project) {
            project.users.delete(user.id);
        }

        this.broadcastUserLeft(socket, projectId, user);
        user.projectId = null;

        // Publish realtime metrics snapshot after project membership changes
        try {
            setRealtimeMetrics(this.getRealtimeMetrics());
        } catch (err) {
            logger.warn({ err }, 'Failed to publish realtime metrics');
        }
    }

    /**
     * Broadcast that a user left
     */
    private broadcastUserLeft(socket: Socket, projectId: string, user: User): void {
        socket.to(projectId).emit('user_left', {
            userId: user.id,
            name: user.name
        });
    }

    /**
     * Handle node update (Last-Write-Wins)
     */
    private handleNodeUpdate(socket: Socket, data: NodeUpdate): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        // Update project version
        const project = this.projects.get(user.projectId);
        if (project) {
            project.version++;
            project.lastModified = new Date();
        }

        // Broadcast to all other clients in the room (Last-Write-Wins)
        socket.to(user.projectId).emit('server_update', {
            type: 'node_update',
            data: {
                ...data,
                userId: user.id,
                userName: user.name
            },
            version: project?.version
        });

        // Buffer for reconnection sync
        if (project) {
            this.bufferEvent(user.projectId, project.version, 'server_update', {
                type: 'node_update',
                data: { ...data, userId: user.id, userName: user.name },
                version: project.version,
            });
        }

        logger.info(`Node ${data.nodeId} updated by ${user.name}`);
    }

    /**
     * Handle node deletion
     */
    private handleDeleteNode(socket: Socket, data: { nodeId: string; userId: string }): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        socket.to(user.projectId).emit('server_update', {
            type: 'node_delete',
            data: {
                nodeId: data.nodeId,
                userId: user.id,
                userName: user.name
            }
        });
    }

    /**
     * Handle member update (Last-Write-Wins)
     */
    private handleMemberUpdate(socket: Socket, data: MemberUpdate): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        const project = this.projects.get(user.projectId);
        if (project) {
            project.version++;
            project.lastModified = new Date();
        }

        socket.to(user.projectId).emit('server_update', {
            type: 'member_update',
            data: {
                ...data,
                userId: user.id,
                userName: user.name
            },
            version: project?.version
        });

        // Buffer for reconnection sync
        if (project) {
            this.bufferEvent(user.projectId, project.version, 'server_update', {
                type: 'member_update',
                data: { ...data, userId: user.id, userName: user.name },
                version: project.version,
            });
        }

        logger.info(`Member ${data.memberId} updated by ${user.name}`);
    }

    /**
     * Handle member deletion
     */
    private handleDeleteMember(socket: Socket, data: { memberId: string; userId: string }): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        socket.to(user.projectId).emit('server_update', {
            type: 'member_delete',
            data: {
                memberId: data.memberId,
                userId: user.id,
                userName: user.name
            }
        });
    }

    /**
     * Handle load update
     */
    private handleLoadUpdate(socket: Socket, data: LoadUpdate): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        socket.to(user.projectId).emit('server_update', {
            type: 'load_update',
            data: {
                ...data,
                userId: user.id,
                userName: user.name
            }
        });
    }

    /**
     * Handle load deletion
     */
    private handleDeleteLoad(socket: Socket, data: { loadId: string; userId: string }): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        socket.to(user.projectId).emit('server_update', {
            type: 'load_delete',
            data: {
                loadId: data.loadId,
                userId: user.id,
                userName: user.name
            }
        });
    }

    /**
     * Handle cursor movement
     */
    private handleCursorMove(socket: Socket, data: CursorPosition): void {
        const user = this.users.get(socket.id);
        if (!user?.projectId) return;

        // Update user's cursor position
        user.cursor = data;
        user.lastActivity = new Date();

        // Broadcast to other users in the room
        socket.to(user.projectId).emit('cursor_update', {
            userId: user.id,
            name: user.name,
            color: user.color,
            cursor: data
        });
    }

    /**
     * Handle user disconnect
     */
    private handleDisconnect(socket: Socket): void {
        const user = this.users.get(socket.id);

        // Clean up rate limiter state for this socket
        this.rateLimiter.removeSocket(socket.id);

        if (user) {
            if (user.projectId) {
                const project = this.projects.get(user.projectId);
                if (project) {
                    project.users.delete(user.id);
                    // Clean up empty project entries to prevent unbounded Map growth
                    if (project.users.size === 0) {
                        this.projects.delete(user.projectId);
                        this.eventBuffers.delete(user.projectId);
                    }
                }
                this.broadcastUserLeft(socket, user.projectId, user);
            }
            this.users.delete(socket.id);
            logger.info(`User disconnected: ${user.name}`);
        }

        // Publish realtime metrics snapshot after disconnect
        try {
            setRealtimeMetrics(this.getRealtimeMetrics());
        } catch (err) {
            logger.warn({ err }, 'Failed to publish realtime metrics');
        }
    }

    /**
     * Get next user color (cycles through palette)
     */
    private getNextColor(): string {
        const color = USER_COLORS[this.colorIndex % USER_COLORS.length] ?? '#3B82F6';
        this.colorIndex++;
        return color;
    }

    /**
     * Get all users in a project
     */
    public getProjectUsers(projectId: string): User[] {
        const project = this.projects.get(projectId);
        if (!project) return [];
        return Array.from(project.users.values());
    }

    /**
     * Get socket.io server instance
     */
    public getIO(): SocketIOServer {
        return this.io;
    }

    /**
     * Realtime load indicators for autoscaling/monitoring.
     */
    public getRealtimeMetrics(): SocketRealtimeMetrics {
        return {
            activeSocketUsers: this.users.size,
            activeProjects: this.projects.size,
        };
    }

    /**
     * Gracefully close all socket connections and the server itself.
     * Used during shutdown to ensure clients receive disconnect events.
     */
    public close(): void {
        this.rateLimiter.destroy();
        this.io.disconnectSockets(true);
        this.io.close();
    }
}

export default SocketServer;
