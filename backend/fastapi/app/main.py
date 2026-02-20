from fastapi import FastAPI
from fastapi import WebSocket, HTTPException
import logging
from random import randint, choice
from fastapi.responses import HTMLResponse
from typing import List
import json
from pydantic import BaseModel, Field
from string import hexdigits, digits
from threading import Timer
from enum import Enum

app = FastAPI(redoc_url=None)

class Move(BaseModel):
    startX: int
    startY: int
    newX: int
    newY: int

class Player(BaseModel):
    player_id: str
    player_name: str    
    # bid: int
    moves: List[Move] = []

# TODO create board representation
# class Board(BaseModel):



def award_game_chip(player_id: str):
    # TODO 
    return None

class Colour(Enum):
    RED = 0
    GREEN = 1
    BLUE = 2
    YELLOW = 3

class Symbol(Enum):
    CIRCLE = 0
    STAR = 1
    COG = 2
    PENTAGON = 3

# TODO define game chips -> colour and symbol
class GameChip(BaseModel):
    colour: Colour
    symbol: Symbol

# TODO define set of game chips -> 16 in total
game_chips = [GameChip(colour=0, symbol=0),
              GameChip(colour=0, symbol=1),
              GameChip(colour=0, symbol=2),
              GameChip(colour=0, symbol=3),
              GameChip(colour=1, symbol=0),
              GameChip(colour=1, symbol=1),
              GameChip(colour=1, symbol=2),
              GameChip(colour=1, symbol=3),
              GameChip(colour=2, symbol=0),
              GameChip(colour=2, symbol=1),
              GameChip(colour=2, symbol=2),
              GameChip(colour=2, symbol=3),
              GameChip(colour=3, symbol=0),
              GameChip(colour=3, symbol=1),
              GameChip(colour=3, symbol=2),
              GameChip(colour=3, symbol=3)]

def end_round():
        # TODO round end
        # allow the player with the lowest number of moves to demonstrate their solution
        # if that doesn't work pick the next until a solution is found or no solution is found
        # if a solution is found allocate the game chip to the player
        # else the game chip is not awarded and stays a playable game chip / remains in the set of game chips
        # if there are remaining game chips the game continues 
        # else the game is ended and the players can start a new round
        return None

class Bid(BaseModel):
    number_of_moves: int
    player_id: str 
    # TODO? make player_id a separate type?

class Game(BaseModel):
    game_id: str
    player_count: int
    game_master_id: str
    player_list: List[Player]
    bids: List[Bid] = Field(default_factory=list)
    is_timer_running: bool = False
    timer_duration: float = 60.0

    def is_player(self, player_id: str):
        for player in self.player_list:
            if player.player_id == player_id:
                return player
        return None

    def add_bid(self, bid: Bid) -> None:
        self.bids.append(bid)
        # keep bids ordered by declared number of moves (lowest first)
        self.bids.sort(key=lambda b: getattr(b, 'number_of_moves', 0))
        return None

    def set_timer_duration(self, new_timer_duration: float) -> None:
        self.timer_duration = new_timer_duration
        return None

    # def start_timer(self):
    #     timer = Timer(self.timer_duration, end_round())
    #     timer.start()

games: List[Game] = []

def game_exists(game_id):
    for game in games:
        if game.game_id == game_id:
            return game
    return None
        

# TODO replace with key value pair or hash map OR REMOVE?
players: List[Player] = []

possible_player_names: List[str] = ["greenAndMean", 
                                   "red_robot_lover", 
                                   "blue_means_better", 
                                   "yellowIsTheBest", 
                                   "all_robots_mover", 
                                   "lastMinuteGuesser", 
                                   "moveMaker", 
                                   "better_late_than_never"]

@app.get("/")
async def get():
    return {"Hello": "FASTAPI"}

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
    try:
        # TODO create a func that creates a new random game id that does not exist yet
        game_id = str(random_game_id_with_N_digits(8))
        # TODO player_count must be set to one as the game master is the first player
        new_player_list: List[Player] = [player_info]
        new_game = Game(
            game_id=game_id,
            player_count=1,
            game_master_id=player_info.player_id,
            player_list=new_player_list,
        )
        games.append(new_game)
        return new_game
    except Exception as e:
        logging.exception("Failed to create game")
        # Return a generic 500 to clients to avoid leaking internals
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.get("/games")
async def read_games():
    if not games:
        return {"NO": "Games"}
    else:
        games_as_json: List[dict] = []
        for game in games:
            # Game is a Pydantic model; use .dict() for serializable representation
            games_as_json.append(game.dict())
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
    player_name: str = choice(possible_player_names)
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

@app.get("/games/{game_id}")
async def read_game_status(game_id: str):
    if not games:
        return {"NO": "Games"}
    
    for game in games:
        if game.game_id == game_id:
            return game
            
    return {"Wrong": "game_id"}
#      # TODO Retrieve status (number of players, game configuration, ) of specified game
#      return #some var with game info

@app.post("/games/{game_id}/players")
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


@app.put("/games/leave")
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

@app.post("/games/bid")
async def make_bid(game_id: str, bid: Bid):
    game = game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    else:
        player = game.is_player(bid.player_id)
        if player is None:
            return {"Wrong": "Player"}
        else:
            game.bids.append(bid)
            # game.start_timer()
            return {"Bid": "accepted"}

# @app.put("games/{game_id}/settings")

# @app.put("games/{game_id}/{player_id}/name")
# async def change_player_name(game_id: int, player_id: str):
#     # TODO change name of player while in lobby

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")
