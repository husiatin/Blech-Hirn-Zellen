from typing import List
from string import hexdigits, digits
from random import randint, choice

possible_player_names: List[str] = [
    "greenAndMean",
    "red_robot_lover",
    "blue_means_better",
    "yellowIsTheBest",
    "all_robots_mover",
    "lastMinuteGuesser",
    "moveMaker",
    "better_late_than_never",
]


def random_player_id_with_n_characters(n: int) -> str:
    symbols: List[str] = list(hexdigits)
    player_id_as_list: List[str] = []
    for _ in range(n):
        player_id_as_list.append(choice(symbols))
    return "".join(player_id_as_list)


def random_player_name() -> str:
    digis: List[str] = list(digits)
    player_name: str = choice(possible_player_names)
    for _ in range(2):
        player_name += choice(digis)
    return player_name


# TODO replace with something similar to random_player_id_with_n_characters
def random_game_id_with_N_digits(n: int) -> int:
    range_start = 10 ** (n - 1)
    range_end = (10 ** n) - 1
    return randint(range_start, range_end)
