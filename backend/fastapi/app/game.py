from typing import List, Optional
from pydantic import BaseModel, Field
import asyncio
import logging
import random

from .models import Player, Board, Bid, GameStatus, Robot, GameChip
from .notifications import manager


class Game(BaseModel):
    game_id: str
    player_count: int
    game_master_id: str
    player_list: List[Player]
    board: Board = Board()
    game_status: GameStatus = GameStatus.LOBBY
    bids: List[Bid] = Field(default_factory=list)
    is_hourglass_running: bool = False
    hourglass_duration: int = 60
    is_round_timer_running: bool = False
    round_timer_duration: int = 5
    robots: List[Robot] = Field(default_factory=list)
    active_robot_id: str = ""
    goal_chip: Optional[GameChip] = None
    chips: List[GameChip] = Field(default_factory=list)
    demonstrating_player_id: Optional[str] = None
    demonstration_moves: list = Field(default_factory=list)
    original_robots: List[Robot] = Field(default_factory=list)

    def is_player(self, player_id: str) -> Optional[Player]:
        for player in self.player_list:
            if player.player_id == player_id:
                return player
        return None

    def add_bid(self, bid: Bid) -> None:
        self.bids.append(bid)
        # keep bids ordered by declared number of moves (lowest first)
        self.bids.sort(key=lambda b: getattr(b, "number_of_moves", 0))

    def set_hourglass_duration(self, new_hourglass_duration: int) -> None:
        self.hourglass_duration = new_hourglass_duration

    def set_round_timer_duration(self, new_round_timer_duration: int) -> None:
        self.round_timer_duration = new_round_timer_duration

    async def next_demonstration(self):
        # Reset board to original round starting positions
        if self.original_robots:
            self.robots = [r.copy() for r in self.original_robots]
            
        if len(self.bids) > 0:
            next_bid = self.bids[0]
            self.demonstrating_player_id = next_bid.player_id
            self.demonstration_moves = []
            payload = {"player_id": self.demonstrating_player_id, "bid": next_bid.dict(), "robots": [r.dict() for r in self.robots]}
            await manager.broadcast(self.game_id, {"type": "demonstration_started", "payload": payload})
        else:
            self.demonstrating_player_id = None
            self.demonstration_moves = []
            await manager.broadcast(self.game_id, {"type": "demonstration_failed", "payload": {"message": "No bids left!"}})

    async def on_round_timer_end(self):
        self.is_round_timer_running = False
        if len(self.bids) == 0:
            # End round without demonstration because no bids were made
            await manager.broadcast(self.game_id, {"type": "round_failed", "payload": {"message": "No bids were made in time!"}})

    async def on_timer_end(self):
        self.is_hourglass_running = False
        self.is_round_timer_running = False
        
        # Save original robots state for resetting upon failed demonstrations
        if not self.original_robots:
            self.original_robots = [r.copy() for r in self.robots]

        # Start demonstration loop
        await self.next_demonstration()

    async def validate_demonstration(self) -> bool:
        if not self.demonstrating_player_id or len(self.bids) == 0:
            return False
            
        current_bid = self.bids[0]
        
        # 1. Check exact move count
        if len(self.demonstration_moves) != current_bid.number_of_moves:
            return False
            
        # 2. Check if a robot reached the active goal chip
        if not self.goal_chip:
            return False
            
        chip_reached = False
        for robot in self.robots:
            if robot.x == self.goal_chip.x and robot.y == self.goal_chip.y:
                # The robot color should match the chip color (or maybe wildcard if supported, assuming direct match for now)
                if robot.color == self.goal_chip.color:
                    chip_reached = True
                    break
                    
        return chip_reached

    async def finish_demonstration(self) -> None:
        is_valid = await self.validate_demonstration()
        
        if is_valid:
            player = self.is_player(self.demonstrating_player_id)
            if player:
                player.won_chips.append(self.goal_chip)
            
            # Demonstration succeeded, clear round state
            self.demonstrating_player_id = None
            self.demonstration_moves = []
            self.bids = []
            self.original_robots = []
            
            payload = {"winner_id": player.player_id if player else None, "chip": self.goal_chip.dict() if self.goal_chip else None}
            self.chips.remove(self.goal_chip)
            await manager.broadcast(self.game_id, {"type": "demonstration_success", "payload": payload})
        else:
            # Demonstration failed
            self.bids.pop(0)
            await self.next_demonstration()

    def start_hourglass_timer(self) -> None:
        if self.is_hourglass_running:
            return
        self.is_hourglass_running = True
        
        async def timer_task():
            await asyncio.sleep(self.hourglass_duration)
            if self.is_hourglass_running:
                await self.on_timer_end()
                
        asyncio.create_task(timer_task())
    
    def start_round_timer(self) -> None:
        if self.is_round_timer_running:
            return
        self.is_round_timer_running = True
        
        async def timer_task():
            await asyncio.sleep(self.round_timer_duration * 60)
            if self.is_round_timer_running:
                await self.on_round_timer_end()
                
        asyncio.create_task(timer_task())

    def pick_goal_chip(self) -> None:
        self.goal_chip = random.choice(self.chips)

# In-memory game and player state
games: List[Game] = []
players: List[Player] = []


async def game_exists(game_id: str) -> Optional[Game]:
    for game in games:
        if game.game_id == game_id:
            return game
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
