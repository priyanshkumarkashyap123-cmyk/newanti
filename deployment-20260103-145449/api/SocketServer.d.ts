/**
 * SocketServer - Real-Time Collaboration Server
 *
 * Handles socket.io events for real-time collaboration:
 * - Project room management
 * - Node/Member updates
 * - Cursor tracking
 * - User presence
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
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
export declare class SocketServer {
    private io;
    private users;
    private projects;
    private colorIndex;
    constructor(httpServer: HTTPServer);
    /**
     * Setup socket event handlers
     */
    private setupEventHandlers;
    /**
     * Handle user joining a project room
     */
    private handleJoinProject;
    /**
     * Handle user leaving a project
     */
    private handleLeaveProject;
    /**
     * Broadcast that a user left
     */
    private broadcastUserLeft;
    /**
     * Handle node update (Last-Write-Wins)
     */
    private handleNodeUpdate;
    /**
     * Handle node deletion
     */
    private handleDeleteNode;
    /**
     * Handle member update (Last-Write-Wins)
     */
    private handleMemberUpdate;
    /**
     * Handle member deletion
     */
    private handleDeleteMember;
    /**
     * Handle load update
     */
    private handleLoadUpdate;
    /**
     * Handle load deletion
     */
    private handleDeleteLoad;
    /**
     * Handle cursor movement
     */
    private handleCursorMove;
    /**
     * Handle user disconnect
     */
    private handleDisconnect;
    /**
     * Get next user color (cycles through palette)
     */
    private getNextColor;
    /**
     * Get all users in a project
     */
    getProjectUsers(projectId: string): User[];
    /**
     * Get socket.io server instance
     */
    getIO(): SocketIOServer;
}
export default SocketServer;
//# sourceMappingURL=SocketServer.d.ts.map