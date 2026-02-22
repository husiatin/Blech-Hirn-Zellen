from fastapi import APIRouter, HTTPException
from typing import List
import logging

from .models import Player, Board, Bid, GameStatus
from .utils import random_player_id_with_n_characters, random_player_name, random_game_id_with_N_digits
from .game import games, players, Game, game_exists
from .notifications import set_webhook_url_for_player

router = APIRouter()


@router.post("/games")
async def create_game(player_info: Player, board_configuration: Board):
    try:
        game_id = str(random_game_id_with_N_digits(8))
        new_player_list: List[Player] = [player_info]
        new_game = Game(
            game_id=game_id,
            player_count=1,
            game_master_id=player_info.player_id,
            player_list=new_player_list,
            board=board_configuration,
        )
        games.append(new_game)
        return new_game
    except Exception:
        logging.exception("Failed to create game")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/games")
async def read_games():
    if not games:
        return {"NO": "Games"}
    return [g.dict() for g in games]


@router.post("/players")
async def create_player():
    player_id = random_player_id_with_n_characters(8)
    player_name = random_player_name()
    new_player: Player = Player(player_id=player_id, player_name=player_name)
    players.append(new_player)
    return new_player


@router.get("/players/{player_id}")
async def read_player_info(player_id: str):
    if not players:
        return {"No": "Players"}
    for player in players:
        if player.player_id == player_id:
            return player
    return {"Wrong": "player_id"}


@router.get("/games/{game_id}")
async def read_game_status(game_id: str):
    if not games:
        return {"NO": "Games"}
    for game in games:
        if game.game_id == game_id:
            return game
    return {"Wrong": "game_id"}


@router.post("/games/{game_id}/players")
async def join_game(game_id: str, player_info: Player):
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


@router.put("/games/{game_id}/start")
async def start_game(game_id: str, game_master_id: str):
    game = await game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    if game.game_master_id != game_master_id:
        return {"Wrong": "Not Game Master"}
    game.game_status = GameStatus.STARTED
    return {"Game": "Started"}


@router.put("/games/leave")
async def leave_game(game_id: str, player_id: str):
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


@router.post("/games/bid")
async def make_bid(game_id: str, bid: Bid):
    game = await game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    player = game.is_player(bid.player_id)
    if player is None:
        return {"Wrong": "Player"}
    game.bids.append(bid)
    return {"Bid": "accepted"}


@router.post("/games/{game_id}/webhook")
async def set_webhook(game_id: str, player_id: str, webhook_url: str):
    game = await game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    if not game.is_player(player_id):
        return {"Wrong": "Player"}
    await set_webhook_url_for_player(player_id, webhook_url)
    return {"Webhook": "Set"}
