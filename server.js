require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory data storage (would use a database in production)
const users = new Map(); // Map of user IDs to user objects
const questions = []; // Array of question objects
const userQueue = []; // Queue of users waiting to play
let currentGame = {
players: [], // Array of 2 player IDs currently playing
question: null, // Current question
buzzedPlayer: null, // ID of player who buzzed in
round: 0, // Round counter
winners: [] // Array of past winners (not eligible for future rounds)
};

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Websocket logic
io.on('connection', (socket) => {
console.log(`New connection: ${socket.id}`);

// Game state
socket.on('gameState', (state) => {
  console.log('Game state update:', state);
  
  // Send user list to admin after each game state update
  io.to('admin-room').emit('usersUpdated', {
    users: Array.from(users.values())
      .filter(u => !u.isAdmin)
      .map(u => ({ id: u.id, name: u.name })),
    userQueue: userQueue.map(id => ({
      id, 
      name: users.get(id)?.name || 'Unknown'
    }))
  });
});

// User registration
socket.on('register', (userData) => {
  const user = {
    id: socket.id,
    name: userData.name,
    isAdmin: userData.isAdmin || false,
    joinedAt: new Date()
  };
  
  users.set(socket.id, user);
  
  // Add non-admin users to the waiting queue
  if (!user.isAdmin) {
    userQueue.push(socket.id);
    // Notify admin about new user
    io.to('admin-room').emit('userQueued', {
      id: user.id, 
      name: user.name
    });
  } else {
    // Join admin room if user is admin
    socket.join('admin-room');
  }
  
  // Send current game state to the new user
  socket.emit('gameState', {
    currentGame,
    inQueue: userQueue.includes(socket.id),
    isPlaying: currentGame.players.includes(socket.id)
  });
  
  // If user is one of the current players, ensure they get the proper state
  if (currentGame.players.includes(socket.id)) {
    socket.emit('playersSelected', {
      players: currentGame.players.map(id => ({
        id,
        name: users.get(id)?.name || 'Unknown'
      })),
      userQueue: []
    });
    
    // If there's a current question, send it as well
    if (currentGame.question) {
      socket.emit('questionSelected', {
        question: currentGame.question.text,
        round: currentGame.round
      });
    }
  }
  
  console.log(`User registered: ${user.name} (${user.isAdmin ? 'Admin' : 'Player'})`);
});

// Admin: Add question
socket.on('addQuestion', (question) => {
  const user = users.get(socket.id);
  if (user && user.isAdmin) {
    const newQuestion = {
      id: uuidv4(),
      text: question.text,
      createdAt: new Date()
    };
    
    questions.push(newQuestion);
    
    // Send updated questions list to admin
    io.to('admin-room').emit('questionAdded', newQuestion);
    console.log(`Question added: ${newQuestion.text}`);
  }
});

// Admin: Select players
socket.on('selectPlayers', (playerIds) => {
  const user = users.get(socket.id);
  if (user && user.isAdmin && playerIds.length === 2) {
    // Reset game state
    currentGame.players = playerIds;
    currentGame.buzzedPlayer = null;
    currentGame.question = null;
    
    // Remove selected players from queue
    playerIds.forEach(id => {
      const index = userQueue.indexOf(id);
      if (index !== -1) {
        userQueue.splice(index, 1);
      }
    });
    
    // Get remaining queue for update
    const remainingQueue = userQueue.map(id => ({
      id, 
      name: users.get(id)?.name || 'Unknown'
    }));
    
    // Notify all clients about new players
    io.emit('playersSelected', {
      players: currentGame.players.map(id => ({
        id,
        name: users.get(id)?.name || 'Unknown'
      })),
      userQueue: remainingQueue
    });
    
    // Send updated game state to all clients with appropriate flags
    io.emit('gameState', {
      currentGame,
      isPlaying: false,
      inQueue: false
    });
    
    // Send individual game state to each player
    currentGame.players.forEach(playerId => {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        playerSocket.emit('gameState', {
          currentGame,
          isPlaying: true,
          inQueue: false
        });
      }
    });
    
    // Send individual game state to each spectator in queue
    userQueue.forEach(queuedId => {
      const queueSocket = io.sockets.sockets.get(queuedId);
      if (queueSocket) {
        queueSocket.emit('gameState', {
          currentGame,
          isPlaying: false,
          inQueue: true
        });
      }
    });
    
    console.log(`Players selected: ${playerIds.map(id => users.get(id)?.name).join(', ')}`);
    console.log(`Users in queue: ${userQueue.map(id => users.get(id)?.name).join(', ')}`);
  }
});

// Admin: Select question
socket.on('selectQuestion', (questionId) => {
  const user = users.get(socket.id);
  if (user && user.isAdmin) {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      currentGame.question = question;
      currentGame.buzzedPlayer = null;
      
      // Notify all clients about new question
      io.emit('questionSelected', {
        question: question.text,
        round: ++currentGame.round
      });
      
      // Notify players individually to ensure proper state
      currentGame.players.forEach(playerId => {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit('gameState', {
            currentGame,
            isPlaying: true,
            inQueue: false
          });
        }
      });
      
      // Notify queue spectators individually to ensure proper state
      userQueue.forEach(queuedId => {
        const queueSocket = io.sockets.sockets.get(queuedId);
        if (queueSocket) {
          queueSocket.emit('gameState', {
            currentGame,
            isPlaying: false,
            inQueue: true
          });
        }
      });
      
      console.log(`Question selected: ${question.text}`);
      console.log(`Users in queue who can see the question: ${userQueue.map(id => users.get(id)?.name).join(', ')}`);
    }
  }
});

// Player: Buzz in
socket.on('buzzIn', () => {
  const user = users.get(socket.id);
  console.log(`Buzz received from ${user?.name} (${socket.id})`);
  
  // Check if user is a current player and not already buzzed
  if (user && 
      currentGame.players.includes(socket.id) && 
      currentGame.question && 
      !currentGame.buzzedPlayer) {
    
    // Set the buzzed player in the game state
    currentGame.buzzedPlayer = socket.id;
    
    // Get player index (0 or 1)
    const playerIndex = currentGame.players.indexOf(socket.id);
    
    // Notify all clients about buzz
    io.emit('playerBuzzed', {
      playerId: socket.id,
      playerName: user.name,
      playerIndex: playerIndex
    });
    
    // Specifically notify admins to ensure they get the message
    io.to('admin-room').emit('adminNotification', {
      type: 'playerBuzzed',
      data: {
        playerId: socket.id,
        playerName: user.name,
        playerIndex: playerIndex,
        time: new Date().toISOString()
      }
    });
    
    console.log(`Player buzzed: ${user.name} (index: ${playerIndex})`);
  } else {
    console.log('Buzz rejected - player not eligible', {
      isUser: !!user,
      isPlayer: user && currentGame.players.includes(socket.id),
      hasQuestion: !!currentGame.question,
      alreadyBuzzed: !!currentGame.buzzedPlayer,
      currentBuzzedPlayer: currentGame.buzzedPlayer ? users.get(currentGame.buzzedPlayer)?.name : 'none'
    });
    
    // Send specific error message back to the client
    socket.emit('buzzRejected', {
      reason: !currentGame.question ? 'No question selected' :
              currentGame.buzzedPlayer ? 'Someone already buzzed in' :
              !currentGame.players.includes(socket.id) ? 'You are not a current player' :
              'Unknown reason'
    });
  }
});

// Admin: Select winner
socket.on('selectWinner', (winnerId) => {
  const user = users.get(socket.id);
  if (user && user.isAdmin) {
    // Allow selecting a winner even if no one has buzzed in
    let winningId = winnerId;
    
    // If a specific winner wasn't provided, use the player who buzzed in
    if (!winnerId && currentGame.buzzedPlayer) {
      winningId = currentGame.buzzedPlayer;
    } 
    
    // Make sure the selected winner is one of the current players
    if (currentGame.players.includes(winningId)) {
      // Add winner to winners list if not already there
      if (!currentGame.winners.includes(winningId)) {
        currentGame.winners.push(winningId);
      }
      
      // Determine loser (the other player)
      const loserId = currentGame.players.find(id => id !== winningId);
      
      // Notify all clients about winner
      io.emit('winnerSelected', {
        winnerId: winningId,
        winnerName: users.get(winningId)?.name || 'Unknown',
        loserId,
        loserName: users.get(loserId)?.name || 'Unknown'
      });
      
      // Reset game state for next round
      currentGame.buzzedPlayer = null;
      currentGame.question = null;
      
      // Notify all clients about game reset
      io.emit('gameReset', {
        currentPlayers: currentGame.players.map(id => ({
          id,
          name: users.get(id)?.name || 'Unknown'
        })),
        winners: currentGame.winners,
        round: currentGame.round,
        userQueue: userQueue.map(id => ({
          id, 
          name: users.get(id)?.name || 'Unknown'
        }))
      });
      
      // Specifically send updated user list to admin
      io.to('admin-room').emit('usersUpdated', {
        users: Array.from(users.values())
          .filter(u => !u.isAdmin)
          .map(u => ({ id: u.id, name: u.name })),
        userQueue: userQueue.map(id => ({
          id, 
          name: users.get(id)?.name || 'Unknown'
        }))
      });
      
      console.log(`Winner selected: ${users.get(winningId)?.name} - Game reset for next round`);
      console.log('Current queue:', userQueue.map(id => users.get(id)?.name));
    } else {
      console.log(`Invalid winner ID: ${winningId}`);
    }
  }
});

// Admin: Replace player
socket.on('replacePlayer', ({ oldPlayerId, newPlayerId }) => {
  const user = users.get(socket.id);
  if (user && user.isAdmin) {
    console.log(`Replace player request: ${oldPlayerId} -> ${newPlayerId}`);
    
    // Replace player in current game
    const playerIndex = currentGame.players.indexOf(oldPlayerId);
    if (playerIndex !== -1 && userQueue.includes(newPlayerId)) {
      console.log(`Replacing player at index ${playerIndex}`);
      
      // Store the old player's name before we update
      const oldPlayerName = users.get(oldPlayerId)?.name || 'Unknown';
      const newPlayerName = users.get(newPlayerId)?.name || 'Unknown';
      
      // Update the player in the current game
      currentGame.players[playerIndex] = newPlayerId;
      
      // Remove new player from queue
      const queueIndex = userQueue.indexOf(newPlayerId);
      if (queueIndex !== -1) {
        userQueue.splice(queueIndex, 1);
      }
      
      // Notify all clients about player replacement
      io.emit('playerReplaced', {
        oldPlayerId,
        oldPlayerName,
        newPlayerId,
        newPlayerName,
        userQueue: userQueue.map(id => ({
          id, 
          name: users.get(id)?.name || 'Unknown'
        }))
      });
      
      // Reset game state for next question
      currentGame.buzzedPlayer = null;
      currentGame.question = null;
      
      // Signal game state reset with updated player info
      io.emit('gameReset', {
        currentPlayers: currentGame.players.map(id => ({
          id,
          name: users.get(id)?.name || 'Unknown'
        })),
        winners: currentGame.winners,
        round: currentGame.round
      });
      
      console.log(`Player replaced: ${oldPlayerName} → ${newPlayerName}`);
    } else {
      console.log('Player replacement failed', {
        playerInGame: playerIndex !== -1,
        newPlayerInQueue: userQueue.includes(newPlayerId),
        currentPlayers: currentGame.players,
        queue: userQueue
      });
    }
  }
});

// User disconnection
socket.on('disconnect', () => {
  const user = users.get(socket.id);
  if (user) {
    // Remove from queue if in queue
    const queueIndex = userQueue.indexOf(socket.id);
    if (queueIndex !== -1) {
      userQueue.splice(queueIndex, 1);
    }
    
    // Handle if current player disconnects
    if (currentGame.players.includes(socket.id)) {
      // Notify admin about player disconnection
      io.to('admin-room').emit('playerDisconnected', {
        id: socket.id,
        name: user.name
      });
    }
    
    // Remove user from users map
    users.delete(socket.id);
    
    console.log(`User disconnected: ${user.name}`);
  }
  
  // Notify admin about updated user list
  io.to('admin-room').emit('usersUpdated', {
    users: Array.from(users.values())
      .filter(u => !u.isAdmin)
      .map(u => ({ id: u.id, name: u.name })),
    userQueue: userQueue.map(id => ({
      id, 
      name: users.get(id)?.name || 'Unknown'
    }))
  });
});

// Admin: Get current state (when admin first loads page)
socket.on('getState', () => {
  const user = users.get(socket.id);
  if (user && user.isAdmin) {
    // Send complete state to admin
    socket.emit('fullState', {
      users: Array.from(users.values())
        .filter(u => !u.isAdmin)
        .map(u => ({ id: u.id, name: u.name })),
      questions,
      userQueue: userQueue.map(id => ({
        id, 
        name: users.get(id)?.name || 'Unknown'
      })),
      currentGame,
      winners: currentGame.winners.map(id => ({
        id,
        name: users.get(id)?.name || 'Unknown'
      }))
    });
    
    // If someone has already buzzed in, send that info separately
    if (currentGame.buzzedPlayer) {
      const buzzedUser = users.get(currentGame.buzzedPlayer);
      if (buzzedUser) {
        socket.emit('playerBuzzed', {
          playerId: currentGame.buzzedPlayer,
          playerName: buzzedUser.name,
          playerIndex: currentGame.players.indexOf(currentGame.buzzedPlayer)
        });
      }
    }
  }
});
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});