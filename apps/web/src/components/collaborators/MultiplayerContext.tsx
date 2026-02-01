import React, { createContext, useContext, ReactNode } from 'react';
import { useMultiplayer, MultiplayerConfig, RemoteUser } from '../../hooks/useMultiplayer';

// Define the context shape - remoteUsers is converted to array in the hook
interface MultiplayerContextValue {
    isConnected: boolean;
    userId: string | null;
    userName: string;
    userColor: string;
    remoteUsers: RemoteUser[]; // Array, not Map
    projectVersion: number;
    updateNode: (nodeId: string, updates: any) => void;
    deleteNode: (nodeId: string) => void;
    updateMember: (memberId: string, updates: any) => void;
    deleteMember: (memberId: string) => void;
    updateCursor: (x: number, y: number, z: number) => void;
    joinProject: (projectId: string) => void;
    leaveProject: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export const useMultiplayerContext = () => {
    const context = useContext(MultiplayerContext);
    if (!context) {
        throw new Error('useMultiplayerContext must be used within a MultiplayerProvider');
    }
    return context;
};

interface MultiplayerProviderProps extends MultiplayerConfig {
    children: ReactNode;
}

export const MultiplayerProvider: React.FC<MultiplayerProviderProps> = ({ children, ...config }) => {
    const multiplayer = useMultiplayer(config);

    return (
        <MultiplayerContext.Provider value={multiplayer}>
            {children}
        </MultiplayerContext.Provider>
    );
};
