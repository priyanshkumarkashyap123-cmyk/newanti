import { useState, useEffect, useCallback } from 'react';
import { realtime, RemoteUser } from '../services/collaboration/RealtimeService';
import { RemoteUserCursor } from '../components/MultiplayerCursors';

/**
 * Hook to connect to realtime collaboration and get remote users' state.
 */
export function useRealtimeCollaboration() {
    const [remoteUsers, setRemoteUsers] = useState<RemoteUserCursor[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Connect on mount
        realtime.connect();
        setIsConnected(true);

        // Listen for updates
        const unsubscribe = realtime.on((type, data) => {
            if (type === 'users_update') {
                const users: RemoteUser[] = data;
                setRemoteUsers(users.map(u => ({
                    id: u.id,
                    name: `User ${u.id.substring(0, 4)}`,
                    color: u.color,
                    cursor: u.cursor || undefined,
                    isActive: true
                })));
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Broadcast local cursor position
    const broadcastCursor = useCallback((x: number, y: number, z: number) => {
        realtime.broadcastCursor(x, y, z);
    }, []);

    // Broadcast local selection
    const broadcastSelection = useCallback((selection: string[]) => {
        realtime.broadcastSelection(selection);
    }, []);

    return {
        remoteUsers,
        isConnected,
        broadcastCursor,
        broadcastSelection,
        myId: realtime.getMyId()
    };
}
