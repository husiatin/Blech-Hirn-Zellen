import asyncio
from typing import List, Optional, Any
from pydantic import BaseModel, Field
from threading import Timer
import logging

from .models import Player, Board, Bid, GameStatus, RoundPhase, Move
from .notifications import manager

# TODO roadmap:
# - Persist game state instead of in-memory lists.
# - Add authoritative round state (official robot positions + active target chip).
# - Implement timer transition: PLANNING -> REPLAY and broadcast to all players.
# - Implement replay adjudication flow (lowest bid first, fallback to next bidder).


class Game(BaseModel):
    game_id: str
    player_count: int
    game_master_id: str
    player_list: List[Player]
    board: Board
    game_status: GameStatus = GameStatus.LOBBY
    round_phase: RoundPhase = RoundPhase.PLANNING
    bids: List[Bid] = Field(default_factory=list)
    is_hourglass_running: bool = False
    hourglass_duration: int = 60
    is_round_timer_running: bool = False
    round_timer_duration: int = 5
    demonstrating_player_id: Optional[str] = None
    demonstration_moves: List[Move] = Field(default_factory=list)
    original_robots: List[dict[str, Any]] = Field(default_factory=list)
    robots: List[dict[str, Any]] = Field(default_factory=list)
    chips: List[dict[str, Any]] = Field(default_factory=list)
    goal_chip: Optional[dict[str, Any]] = None

    # asyncio Task handles excluded from Pydantic serialisation
    _hourglass_task: Optional[asyncio.Task] = None
    _round_timer_task: Optional[asyncio.Task] = None
 
    class Config:
        # Allow arbitrary types so asyncio.Task can be stored as a private attr
        arbitrary_types_allowed = True

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

    async def start_timer(self, on_timer_end) -> None:
        if self.is_timer_running:
            return
        self.is_timer_running = True
        timer = Timer(self.timer_duration, on_timer_end)
        timer.start()
    # TODO: set robot start positions.

    def set_hourglass_duration(self, new_hourglass_duration: int) -> None:
        self.hourglass_duration = new_hourglass_duration

    def set_round_timer_duration(self, new_round_timer_duration: int) -> None:
        self.round_timer_duration = new_round_timer_duration

    def _cancel_round_timer(self) -> None:
        if self._round_timer_task and not self._round_timer_task.done():
            self._round_timer_task.cancel()
        self._round_timer_task = None
        self.is_round_timer_running = False
 
    def _cancel_hourglass(self) -> None:
        if self._hourglass_task and not self._hourglass_task.done():
            self._hourglass_task.cancel()
        self._hourglass_task = None
        self.is_hourglass_running = False

    async def on_round_timer_end(self):
        self.is_round_timer_running = False
        if len(self.bids) == 0:
            # End round without demonstration because no bids were made
             await manager.broadcast(self.game_id, {"type": "round_failed", "payload": self.dict()})

    async def on_timer_end(self):
        self._cancel_hourglass()

        await manager.broadcast(
            self.game_id, {"type": "hourglass_ended", "payload": {}}
        )

        # Save original robots state for resetting upon failed demonstrations
        if not self.original_robots:
            self.original_robots = [r.copy() for r in self.robots]

        # Start demonstration loop
        await self.next_demonstration()

    def start_hourglass_timer(self) -> None:
        if self.is_hourglass_running:
            return
        self._cancel_round_timer()
        self.is_hourglass_running = True

        async def timer_task():
            try:
                # Notify frontend so it can stop the round timer display and
                # start the hourglass display
                await manager.broadcast(
                    self.game_id,
                    {
                        "type": "hourglass_started",
                        "payload": {"duration_seconds": self.hourglass_duration},
                    },
                )
                await asyncio.sleep(self.hourglass_duration)
                if self.is_hourglass_running:
                    await self.on_timer_end()
            except asyncio.CancelledError:
                pass
            finally:
                # Ensure the task reference is cleaned
                self._hourglass_task = None

        self._hourglass_task = asyncio.create_task(timer_task())

    def start_round_timer(self) -> None:
        if self.is_round_timer_running:
            return
        self._cancel_round_timer()
        self.is_round_timer_running = True
        duration_seconds = self.round_timer_duration * 60

        async def timer_task():
            try:
                # Notify frontend so it can start a synchronised display
                await manager.broadcast(
                    self.game_id,
                    {
                        "type": "round_timer_started",
                        "payload": {"duration_seconds": duration_seconds},
                    },
                )
                await asyncio.sleep(duration_seconds)
                if self.is_round_timer_running:
                    await self.on_round_timer_end()
            except asyncio.CancelledError:
                pass

        self._round_timer_task = asyncio.create_task(timer_task())
    
    async def next_demonstration(self):
        # Reset board to original round starting positions
        if self.original_robots:
            self.robots = [r.copy() for r in self.original_robots]
            
        if len(self.bids) > 0:
            next_bid = self.bids[0]
            self.demonstrating_player_id = next_bid.player_id
            self.demonstration_moves = []
            payload = {"player_id": self.demonstrating_player_id, "bid": next_bid.dict(), "robots": self.robots}
            await manager.broadcast(self.game_id, {"type": "demonstration_started", "payload": payload})
        else:
            self.demonstrating_player_id = None
            self.demonstration_moves = []
            payload = {"message": "No bids left!", "robots": self.robots}
            await manager.broadcast(self.game_id, {"type": "demonstration_failed", "payload": payload})
    
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
        target_x = self.goal_chip.get("x")
        target_y = self.goal_chip.get("y")
        target_color = self.goal_chip.get("color") or self.goal_chip.get("robotId") or ""
        
        for robot in self.robots:
            if robot["x"] == target_x and robot["y"] == target_y:
                # The robot color should match the chip color
                if str(robot.get("id")).lower() == target_color.lower() or target_color.lower() in str(robot.get("id")).lower():
                    chip_reached = True
                    break
                    
        return chip_reached

    async def finish_demonstration(self) -> None:
        is_valid = await self.validate_demonstration()
        
        if self.goal_chip is not None:
            if self.demonstrating_player_id is not None:
                if is_valid:
                    player = self.is_player(self.demonstrating_player_id)
                    if player:
                        player.won_chips.append(self.goal_chip)
                    
                    # Demonstration succeeded, clear round state
                    self.demonstrating_player_id = None
                    self.demonstration_moves = []
                    self.bids = []
                    self.original_robots = []
                    
                    # Safely remove goal chip from chips list
                    target_x = self.goal_chip.get("x")
                    target_y = self.goal_chip.get("y")
                    for chip in self.chips:
                        if chip.get("x") == target_x and chip.get("y") == target_y:
                            self.chips.remove(chip)
                            break
                            
                    payload = {"winner_name": player.player_name if player else None, "game": self.dict(), "robots": self.robots, "targets": self.chips}
                    if len(self.chips) == 0:
                        await self.end_game()
                    else:
                        await manager.broadcast(self.game_id, {"type": "demonstration_success", "payload": payload})
                else:
                    # Demonstration failed
                    self.bids.pop(0)
                    await self.next_demonstration()
    
    async def end_game(self) -> None:
        self._cancel_round_timer()
        self._cancel_hourglass()

        winners: List[Player]  = []
        for player in self.player_list:
            if len(winners) == 0:
                if len(player.won_chips) != 0:
                    winners.append(player)
            else:
                for winner in winners:
                    if len(player.won_chips) == len(winner.won_chips):
                        winners.append(player)
                    elif len(player.won_chips) > len(winner.won_chips):
                        winners.remove(winner)
                        if player not in winners:
                            winners.append(player)
        await manager.broadcast(self.game_id, {"type": "end_game", "payload": winners})

# In-memory game and player state.
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
