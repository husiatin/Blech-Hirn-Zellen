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


class Move(BaseModel):
    startX: int
    startY: int
    newX: int
    newY: int


class Board(BaseModel):
    board_size: int = 16
    # board_data is a 2D array (rows of columns) of integers representing wall flags
    board_data: List[List[int]] = Field(default_factory=list)


class Color(str, Enum):
    RED = "red"
    BLUE = "blue"
    GREEN = "green"
    YELLOW = "yellow"


class Symbol(str, Enum):
    CIRCLE = "circle"
    STAR = "star"
    COG = "cog"
    PENTAGON = "pentagon"


class GameChip(BaseModel):
    x: int
    y: int
    color: Color
    symbol: Symbol


class Robot(BaseModel):
    id: str
    color: Color
    x: int
    y: int


class Player(BaseModel):
    player_id: str
    player_name: str
    moves: List[Move] = Field(default_factory=list)
    won_chips: List[GameChip] = Field(default_factory=list)