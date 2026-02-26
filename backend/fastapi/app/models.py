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