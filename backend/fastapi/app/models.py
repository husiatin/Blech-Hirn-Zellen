"""
Pydantic data models for the backend API.

This module defines request/response payload schemas and shared domain enums
used by routes and in-memory game state.

TODO roadmap:
- Add round-level fields to `Game` payloads (for example: `round_end_at`, active target chip).
- Add explicit replay payload models (submitted move sequence, replay result).
- Decide whether API keys should be `snake_case` only or support legacy camelCase aliases.
"""

from typing import List
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


class Position(BaseModel):
    x: int
    y: int


class Move(BaseModel):
    startPosition: Position
    newPosition: Position


class Board(BaseModel):
    # board_data is a 2D array (rows of columns) of integers representing wall flags
    board_data: List[List[int]] = Field(default_factory=list)


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


class GameChip(BaseModel):
    colour: Colour
    symbol: Symbol
    position: Position


class Robot(BaseModel):
    colour: Colour
    start_position: Position


class Player(BaseModel):
    player_id: str
    player_name: str
    moves: List[Move] = Field(default_factory=list)
    won_chips: List[GameChip] = Field(default_factory=list)
