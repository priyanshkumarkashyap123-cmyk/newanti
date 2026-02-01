import { FC, useEffect } from 'react';
import { useRealtimeCollaboration } from '../../hooks/useRealtimeCollaboration';
import { ScreenCursorsOverlay, UserPresenceBar } from '../MultiplayerCursors';

/**
 * CollaborationOverlay - Renders remote user cursors and presence bar
 * 
 * Add this component to your main layout to enable real-time collaboration.
 */
export const CollaborationOverlay: FC = () => {
    const { remoteUsers, isConnected, myId } = useRealtimeCollaboration();

    // Convert 3D cursors to screen coordinates (simplified - uses x,y directly)
    const screenCursors = remoteUsers
        .filter(u => u.cursor)
        .map(u => ({
            id: u.id,
            name: u.name,
            color: u.color,
            screenX: u.cursor?.x || 0,
            screenY: u.cursor?.y || 0
        }));

    if (!isConnected) return null;

    return (
        <>
            {/* Remote Cursors */}
            <ScreenCursorsOverlay cursors={screenCursors} />

            {/* Presence Bar (top right) */}
            <div style={{
                position: 'fixed',
                top: '16px',
                right: '16px',
                zIndex: 9998
            }}>
                <UserPresenceBar
                    users={remoteUsers}
                    currentUserName={`User ${myId.substring(0, 4)}`}
                    currentUserColor="#3B82F6"
                />
            </div>
        </>
    );
};

export default CollaborationOverlay;
