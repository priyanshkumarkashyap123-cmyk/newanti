from typing import List, Dict
from fastapi import WebSocket

class ConnectionManager:
    """
    Manages WebSocket connections for real-time collaboration.
    """
    def __init__(self):
        # active_connections: List[WebSocket] = []
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"[WS] Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"[WS] Client {client_id} disconnected")

    async def broadcast(self, message: dict, sender_id: str = None):
        """Broadcast message to all connected clients except sender"""
        for client_id, connection in self.active_connections.items():
            if client_id != sender_id:
                try:
                    await connection.send_json(message)
                except Exception:
                    # Handle broken pipe
                    pass

manager = ConnectionManager()
