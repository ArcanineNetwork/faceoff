import { Socket, Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { User, Question, Game, ReplacePlayer } from '../types';
import { wsLogger, userLogger, gameLogger } from '../logger';

// Type for the socket data structure
interface SocketData {
  users: Map<string, User>;
  questions: Question[];
  userQueue: string[];
  currentGame: Game;
}

// Game state handler
export const handleGameState = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('gameState', (state: any) => {
    wsLogger.info('Game state update', { state });
    
    // Send user list to admin after each game state update
    socket.to('admin-room').emit('usersUpdated', {
      users: Array.from(data.users.values())
        .filter(u => !u.isAdmin)
        .map(u => ({ id: u.id, name: u.name })),
      userQueue: data.userQueue.map(id => ({
        id, 
        name: data.users.get(id)?.name || 'Unknown'
      }))
    });
  });
};

// User registration handler
export const handleUserRegistration = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('register', (userData: { name: string; isAdmin?: boolean }) => {
    const user: User = {
      id: socket.id,
      name: userData.name,
      isAdmin: userData.isAdmin || false,
      joinedAt: new Date()
    };
    
    data.users.set(socket.id, user);
    
    // Add non-admin users to the waiting queue
    if (!user.isAdmin) {
      data.userQueue.push(socket.id);
      socket.to('admin-room').emit('userQueued', {
        id: user.id, 
        name: user.name
      });
    } else {
      socket.join('admin-room');
    }
    
    // Send current game state to the new user
    socket.emit('gameState', {
      currentGame: data.currentGame,
      inQueue: data.userQueue.includes(socket.id),
      isPlaying: data.currentGame.players.includes(socket.id)
    });
    
    // If user is one of the current players, ensure they get the proper state
    if (data.currentGame.players.includes(socket.id)) {
      socket.emit('playersSelected', {
        players: data.currentGame.players.map(id => ({
          id,
          name: data.users.get(id)?.name || 'Unknown'
        })),
        userQueue: []
      });
      
      // If there's a current question, send it as well
      if (data.currentGame.question) {
        socket.emit('questionSelected', {
          question: data.currentGame.question.text,
          round: data.currentGame.round
        });
      }
    }
    
    userLogger.info('User registered', { 
      userId: user.id,
      userName: user.name,
      isAdmin: user.isAdmin
    });
  });
};

// Add question handler
export const handleAddQuestion = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('addQuestion', (question: { text: string }) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      const newQuestion: Question = {
        id: uuidv4(),
        text: question.text,
        createdAt: new Date()
      };
      
      data.questions.push(newQuestion);
      
      socket.to('admin-room').emit('questionAdded', newQuestion);
      gameLogger.info('Question added', { 
      questionId: newQuestion.id,
      questionText: newQuestion.text
    });
    }
  });
};

// Select players handler
export const handleSelectPlayers = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('selectPlayers', (playerIds: string[]) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin && playerIds.length === 2) {
      // Reset game state
      data.currentGame.players = playerIds;
      data.currentGame.buzzedPlayer = null;
      data.currentGame.question = null;
      
      // Remove selected players from queue
      playerIds.forEach(id => {
        const index = data.userQueue.indexOf(id);
        if (index !== -1) {
          data.userQueue.splice(index, 1);
        }
      });
      
      // Get remaining queue for update
      const remainingQueue = data.userQueue.map(id => ({
        id, 
        name: data.users.get(id)?.name || 'Unknown'
      }));
      
      // Notify all clients about new players
      socket.emit('playersSelected', {
        players: data.currentGame.players.map(id => ({
          id,
          name: data.users.get(id)?.name || 'Unknown'
        })),
        userQueue: remainingQueue
      });
      
      gameLogger.info('Players selected', { 
      players: playerIds.map(id => ({
        id,
        name: data.users.get(id)?.name
      })),
      queue: data.userQueue.map(id => ({
        id,
        name: data.users.get(id)?.name
      }))
    });
    }
  });
};

// Select question handler
export const handleSelectQuestion = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('selectQuestion', (questionId: string) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      const question = data.questions.find(q => q.id === questionId);
      if (question) {
        data.currentGame.question = question;
        data.currentGame.buzzedPlayer = null;
        
        // Notify players about the new question
        data.currentGame.players.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('questionSelected', {
              question: question.text,
              round: data.currentGame.round
            });
          }
        });
        
        gameLogger.info('Question selected', { 
      questionId: question.id,
      questionText: question.text
    });
      }
    }
  });
};

// Buzz in handler
export const handleBuzzIn = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('buzzIn', () => {
    const user = data.users.get(socket.id);
    wsLogger.info('Buzz received', { 
      socketId: socket.id,
      userName: user?.name
    });
    
    // Check if user is a current player and not already buzzed
    if (data.currentGame.players.includes(socket.id) && !data.currentGame.buzzedPlayer) {
      data.currentGame.buzzedPlayer = socket.id;
      
      // Notify all players about the buzz
      data.currentGame.players.forEach(playerId => {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit('buzzed', {
            player: {
              id: socket.id,
              name: user?.name || 'Unknown'
            }
          });
        }
      });
      
      wsLogger.info('Player buzzed in', { 
      socketId: socket.id,
      userName: user?.name
    });
    }
  });
};

// Replace player handler
export const handleReplacePlayer = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('replacePlayer', ({ oldPlayerId, newPlayerId }: ReplacePlayer) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      gameLogger.info('Player replacement requested', { 
      oldPlayerId,
      newPlayerId
    });
      
      // Find index of old player
      const index = data.currentGame.players.indexOf(oldPlayerId);
      if (index !== -1) {
        // Replace player in game
        data.currentGame.players[index] = newPlayerId;
        
        // Update game state
        socket.emit('playersSelected', {
          players: data.currentGame.players.map(id => ({
            id,
            name: data.users.get(id)?.name || 'Unknown'
          })),
          userQueue: data.userQueue.map(id => ({
            id,
            name: data.users.get(id)?.name || 'Unknown'
          }))
        });
        
        gameLogger.info('Player replaced', { 
      oldPlayerId,
      newPlayerId
    });
      }
    }
  });
};

// Disconnect handler
export const handleDisconnect = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('disconnect', () => {
    wsLogger.info('User disconnected', { socketId: socket.id });
    
    // Remove user from users map
    data.users.delete(socket.id);
    
    // Remove from player queue if present
    const queueIndex = data.userQueue.indexOf(socket.id);
    if (queueIndex !== -1) {
      data.userQueue.splice(queueIndex, 1);
    }
    
    // If user was a player, handle game state change
    if (data.currentGame.players.includes(socket.id)) {
      // Remove player from game
      const playerIndex = data.currentGame.players.indexOf(socket.id);
      if (playerIndex !== -1) {
        data.currentGame.players.splice(playerIndex, 1);
      }
      
      // If there's only one player left, end the game
      if (data.currentGame.players.length === 1) {
        data.currentGame.players = [];
        data.currentGame.question = null;
        data.currentGame.buzzedPlayer = null;
        
        // Notify all clients about game end
        socket.emit('gameState', {
          currentGame: data.currentGame,
          isPlaying: false,
          inQueue: false
        });
        
        gameLogger.info('Game ended due to player disconnect', { 
      socketId: socket.id,
      remainingPlayers: data.currentGame.players.length
    });
      }
    }
  });
};
