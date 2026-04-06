import { BOARD_SIZE } from './constants.js';

export const Color = Object.freeze({
  RED: 'red',
  BLUE: 'blue',
  GREEN: 'green',
  YELLOW: 'yellow'
});

export class Robot {
  constructor(id, color, x, y) {
    this.id = id;
    this.color = color;
    this.x = x;
    this.y = y;
  }
}

export class Board {
  constructor(board_size, board_data) {
    this.board_size = board_size;
    this.board_data = board_data;
  }
}

export class GameInfo {
  constructor(
    game_id,
    player_count,
    game_master_id,
    player_list,
    board,
    game_status,
    bids,
    is_hourglass_running,
    hourglass_duration,
    is_round_timer_running,
    round_timer_duration,
    robots,
    active_robot_id,
    goal_chip,
    chips,
    demonstrating_player_id,
    demonstration_moves,
    original_robots
  ) {
    this.game_id = game_id;
    this.player_count = player_count;
    this.game_master_id = game_master_id;
    this.player_list = player_list;
    this.board = board;
    this.game_status = game_status;
    this.bids = bids;
    this.is_hourglass_running = is_hourglass_running;
    this.hourglass_duration = hourglass_duration; //in seconds
    this.is_round_timer_running = is_round_timer_running;
    this.round_timer_duration = round_timer_duration; //in Minutes
    this.robots = robots;
    this.active_robot_id = active_robot_id;
    this.goal_chip = goal_chip;
    this.chips = chips;
    this.demonstrating_player_id = demonstrating_player_id;
    this.demonstration_moves = demonstration_moves;
    this.original_robots = original_robots;
  }
}

export class Player {
  constructor(player_id, player_name, moves) {
    this.player_id = player_id;
    this.player_name = player_name;
    this.moves = moves;
  }
}

export class Chip {
  constructor(x, y, color, symbol) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.symbol = symbol;
  }
}

export const Symbol = Object.freeze({
  CIRCLE: 'circle',
  STAR: 'star',
  COG: 'cog',
  PENTAGON: 'pentagon'
});

export const GameStatus = Object.freeze({
  LOBBY: 0,
  STARTED: 1,
  ENDED: 2
});

export const gameInfo = new GameInfo(
  "",
  0,
  "",
  [],
  new Board(BOARD_SIZE, Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))),
  GameStatus.LOBBY,
  [],
  false,
  60,
  false,
  5,
  [
    new Robot('red', Color.RED, 1, 1),
    new Robot('blue', Color.BLUE, 14, 2),
    new Robot('green', Color.GREEN, 6, 13),
    new Robot('yellow', Color.YELLOW, 13, 14)
  ],
  'red',
  new Chip(12, 3, 'red', Symbol.CIRCLE),
  [],
  null,
  [],
  []
);

export const playerInfo = new Player(
  "",
  "",
  []
);