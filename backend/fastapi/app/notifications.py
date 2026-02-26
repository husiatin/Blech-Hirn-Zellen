from typing import Dict
import logging
from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class WebSocketManager:
    """Manage websocket connections per game and player."""

    def __init__(self):
        # game_id -> player_id -> WebSocket
        self.connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, game_id: str, player_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.setdefault(game_id, {})[player_id] = websocket
        logging.debug("WebSocket connected: %s / %s", game_id, player_id)

    async def disconnect(self, game_id: str, player_id: str) -> None:
        game_conns = self.connections.get(game_id)
        if not game_conns:
            return
        ws = game_conns.pop(player_id, None)
        if ws:
            try:
                await ws.close()
            except Exception:
                logging.debug("Error closing websocket for %s/%s", game_id, player_id)
        if not game_conns:
            self.connections.pop(game_id, None)

    async def send_to_player(self, game_id: str, player_id: str, event: dict) -> None:
        game_conns = self.connections.get(game_id, {})
        ws = game_conns.get(player_id)
        if not ws:
            return
        try:
            # ensure event is JSON serializable (convert Enums, Pydantic models, etc.)
            payload = jsonable_encoder(event)
            await ws.send_json(payload)
        except Exception:
            logging.exception("Failed to send websocket message to %s/%s", game_id, player_id)
            # on failure, remove connection
            await self.disconnect(game_id, player_id)

    async def broadcast(self, game_id: str, event: dict) -> None:
        game_conns = self.connections.get(game_id, {})
        to_remove = []
        for player_id, ws in list(game_conns.items()):
            try:
                # convert event to JSON-serializable form first
                payload = jsonable_encoder(event)
                await ws.send_json(payload)
            except Exception:
                logging.exception("Broadcast failed for %s/%s", game_id, player_id)
                to_remove.append(player_id)
        for player_id in to_remove:
            await self.disconnect(game_id, player_id)


manager = WebSocketManager()
