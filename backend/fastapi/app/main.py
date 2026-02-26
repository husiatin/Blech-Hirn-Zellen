from fastapi import FastAPI, WebSocket
import logging

app = FastAPI(redoc_url=None, root_path="/api/")

from .routes import router as routes_router
from .notifications import manager

app.include_router(routes_router)


@app.get("/")
async def get():
    return {"Hello": "FASTAPI"}


@app.get("/app")
def read_app():
    return {"Hello": "APP"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")


@app.websocket("/ws/games/{game_id}/{player_id}")
async def game_ws(websocket: WebSocket, game_id: str, player_id: str):
    await manager.connect(game_id, player_id, websocket)
    try:
        while True:
            # keep connection alive; optionally receive client messages
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        await manager.disconnect(game_id, player_id)
