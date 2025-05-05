import { Socket, Server } from 'socket.io';
import { User, ReplacePlayer, SocketData } from '../types';
import { wsLogger, userLogger, gameLogger } from '../logger';
import QuestionSetService from '../services/questionSetService';

// Game state handler
export const handleGameState = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('gameState', (state: any) => {
    wsLogger.info('Game state update', { state });

    // Send user list to admin after each game state update
    io.to('admin-room').emit('usersUpdated', {
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
      io.to('admin-room').emit('userQueued', {
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
  socket.on('addQuestion', async (question: { text: string }) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      const questionSetService = new QuestionSetService();
      const questionSet = await questionSetService.addQuestions('6818f618e44cc58cccc01c27', [{
        text: question.text
      }]);
      const savedQuestion = questionSet.questions[questionSet.questions.length - 1];

      io.to('admin-room').emit('questionAdded', savedQuestion);
      gameLogger.info('Question added', {
        questionId: savedQuestion._id,
        questionText: savedQuestion.text
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
      io.emit('playersSelected', {
        players: data.currentGame.players.map(id => ({
          id,
          name: data.users.get(id)?.name || 'Unknown'
        })),
        userQueue: remainingQueue
      });

      // Send updated game state to all clients with appropriate flags
      io.emit('gameState', {
        currentGame: data.currentGame,
        isPlaying: false,
        inQueue: false
      });

      // Send individual game state to each player
      data.currentGame.players.forEach(playerId => {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit('gameState', {
            currentGame: data.currentGame,
            isPlaying: true,
            inQueue: false
          });
        }
      });

      // Send individual game state to each spectator in queue
      data.userQueue.forEach(queuedId => {
        const queueSocket = io.sockets.sockets.get(queuedId);
        if (queueSocket) {
          queueSocket.emit('gameState', {
            currentGame: data.currentGame,
            isPlaying: false,
            inQueue: true
          });
        }
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
  socket.on('selectQuestion', async (questionId: string) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      const questionSetService = new QuestionSetService();
      const questionSet = await questionSetService.getQuestionSet('6818f618e44cc58cccc01c27');
      const question = questionSet?.questions.find(q => q._id.toString() === questionId);
      if (questionSet && question) {
        data.currentGame.question = {
          id: question._id.toString(),
          text: question.text
        };
        data.currentGame.buzzedPlayer = null;

        // Notify all clients about new question
        io.emit('questionSelected', {
          question: question.text,
          round: ++data.currentGame.round
        });

        // Notify players about the new question
        data.currentGame.players.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('questionSelected', {
              question: question.text,
              round: ++data.currentGame.round
            });
          }
        });

        // Notify queue spectators individually to ensure proper state
        data.userQueue.forEach(queuedId => {
          const queueSocket = io.sockets.sockets.get(queuedId);
          if (queueSocket) {
            queueSocket.emit('gameState', {
              currentGame: data.currentGame,
              isPlaying: false,
              inQueue: true
            });
          }
        });

        gameLogger.info('Question selected', {
          questionId,
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

      // Get player index (0 or 1)
      const playerIndex = data.currentGame.players.indexOf(socket.id);

      // Notify all clients about buzz
      io.emit('playerBuzzed', {
        playerId: socket.id,
        playerName: user?.name,
        playerIndex: playerIndex
      });

      // Specifically notify admins to ensure they get the message
      io.to('admin-room').emit('adminNotification', {
        type: 'playerBuzzed',
        data: {
          playerId: socket.id,
          playerName: user?.name,
          playerIndex: playerIndex,
          time: new Date().toISOString()
        }
      });

      wsLogger.info('Player buzzed in', {
        socketId: socket.id,
        userName: user?.name
      });
    } else {
      // Send specific error message back to the client
      socket.emit('buzzRejected', {
        reason: !data.currentGame.question ? 'No question selected' :
          data.currentGame.buzzedPlayer ? 'Someone already buzzed in' :
            !data.currentGame.players.includes(socket.id) ? 'You are not a current player' :
              'Unknown reason'
      });
    }
  });
};

// Replace player handler
export const handleReplacePlayer = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('replacePlayer', ({ oldPlayerId, newPlayerId }: ReplacePlayer) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      wsLogger.info('Player replacement request', {
        oldPlayerId,
        newPlayerId,
        adminId: socket.id
      });
      
      // Replace player in current game
      const playerIndex = data.currentGame.players.indexOf(oldPlayerId);
      if (playerIndex !== -1 && data.userQueue.includes(newPlayerId)) {
        wsLogger.info('Replacing player', {
          oldPlayerId,
          newPlayerId,
          playerIndex
        });
        
        // Store the old player's name before we update
        const oldPlayerName = data.users.get(oldPlayerId)?.name || 'Unknown';
        const newPlayerName = data.users.get(newPlayerId)?.name || 'Unknown';
        
        // Update the player in the current game
        data.currentGame.players[playerIndex] = newPlayerId;
        
        // Remove new player from queue
        const queueIndex = data.userQueue.indexOf(newPlayerId);
        if (queueIndex !== -1) {
          data.userQueue.splice(queueIndex, 1);
        }
        
        // Notify all clients about player replacement
        io.emit('playerReplaced', {
          oldPlayerId,
          oldPlayerName,
          newPlayerId,
          newPlayerName,
          userQueue: data.userQueue.map(id => ({
            id, 
            name: data.users.get(id)?.name || 'Unknown'
          }))
        });
        
        // Reset game state for next question
        data.currentGame.buzzedPlayer = null;
        data.currentGame.question = null;
        
        // Signal game state reset with updated player info
        io.emit('gameReset', {
          currentPlayers: data.currentGame.players.map(id => ({
            id,
            name: data.users.get(id)?.name || 'Unknown'
          })),
          winners: data.currentGame.winners,
          round: data.currentGame.round
        });
        
        wsLogger.info('Player replacement successful', {
          oldPlayer: {
            id: oldPlayerId,
            name: oldPlayerName
          },
          newPlayer: {
            id: newPlayerId,
            name: newPlayerName
          },
          playerIndex,
          queueLength: data.userQueue.length
        });
      } else {
        wsLogger.info('Player replacement failed', {
          reason: playerIndex === -1 ? 'old player not found' : 'new player not in queue',
          oldPlayerId,
          newPlayerId,
          currentPlayers: data.currentGame.players,
          queue: data.userQueue
        });
      }
    }
  });
};

// Disconnect handler
export const handleDisconnect = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('disconnect', () => {
    const user = data.users.get(socket.id);
    if (user) {
      wsLogger.info('User disconnected', {
        userId: socket.id,
        userName: user.name
      });

      // Remove from queue if in queue
      const queueIndex = data.userQueue.indexOf(socket.id);
      if (queueIndex !== -1) {
        data.userQueue.splice(queueIndex, 1);
        wsLogger.info('User removed from queue', {
          userId: socket.id,
          previousQueueLength: queueIndex + 1,
          newQueueLength: data.userQueue.length
        });
      }
      
      // Handle if current player disconnects
      if (data.currentGame.players.includes(socket.id)) {
        // Notify admin about player disconnection
        io.to('admin-room').emit('playerDisconnected', {
          id: socket.id,
          name: user.name
        });
        wsLogger.info('Player disconnected from game', {
          playerId: socket.id,
          playerName: user.name,
          remainingPlayers: data.currentGame.players.filter(id => id !== socket.id)
        });
      }
      
      // Remove user from users map
      data.users.delete(socket.id);
      wsLogger.info('User removed from users map', {
        userId: socket.id,
        remainingUsers: data.users.size
      });
    }
    
    // Notify admin about updated user list
    io.to('admin-room').emit('usersUpdated', {
      users: Array.from(data.users.values())
        .filter(u => !u.isAdmin)
        .map(u => ({ id: u.id, name: u.name })),
      userQueue: data.userQueue.map(id => ({
        id, 
        name: data.users.get(id)?.name || 'Unknown'
      }))
    });
    wsLogger.info('User list updated after disconnect', {
      activeUsers: data.users.size,
      queueLength: data.userQueue.length
    });
  });
};

// Get state handler
export const handleGetState = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('getState', async () => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      wsLogger.info('Admin requested game state', {
        adminId: socket.id,
        adminName: user.name
      });

      const questionSetService = new QuestionSetService();
      const questionSet = await questionSetService.getQuestionSet('6818f618e44cc58cccc01c27');
      const questions = questionSet?.questions;
      data.questions = questions || [];

      // Send complete state to admin
      socket.emit('fullState', {
        users: Array.from(data.users.values())
          .filter(u => !u.isAdmin)
          .map(u => ({ id: u.id, name: u.name })),
        questions: data.questions,
        userQueue: data.userQueue.map(id => ({
          id, 
          name: data.users.get(id)?.name || 'Unknown'
        })),
        currentGame: data.currentGame,
        winners: data.currentGame.winners.map(id => ({
          id,
          name: data.users.get(id)?.name || 'Unknown'
        }))
      });
      wsLogger.info('Sent full game state to admin', {
        userCount: data.users.size - 1, // excluding admin
        questionCount: data.questions.length,
        queueLength: data.userQueue.length,
        currentRound: data.currentGame.round,
        winnerCount: data.currentGame.winners.length
      });

      // If someone has already buzzed in, send that info separately
      if (data.currentGame.buzzedPlayer) {
        const buzzedUser = data.users.get(data.currentGame.buzzedPlayer);
        if (buzzedUser) {
          socket.emit('playerBuzzed', {
            playerId: data.currentGame.buzzedPlayer,
            playerName: buzzedUser.name,
            playerIndex: data.currentGame.players.indexOf(data.currentGame.buzzedPlayer)
          });
          wsLogger.info('Sent buzzed player info to admin', {
            buzzedPlayerId: data.currentGame.buzzedPlayer,
            buzzedPlayerName: buzzedUser.name,
            playerIndex: data.currentGame.players.indexOf(data.currentGame.buzzedPlayer)
          });
        }
      }
    }
  });
};

// Select winner handler
export const handleSelectWinner = (socket: Socket, data: SocketData, io: Server) => {
  socket.on('selectWinner', (winnerId: string) => {
    const user = data.users.get(socket.id);
    if (user && user.isAdmin) {
      // Allow selecting a winner even if no one has buzzed in
      let winningId = winnerId;
      
      // If a specific winner wasn't provided, use the player who buzzed in
      if (!winnerId && data.currentGame.buzzedPlayer) {
        winningId = data.currentGame.buzzedPlayer;
      }
      
      // Make sure the selected winner is one of the current players
      if (data.currentGame.players.includes(winningId)) {
        // Add winner to winners list if not already there
        if (!data.currentGame.winners.includes(winningId)) {
          data.currentGame.winners.push(winningId);
        }
        
        // Determine loser (the other player)
        const loserId = data.currentGame.players.find(id => id !== winningId) || '';
        
        // Notify all clients about winner
        io.emit('winnerSelected', {
          winnerId: winningId,
          winnerName: data.users.get(winningId)?.name || 'Unknown',
          loserId,
          loserName: data.users.get(loserId)?.name || 'Unknown'
        });
        
        // Reset game state for next round
        data.currentGame.buzzedPlayer = null;
        data.currentGame.question = null;
        
        // Notify all clients about game reset
        io.emit('gameReset', {
          currentPlayers: data.currentGame.players.map(id => ({
            id,
            name: data.users.get(id)?.name || 'Unknown'
          })),
          winners: data.currentGame.winners,
          round: data.currentGame.round,
          userQueue: data.userQueue.map(id => ({
            id, 
            name: data.users.get(id)?.name || 'Unknown'
          }))
        });
        
        // Specifically send updated user list to admin
        io.to('admin-room').emit('usersUpdated', {
          users: Array.from(data.users.values())
            .filter(u => !u.isAdmin)
            .map(u => ({ id: u.id, name: u.name })),
          userQueue: data.userQueue.map(id => ({
            id, 
            name: data.users.get(id)?.name || 'Unknown'
          }))
        });
        
        wsLogger.info('Winner selection successful', {
          winner: {
            id: winningId,
            name: data.users.get(winningId)?.name
          },
          loser: {
            id: loserId,
            name: data.users.get(loserId)?.name
          },
          round: data.currentGame.round,
          currentWinners: data.currentGame.winners
        });
        
        wsLogger.info('Game state after winner selection', {
          currentPlayers: data.currentGame.players,
          userQueue: data.userQueue.map(id => data.users.get(id)?.name)
        });
      } else {
        wsLogger.info('Invalid winner selection', {
          reason: 'player not in current game',
          attemptedWinnerId: winningId,
          currentPlayers: data.currentGame.players
        });
      }
    }
  });
};
