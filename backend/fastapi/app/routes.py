from fastapi import APIRouter, HTTPException, Query
from typing import Any, List
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field

from .models import Player, Board, Bid, GameStatus, CreateGameRequest, StartGameRequest
from .utils import random_player_id_with_n_characters, random_player_name, random_game_id_with_N_digits
from .game import games, players, Game, game_exists
from .notifications import manager
from .core_adapter import board_data_to_walls, walls_to_board_data, robots_to_state, state_to_robots
from .core import slide, Walls

router = APIRouter()


class AdapterRoundtripRequest(BaseModel):
    # Frontend board matrix + robots, used by adapter debug endpoint.
    board_data: List[List[int]] = Field(default_factory=list)
    robots: List[dict[str, Any]] = Field(default_factory=list)


class MoveSimulateRequest(BaseModel):
    # One-step move simulation payload for debugging movement behavior.
    board_data: List[List[int]] = Field(default_factory=list)
    robots: List[dict[str, Any]] = Field(default_factory=list)
    active_robot_id: str
    direction: str


def _board_preset_path(preset_name: str) -> Path:
    # Canonical location is backend/board_presets.
    # Search order covers local repo and container dev mount (/code/board_presets).
    module_path = Path(__file__).resolve()
    candidates = [
        module_path.parents[2] / "board_presets" / f"{preset_name}.json",
        module_path.parents[1] / "board_presets" / f"{preset_name}.json",
        module_path.parent / "board_presets" / f"{preset_name}.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _normalize_side(side: str | None) -> str:
    # Accept only A/B to keep preset selection predictable.
    candidate = (side or "A").strip().upper()
    return candidate if candidate in {"A", "B"} else "A"


def _load_playable_preset(preset_name: str, quadrant_sides: dict[str, str] | None = None) -> dict[str, Any]:
    # Main preset loader used by /boards/.../playable routes.
    # Supports both:
    # - new quadrant-based format (quadrants.blockX.A/B)
    # - legacy flat format (vertical/horizontal on root)
    preset_path = _board_preset_path(preset_name)
    if not preset_path.exists():
        raise HTTPException(status_code=404, detail=f"Preset not found: {preset_name}")

    try:
        raw = json.loads(preset_path.read_text(encoding="utf-8"))
        n = int(raw["board_size"])

        quadrants = raw.get("quadrants")
        if isinstance(quadrants, dict) and quadrants:
            # Build full 16x16 board by stitching selected 8x8 quadrant sides.
            sides = quadrant_sides or {}
            quadrant_configs = [
                ("block1", 0, 0),
                ("block2", 8, 0),
                ("block3", 0, 8),
                ("block4", 8, 8),
            ]
            vertical: set[tuple[int, int]] = set()
            horizontal: set[tuple[int, int]] = set()
            robots: list[dict[str, Any]] = []
            chips: list[dict[str, Any]] = []
            targets: list[dict[str, Any]] = []

            for block_name, offset_x, offset_y in quadrant_configs:
                selected_side = _normalize_side(sides.get(block_name))
                side_data = quadrants.get(block_name, {}).get(selected_side)
                if not isinstance(side_data, dict):
                    raise KeyError(f"quadrants.{block_name}.{selected_side}")

                for col, row in side_data.get("vertical", []):
                    # Shift local quadrant coordinates into global board coordinates.
                    vertical.add((int(col) + offset_x, int(row) + offset_y))
                for col, row in side_data.get("horizontal", []):
                    horizontal.add((int(col) + offset_x, int(row) + offset_y))

                for robot in side_data.get("robots", []):
                    # Same coordinate shift for entities.
                    robots.append(
                        {
                            "id": robot["id"],
                            "x": int(robot["x"]) + offset_x,
                            "y": int(robot["y"]) + offset_y,
                        }
                    )

                for chip in side_data.get("chips", []):
                    chips.append(
                        {
                            "id": chip.get("id"),
                            "robot_id": chip.get("robot_id"),
                            "color": chip.get("color"),
                            "symbol": chip.get("symbol"),
                            "x": int(chip["x"]) + offset_x,
                            "y": int(chip["y"]) + offset_y,
                        }
                    )

                for target in side_data.get("targets", []):
                    targets.append(
                        {
                            "id": target.get("id"),
                            "robot_id": target.get("robot_id"),
                            "x": int(target["x"]) + offset_x,
                            "y": int(target["y"]) + offset_y,
                        }
                    )

            walls = Walls(vertical=frozenset(vertical), horizontal=frozenset(horizontal))
            board_data = walls_to_board_data(n, walls, include_outer_borders=True)
        else:
            # Legacy fallback path.
            vertical = frozenset((int(col), int(row)) for col, row in raw["vertical"])
            horizontal = frozenset((int(col), int(row)) for col, row in raw["horizontal"])
            walls = Walls(vertical=vertical, horizontal=horizontal)
            board_data = walls_to_board_data(n, walls, include_outer_borders=True)
            robots = raw.get("robots", [])
            chips = raw.get("chips", [])
            targets = raw.get("targets", [])
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid preset format, missing key: {exc}") from exc
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid preset format: {exc}") from exc

    active_target_id = raw.get("active_target_id")
    # If no exact active target is found, use first available target as fallback.
    active_target = next((target for target in targets if target.get("id") == active_target_id), None)
    if active_target is None and targets:
        active_target = targets[0]

    return {
        "name": raw.get("name", preset_name),
        "board_size": n,
        "board_data": board_data,
        "robots": robots,
        "chips": chips,
        "targets": targets,
        "active_target_id": active_target_id,
        "target": active_target,
    }


@router.post("/games")
async def create_game(request: CreateGameRequest):
    # Creates a new game with one initial player (the game master).
    try:
        game_id = str(random_game_id_with_N_digits(8))
        new_player_list: List[Player] = [request.player_info]
        new_game = Game(
            game_id=game_id,
            player_count=1,
            game_master_id=request.player_info.player_id,
            player_list=new_player_list,
            board=request.board_configuration,
            hourglass_duration=request.hourglass_duration,
            round_timer_duration=request.round_timer_duration,
            chips=request.chips
        )
        games.append(new_game)
        return new_game
    except Exception:
        logging.exception("Failed to create game")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/boards/default/playable")
async def read_default_playable_board(
    block1_side: str = Query(default="A"),
    block2_side: str = Query(default="A"),
    block3_side: str = Query(default="A"),
    block4_side: str = Query(default="A"),
):
    # Convenience route for the default preset.
    return _load_playable_preset(
        "default",
        quadrant_sides={
            "block1": block1_side,
            "block2": block2_side,
            "block3": block3_side,
            "block4": block4_side,
        },
    )


@router.get("/boards/{preset_name}/playable")
async def read_named_playable_board(
    preset_name: str,
    block1_side: str = Query(default="A"),
    block2_side: str = Query(default="A"),
    block3_side: str = Query(default="A"),
    block4_side: str = Query(default="A"),
):
    # Generic route used by frontend for custom preset names.
    return _load_playable_preset(
        preset_name,
        quadrant_sides={
            "block1": block1_side,
            "block2": block2_side,
            "block3": block3_side,
            "block4": block4_side,
        },
    )


@router.get("/games")
async def read_games():
    if not games:
        return {"NO": "Games"}
    return [g.dict() for g in games]


@router.post("/players")
async def create_player():
    # Lightweight anonymous player creation used by frontend bootstrap.
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
async def start_game(game_id: str, player_id: str, request: StartGameRequest):
    # Only game master can move game from lobby -> started.
    game = await game_exists(game_id)
    if game is None:
        return {"Wrong": "game_id"}
    if game.game_master_id != player_id:
        return {"Wrong": "Not Game Master"}
        
    game.original_robots = request.original_robots
    if len(game.chips) > 0:
        import random
        game.goal_chip = random.choice(game.chips)
    
    game.game_status = GameStatus.STARTED
    game.start_round_timer()
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
    game.start_hourglass_timer()
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
