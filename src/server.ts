import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { User, Question, Game } from './types';
import { handleWebSocket } from './websocket';
import routes from './routes';
import { logger } from './logger';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory data storage (would use a database in production)
const users = new Map<string, User>();
const questions: Question[] = [];
const userQueue: string[] = [];
let currentGame: Game = {
  players: [],
  question: null,
  buzzedPlayer: null,
  round: 0,
  winners: []
};

app.use(express.json());

// Use routes
app.use('/', routes);

// Websocket logic
io.on('connection', (socket) => {
  logger.info('New WebSocket connection', { socketId: socket.id });
  
  // Pass socket, data, and io server to the handler
  handleWebSocket(socket, {
    users,
    questions,
    userQueue,
    currentGame
  }, io);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});
