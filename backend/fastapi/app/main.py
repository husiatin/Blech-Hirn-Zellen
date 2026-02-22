from fastapi import FastAPI, WebSocket
import logging

app = FastAPI(redoc_url=None, root_path="/api/")

from .routes import router as routes_router

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
