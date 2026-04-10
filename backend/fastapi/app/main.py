from fastapi import FastAPI, WebSocket
import logging

app = FastAPI(redoc_url=None, root_path="/api/")

from .routes import router as routes_router
from .notifications import manager
from .game import game_exists
from .models import Move

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
            data = await websocket.receive_json()
            game = await game_exists(game_id)
            if not game:
                continue
                
            if data.get("type") == "robot_moved":
                payload = data.get("payload", {})
                if game.demonstrating_player_id == player_id:                    
                    game.demonstration_moves.append(Move(**payload))
                    robot_to_move = payload.get("robot_id")
                    for robot in game.robots:
                        # Frontend sends both string names ("red") or integer IDs. Handle fallback checking
                        if str(robot.get("id")) == str(robot_to_move):
                            robot["x"] = payload.get("newX")
                            robot["y"] = payload.get("newY")
                            break
                    await manager.broadcast(game_id, {"type": "robot_moved", "payload": payload})
                    
            elif data.get("type") == "finish_demonstration":
                if game.demonstrating_player_id == player_id:
                    await game.finish_demonstration()
            elif data.get("type") == "replay_choice":
                payload = data.get("payload", {})
                await game.set_replay_vote(player_id, str(payload.get("choice", "")))
    except Exception as e:
        logging.debug(f"WS closed or error: {e}")
    finally:
        await manager.disconnect(game_id, player_id)
