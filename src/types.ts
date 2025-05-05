export interface User {
  id: string;
  name: string;
  isAdmin: boolean;
  joinedAt: Date;
}

export interface Question {
  id: string;
  text: string;
}

export interface Game {
  players: string[];
  question: Question | null;
  buzzedPlayer: string | null;
  round: number;
  winners: string[];
}

export interface UserQueueItem {
  id: string;
  name: string;
}

export interface GameState {
  currentGame: Game;
  inQueue: boolean;
  isPlaying: boolean;
}

export interface PlayersSelected {
  players: UserQueueItem[];
  userQueue: UserQueueItem[];
}

export interface QuestionSelected {
  question: string;
  round: number;
}

export interface Buzzed {
  player: UserQueueItem;
}

export interface ReplacePlayer {
  oldPlayerId: string;
  newPlayerId: string;
}

export interface SocketData {
  users: Map<string, User>;
  questions: Question[];
  userQueue: string[];
  currentGame: Game;
}