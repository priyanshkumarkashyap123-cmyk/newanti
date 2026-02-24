import React from 'react';
import { RemoteUser } from '../../hooks/useMultiplayer';
import { Users } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface CollaboratorsProps {
    users: RemoteUser[];
    currentUserColor: string;
    isConnected: boolean;
}

export const Collaborators: React.FC<CollaboratorsProps> = ({ users, currentUserColor, isConnected }) => {
    if (!isConnected) return null;

    return (
        <div className="absolute top-4 right-4 flex items-center -space-x-2 z-50">
            {users.map(user => (
                <Tooltip 
                    key={user.id}
                    content={`${user.name} ${user.isActive ? '(Active)' : '(Idle)'}`}
                >
                    <div
                        className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-white shadow-lg transition-transform hover:scale-110 hover:z-10"
                        style={{ backgroundColor: user.color }}
                    >
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                </Tooltip>
            ))}

            <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-lg transform hover:scale-105 transition-all">
                <Users className="w-4 h-4 text-slate-400" />
            </div>
        </div>
    );
};
