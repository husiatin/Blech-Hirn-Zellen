from fastapi import FastAPI
from fastapi import WebSocket
from random import randint, choice
from fastapi.responses import HTMLResponse
from typing import List
import json
from pydantic import BaseModel
from string import hexdigits, digits

app = FastAPI(redoc_url=None)

class Player(BaseModel):
    player_id: str
    player_name: str

class Game:
    def __init__(self, game_id: str, player_count: int, game_master_id: str, player_list: List[Player]):
        self.game_id = game_id
        self.player_count = player_count
        self.game_master_id = game_master_id
        self.player_list = player_list

games: List[Game] = []

# TODO replace with key value pair or hash map OR REMOVE?
players: List[Player] = []

possible_layer_names: List[str] = ["greenAndMean", "red_robot_lover", "blue_means_better", "yellowIsTheBest", "all_robots_mover", "lastMinuteGuesser", "moveMaker", "better_late_than_never"]

@app.get("/")
async def get():
    return HTMLResponse(html)

@app.get("/app")
def read_app():
    return {"Hello": "APP"}

# TODO replace with something similar to random_player_id_with_n_characters
def random_game_id_with_N_digits(n):
    range_start = 10**(n-1)
    range_end = (10**n)-1
    return randint(range_start, range_end)

@app.post("/games")
async def create_game(player_info: Player):
    # TODO create a func that creates a new random game id that does not exist yet
    game_id = str(random_game_id_with_N_digits(8))
    # TODO player_count must be set to one as the game master is the first player
    new_player_list: List[Player] = [player_info]
    new_game = Game(game_id, 1, player_info.player_id, new_player_list)
    games.append(new_game)
    # return something for the frontend as proof of success

@app.get("/games")
async def read_games():
    if not games:
        return {"NO": "Games"}
    else:
        games_as_json: List[str] = []
        for game in games:
            games_as_json.append(json.dumps(game.__dict__))
        return games_as_json
    
def random_player_id_with_n_characters(n):
    symbols: List[str] = list(hexdigits)
    player_id_as_list: List[str] = []
    i: int = 0
    while i < n:
        i += 1
        player_id_as_list.append(choice(symbols))
    return "".join(player_id_as_list)

def random_player_name():
    digis: List[str] = list(digits)
    player_name: str = choice(possible_layer_names)
    i: int = 0
    while i < 2:
        i += 1
        player_name += choice(digis)
    return player_name


# TODO create an endpoint that is called when the game is open the first time
# it should create a unique player_id that is persistent throughout the session / browser
# for a set amout of time 
@app.post("/players")
async def create_player():
    player_id = random_player_id_with_n_characters(8)
    player_name = random_player_name()
    new_player: Player = Player(player_id=player_id, player_name=player_name)
    players.append(new_player)
    return new_player
# check if session exists and the player already has a player_id (this is done on the frontend side)
# if not create a unique player_id that does not exist!
# send respond to the get/post request with the player_id

@app.get("/players/{player_id}")
async def read_player_info(player_id):
    if not players:
        return {"No": "Players"}
    else:
        for player in players:
            if player.player_id == player_id:
                return player
        return {"Wrong": "player_id"}

@app.get("games/{game_id}")
async def read_game_status(game_id: str):
    if not games:
        return {"NO": "Games"}
    
    for game in games:
        if game.game_id == game_id:
            return game
            
    return {"Wrong": "game_id"}
#      # TODO Retrieve status (number of players, game configuration, ) of specified game
#      return #some var with game info

@app.put("games/join")
async def join_game(game_id: str, player_info: Player):
    # TODO check if game_ID and player_info are of valid format
    if not games:
        return {"NO": "Games"}
    
    for game in games:
        if game.game_id == game_id:
            for player in game.player_list:
                if player.player_id == player_info.player_id:
                    return {"Player": "Already in Game"}
            game.player_list.append(player_info)
            game.player_count += 1
            return {"Player": "Joined Game"} 
    
    return {"Wrong": "game_id"}
            
    
#     # TODO join specified game if it exists (adds the playerId and Name to the list of players)


@app.put("games/leave")
async def leave_game(game_id: str, player_id: str):
    # TODO check if game_ID and player_id are of valid format
    # #     # TODO leave specified game (removes the player from the list of players)
# TODO check player_count if 0 then delete game form games list or maybe create a 
# deletion timer that will delete the game after a 
# set time (if players accidently are disconnected and what to contiune the game) 

    if not games:
        return {"NO": "Games"}
    
    for game in games:
        if game.game_id == game_id:
            for player in game.player_list:
                if player.player_id == player_id:
                    game.player_list.remove(player)
                    game.player_count -= 1
                    return {"Player": "Left Game"}
            return {"Player": "Not in Game"}
    
    return {"Wrong": "game_id"}



# @app.patch("games/{game_id}/{player_id}/name")
# async def change_player_name(game_id: int, player_id: str):
#     # TODO change name of player while in lobby

html = """
<!DOCTYPE html>
<html>
    <head>
        <title>Chat</title>
    </head>
    <body>
        <h1>WebSocket Chat</h1>
        <form action="" onsubmit="sendMessage(event)">
            <input type="text" id="messageText" autocomplete="off"/>
            <button>Send</button>
        </form>
        <ul id='messages'>
        </ul>
        <script>
            var ws = new WebSocket("ws://localhost/ws");
            ws.onmessage = function(event) {
                var messages = document.getElementById('messages')
                var message = document.createElement('li')
                var content = document.createTextNode(event.data)
                message.appendChild(content)
                messages.appendChild(message)
            };
            function sendMessage(event) {
                var input = document.getElementById("messageText")
                ws.send(input.value)
                input.value = ''
                event.preventDefault()
            }
        </script>
    </body>
</html>
"""
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")