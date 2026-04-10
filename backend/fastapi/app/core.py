from __future__ import annotations
from collections import deque
from dataclasses import dataclass
import random
from typing import Callable, FrozenSet

# eine Zelle im Spielfeld Pos = Position auf dem Spielfeld
@dataclass(frozen=True, order=True)
class Pos:
    row: int
    col: int

    # berechnet eine neue Position delta row, delta colum 
    def step(self, delta: tuple[int, int]) -> "Pos":
        dr, dc = delta
        return Pos(self.row + dr, self.col + dc)


# State beschreibt den gesamten spielzustand / wo roboter gerade stehen 
@dataclass(frozen=True) 
class State:
    robots: tuple[Pos, ...] # robots ist eine auflistung von positionen ... bedeutet beliebig viele 

    def moved(self, robot_idx: int, new_pos: Pos) -> "State":
        robots = list(self.robots)
        robots[robot_idx] = new_pos # robot_indx index 
        return State(tuple(robots))


Cell = tuple[int, int]  # (col, row)


@dataclass(frozen=True)
class Walls:
    # V speichert vertikale Blockaden V[col, row]:
    # blockiert den Übergang von (col, row) nach (col+1, row) (also nach rechts).
    vertical: FrozenSet[Cell] = frozenset()
    # H speichert horizontale Blockaden H[col, row]:
    # blockiert den Übergang von (col, row) nach (col, row+1) (also nach unten).
    horizontal: FrozenSet[Cell] = frozenset()


DEFAULT_BOARD_SIZE = 8 # definiert die Bordgröße

# selbsterklärend alle bewegungsrichtungen
DIRECTIONS: dict[str, tuple[int, int]] = {
    "up": (-1, 0),
    "down": (1, 0),
    "left": (0, -1),
    "right": (0, 1),
}


def validate_board_size(n: int) -> int:
    if n <= 0:
        raise ValueError("Board size n must be > 0")
    if n % 2 != 0:
        raise ValueError("Board size n must be even (e.g. 8)")
    return n


def generate_board(n: int = DEFAULT_BOARD_SIZE) -> tuple[Cell, ...]:
    """Generate all cells as (col, row) tuples for an n x n board."""
    validate_board_size(n)
    return tuple((col, row) for row in range(n) for col in range(n))


def make_vertical_wall(col: int, row: int) -> Walls:
    """Erzeugt eine vertikale Mauer V[col, row] (rechts von Zelle (col, row))."""
    return Walls(vertical=frozenset({(col, row)}))


def make_horizontal_wall(col: int, row: int) -> Walls:
    """Erzeugt eine horizontale Mauer H[col, row] (unter Zelle (col, row))."""
    return Walls(horizontal=frozenset({(col, row)}))


def merge_walls(*parts: Walls) -> Walls:
    """Fasst mehrere Walls-Objekte zusammen."""
    vertical: set[Cell] = set()
    horizontal: set[Cell] = set()
    for part in parts:
        vertical.update(part.vertical)
        horizontal.update(part.horizontal)
    return Walls(vertical=frozenset(vertical), horizontal=frozenset(horizontal))


def subtract_walls(walls: Walls, to_remove: Walls) -> Walls:
    """Entfernt Mauersegmente aus `walls` (nützlich für Spezialmuster-Ausnahmen)."""
    return Walls(
        vertical=frozenset(set(walls.vertical) - set(to_remove.vertical)),
        horizontal=frozenset(set(walls.horizontal) - set(to_remove.horizontal)),
    )


def can_add_walls(
    existing: Walls,
    new_part: Walls,
    n: int,
    min_distance: int = 1,
    *,
    ignore_for_constraints: Walls | None = None,
) -> bool:
    """Filter beim Aufbau: True, wenn `new_part` zu `existing` hinzugefügt werden darf."""
    combined = merge_walls(existing, new_part)
    return is_valid_wall_pattern(
        combined,
        n=n,
        min_distance=min_distance,
        ignore_for_constraints=ignore_for_constraints,
    )


def make_wall(a: Pos, b: Pos) -> Walls:
    """Kompatibilitäts-Helfer: aus zwei benachbarten Pos eine Walls-Struktur bauen."""
    if abs(a.row - b.row) + abs(a.col - b.col) != 1:
        raise ValueError("Walls must connect orthogonally adjacent cells")
    # Wir ordnen die beiden Zellen so, dass immer die 'linke/obere' Zelle speichert.
    if a.row == b.row:
        left = a if a.col < b.col else b
        return make_vertical_wall(left.col, left.row)
    upper = a if a.row < b.row else b
    return make_horizontal_wall(upper.col, upper.row)


def central_square_walls(n: int) -> Walls:
    """Erzeugt die zentrale 2x2-Sperre für gerade Brettgrößen.

    Bei n=8 (0-basiert) werden die Zellen (3,3), (4,3), (3,4), (4,4) umschlossen.
    Das entspricht 1-basiert den Zellen (4,4), (5,4), (4,5), (5,5).
    """
    validate_board_size(n)
    half = n // 2
    left_col = half - 1
    right_col = half
    top_row = half - 1
    bottom_row = half

    # Perimeter um die 2x2-Mitte
    return merge_walls(
        make_vertical_wall(left_col - 1, top_row),
        make_vertical_wall(left_col - 1, bottom_row),
        make_vertical_wall(right_col, top_row),
        make_vertical_wall(right_col, bottom_row),
        make_horizontal_wall(left_col, top_row - 1),
        make_horizontal_wall(right_col, top_row - 1),
        make_horizontal_wall(left_col, bottom_row),
        make_horizontal_wall(right_col, bottom_row),
    )


def _wall_indices_in_bounds(walls: Walls, n: int) -> bool:
    # V[col,row] und H[col,row] dürfen jeweils auch am rechten/unteren Rand liegen (Index n-1).
    valid = range(n)
    return all(col in valid and row in valid for col, row in walls.vertical | walls.horizontal)


def _segment_endpoints(kind: str, col: int, row: int) -> tuple[Cell, Cell]:
    """Abbildung einer gespeicherten Mauer auf Kanten im Gitter der Zell-Ecken."""
    if kind == "V":
        # Vertikale Kante rechts von Zelle (col,row): x = col+1, y = row..row+1
        return ((col + 1, row), (col + 1, row + 1))
    # Horizontale Kante unter Zelle (col,row): y = row+1, x = col..col+1
    return ((col, row + 1), (col + 1, row + 1))


def _wall_segments(walls: Walls) -> tuple[tuple[str, int, int], ...]:
    segments: list[tuple[str, int, int]] = []
    segments.extend(("V", col, row) for col, row in walls.vertical)
    segments.extend(("H", col, row) for col, row in walls.horizontal)
    return tuple(segments)


def _segment_signature_set(walls: Walls) -> set[tuple[str, int, int]]:
    return set(_wall_segments(walls))


def _is_outer_border_segment(kind: str, col: int, row: int, n: int) -> bool:
    # Explizite Randsegmente am rechten/unteren Rand sind in der ASCII-Ausgabe nicht sichtbar,
    # weil der Außenrahmen immer gezeichnet wird.
    if kind == "V":
        return col == n - 1
    return row == n - 1


def _cell_has_opposite_explicit_walls(walls: Walls, col: int, row: int) -> bool:
    left = (col - 1, row) in walls.vertical if col > 0 else False
    right = (col, row) in walls.vertical
    top = (col, row - 1) in walls.horizontal if row > 0 else False
    bottom = (col, row) in walls.horizontal
    # Gegenüberstehend heißt hier: links+rechts oder oben+unten an derselben Zelle.
    return (left and right) or (top and bottom)


def _component_indices(segments: tuple[tuple[str, int, int], ...]) -> list[list[int]]:
    endpoint_to_segments: dict[Cell, list[int]] = {}
    for idx, (kind, col, row) in enumerate(segments):
        a, b = _segment_endpoints(kind, col, row)
        endpoint_to_segments.setdefault(a, []).append(idx)
        endpoint_to_segments.setdefault(b, []).append(idx)

    adj: dict[int, set[int]] = {i: set() for i in range(len(segments))}
    for ids in endpoint_to_segments.values():
        for i in ids:
            for j in ids:
                if i != j:
                    adj[i].add(j)

    components: list[list[int]] = []
    seen: set[int] = set()
    for start in range(len(segments)):
        if start in seen:
            continue
        stack = [start]
        comp: list[int] = []
        seen.add(start)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for nxt in adj[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        components.append(comp)
    return components


def _shares_endpoint_with_any(candidate: Walls, others: Walls) -> bool:
    """True, wenn ein Kandidat einen Eckpunkt mit einem bestehenden Mauersegment teilt."""
    candidate_segments = _wall_segments(candidate)
    other_segments = _wall_segments(others)
    if not candidate_segments or not other_segments:
        return False
    candidate_points: set[Cell] = set()
    for kind, col, row in candidate_segments:
        a, b = _segment_endpoints(kind, col, row)
        candidate_points.add(a)
        candidate_points.add(b)
    for kind, col, row in other_segments:
        a, b = _segment_endpoints(kind, col, row)
        if a in candidate_points or b in candidate_points:
            return True
    return False


def _components_too_close(
    segments: tuple[tuple[str, int, int], ...],
    min_distance: int,
) -> bool:
    if min_distance <= 0 or len(segments) < 2:
        return False

    comps = _component_indices(segments)
    if len(comps) < 2:
        return False

    # Distanz über "Ankerzellen" (col,row) der gespeicherten V/H-Einträge.
    # Für d=1 bedeutet das: zwei getrennte Mauergebilde dürfen nicht direkt benachbart liegen.
    anchors = [(col, row) for _, col, row in segments]
    for i in range(len(comps)):
        for j in range(i + 1, len(comps)):
            for si in comps[i]:
                for sj in comps[j]:
                    c1, r1 = anchors[si]
                    c2, r2 = anchors[sj]
                    if abs(c1 - c2) + abs(r1 - r2) <= min_distance:
                        return True
    return False


def find_wall_pattern_violations(
    walls: Walls,
    n: int,
    min_distance: int = 1,
    *,
    ignore_for_constraints: Walls | None = None,
) -> list[str]:
    """Prüft lokale Constraints für Wandmuster und liefert eine Liste von Verstößen."""
    validate_board_size(n)
    violations: list[str] = []

    if not _wall_indices_in_bounds(walls, n):
        violations.append("wall index out of bounds for board size n")
        return violations

    # Spezialmuster (z.B. zentrale 2x2-Sperre) können von lokalen Formregeln ausgenommen werden.
    filtered = walls if ignore_for_constraints is None else subtract_walls(walls, ignore_for_constraints)
    segments = _wall_segments(filtered)

    # 1) Keine gegenüberstehenden expliziten Wände an derselben Zelle.
    for row in range(n):
        for col in range(n):
            if _cell_has_opposite_explicit_walls(filtered, col, row):
                violations.append("opposite walls on same cell are not allowed")
                break
        if violations:
            break

    # 2) Verbindungen nur im 90°-Winkel, keine gerade Linie '--' oder '|'.
    endpoint_to_segments: dict[Cell, list[int]] = {}
    for idx, (kind, col, row) in enumerate(segments):
        a, b = _segment_endpoints(kind, col, row)
        endpoint_to_segments.setdefault(a, []).append(idx)
        endpoint_to_segments.setdefault(b, []).append(idx)

    for ids in endpoint_to_segments.values():
        if len(ids) > 3:
            violations.append("more than 3 walls connected at one corner")
            break
        if len(ids) < 2:
            continue
        kinds = {segments[idx][0] for idx in ids}
        # Zwei (oder mehr) gleiche Orientierungen am selben Eckpunkt würden eine Linie bilden.
        if len(ids) >= 2 and ("V" in kinds and sum(segments[idx][0] == "V" for idx in ids) >= 2):
            violations.append("straight wall lines are not allowed (vertical)")
            break
        if len(ids) >= 2 and ("H" in kinds and sum(segments[idx][0] == "H" for idx in ids) >= 2):
            violations.append("straight wall lines are not allowed (horizontal)")
            break

    # 3) Abstand zwischen getrennten Mauergebilden.
    if _components_too_close(segments, min_distance=min_distance):
        violations.append(f"wall components must have distance > {min_distance}")

    return violations


def is_valid_wall_pattern(
    walls: Walls,
    n: int,
    min_distance: int = 1,
    *,
    ignore_for_constraints: Walls | None = None,
) -> bool:
    return not find_wall_pattern_violations(
        walls,
        n=n,
        min_distance=min_distance,
        ignore_for_constraints=ignore_for_constraints,
    )


def _wall_anchor_quadrant(col: int, row: int, n: int) -> int:
    """Quadrant eines Mauer-Ankers (col,row): 0=OL, 1=OR, 2=UL, 3=UR (unten/rechts)."""
    half = n // 2
    top = row < half
    left = col < half
    if top and left:
        return 0
    if top and not left:
        return 1
    if not top and left:
        return 2
    return 3


def walls_have_all_quadrants(
    walls: Walls,
    n: int,
    *,
    exclude: Walls | None = None,
    visible_only: bool = True,
) -> bool:
    excluded = _segment_signature_set(exclude) if exclude is not None else set()
    found: set[int] = set()
    for kind, col, row in _wall_segments(walls):
        if (kind, col, row) in excluded:
            continue
        if visible_only and _is_outer_border_segment(kind, col, row, n):
            continue
        found.add(_wall_anchor_quadrant(col, row, n))
    return len(found) == 4


def _cell_quadrant(col: int, row: int, n: int) -> int:
    half = n // 2
    return (0 if row < half else 2) + (0 if col < half else 1)


def central_block_cells(n: int) -> frozenset[Cell]:
    """Die 4 gesperrten Mittelzellen (bei geradem n)."""
    validate_board_size(n)
    half = n // 2
    return frozenset(
        {
            (half - 1, half - 1),
            (half, half - 1),
            (half - 1, half),
            (half, half),
        }
    )


def playable_cells(n: int, walls: Walls | None = None) -> tuple[Cell, ...]:
    """Alle spielbaren Zellen als (col,row).

    Wenn die zentrale 2x2-Sperre im Brett vorhanden ist, werden diese 4 Zellen ausgeschlossen.
    """
    cells = list(generate_board(n))
    if walls is None:
        return tuple(cells)
    center = central_square_walls(n)
    has_center = center.vertical.issubset(walls.vertical) and center.horizontal.issubset(walls.horizontal)
    if not has_center:
        return tuple(cells)
    blocked = central_block_cells(n)
    return tuple(cell for cell in cells if cell not in blocked)


def generate_start_state(
    n: int = DEFAULT_BOARD_SIZE,
    *,
    seed: int | None = None,
) -> State:
    """Erzeugt einen festen Startzustand mit 4 Robotern, je einer pro Quadrant.

    Die 4 zentralen gesperrten Zellen werden ausgelassen.
    """
    validate_board_size(n)
    rng = random.Random(seed)
    forbidden = central_block_cells(n)

    robots: list[Pos] = []
    for quadrant in range(4):
        cells = [
            (col, row)
            for col, row in generate_board(n)
            if (col, row) not in forbidden and _cell_quadrant(col, row, n) == quadrant
        ]
        if not cells:
            raise ValueError(f"No valid start cells in quadrant {quadrant}")
        col, row = rng.choice(cells)
        robots.append(Pos(row=row, col=col))
    return State(tuple(robots))


def reachable_positions_by_robot_report(
    start: State,
    n: int,
    walls: Walls,
    *,
    max_states: int | None = None,
) -> tuple[tuple[frozenset[Pos], ...], bool, int]:
    """BFS über Zustände; sammelt pro Roboter alle erreichten Positionen.

    Rückgabe: (positionen_pro_roboter, complete, visited_state_count)
    - complete=False bedeutet: Suche wurde bei `max_states` abgebrochen (Teilresultat).
    """
    visited = {start}
    queue = deque([start])
    per_robot: list[set[Pos]] = [set() for _ in start.robots]
    for idx, pos in enumerate(start.robots):
        per_robot[idx].add(pos)

    while queue:
        if max_states is not None and len(visited) >= max_states:
            return tuple(frozenset(s) for s in per_robot), False, len(visited)
        state = queue.popleft()
        for idx, pos in enumerate(state.robots):
            per_robot[idx].add(pos)
        for nxt in neighbors(state, n, walls):
            if nxt in visited:
                continue
            visited.add(nxt)
            queue.append(nxt)

    return tuple(frozenset(s) for s in per_robot), True, len(visited)


def reachable_positions_by_robot(start: State, n: int, walls: Walls) -> tuple[frozenset[Pos], ...]:
    positions, _, _ = reachable_positions_by_robot_report(start, n, walls)
    return positions


def unreachable_target_fields(
    start: State,
    n: int,
    walls: Walls,
    *,
    targets: tuple[Cell, ...] | None = None,
) -> dict[int, tuple[Cell, ...]]:
    """Liefert pro Roboter die nicht erreichbaren Zielfelder (col,row)."""
    missing, _, _ = unreachable_target_fields_report(start, n, walls, targets=targets)
    return missing


def unreachable_target_fields_report(
    start: State,
    n: int,
    walls: Walls,
    *,
    targets: tuple[Cell, ...] | None = None,
    max_states: int | None = None,
) -> tuple[dict[int, tuple[Cell, ...]], bool, int]:
    """Wie `unreachable_target_fields`, aber mit Report über Vollständigkeit/State-Anzahl."""
    target_cells = targets if targets is not None else playable_cells(n, walls)
    target_pos = {Pos(row=row, col=col) for col, row in target_cells}
    reachable, complete, visited_count = reachable_positions_by_robot_report(
        start,
        n,
        walls,
        max_states=max_states,
    )

    result: dict[int, tuple[Cell, ...]] = {}
    for idx, positions in enumerate(reachable):
        missing = sorted((pos.col, pos.row) for pos in (target_pos - set(positions)))
        result[idx] = tuple(missing)
    return result, complete, visited_count


def _single_wall_in_set(candidate: Walls, walls: Walls) -> bool:
    if candidate.vertical:
        return next(iter(candidate.vertical)) in walls.vertical
    if candidate.horizontal:
        return next(iter(candidate.horizontal)) in walls.horizontal
    return False


def _candidate_overlaps(candidate: Walls, walls: Walls) -> bool:
    return bool(candidate.vertical & walls.vertical) or bool(candidate.horizontal & walls.horizontal)


def _candidate_quadrants(candidate: Walls, n: int) -> set[int]:
    quadrants: set[int] = set()
    for kind, col, row in _wall_segments(candidate):
        if _is_outer_border_segment(kind, col, row, n):
            continue
        quadrants.add(_wall_anchor_quadrant(col, row, n))
    return quadrants


def _all_wall_candidates(n: int) -> tuple[Walls, ...]:
    """Alle möglichen einzelnen V/H-Mauern als Kandidaten (inkl. Rand-Indizes)."""
    validate_board_size(n)
    candidates: list[Walls] = []
    for row in range(n):
        for col in range(n):
            candidates.append(make_vertical_wall(col, row))
            candidates.append(make_horizontal_wall(col, row))
    return tuple(candidates)


def _all_l_candidates(n: int, forbidden: Walls) -> tuple[Walls, ...]:
    """Erzeugt 2-Segment-Kandidaten mit 90°-Winkel (L-Form), lokal in genau einem Quadranten."""
    singles: list[Walls] = []
    for c in _all_wall_candidates(n):
        if _single_wall_in_set(c, forbidden):
            continue
        kind, col, row = _wall_segments(c)[0]
        if _is_outer_border_segment(kind, col, row, n):
            continue
        if _shares_endpoint_with_any(c, forbidden):
            continue
        singles.append(c)

    result: list[Walls] = []
    seen: set[frozenset[tuple[str, int, int]]] = set()
    for i in range(len(singles)):
        for j in range(i + 1, len(singles)):
            a = singles[i]
            b = singles[j]
            if _candidate_overlaps(a, b):
                continue
            if not _shares_endpoint_with_any(a, b):
                continue
            merged = merge_walls(a, b)
            segs = _wall_segments(merged)
            if len(segs) != 2:
                continue
            if {kind for kind, _, _ in segs} != {"V", "H"}:
                continue
            if len(_candidate_quadrants(merged, n)) != 1:
                continue
            sig = frozenset(segs)
            if sig in seen:
                continue
            seen.add(sig)
            result.append(merged)
    return tuple(result)


def generate_walls(
    n: int = DEFAULT_BOARD_SIZE,
    target_count: int = 100,
    *,
    seed: int | None = None,
    min_distance: int = 1,
) -> Walls:
    """Erzeugt zufällige Mauern und filtert sie mit den lokalen Constraints.

    `target_count` ist die gewünschte Anzahl einzelner Mauersegmente (V/H-Einträge).
    Wenn wegen Constraints weniger möglich sind, wird ein gültiges Teilset zurückgegeben.
    """
    validate_board_size(n)
    if target_count < 0:
        raise ValueError("target_count must be >= 0")

    rng = random.Random(seed)
    mandatory_center = central_square_walls(n)
    mandatory_count = len(mandatory_center.vertical) + len(mandatory_center.horizontal)

    # Die zentrale 2x2-Sperre ist Pflicht + pro Quadrant:
    # 1 L-Form (2 Segmente) + 1 Einzelmauer (1 Segment) => 3 Segmente je Quadrant.
    # => mindestens mandatory_count + 12 Segmente insgesamt.
    target_count = max(target_count, mandatory_count + 12)

    single_candidates: list[Walls] = []
    for c in _all_wall_candidates(n):
        if _single_wall_in_set(c, mandatory_center):
            continue
        kind, col, row = _wall_segments(c)[0]
        if _is_outer_border_segment(kind, col, row, n):
            continue  # keine "unsichtbaren" Zusatzmauern auf dem bereits gezeichneten Außenrand
        if _shares_endpoint_with_any(c, mandatory_center):
            continue  # keine Mauer darf an der mittleren Sperre andocken
        single_candidates.append(c)
    l_candidates = list(_all_l_candidates(n, mandatory_center))
    rng.shuffle(l_candidates)
    rng.shuffle(single_candidates)

    result = mandatory_center
    protected_singles: list[Walls] = []

    # Zuerst (falls möglich) pro Quadrant eine L-Form (2 Segmente).
    for quadrant in range(4):
        if len(result.vertical) + len(result.horizontal) >= target_count:
            break
        placed = False
        for candidate in list(l_candidates):
            if _candidate_quadrants(candidate, n) != {quadrant}:
                continue
            if _candidate_overlaps(candidate, result):
                continue
            if can_add_walls(
                result,
                candidate,
                n=n,
                min_distance=min_distance,
                ignore_for_constraints=mandatory_center,
            ):
                result = merge_walls(result, candidate)
                l_candidates.remove(candidate)
                placed = True
                break
        if not placed:
            # Falls keine L-Ecke passt, versuchen wir später weiter aufzufüllen.
            continue

    # Danach pro Quadrant zusätzlich mindestens eine Einzelmauer.
    for quadrant in range(4):
        if len(result.vertical) + len(result.horizontal) >= target_count:
            break
        for candidate in list(single_candidates):
            anchor = next(iter(candidate.vertical or candidate.horizontal))
            if _wall_anchor_quadrant(anchor[0], anchor[1], n) != quadrant:
                continue
            if _candidate_overlaps(candidate, result):
                continue
            if can_add_walls(
                result,
                candidate,
                n=n,
                min_distance=min_distance,
                ignore_for_constraints=mandatory_center,
            ):
                result = merge_walls(result, candidate)
                single_candidates.remove(candidate)
                protected_singles.append(candidate)
                break

    # Danach weiter auffüllen: zuerst zusätzliche Ls, dann Einzelsegmente.
    for candidate in list(l_candidates):
        if len(result.vertical) + len(result.horizontal) >= target_count:
            break
        if _candidate_overlaps(candidate, result):
            continue
        if any(_shares_endpoint_with_any(candidate, protected) for protected in protected_singles):
            continue  # Pflicht-Einzelmauern pro Quadrant dürfen keine neue Ecke bekommen
        if can_add_walls(
            result,
            candidate,
            n=n,
            min_distance=min_distance,
            ignore_for_constraints=mandatory_center,
        ):
            result = merge_walls(result, candidate)
            l_candidates.remove(candidate)

    for candidate in single_candidates:
        if len(result.vertical) + len(result.horizontal) >= target_count:
            break
        if _candidate_overlaps(candidate, result):
            continue
        if any(_shares_endpoint_with_any(candidate, protected) for protected in protected_singles):
            continue  # Pflicht-Einzelmauern bleiben Einzelmauern
        if can_add_walls(
            result,
            candidate,
            n=n,
            min_distance=min_distance,
            ignore_for_constraints=mandatory_center,
        ):
            result = merge_walls(result, candidate)
    return result


def render_ascii_board(n: int, walls: Walls, state: State | None = None) -> str:
    """ASCII-Ausgabe des Spielfelds mit Außenrand und V/H-Mauern.

    Zellen sind '.'; Roboter werden als Ziffern 0..9 dargestellt (falls `state` gesetzt).
    """
    validate_board_size(n)
    robot_marks: dict[tuple[int, int], str] = {}
    if state is not None:
        for idx, pos in enumerate(state.robots):
            if 0 <= pos.row < n and 0 <= pos.col < n:
                robot_marks[(pos.col, pos.row)] = str(idx % 10)
    center_block = central_square_walls(n)
    blocked_center_cells: set[Cell] = set()
    half = n // 2
    blocked_center_cells.update(
        {
            (half - 1, half - 1),
            (half, half - 1),
            (half - 1, half),
            (half, half),
        }
    )

    lines: list[str] = []

    # Oberer Außenrand (implizite Mauer)
    lines.append("+" + "+".join("---" for _ in range(n)) + "+")

    for row in range(n):
        # Zellzeile mit vertikalen Mauern links/rechts und inneren V[col,row]
        cell_line = ["|"]  # linker Außenrand (implizit)
        for col in range(n):
            if (col, row) in robot_marks:
                mark = robot_marks[(col, row)]
            elif (
                (col, row) in blocked_center_cells
                and center_block.vertical.issubset(walls.vertical)
                and center_block.horizontal.issubset(walls.horizontal)
            ):
                # Die zentrale 2x2-Sperre wird sichtbar markiert.
                mark = "#"
            else:
                mark = "."
            cell_line.append(f" {mark} ")
            if col == n - 1:
                cell_line.append("|")  # rechter Außenrand (implizit)
            else:
                cell_line.append("|" if (col, row) in walls.vertical else " ")
        lines.append("".join(cell_line))

        # Unterkante dieser Zeile: H[col,row] oder leer; unterster Rand immer Mauer.
        edge_line = ["+"]
        for col in range(n):
            if row == n - 1 or (col, row) in walls.horizontal:
                edge_line.append("---")
            else:
                edge_line.append("   ")
            edge_line.append("+")
        lines.append("".join(edge_line))

    return "\n".join(lines)


def is_blocked(
    pos: Pos,
    next_pos: Pos,
    walls: Walls,
    occupied: set[Pos] | FrozenSet[Pos],
) -> bool:
    """Check blockers between two adjacent cells.

    Board boundaries are partially checkable here (negative coordinates only).
    Upper bounds depend on `n` and are enforced by `slide`.
    """
    if next_pos.row < 0 or next_pos.col < 0:
        return True
    if next_pos in occupied:
        return True

    d_row = next_pos.row - pos.row
    d_col = next_pos.col - pos.col

    # Rechtsbewegung: prüfe V[col, row] der aktuellen Zelle.
    if d_row == 0 and d_col == 1:
        return (pos.col, pos.row) in walls.vertical

    # Linksbewegung: prüfe die rechte Kante der linken Nachbarzelle V[col-1, row].
    if d_row == 0 and d_col == -1:
        if pos.col == 0:
            return True  # impliziter linker Außenrand
        return (pos.col - 1, pos.row) in walls.vertical

    # Bewegung nach unten: prüfe H[col, row] der aktuellen Zelle.
    if d_row == 1 and d_col == 0:
        return (pos.col, pos.row) in walls.horizontal

    # Bewegung nach oben: prüfe die untere Kante der oberen Nachbarzelle H[col, row-1].
    if d_row == -1 and d_col == 0:
        if pos.row == 0:
            return True  # impliziter oberer Außenrand
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


def enumerate_reachable_states(start: State, n: int, walls: Walls) -> tuple[State, ...]:
    """Berechnet vollständig alle vom Startzustand erreichbaren Zustände (BFS)."""
    queue = deque([start])
    visited = {start}
    ordered: list[State] = []

    while queue:
        state = queue.popleft()
        ordered.append(state)
        for nxt in neighbors(state, n, walls):
            if nxt in visited:
                continue
            visited.add(nxt)
            queue.append(nxt)

    return tuple(ordered)


def bfs_reachable(
    start: State,
    goal_predicate: Callable[[State], bool],
    n: int,
    walls: Walls,
) -> bool:
    if goal_predicate(start):
        return True

    queue = deque([start])
    visited = {start}

    while queue:
        state = queue.popleft()
        for nxt in neighbors(state, n, walls):
            if nxt in visited:
                continue
            if goal_predicate(nxt):
                return True
            visited.add(nxt)
            queue.append(nxt)

    return False
