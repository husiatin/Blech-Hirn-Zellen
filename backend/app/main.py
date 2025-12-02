from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from backend.classes.GameManager import GameManager 

app = FastAPI(redoc_url=None)

# Globale Instanz: Der Game Manager
game_manager = GameManager() 

@app.get("/")
def read_root():
    return {"Hello": "ROOT!"}

@app.get("/app")
def read_app():
    return {"Hello": "APP"}

# Der WebSocket-Endpunkt
@app.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    
    # 1. Verbindung herstellen
    # Methode aus dem GameManager aufrufen
    game_manager.connect_player(player_id, websocket) 

    # Willkommensnachricht senden (Test der send_update_to_player-Funktion)
    await game_manager.send_update_to_player(
        player_id, 
        f'{{"type": "STATUS", "message": "Hallo {player_id}, verbunden!"}}'
    )

    try:
        # 2. Zuhören und Abwarten (Nur Logging)
        while True:
            # Wir empfangen Daten, tun aber noch nichts damit (Minimalziel!)
            raw_data = await websocket.receive_text()
            print(f"[!] Server empfing Daten von {player_id}, ignoriert: {raw_data}")
            
    except WebSocketDisconnect:
        # 3. Verbindung trennen
        # Methode aus dem GameManager aufrufen
        game_manager.disconnect_player(player_id)
    
    except Exception as e:
        print(f"Fehler bei WS für {player_id}: {e}")
        game_manager.disconnect_player(player_id)