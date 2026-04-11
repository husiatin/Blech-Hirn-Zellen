import asyncio
import random
import time
from typing import List, Optional, Any
from pydantic import BaseModel, Field
from threading import Timer
import logging

from .models import Player, Board, Bid, GameStatus, RoundPhase, Move
from .notifications import manager
from .core import State, Walls, bfs_shortest_path
from .core_adapter import board_data_to_walls, robots_to_state


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
    initial_robots: List[dict[str, Any]] = Field(default_factory=list)
    robots: List[dict[str, Any]] = Field(default_factory=list)
    chips: List[dict[str, Any]] = Field(default_factory=list)
    initial_chips: List[dict[str, Any]] = Field(default_factory=list)
    goal_chip: Optional[dict[str, Any]] = None
    replay_duration_seconds: int = 60
    replay_votes: dict[str, str] = Field(default_factory=dict)
    round_timer_ends_at: Optional[float] = None
    hourglass_ends_at: Optional[float] = None
    replay_vote_ends_at: Optional[float] = None

    # asyncio Task handles excluded from Pydantic serialisation
    _hourglass_task: Optional[asyncio.Task] = None
    _round_timer_task: Optional[asyncio.Task] = None
    _replay_task: Optional[asyncio.Task] = None
    _round_transition_task: Optional[asyncio.Task] = None

    _solution_move_step_delay_seconds: float = 1.0
    _solution_initial_delay_seconds: float = 1.0
    _solution_final_hold_seconds: float = 7.0
 
    class Config:
        # Allow arbitrary types so asyncio.Task can be stored as a private attr
        arbitrary_types_allowed = True

    def is_player(self, player_id: str) -> Optional[Player]:
        for player in self.player_list:
            if player.player_id == player_id:
                return player
        return None

    def _now_ts(self) -> float:
        return time.time()

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
        self.round_timer_ends_at = None
 
    def _cancel_hourglass(self) -> None:
        if self._hourglass_task and not self._hourglass_task.done():
            self._hourglass_task.cancel()
        self._hourglass_task = None
        self.is_hourglass_running = False
        self.hourglass_ends_at = None

    def _cancel_replay_timer(self) -> None:
        if self._replay_task and not self._replay_task.done():
            self._replay_task.cancel()
        self._replay_task = None
        self.replay_vote_ends_at = None

    def _cancel_round_transition(self) -> None:
        if self._round_transition_task and not self._round_transition_task.done():
            self._round_transition_task.cancel()
        self._round_transition_task = None

    def _clone_chip(self, chip: dict[str, Any]) -> dict[str, Any]:
        return dict(chip)

    def _board_size(self) -> int:
        return len(self.board.board_data) if self.board and self.board.board_data else 0

    def _center_blocked_cells(self) -> set[tuple[int, int]]:
        board_size = self._board_size()
        if board_size < 2:
            return set()
        center_low = (board_size // 2) - 1
        center_high = board_size // 2
        return {
            (center_low, center_low),
            (center_low, center_high),
            (center_high, center_low),
            (center_high, center_high),
        }

    def randomize_initial_robot_positions(self, robot_templates: Optional[List[dict[str, Any]]] = None) -> List[dict[str, Any]]:
        board_size = self._board_size()
        if board_size <= 0:
            raise ValueError("Board must be present before randomizing robots")

        robot_ids: list[str] = []
        seen_ids: set[str] = set()
        for robot in robot_templates or []:
            robot_id = str(robot.get("id", "")).strip()
            if not robot_id or robot_id in seen_ids:
                continue
            seen_ids.add(robot_id)
            robot_ids.append(robot_id)

        if not robot_ids:
            robot_ids = ["red", "blue", "green", "yellow"]

        blocked_cells = {
            (int(chip.get("x")), int(chip.get("y")))
            for chip in self.chips
            if chip.get("x") is not None and chip.get("y") is not None
        }
        blocked_cells.update(self._center_blocked_cells())

        candidate_cells = [
            (x, y)
            for y in range(board_size)
            for x in range(board_size)
            if (x, y) not in blocked_cells
        ]
        if len(candidate_cells) < len(robot_ids):
            raise ValueError("Not enough free cells to place all robots")

        chosen_cells = random.sample(candidate_cells, len(robot_ids))
        return [
            {"id": robot_id, "x": x, "y": y}
            for robot_id, (x, y) in zip(robot_ids, chosen_cells)
        ]

    def standings(self) -> list[dict[str, Any]]:
        standings = []
        max_chip_count = 0
        for player in self.player_list:
            chip_count = len(player.won_chips)
            max_chip_count = max(max_chip_count, chip_count)
            standings.append(
                {
                    "player_id": player.player_id,
                    "player_name": player.player_name,
                    "won_chips": [self._clone_chip(chip) for chip in player.won_chips],
                    "won_chip_count": chip_count,
                    "is_game_master": player.player_id == self.game_master_id,
                }
            )

        for row in standings:
            row["is_winner"] = bool(standings) and row["won_chip_count"] == max_chip_count

        standings.sort(
            key=lambda row: (
                -row["won_chip_count"],
                str(row["player_name"]).lower(),
                row["player_id"],
            )
        )
        return standings

    def winner_names(self) -> list[str]:
        return [row["player_name"] for row in self.standings() if row["is_winner"]]

    def remove_player(self, player_id: str) -> Optional[Player]:
        for player in self.player_list:
            if player.player_id == player_id:
                self.player_list.remove(player)
                self.player_count = len(self.player_list)
                if self.game_master_id == player_id and self.player_list:
                    self.game_master_id = self.player_list[0].player_id
                return player
        return None

    def reset_for_new_game(self) -> None:
        self._cancel_round_timer()
        self._cancel_hourglass()
        self._cancel_replay_timer()
        self._cancel_round_transition()
        self.game_status = GameStatus.STARTED
        self.round_phase = RoundPhase.PLANNING
        self.bids = []
        self.demonstrating_player_id = None
        self.demonstration_moves = []
        self.replay_votes = {}
        self.round_timer_ends_at = None
        self.hourglass_ends_at = None
        self.replay_vote_ends_at = None
        self.chips = [self._clone_chip(chip) for chip in self.initial_chips]
        self.goal_chip = random.choice(self.chips) if self.chips else None
        self.original_robots = [dict(robot) for robot in self.initial_robots]
        self.robots = [dict(robot) for robot in self.initial_robots]
        for player in self.player_list:
            player.won_chips = []

    def _solution_playback_duration_seconds(self, solution: list | str) -> float:
        if not isinstance(solution, list) or not solution:
            return 0.5
        return (
            self._solution_initial_delay_seconds
            + (len(solution) * self._solution_move_step_delay_seconds)
            + self._solution_final_hold_seconds
        )

    async def start_next_round(self, robots: Optional[List[dict[str, Any]]] = None) -> None:
        self._cancel_round_transition()
        self._cancel_hourglass()
        self._cancel_round_timer()
        self.game_status = GameStatus.STARTED
        self.round_phase = RoundPhase.PLANNING
        self.demonstrating_player_id = None
        self.demonstration_moves = []
        self.bids = []

        next_round_robots = robots if robots is not None else self.original_robots
        self.original_robots = [dict(robot) for robot in next_round_robots]
        self.robots = [dict(robot) for robot in next_round_robots]
        self.goal_chip = random.choice(self.chips) if self.chips else None

        self.start_round_timer()
        await manager.broadcast(self.game_id, {"type": "game_started", "payload": self.dict()})

    def schedule_next_round(self, solution: list | str, robots: Optional[List[dict[str, Any]]] = None) -> None:
        self._cancel_round_transition()
        delay_seconds = self._solution_playback_duration_seconds(solution)
        next_round_robots = [dict(robot) for robot in (robots if robots is not None else self.original_robots)]

        async def transition_task():
            try:
                await asyncio.sleep(delay_seconds)
                if self.game_status == GameStatus.STARTED and self.round_phase == RoundPhase.ROUND_END and self.chips:
                    await self.start_next_round(next_round_robots)
            except asyncio.CancelledError:
                pass
            finally:
                self._round_transition_task = None

        self._round_transition_task = asyncio.create_task(transition_task())

    async def start_replay_vote(self) -> None:
        self._cancel_replay_timer()
        self.replay_votes = {}
        self.replay_vote_ends_at = self._now_ts() + self.replay_duration_seconds

        async def replay_task():
            try:
                await asyncio.sleep(self.replay_duration_seconds)
                await self.finalize_replay_vote()
            except asyncio.CancelledError:
                pass
            finally:
                self._replay_task = None

        self._replay_task = asyncio.create_task(replay_task())

    async def set_replay_vote(self, player_id: str, choice: str) -> None:
        if self.game_status != GameStatus.ENDED:
            return
        if choice not in {"play_again", "leave"}:
            return
        if not self.is_player(player_id):
            return

        self.replay_votes[player_id] = choice
        await manager.broadcast(
            self.game_id,
            {
                "type": "replay_vote_updated",
                "payload": {
                    "player_id": player_id,
                    "choice": choice,
                    "replay_votes": dict(self.replay_votes),
                },
            },
        )

    async def finalize_replay_vote(self) -> None:
        self._cancel_replay_timer()
        self._cancel_round_transition()
        if self.game_status != GameStatus.ENDED:
            return

        staying_player_ids = {
            player.player_id
            for player in self.player_list
            if self.replay_votes.get(player.player_id) == "play_again"
        }
        leaving_player_ids = [player.player_id for player in self.player_list if player.player_id not in staying_player_ids]

        for player_id in leaving_player_ids:
            await manager.send_to_player(
                self.game_id,
                player_id,
                {"type": "removed_from_game", "payload": {"game_id": self.game_id}},
            )
            await manager.disconnect(self.game_id, player_id)

        self.player_list = [player for player in self.player_list if player.player_id in staying_player_ids]
        self.player_count = len(self.player_list)

        if not self.player_list:
            if self in games:
                games.remove(self)
            return

        if self.game_master_id not in {player.player_id for player in self.player_list}:
            self.game_master_id = self.player_list[0].player_id

        self.reset_for_new_game()

        await manager.broadcast(
            self.game_id,
            {
                "type": "replay_vote_result",
                "payload": {
                    "remaining_player_ids": [player.player_id for player in self.player_list],
                    "game_master_id": self.game_master_id,
                },
            },
        )
        self.start_round_timer()
        await manager.broadcast(self.game_id, {"type": "game_started", "payload": self.dict()})

    async def on_round_timer_end(self):
        self.is_round_timer_running = False
        self.round_timer_ends_at = None
        self.round_phase = RoundPhase.REPLAY
        if len(self.bids) == 0:
            # End round without demonstration because no bids were made
            payload = self.dict()
            payload["solution"] = self.calculate_solution()
            await manager.broadcast(self.game_id, {"type": "round_failed", "payload": payload})
            self.round_phase = RoundPhase.ROUND_END
            self.schedule_next_round(payload["solution"], self.original_robots)

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
        self.round_phase = RoundPhase.REPLAY
        self.hourglass_ends_at = self._now_ts() + self.hourglass_duration

        async def timer_task():
            try:
                # Notify frontend so it can stop the round timer display and
                # start the hourglass display
                await manager.broadcast(
                    self.game_id,
                    {
                        "type": "hourglass_started",
                        "payload": {
                            "duration_seconds": self.hourglass_duration,
                            "ends_at": self.hourglass_ends_at,
                        },
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
        self.round_phase = RoundPhase.PLANNING
        duration_seconds = self.round_timer_duration * 60
        self.round_timer_ends_at = self._now_ts() + duration_seconds

        async def timer_task():
            try:
                # Notify frontend so it can start a synchronised display
                await manager.broadcast(
                    self.game_id,
                    {
                        "type": "round_timer_started",
                        "payload": {
                            "duration_seconds": duration_seconds,
                            "ends_at": self.round_timer_ends_at,
                        },
                    },
                )
                await manager.broadcast(
                    self.game_id,
                    {
                        "type": "game_state_sync",
                        "payload": self.dict(),
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
            self.round_phase = RoundPhase.ROUND_END
            solution = self.calculate_solution()
            payload = {"message": "No bids left!", "robots": self.robots, "solution": solution}
            await manager.broadcast(self.game_id, {"type": "demonstration_failed", "payload": payload})
            self.schedule_next_round(solution, self.robots)
    
    async def validate_demonstration(self) -> bool:
        if not self.demonstrating_player_id or len(self.bids) == 0:
            return False
            
        current_bid = self.bids[0]
        
        # 1. Check exact move count
        if len(self.demonstration_moves) != current_bid.number_of_moves:
            return False
            
        target_color = self.goal_chip.get('color') or self.goal_chip.get('robotId') or ''
        # Sets do not allow duplicate values, so we just aggregate unique axes (horizontal and vertical)
        axes = set()
        for move in self.demonstration_moves:
            robot_id = getattr(move, 'robot_id', '') or (move.get('robot_id', '') if isinstance(move, dict) else '')
            if str(robot_id).lower() == target_color.lower() or target_color.lower() in str(robot_id).lower():
                start_x = getattr(move, 'startX', 0) if not isinstance(move, dict) else move.get('startX', 0)
                start_y = getattr(move, 'startY', 0) if not isinstance(move, dict) else move.get('startY', 0)
                new_x = getattr(move, 'newX', 0) if not isinstance(move, dict) else move.get('newX', 0)
                new_y = getattr(move, 'newY', 0) if not isinstance(move, dict) else move.get('newY', 0)
                # Check axis of movement (assumes X = horizontal, Y = vertical)
                if start_y == new_y and start_x != new_x:
                    axes.add('H')
                elif start_x == new_x and start_y != new_y:
                    axes.add('V')
        # Both horizontal and vertical movements must be present = a true 90 degree turn occurred
        if len(axes) < 2:
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
                    self.round_phase = RoundPhase.ROUND_END
                    self.demonstrating_player_id = None
                    self.demonstration_moves = []
                    self.bids = []
                    
                    # Safely remove goal chip from chips list
                    target_x = self.goal_chip.get("x")
                    target_y = self.goal_chip.get("y")
                    for chip in self.chips:
                        if chip.get("x") == target_x and chip.get("y") == target_y:
                            self.chips.remove(chip)
                            break
                            
                    next_round_robots = [dict(robot) for robot in self.robots]
                    solution = self.calculate_solution()
                    payload = {"winner_name": player.player_name if player else None, "game": self.dict(), "robots": next_round_robots, "targets": self.chips, "solution": solution}
                    if len(self.chips) == 0:
                        await self.end_game()
                    else:
                        await manager.broadcast(self.game_id, {"type": "demonstration_success", "payload": payload})
                        self.schedule_next_round(solution, next_round_robots)
                else:
                    # Demonstration failed
                    self.bids.pop(0)
                    await self.next_demonstration()
    
    async def end_game(self) -> None:
        self._cancel_round_timer()
        self._cancel_hourglass()
        self._cancel_replay_timer()
        self._cancel_round_transition()
        self.game_status = GameStatus.ENDED
        self.round_phase = RoundPhase.ROUND_END
        standings = self.standings()
        await self.start_replay_vote()
        await manager.broadcast(
            self.game_id,
            {
                "type": "end_game",
                "payload": {
                    "game_id": self.game_id,
                    "standings": standings,
                    "winner_names": self.winner_names(),
                    "replay_duration_seconds": self.replay_duration_seconds,
                    "replay_votes": {},
                },
            },
        )

    def calculate_solution(self) -> list | str:
        if not self.goal_chip or not self.original_robots or not self.board:
            return "Solution too complex to find quickly"
            
        
        
        walls = board_data_to_walls(self.board.board_data)
        n = len(self.board.board_data)
        
        start_state, robot_ids = robots_to_state(self.original_robots)
        
        target_x = self.goal_chip.get("x")
        target_y = self.goal_chip.get("y")
        target_color = self.goal_chip.get("color") or self.goal_chip.get("robotId") or ""
        
        target_robot_idx = -1
        for idx, r_id in enumerate(robot_ids):
            if str(r_id).lower() == target_color.lower() or target_color.lower() in str(r_id).lower():
                target_robot_idx = idx
                break
                
        if target_robot_idx == -1:
            return "Solution too complex to find quickly"
            
        def goal_predicate(state: State) -> bool:
            pos = state.robots[target_robot_idx]
            return pos.col == target_x and pos.row == target_y
            
        def path_validator(path: list[tuple[int, Any, Any]]) -> bool:
            # Sets do not allow duplicate values, so we just aggregate unique axes (horizontal and vertical)
            axes = set()
            for current_robot_idx, start_pos, end_pos in path:
                if current_robot_idx == target_robot_idx:
                    if start_pos.row == end_pos.row and start_pos.col != end_pos.col:
                        axes.add('H')
                    elif start_pos.col == end_pos.col and start_pos.row != end_pos.row:
                        axes.add('V')
            return len(axes) == 2

        path = bfs_shortest_path(start_state, goal_predicate, n, walls, path_validator=path_validator, target_robot_idx=target_robot_idx)
        if path is None:
            return "Solution too complex to find quickly"
            
        solution_moves = []
        for robot_idx, start_pos, end_pos in path:
            solution_moves.append({
                "robot_id": robot_ids[robot_idx],
                "startX": start_pos.col,
                "startY": start_pos.row,
                "newX": end_pos.col,
                "newY": end_pos.row
            })
            
        return solution_moves

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
