from fastapi import APIRouter, HTTPException
from typing import Any, List
import logging
from pydantic import BaseModel, Field

from .models import Player, Board, Bid, GameStatus
from .utils import random_player_id_with_n_characters, random_player_name, random_game_id_with_N_digits
from .game import games, players, Game, game_exists
from .notifications import manager
from .core_adapter import board_data_to_walls, walls_to_board_data, robots_to_state, state_to_robots
from .core import slide

router = APIRouter()

# TODO roadmap:
# - Replace debug endpoints with production endpoints once replay workflow is implemented.
# - Validate bid rules (time window, duplicate handling, tie-break strategy).
# - Add endpoint for submitting official replay moves and broadcasting adjudication results.
# - Add phase guards so actions are accepted only in valid `RoundPhase`.


class AdapterRoundtripRequest(BaseModel):
    board_data: List[List[int]] = Field(default_factory=list)
    robots: List[dict[str, Any]] = Field(default_factory=list)


class MoveSimulateRequest(BaseModel):
    board_data: List[List[int]] = Field(default_factory=list)
    robots: List[dict[str, Any]] = Field(default_factory=list)
    active_robot_id: str
    direction: str


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

            await manager.broadcast(game_id, {"type": "player_joined", "payload": {"player": player_info.dict()}})
            return game
    return {"Wrong": "game_id"}


@router.put("/games/{game_id}/start")
async def start_game(game_id: str, game_master_id: str):
    game = await game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    if game.game_master_id != game_master_id:
        return {"Wrong": "Not Game Master"}
    game.game_status = GameStatus.STARTED
    await manager.broadcast(game_id, {"type": "game_started", "payload": game.dict()})
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
                    await manager.broadcast(game_id, {"type": "player_left", "payload": {"player_id": player_id}})
                    return {"Player": "Left Game"}
            return {"Player": "Not in Game"}
    return {"Wrong": "game_id"}

#TODO add moves and send notifications to registered webhooks for players
@router.post("/games/{game_id}/bids")
async def make_bid(game_id: str, bid: Bid):
    game = await game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    player = game.is_player(bid.player_id)
    if player is None:
        return {"Wrong": "Player"}
    game.bids.append(bid)
    await game.start_timer(game.on_timer_end)
    await manager.broadcast(game_id, {"type": "bid_made", "payload": game.dict()})
    return {"Bid": "accepted"}


@router.post("/debug/adapter/roundtrip")
async def adapter_roundtrip(payload: AdapterRoundtripRequest):
    """Debug route: validate format mapping between frontend payloads and core types."""
    board_data = payload.board_data
    n = len(board_data)

    walls = board_data_to_walls(board_data)
    board_data_roundtrip = walls_to_board_data(n, walls, include_outer_borders=True)

    state, robot_ids = robots_to_state(payload.robots)
    robots_roundtrip = state_to_robots(state, robot_ids, template=payload.robots)

    return {
        "ok": board_data_roundtrip == board_data,
        "board_size": n,
        "walls": {
            "vertical": sorted(list(walls.vertical)),
            "horizontal": sorted(list(walls.horizontal)),
        },
        "board_data_roundtrip": board_data_roundtrip,
        "state": [{"row": pos.row, "col": pos.col} for pos in state.robots],
        "robots_roundtrip": robots_roundtrip,
    }


@router.post("/debug/move/simulate")
async def debug_move_simulate(payload: MoveSimulateRequest):
    """Debug route: simulate exactly one slide move via core.py."""
    try:
        board_data = payload.board_data
        n = len(board_data)
        walls = board_data_to_walls(board_data)
        state, robot_ids = robots_to_state(payload.robots)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        robot_idx = robot_ids.index(payload.active_robot_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="active_robot_id not found in robots") from exc

    try:
        next_state = slide(state, robot_idx, payload.direction, n, walls)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    robots_after_move = state_to_robots(next_state, robot_ids, template=payload.robots)
    return {
        "board_size": n,
        "active_robot_id": payload.active_robot_id,
        "direction": payload.direction,
        "state_before": [{"row": pos.row, "col": pos.col} for pos in state.robots],
        "state_after": [{"row": pos.row, "col": pos.col} for pos in next_state.robots],
        "robots_after_move": robots_after_move,
    }
