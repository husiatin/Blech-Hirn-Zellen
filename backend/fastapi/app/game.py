from typing import List, Optional
from pydantic import BaseModel, Field
from threading import Timer
import logging

from .models import Player, Board, Bid, GameStatus


class Game(BaseModel):
    game_id: str
    player_count: int
    game_master_id: str
    player_list: List[Player]
    board: Board
    game_status: GameStatus = GameStatus.LOBBY
    bids: List[Bid] = Field(default_factory=list)
    is_timer_running: bool = False
    timer_duration: float = 60.0

    def is_player(self, player_id: str) -> Optional[Player]:
        for player in self.player_list:
            if player.player_id == player_id:
                return player
        return None

    def add_bid(self, bid: Bid) -> None:
        self.bids.append(bid)
        # keep bids ordered by declared number of moves (lowest first)
        self.bids.sort(key=lambda b: getattr(b, "number_of_moves", 0))

    def set_timer_duration(self, new_timer_duration: float) -> None:
        self.timer_duration = new_timer_duration

    def on_timer_end(self):
        # TODO make broadcast to players that timer has ended and process bids(tell the player with the least number to show his moves)
        return None

    async def start_timer(self, on_timer_end) -> None:
        if self.is_timer_running:
            return
        self.is_timer_running = True
        timer = Timer(self.timer_duration, on_timer_end)
        timer.start()
    # def set robots start postions


# In-memory game and player state
games: List[Game] = []
players: List[Player] = []


async def game_exists(game_id: str) -> Optional[Game]:
    for game in games:
        if game.game_id == game_id:
            return game
    return None


def award_game_chip(player_id: str):
    # TODO: implement awarding logic
    return None


def end_round():
    # TODO: implement round-ending logic
    # allow the player with the lowest number of moves to demonstrate their solution
    # if that doesn't work pick the next until a solution is found or no solution is found
    # if a solution is found allocate the game chip to the player
    # else the game chip is not awarded and stays a playable game chip / remains in the set of game chips
    # if there are remaining game chips the game continues
    # else the game is ended and the players can start a new round
    return None
