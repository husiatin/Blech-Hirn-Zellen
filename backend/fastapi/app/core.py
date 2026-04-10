from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Callable, FrozenSet


@dataclass(frozen=True, order=True)
class Pos:
    row: int
    col: int

    def step(self, delta: tuple[int, int]) -> "Pos":
        dr, dc = delta
        return Pos(self.row + dr, self.col + dc)


@dataclass(frozen=True)
class State:
    robots: tuple[Pos, ...]

    def moved(self, robot_idx: int, new_pos: Pos) -> "State":
        robots = list(self.robots)
        robots[robot_idx] = new_pos
        return State(tuple(robots))


Cell = tuple[int, int]


@dataclass(frozen=True)
class Walls:
    vertical: FrozenSet[Cell] = frozenset()
    horizontal: FrozenSet[Cell] = frozenset()


DIRECTIONS: dict[str, tuple[int, int]] = {
    "up": (-1, 0),
    "down": (1, 0),
    "left": (0, -1),
    "right": (0, 1),
}


def is_blocked(
    pos: Pos,
    next_pos: Pos,
    walls: Walls,
    occupied: set[Pos] | FrozenSet[Pos],
) -> bool:
    if next_pos.row < 0 or next_pos.col < 0:
        return True
    if next_pos in occupied:
        return True

    d_row = next_pos.row - pos.row
    d_col = next_pos.col - pos.col

    if d_row == 0 and d_col == 1:
        return (pos.col, pos.row) in walls.vertical

    if d_row == 0 and d_col == -1:
        if pos.col == 0:
            return True
        return (pos.col - 1, pos.row) in walls.vertical

    if d_row == 1 and d_col == 0:
        return (pos.col, pos.row) in walls.horizontal

    if d_row == -1 and d_col == 0:
        if pos.row == 0:
            return True
        return (pos.col, pos.row - 1) in walls.horizontal

    raise ValueError("is_blocked expects adjacent cells")


def _resolve_direction(direction: str | tuple[int, int]) -> tuple[int, int]:
    if isinstance(direction, str):
        try:
            return DIRECTIONS[direction]
        except KeyError as exc:
            raise ValueError(f"Unknown direction: {direction}") from exc
    return direction


def slide(
    state: State,
    robot_idx: int,
    direction: str | tuple[int, int],
    n: int,
    walls: Walls,
) -> State:
    delta = _resolve_direction(direction)
    current = state.robots[robot_idx]
    occupied = set(state.robots)
    occupied.remove(current)

    while True:
        nxt = current.step(delta)
        if not (0 <= nxt.row < n and 0 <= nxt.col < n):
            break
        if is_blocked(current, nxt, walls, occupied):
            break
        current = nxt

    if current == state.robots[robot_idx]:
        return state
    return state.moved(robot_idx, current)


def neighbors(state: State, n: int, walls: Walls) -> list[State]:
    result: list[State] = []
    seen: set[State] = set()
    for robot_idx in range(len(state.robots)):
        for delta in DIRECTIONS.values():
            nxt = slide(state, robot_idx, delta, n, walls)
            if nxt != state and nxt not in seen:
                seen.add(nxt)
                result.append(nxt)
    return result


def bfs_shortest_path(
    start: State,
    goal_predicate: Callable[[State], bool],
    n: int,
    walls: Walls,
    max_depth: int = 15,
    path_validator: Callable[[list[tuple[int, Pos, Pos]]], bool] | None = None,
    target_robot_idx: int | None = None,
) -> list[tuple[int, Pos, Pos]] | None:
    if goal_predicate(start):
        return []

    queue = deque([(start, [], 0)])
    visited = {(start, 0)}

    while queue:
        state, path, axes_mask = queue.popleft()

        if len(path) >= max_depth:
            continue

        for robot_idx in range(len(state.robots)):
            for delta in DIRECTIONS.values():
                nxt = slide(state, robot_idx, delta, n, walls)

                nxt_axes_mask = axes_mask
                if target_robot_idx is not None and robot_idx == target_robot_idx:
                    start_pos = state.robots[robot_idx]
                    end_pos = nxt.robots[robot_idx]
                    if start_pos.row == end_pos.row and start_pos.col != end_pos.col:
                        nxt_axes_mask |= 1
                    elif start_pos.col == end_pos.col and start_pos.row != end_pos.row:
                        nxt_axes_mask |= 2

                visit_key = (nxt, nxt_axes_mask)
                if nxt != state and visit_key not in visited:
                    start_pos = state.robots[robot_idx]
                    end_pos = nxt.robots[robot_idx]
                    new_path = path + [(robot_idx, start_pos, end_pos)]

                    if goal_predicate(nxt):
                        if path_validator is None or path_validator(new_path):
                            return new_path
                        continue

                    visited.add(visit_key)
                    queue.append((nxt, new_path, nxt_axes_mask))

    return None
