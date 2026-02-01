import { v4 as uuidv4 } from 'uuid';

// Types
export interface CursorPosition {
    x: number;
    y: number;
    z: number;
}

export interface RemoteUser {
    id: string;
    color: string;
    cursor: CursorPosition | null;
    selection: string[]; // Selected element IDs
}

type EventCallback = (type: string, data: any) => void;

class RealtimeService {
    private socket: WebSocket | null = null;
    private userId: string;
    private listeners: EventCallback[] = [];
    private remoteUsers: Map<string, RemoteUser> = new Map();

    // Config
    private WS_URL = import.meta.env['VITE_WS_URL'] || 'ws://localhost:8000/ws';

    constructor() {
        this.userId = uuidv4().substring(0, 8); // Random ID for this session
    }

    public connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        console.log(`[Realtime] Connecting as ${this.userId}...`);
        this.socket = new WebSocket(`${this.WS_URL}/${this.userId}`);

        this.socket.onopen = () => {
            console.log('[Realtime] Connected');
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('[Realtime] Failed to parse message', e);
            }
        };

        this.socket.onclose = () => {
            console.log('[Realtime] Disconnected');
            // Reconnect logic could go here
        };
    }

    private handleMessage(message: any) {
        const { type, userId } = message;

        if (type === 'cursor_move') {
            this.updateRemoteCursor(userId, message.position);
        } else if (type === 'selection_change') {
            this.updateRemoteSelection(userId, message.selection);
        } else if (type === 'user_left') {
            this.remoteUsers.delete(userId);
            this.notifyListeners('users_update', this.getUsers());
        }

        // Notify raw listeners
        this.notifyListeners(type, message);
    }

    private updateRemoteCursor(userId: string, position: CursorPosition) {
        let user = this.remoteUsers.get(userId);
        if (!user) {
            user = { id: userId, color: this.getRandomColor(), cursor: null, selection: [] };
            this.remoteUsers.set(userId, user);
        }
        user.cursor = position;
        this.notifyListeners('users_update', this.getUsers());
    }

    private updateRemoteSelection(userId: string, selection: string[]) {
        let user = this.remoteUsers.get(userId);
        if (!user) {
            user = { id: userId, color: this.getRandomColor(), cursor: null, selection: [] };
            this.remoteUsers.set(userId, user);
        }
        user.selection = selection;
        this.notifyListeners('users_update', this.getUsers());
    }

    // ============================================
    // API
    // ============================================

    public broadcastCursor(x: number, y: number, z: number) {
        this.send({
            type: 'cursor_move',
            userId: this.userId,
            position: { x, y, z }
        });
    }

    public broadcastSelection(selection: string[]) {
        this.send({
            type: 'selection_change',
            userId: this.userId,
            selection
        });
    }

    public on(callback: EventCallback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    public getUsers(): RemoteUser[] {
        return Array.from(this.remoteUsers.values());
    }

    public getMyId(): string {
        return this.userId;
    }

    // ============================================
    // UTILS
    // ============================================

    private notifyListeners(type: string, data: any) {
        this.listeners.forEach(callback => callback(type, data));
    }

    private send(data: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    private getRandomColor() {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF5', '#e91e63', '#9c27b0'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

export const realtime = new RealtimeService();
