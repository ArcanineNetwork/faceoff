import { Socket, Server } from 'socket.io';
import { User, Question, Game } from './types';
import { wsLogger } from './logger';
import {
  handleGameState,
  handleUserRegistration,
  handleAddQuestion,
  handleSelectPlayers,
  handleSelectQuestion,
  handleBuzzIn,
  handleReplacePlayer,
  handleDisconnect,
  handleSelectWinner,
  handleGetState
} from './websocket/events';

// Type for the socket data structure
interface SocketData {
  users: Map<string, User>;
  questions: Question[];
  userQueue: string[];
  currentGame: Game;
}

export const handleWebSocket = (socket: Socket, data: SocketData, io: Server) => {
  wsLogger.info('WebSocket connection established', { socketId: socket.id });
  
  // Register all event handlers
  handleGameState(socket, data, io);
  handleUserRegistration(socket, data, io);
  handleAddQuestion(socket, data, io);
  handleSelectPlayers(socket, data, io);
  handleSelectQuestion(socket, data, io);
  handleBuzzIn(socket, data, io);
  handleReplacePlayer(socket, data, io);
  handleSelectWinner(socket, data, io);
  handleDisconnect(socket, data, io);
  handleGetState(socket, data, io);
};
