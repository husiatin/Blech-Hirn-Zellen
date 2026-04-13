"""
Pydantic data models for the backend API.

This module defines request/response payload schemas and shared domain enums
used by routes and in-memory game state.

TODO roadmap:
- Add round-level fields to `Game` payloads (for example: `round_end_at`, active target chip).
- Add explicit replay payload models (submitted move sequence, replay result).
- Decide whether API keys should be `snake_case` only or support legacy camelCase aliases.
"""

from typing import List, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum


class Bid(BaseModel):
    number_of_moves: int
    player_id: str


class GameStatus(Enum):
    LOBBY = 0
    STARTED = 1
    ENDED = 2

class RoundPhase(Enum):
    """Allowed states for a single round lifecycle.

    PLANNING:
    - Players can privately test robot moves on their local client.
    - No official move validation is performed by the backend yet.

    REPLAY:
    - Planning is closed (typically after the timer ends).
    - Official solution attempts are demonstrated and validated by the backend.

    ROUND_END:
    - The round result is finalized (chip awarded or no valid solution).
    - The game prepares the next round setup/state transition.
    """

    PLANNING = "planning"
    REPLAY = "replay"
    ROUND_END = "round_end"


class Move(BaseModel):
    robot_id: str
    startX: int
    startY: int
    newX: int
    newY: int


class Board(BaseModel):
    # board_data is a 2D array (rows of columns) of integers representing wall flags
    board_data: List[List[int]] = Field(default_factory=list)

class Player(BaseModel):
    player_id: str
    player_name: str
    moves: List[Move] = Field(default_factory=list)
    won_chips: List[dict[str, Any]] = Field(default_factory=list)

class CreateGameRequest(BaseModel):
    player_info: Player
    board_configuration: Board
    hourglass_duration: int
    round_timer_duration: int
    chips: List[dict[str, Any]] = Field(default_factory=list)

class StartGameRequest(BaseModel):
    original_robots: List[dict[str, Any]]
    target: Optional[dict[str, Any]] = None
