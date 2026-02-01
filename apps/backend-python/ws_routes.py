from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from collaboration.manager import manager
import json

router = APIRouter()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(client_id, websocket)
    
    # Notify others that a user joined
    await manager.broadcast({
        "type": "user_joined",
        "userId": client_id
    }, sender_id=client_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Broadcast the message (cursor move, selection, etc.)
            # We explicitly exclude the sender to avoid echo
            await manager.broadcast(message, sender_id=client_id)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await manager.broadcast({
            "type": "user_left",
            "userId": client_id
        }, sender_id=client_id)
    except Exception as e:
        print(f"[WS] Error: {e}")
        manager.disconnect(client_id)
