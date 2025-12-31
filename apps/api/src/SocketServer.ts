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

export class SocketServer {
    private io: SocketIOServer;
    private users: Map<string, User> = new Map();
    private projects: Map<string, ProjectState> = new Map();
    private colorIndex: number = 0;

    constructor(httpServer: HTTPServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: [
                    'http://localhost:5173',
                    'http://localhost:3000',
                    'https://beamlabultimate.tech',
                    'https://www.beamlabultimate.tech',
                    'https://brave-mushroom-0eae8ec00.4.azurestaticapps.net'
                ],
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingInterval: 10000,
            pingTimeout: 5000
        });

        this.setupEventHandlers();
        console.log('🔌 Socket.IO server initialized');
    }

    /**
     * Setup socket event handlers
     */
    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`👤 User connected: ${socket.id}`);

            // Create user with assigned color
            const user: User = {
                id: socket.id,
                socketId: socket.id,
                name: `User ${this.users.size + 1}`,
                color: this.getNextColor(),
                projectId: null,
                lastActivity: new Date()
            };
            this.users.set(socket.id, user);

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

            socket.on('update_node', (data: NodeUpdate) => {
                this.handleNodeUpdate(socket, data);
            });

            socket.on('delete_node', (data: { nodeId: string; userId: string }) => {
                this.handleDeleteNode(socket, data);
            });

            socket.on('update_member', (data: MemberUpdate) => {
                this.handleMemberUpdate(socket, data);
            });

            socket.on('delete_member', (data: { memberId: string; userId: string }) => {
                this.handleDeleteMember(socket, data);
            });

            socket.on('update_load', (data: LoadUpdate) => {
                this.handleLoadUpdate(socket, data);
            });

            socket.on('delete_load', (data: { loadId: string; userId: string }) => {
                this.handleDeleteLoad(socket, data);
            });

            // ========================================
            // CURSOR TRACKING
            // ========================================

            socket.on('cursor_move', (data: CursorPosition) => {
                this.handleCursorMove(socket, data);
            });

            // ========================================
            // ANALYSIS EVENTS
            // ========================================

            socket.on('analysis_started', (data: { userId: string }) => {
                const user = this.users.get(socket.id);
                if (user?.projectId) {
                    socket.to(user.projectId).emit('analysis_started', {
                        userId: data.userId,
                        userName: user.name
                    });
                }
            });

            socket.on('analysis_complete', (data: { results: any; userId: string }) => {
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

        console.log(`📂 ${user.name} joined project: ${data.projectId}`);
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

        console.log(`📍 Node ${data.nodeId} updated by ${user.name}`);
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

        console.log(`🔗 Member ${data.memberId} updated by ${user.name}`);
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

        if (user) {
            if (user.projectId) {
                const project = this.projects.get(user.projectId);
                if (project) {
                    project.users.delete(user.id);
                }
                this.broadcastUserLeft(socket, user.projectId, user);
            }
            this.users.delete(socket.id);
            console.log(`👋 User disconnected: ${user.name}`);
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
}

export default SocketServer;
