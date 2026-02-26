/**
 * MultiplayerCursors - 3D Cursor Rendering for Remote Users
 * 
 * Renders other users' cursors in the 3D viewport with colored nametags.
 */

import { FC, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================
// TYPES
// ============================================

export interface RemoteUserCursor {
    id: string;
    name: string;
    color: string;
    cursor?: {
        x: number;
        y: number;
        z: number;
    };
    isActive: boolean;
}

interface MultiplayerCursorsProps {
    users: RemoteUserCursor[];
    showNametags?: boolean;
    cursorSize?: number;
}

// ============================================
// CURSOR COMPONENT
// ============================================

const UserCursor: FC<{
    user: RemoteUserCursor;
    showNametag: boolean;
    size: number;
}> = ({ user, showNametag, size }) => {
    if (!user.cursor) return null;

    const position = new THREE.Vector3(user.cursor.x, user.cursor.y, user.cursor.z);

    return (
        <group position={position}>
            {/* Cursor sphere */}
            <mesh>
                <sphereGeometry args={[size, 16, 16]} />
                <meshStandardMaterial
                    color={user.color}
                    emissive={user.color}
                    emissiveIntensity={0.5}
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* Cursor ring (pulsing effect) */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[size * 1.5, size * 2, 32]} />
                <meshBasicMaterial
                    color={user.color}
                    transparent
                    opacity={0.3}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Nametag */}
            {showNametag && (
                <Html
                    position={[0, size * 3, 0]}
                    center
                    distanceFactor={10}
                    zIndexRange={[100, 0]}
                >
                    <div
                        style={{
                            backgroundColor: user.color,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 600,
                            fontFamily: 'Inter, sans-serif',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            userSelect: 'none',
                            pointerEvents: 'none',
                            transform: 'translateY(-100%)'
                        }}
                    >
                        {user.name}
                    </div>
                </Html>
            )}
        </group>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const MultiplayerCursors: FC<MultiplayerCursorsProps> = ({
    users,
    showNametags = true,
    cursorSize = 0.15
}) => {
    // Filter users with active cursors
    const activeUsers = useMemo(() => {
        return users.filter(user => user.cursor && user.isActive);
    }, [users]);

    if (activeUsers.length === 0) return null;

    return (
        <group name="multiplayer-cursors">
            {activeUsers.map(user => (
                <UserCursor
                    key={user.id}
                    user={user}
                    showNametag={showNametags}
                    size={cursorSize}
                />
            ))}
        </group>
    );
};

// ============================================
// 2D OVERLAY CURSORS (for screen-space)
// ============================================

interface ScreenCursor {
    id: string;
    name: string;
    color: string;
    screenX: number;
    screenY: number;
}

interface ScreenCursorsOverlayProps {
    cursors: ScreenCursor[];
}

export const ScreenCursorsOverlay: FC<ScreenCursorsOverlayProps> = ({ cursors }) => {
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                zIndex: 9991
            }}
        >
            {cursors.map(cursor => (
                <div
                    key={cursor.id}
                    style={{
                        position: 'absolute',
                        left: cursor.screenX,
                        top: cursor.screenY,
                        transform: 'translate(-4px, -4px)',
                        transition: 'left 0.1s ease-out, top 0.1s ease-out'
                    }}
                >
                    {/* Cursor pointer */}
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                    >
                        <path
                            d="M5.5 3.5L19 12L12 13.5L9.5 20.5L5.5 3.5Z"
                            fill={cursor.color}
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                        />
                    </svg>

                    {/* Nametag */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: '16px',
                            backgroundColor: cursor.color,
                            padding: '2px 6px',
                            borderRadius: '3px',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'Inter, sans-serif',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            marginTop: '2px'
                        }}
                    >
                        {cursor.name}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================
// USER PRESENCE BAR
// ============================================

interface UserPresenceBarProps {
    users: RemoteUserCursor[];
    currentUserName: string;
    currentUserColor: string;
}

export const UserPresenceBar: FC<UserPresenceBarProps> = ({
    users,
    currentUserName,
    currentUserColor
}) => {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
        >
            {/* Current user */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                    style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: currentUserColor,
                        boxShadow: `0 0 0 2px rgba(255,255,255,0.3)`
                    }}
                />
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>
                    {currentUserName} (You)
                </span>
            </div>

            {/* Divider */}
            {users.length > 0 && (
                <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            )}

            {/* Remote users */}
            {users.map(user => (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                        style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: user.color,
                            opacity: user.isActive ? 1 : 0.5
                        }}
                    />
                    <span
                        style={{
                            color: user.isActive ? 'white' : 'rgba(255,255,255,0.5)',
                            fontSize: '13px',
                            fontWeight: 500
                        }}
                    >
                        {user.name}
                    </span>
                </div>
            ))}

            {/* User count badge */}
            <div
                style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    marginLeft: '4px'
                }}
            >
                {users.length + 1} online
            </div>
        </div>
    );
};

export default MultiplayerCursors;
