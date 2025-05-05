import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB, disconnectDB } from './config/mongodb';
import { logger } from './logger';
import { errorHandler } from './middleware/error'
import { User, Question, Game } from './types';
import { handleWebSocket } from './websocket';
import routes from './routes';

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', routes);

// Error handling middleware
app.use(errorHandler);

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

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

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

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  try {
    await disconnectDB();
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to shutdown server', { error });
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
startServer();
