/**
 * useMultiplayer - Real-Time Collaboration Hook
 * 
 * Manages socket.io connection for real-time collaboration:
 * - Project room management
 * - Optimistic UI updates
 * - Cursor synchronization
 * - User presence
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// ============================================
// TYPES
// ============================================

export interface RemoteUser {
    id: string;
    name: string;
    color: string;
    cursor?: {
        x: number;
        y: number;
        z: number;
        screenX?: number;
        screenY?: number;
    } | undefined;
    isActive: boolean;
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
}

export interface MemberUpdate {
    memberId: string;
    startNodeId?: string;
    endNodeId?: string;
    sectionId?: string;
    E?: number;
    A?: number;
    I?: number;
}

export interface ServerUpdate {
    type: 'node_update' | 'node_delete' | 'member_update' | 'member_delete' | 'load_update' | 'load_delete';
    data: any;
    version?: number;
}

export interface MultiplayerConfig {
    serverUrl?: string;
    projectId: string;
    userName?: string;
    onServerUpdate?: (update: ServerUpdate) => void;
    onUserJoined?: (user: RemoteUser) => void;
    onUserLeft?: (userId: string) => void;
    onCursorUpdate?: (userId: string, cursor: RemoteUser['cursor']) => void;
    onAnalysisStarted?: (userName: string) => void;
    onAnalysisComplete?: (results: any, userName: string) => void;
}

export interface MultiplayerState {
    isConnected: boolean;
    userId: string | null;
    userName: string;
    userColor: string;
    remoteUsers: Map<string, RemoteUser>;
    projectVersion: number;
}

// ============================================
// HOOK
// ============================================

export function useMultiplayer(config: MultiplayerConfig) {
    const socketRef = useRef<Socket | null>(null);
    const [state, setState] = useState<MultiplayerState>({
        isConnected: false,
        userId: null,
        userName: config.userName || 'Anonymous',
        userColor: '#3B82F6',
        remoteUsers: new Map(),
        projectVersion: 0
    });

    const serverUrl = config.serverUrl || 'http://localhost:3001';

    // ========================================
    // CONNECTION MANAGEMENT
    // ========================================

    useEffect(() => {
        // Create socket connection
        const socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current = socket;

        // Handle connection
        socket.on('connect', () => {
            console.log('🔌 Connected to multiplayer server');
            setState(prev => ({ ...prev, isConnected: true }));
        });

        // Handle initial user info
        socket.on('user_connected', (data: { userId: string; name: string; color: string }) => {
            setState(prev => ({
                ...prev,
                userId: data.userId,
                userName: data.name,
                userColor: data.color
            }));

            // Auto-join project
            if (config.projectId) {
                socket.emit('join_project', {
                    projectId: config.projectId,
                    userName: config.userName
                });
            }
        });

        // Handle project joined
        socket.on('project_joined', (data: { projectId: string; users: RemoteUser[]; version: number }) => {
            const usersMap = new Map<string, RemoteUser>();
            data.users.forEach(user => {
                if (user.id !== socketRef.current?.id) {
                    usersMap.set(user.id, { ...user, isActive: true });
                }
            });
            setState(prev => ({
                ...prev,
                remoteUsers: usersMap,
                projectVersion: data.version
            }));
            console.log(`📂 Joined project: ${data.projectId} with ${data.users.length} users`);
        });

        // Handle user joined
        socket.on('user_joined', (data: { userId: string; name: string; color: string }) => {
            const newUser: RemoteUser = {
                id: data.userId,
                name: data.name,
                color: data.color,
                isActive: true
            };
            setState(prev => {
                const newUsers = new Map(prev.remoteUsers);
                newUsers.set(data.userId, newUser);
                return { ...prev, remoteUsers: newUsers };
            });
            config.onUserJoined?.(newUser);
            console.log(`👤 ${data.name} joined`);
        });

        // Handle user left
        socket.on('user_left', (data: { userId: string; name: string }) => {
            setState(prev => {
                const newUsers = new Map(prev.remoteUsers);
                newUsers.delete(data.userId);
                return { ...prev, remoteUsers: newUsers };
            });
            config.onUserLeft?.(data.userId);
            console.log(`👋 ${data.name} left`);
        });

        // Handle server updates (node/member changes from other users)
        socket.on('server_update', (update: ServerUpdate) => {
            config.onServerUpdate?.(update);
            if (update.version) {
                setState(prev => ({ ...prev, projectVersion: update.version! }));
            }
        });

        // Handle cursor updates
        socket.on('cursor_update', (data: { userId: string; name: string; color: string; cursor: RemoteUser['cursor'] }) => {
            setState(prev => {
                const newUsers = new Map(prev.remoteUsers);
                const existing = newUsers.get(data.userId);
                if (existing) {
                    newUsers.set(data.userId, { ...existing, cursor: data.cursor });
                } else {
                    newUsers.set(data.userId, {
                        id: data.userId,
                        name: data.name,
                        color: data.color,
                        cursor: data.cursor,
                        isActive: true
                    });
                }
                return { ...prev, remoteUsers: newUsers };
            });
            config.onCursorUpdate?.(data.userId, data.cursor);
        });

        // Handle analysis events
        socket.on('analysis_started', (data: { userName: string }) => {
            config.onAnalysisStarted?.(data.userName);
        });

        socket.on('analysis_complete', (data: { results: any; userName: string }) => {
            config.onAnalysisComplete?.(data.results, data.userName);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('❌ Disconnected from multiplayer server');
            setState(prev => ({ ...prev, isConnected: false }));
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [serverUrl, config.projectId, config.userName]);

    // ========================================
    // OPTIMISTIC UPDATE HELPERS
    // ========================================

    /**
     * Update a node (optimistic UI)
     * Apply locally first, then emit to server
     */
    const updateNode = useCallback((nodeId: string, updates: Partial<NodeUpdate>) => {
        if (!socketRef.current?.connected) return;

        // Emit to server (other clients will receive via server_update)
        socketRef.current.emit('update_node', {
            nodeId,
            ...updates,
            timestamp: Date.now(),
            userId: state.userId
        });
    }, [state.userId]);

    /**
     * Delete a node
     */
    const deleteNode = useCallback((nodeId: string) => {
        if (!socketRef.current?.connected) return;

        socketRef.current.emit('delete_node', {
            nodeId,
            userId: state.userId
        });
    }, [state.userId]);

    /**
     * Update a member (optimistic UI)
     */
    const updateMember = useCallback((memberId: string, updates: Partial<MemberUpdate>) => {
        if (!socketRef.current?.connected) return;

        socketRef.current.emit('update_member', {
            memberId,
            ...updates,
            timestamp: Date.now(),
            userId: state.userId
        });
    }, [state.userId]);

    /**
     * Delete a member
     */
    const deleteMember = useCallback((memberId: string) => {
        if (!socketRef.current?.connected) return;

        socketRef.current.emit('delete_member', {
            memberId,
            userId: state.userId
        });
    }, [state.userId]);

    /**
     * Update cursor position
     */
    const updateCursor = useCallback((x: number, y: number, z: number, screenX?: number, screenY?: number) => {
        if (!socketRef.current?.connected) return;

        socketRef.current.emit('cursor_move', {
            x,
            y,
            z,
            screenX,
            screenY
        });
    }, []);

    /**
     * Notify that analysis started
     */
    const notifyAnalysisStarted = useCallback(() => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('analysis_started', { userId: state.userId });
    }, [state.userId]);

    /**
     * Notify that analysis completed
     */
    const notifyAnalysisComplete = useCallback((results: any) => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('analysis_complete', { results, userId: state.userId });
    }, [state.userId]);

    /**
     * Leave current project
     */
    const leaveProject = useCallback(() => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('leave_project');
    }, []);

    /**
     * Join a different project
     */
    const joinProject = useCallback((projectId: string) => {
        if (!socketRef.current?.connected) return;
        socketRef.current.emit('join_project', {
            projectId,
            userName: state.userName
        });
    }, [state.userName]);

    // ========================================
    // RETURN
    // ========================================

    return {
        // State
        isConnected: state.isConnected,
        userId: state.userId,
        userName: state.userName,
        userColor: state.userColor,
        remoteUsers: Array.from(state.remoteUsers.values()),
        projectVersion: state.projectVersion,

        // Actions
        updateNode,
        deleteNode,
        updateMember,
        deleteMember,
        updateCursor,
        notifyAnalysisStarted,
        notifyAnalysisComplete,
        leaveProject,
        joinProject
    };
}

export default useMultiplayer;
