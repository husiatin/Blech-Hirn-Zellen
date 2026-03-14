from __future__ import annotations

"""
This file is an adapter between frontend payload formats and core domain logic.

Goal:
- Frontend sends/expects `board_data[y][x]` with wall bitmasks (N/E/S/W).
- Core uses `Walls` (vertical/horizontal segments) and `State` with `Pos(row, col)`.

The adapter only translates formats and intentionally contains no game rules.

TODO roadmap:
- Move shared wall bit constants to a single shared module used by frontend/backend.
- Add dedicated tests for malformed board payloads and id/order mismatches.
- Consider strict payload models instead of generic `dict[str, Any]` robot objects.
"""

from typing import Any, Sequence

from .core import Pos, State, Walls

# Bit values in the frontend format:
# N=1, E=2, S=4, W=8
WALL_N = 1
WALL_E = 2
WALL_S = 4
WALL_W = 8


def board_data_to_walls(board_data: Sequence[Sequence[int]]) -> Walls:
    """Convert frontend `board_data[y][x]` into `Walls` from core.py."""
    n = len(board_data)
    if n == 0:
        return Walls()
    if any(len(row) != n for row in board_data):
        raise ValueError("board_data must be a square matrix")

    vertical: set[tuple[int, int]] = set()
    horizontal: set[tuple[int, int]] = set()

    for y, row in enumerate(board_data):
        for x, cell in enumerate(row):
            # E at (x,y) means a vertical segment to the right of the cell: V[x,y]
            if cell & WALL_E:
                vertical.add((x, y))
            # W at (x,y) is the same segment as E on the left neighbor: V[x-1,y]
            if cell & WALL_W and x > 0:
                vertical.add((x - 1, y))
            # S at (x,y) means a horizontal segment below the cell: H[x,y]
            if cell & WALL_S:
                horizontal.add((x, y))
            # N at (x,y) is the same segment as S on the upper neighbor: H[x,y-1]
            if cell & WALL_N and y > 0:
                horizontal.add((x, y - 1))

    return Walls(vertical=frozenset(vertical), horizontal=frozenset(horizontal))


def walls_to_board_data(
    n: int,
    walls: Walls,
    include_outer_borders: bool = True,
) -> list[list[int]]:
    """Convert `Walls` into frontend `board_data[y][x]`."""
    board = [[0 for _ in range(n)] for _ in range(n)]

    if include_outer_borders:
        # Explicit border bits for frontends that expect outer walls as bits.
        for i in range(n):
            board[0][i] |= WALL_N
            board[n - 1][i] |= WALL_S
            board[i][0] |= WALL_W
            board[i][n - 1] |= WALL_E

    for col, row in walls.vertical:
        # Vertical segment lies between (col,row) and (col+1,row).
        if 0 <= col < n and 0 <= row < n:
            board[row][col] |= WALL_E
        if 0 <= col + 1 < n and 0 <= row < n:
            board[row][col + 1] |= WALL_W

    for col, row in walls.horizontal:
        # Horizontal segment lies between (col,row) and (col,row+1).
        if 0 <= col < n and 0 <= row < n:
            board[row][col] |= WALL_S
        if 0 <= col < n and 0 <= row + 1 < n:
            board[row + 1][col] |= WALL_N

    return board


def robots_to_state(robots: Sequence[dict[str, Any]]) -> tuple[State, tuple[str, ...]]:
    """Convert frontend robot list [{id,x,y,...}] into `State`."""
    positions: list[Pos] = []
    robot_ids: list[str] = []

    for robot in robots:
        if "id" not in robot or "x" not in robot or "y" not in robot:
            raise ValueError("each robot must have id, x, y")

        robot_ids.append(str(robot["id"]))
        # Frontend uses x/y, core uses Pos(row, col)
        positions.append(Pos(row=int(robot["y"]), col=int(robot["x"])))

    return State(robots=tuple(positions)), tuple(robot_ids)


def state_to_robots(
    state: State,
    robot_ids: Sequence[str],
    template: Sequence[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Convert `State` back into frontend robot objects."""
    if len(state.robots) != len(robot_ids):
        raise ValueError("state robot count and robot_ids length must match")

    # Keep optional existing fields (for example: color).
    template_map = {str(r.get("id")): dict(r) for r in (template or []) if "id" in r}
    result: list[dict[str, Any]] = []

    for idx, pos in enumerate(state.robots):
        robot_id = str(robot_ids[idx])
        item = template_map.get(robot_id, {"id": robot_id})
        item["x"] = pos.col
        item["y"] = pos.row
        result.append(item)

    return result
