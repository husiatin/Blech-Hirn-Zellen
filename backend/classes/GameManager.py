# backend/classes/GameManager.py

from typing import Dict, Any, Optional
from fastapi import WebSocket 

class GameManager:
    """Verwaltet alle Spiele und die aktiven Client-Verbindungen."""
    
    def __init__(self):
        # Attribute aus dem Klassendiagramm:
        
        # Speichert alle aktiven Game-Instanzen (später {ID: Game-Objekt})
        self.active_games: Dict[str, Any] = {} 
        
        # Zähler für neue Game-IDs
        self.game_counter: int = 0
        
        # NEU & WICHTIG: Speichert die offenen WebSocket-Verbindungen.
        # {player_id (string): WebSocket-Objekt}
        self.active_connections: Dict[str, WebSocket] = {}


    # --- Methoden zur Verbindungsverwaltung (ClientConnection-Logik) ---

    def connect_player(self, player_id: str, websocket: WebSocket):
        """
        Speichert die neue WebSocket-Verbindung.
        (Entspricht dem Speichern des 'socket'-Attributs der ClientConnection).
        """
        self.active_connections[player_id] = websocket
        print(f"Server-Log: Spieler {player_id} verbunden. Total: {len(self.active_connections)}")
        return True

    def disconnect_player(self, player_id: str):
        """
        Entfernt die Verbindung, wenn der Client trennt.
        (Entspricht der closeConnection-Logik).
        """
        if player_id in self.active_connections:
            del self.active_connections[player_id]
            print(f"Server-Log: Spieler {player_id} getrennt. Verbleibend: {len(self.active_connections)}")

    async def send_update_to_player(self, player_id: str, message: str):
        """
        Sendet eine Nachricht an einen bestimmten Spieler.
        (Entspricht der sendUpdate-Operation).
        """
        if player_id in self.active_connections:
            try:
                # Da WebSockets asynchron sind, verwenden wir 'await'
                await self.active_connections[player_id].send_text(message)
            except Exception as e:
                 print(f"Fehler beim Senden an {player_id}: {e}")
                 # Wenn Senden fehlschlägt, ist der Spieler wahrscheinlich getrennt
                 self.disconnect_player(player_id) 


    # Die Methoden handle_action, createGame, joinGame, etc., lassen wir
    # HIER NOCH WEG, da sie komplex sind.
    pass