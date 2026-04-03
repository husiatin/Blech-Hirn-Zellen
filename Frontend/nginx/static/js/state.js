import { BOARD_SIZE } from './constants.js';

export class Color {
  RED = '#d44';
  BLUE = '#44d';
  GREEN = '#4d4';
  YELLOW = '#dd4';
}

export class Robot {
  constructor(id, color, x, y) {
    this.id = id;
    this.color = color;
    this.x = x;
    this.y = y;
  }
}

export class GameInfo {
  constructor(game_id, player_count, game_master_id, player_list, game_status, bids, is_timer_running, timer_duration) {
    this.game_id = game_id;
    this.player_count = player_count;
    this.game_master_id = game_master_id;
    this.player_list = player_list;
    this.board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
    this.game_status = game_status;
    this.bids = bids;
    this.is_timer_running = is_timer_running;
    this.timer_duration = timer_duration;
    this.BOARD_SIZE = BOARD_SIZE;
    this.robots = [
      new Robot('red', Color.RED, 1, 1),
      new Robot('blue', Color.BLUE, 14, 2),
      new Robot('green', Color.GREEN, 6, 13),
      new Robot('yellow', Color.YELLOW, 13, 14)
    ];
    this.activeRobotId = 'red';
    this.goal_chip = { color: 'red', x: 12, y: 3 };
    this.chips = [];
    this.playerInfo = null;
    this.roundEndAt = null;
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

export class Symbol {
  CIRCLE = 0;
  STAR = 1;
  COG = 2;
  PENTAGON = 3;
}

export const gameInfo = new GameInfo();
