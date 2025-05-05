// Initialize socket connection
const socket = io();

// DOM Elements
const connectionStatus = document.getElementById('connection-status');
const registrationForm = document.getElementById('registration-form');
const waitingArea = document.getElementById('waiting-area');
const gameArea = document.getElementById('game-area');
const registerForm = document.getElementById('register-form');
const usernameInput = document.getElementById('username');
const queuePosition = document.getElementById('queue-position');
const playerRole = document.getElementById('player-role');
const roundNumber = document.getElementById('round-number');
const playerOne = document.getElementById('player-one');
const playerTwo = document.getElementById('player-two');
const questionText = document.getElementById('question-text');
const buzzButton = document.getElementById('buzz-button');
const buzzStatus = document.getElementById('buzz-status');
const resultArea = document.getElementById('result-area');
const resultMessage = document.getElementById('result-message');

// Initialize UI
buzzButton.style.display = 'none'; // Hide buzz button by default
buzzButton.disabled = false; // Make sure it's not disabled

// Game state
let currentUser = {
    id: null,
    name: '',
    isPlaying: false,
    hasBuzzed: false
};

// Helper function to update buzz button visibility
function updateBuzzButton() {
    console.log('Updating buzz button. isPlaying:', currentUser.isPlaying, 'hasBuzzed:', currentUser.hasBuzzed);
    
    // Only active players who haven't buzzed yet get to see the button
    if (currentUser.isPlaying && !currentUser.hasBuzzed) {
        buzzButton.style.display = 'block';
        buzzButton.disabled = false; // Explicitly ensure it's not disabled
        console.log('Buzz button shown and enabled for active player');
    } else {
        // Hide for spectators, queue spectators, and players who already buzzed
        buzzButton.style.display = 'none';
        console.log('Buzz button hidden - user is spectator/queue or already buzzed');
    }
}

// Socket connection status
socket.on('connect', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = 'green';
});

socket.on('disconnect', () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.style.color = 'red';
});

// Register user
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    if (username) {
        currentUser.name = username;
        socket.emit('register', { name: username });
        
        // Hide registration form and show waiting area
        registrationForm.classList.add('hidden');
        waitingArea.classList.remove('hidden');
        queuePosition.textContent = 'You have joined the queue. Waiting for the admin to select you...';
    }
});

// Update game state
socket.on('gameState', (state) => {
    console.log('Received game state:', state);
    
    if (state.isPlaying) {
        // User is one of the current players
        waitingArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        currentUser.isPlaying = true;
        
        // Update player role indicator
        playerRole.textContent = 'You are playing in this round!';
        playerRole.style.color = 'green';
        
        // The button should always be enabled for active players
        buzzButton.disabled = false;
        
        // Update visibility
        updateBuzzButton();
    } else if (state.inQueue) {
        // User is in queue but not playing - Show spectator view instead of waiting area
        waitingArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        currentUser.isPlaying = false;
        
        // Update player role indicator for queue spectators
        playerRole.textContent = 'You are in the queue - watching the current round';
        playerRole.style.color = 'blue';
        
        // Make sure buzz button is hidden for queue spectators
        buzzButton.style.display = 'none';
        
        // If there are current players and a question, show them
        if (state.currentGame && state.currentGame.players && state.currentGame.players.length === 2) {
            // Update player display if we have player info
            const players = state.currentGame.players.map(id => ({
                id,
                name: id ? 'Player ' + (state.currentGame.players.indexOf(id) + 1) : 'Waiting...'
            }));
            
            if (players.length >= 2) {
                playerOne.querySelector('.player-name').textContent = players[0].name;
                playerTwo.querySelector('.player-name').textContent = players[1].name;
            }
            
            // Update question display if available
            if (state.currentGame.question) {
                questionText.textContent = state.currentGame.question.text;
            } else {
                questionText.textContent = 'Waiting for the next question...';
            }
            
            // Update round number if available
            if (state.currentGame.round) {
                roundNumber.textContent = state.currentGame.round;
            }
        }
    } else {
        // User is spectating (not in queue and not playing)
        waitingArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        currentUser.isPlaying = false;
        
        // Update player role indicator
        playerRole.textContent = 'You are spectating this round';
        playerRole.style.color = 'blue';
        
        // Spectators don't see the buzz button
        updateBuzzButton();
    }
    
    // Update round display if available
    if (state.currentGame && state.currentGame.round) {
        roundNumber.textContent = state.currentGame.round;
    }
});

// Players selected
socket.on('playersSelected', (data) => {
    console.log('Players selected:', data);
    
    // Check if current user is one of the selected players
    const isUserPlaying = data.players.some(p => p.id === socket.id);
    
    // Update current user state
    currentUser.isPlaying = isUserPlaying;
    currentUser.hasBuzzed = false; // Reset buzz state for new round
    
    if (isUserPlaying) {
        // User is playing in this round
        waitingArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        playerRole.textContent = 'You are playing in this round!';
        playerRole.style.color = 'green';
        
        // Make sure the button is enabled
        buzzButton.disabled = false;
    } else {
        // User is spectating or in queue - show game area either way
        waitingArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        
        if (data.userQueue && data.userQueue.some(u => u.id === socket.id)) {
            // User is in queue watching
            playerRole.textContent = 'You are in the queue - watching the current round';
            playerRole.style.color = 'blue';
        } else {
            // User is spectating (not in queue)
            playerRole.textContent = 'You are spectating this round';
            playerRole.style.color = 'blue';
        }
    }
    
    // Update player display for ALL users (players, queue, and spectators)
    if (data.players.length === 2) {
        const player1 = data.players[0];
        const player2 = data.players[1];
        
        playerOne.querySelector('.player-name').textContent = player1.name;
        playerTwo.querySelector('.player-name').textContent = player2.name;
        
        // Reset lights
        playerOne.querySelector('.player-light').classList.remove('active');
        playerTwo.querySelector('.player-light').classList.remove('active');
    }
    
    // Update visibility - only players get the buzz button
    updateBuzzButton();
    
    // Reset status
    buzzStatus.classList.add('hidden');
});

// Question selected
socket.on('questionSelected', (data) => {
    console.log('Question selected:', data);
    
    // Display the question for everyone (players, queue spectators, and regular spectators)
    questionText.textContent = data.question;
    roundNumber.textContent = data.round;
    
    // Reset buzz state
    currentUser.hasBuzzed = false;
    
    // Reset player lights
    playerOne.querySelector('.player-light').classList.remove('active');
    playerTwo.querySelector('.player-light').classList.remove('active');
    
    // Make sure the buzz button is enabled for players only
    if (currentUser.isPlaying) {
        console.log('Ensuring buzz button is enabled for active player');
        buzzButton.disabled = false;
        buzzStatus.classList.add('hidden');
    }
    
    // Update visibility - only players get the buzz button
    updateBuzzButton();
    
    // Hide result area
    resultArea.classList.add('hidden');
});

// Player buzzed
socket.on('playerBuzzed', (data) => {
    console.log('Player buzzed event received:', data);
    
    // Get references to both player lights
    const playerLights = [
        playerOne.querySelector('.player-light'),
        playerTwo.querySelector('.player-light')
    ];
    
    // Reset both lights first
    playerLights.forEach(light => light.classList.remove('active'));
    
    // Light up only the player who buzzed first based on playerIndex
    if (data.playerIndex === 0 || data.playerIndex === 1) {
        console.log(`Lighting up player ${data.playerIndex + 1}'s light`);
        playerLights[data.playerIndex].classList.add('active');
    }
    
    // Disable buzz button for all players
    buzzButton.disabled = true;
    
    // Mark as buzzed if it was this user
    if (data.playerId === socket.id) {
        currentUser.hasBuzzed = true;
        buzzStatus.textContent = 'You buzzed in!';
        buzzStatus.style.color = 'green';
        buzzStatus.classList.remove('hidden');
    } else if (currentUser.isPlaying) {
        currentUser.hasBuzzed = true; // Other player buzzed, so this player can't
        buzzStatus.textContent = `${data.playerName} buzzed in first!`;
        buzzStatus.style.color = 'red';
        buzzStatus.classList.remove('hidden');
    }
    
    // Update buzz button visibility
    updateBuzzButton();
});

// Winner selected
socket.on('winnerSelected', (data) => {
    // Display winner message
    resultArea.classList.remove('hidden');
    
    if (data.winnerId === socket.id) {
        resultMessage.textContent = 'You won this round!';
        resultMessage.style.color = 'green';
    } else if (data.loserId === socket.id) {
        resultMessage.textContent = 'You lost this round';
        resultMessage.style.color = 'red';
    } else {
        resultMessage.textContent = `${data.winnerName} won this round!`;
        resultMessage.style.color = 'blue';
    }
    
    // Disable buzz button
    buzzButton.disabled = true;
});

// Game reset event
socket.on('gameReset', () => {
    console.log('Game reset received');
    
    // Reset buzz state
    currentUser.hasBuzzed = false;
    
    // Reset player lights
    playerOne.querySelector('.player-light').classList.remove('active');
    playerTwo.querySelector('.player-light').classList.remove('active');
    
    // Clear question
    questionText.textContent = 'Waiting for the next question...';
    
    // Update buzz button visibility
    updateBuzzButton();
    
    // Display waiting message
    buzzStatus.textContent = 'Waiting for next round...';
    buzzStatus.style.color = 'blue';
    buzzStatus.classList.remove('hidden');
});

// Player replaced
socket.on('playerReplaced', (data) => {
    // Update players display
    if (data.oldPlayerId === socket.id) {
        // This player was replaced
        currentUser.isPlaying = false;
        waitingArea.classList.remove('hidden');
        gameArea.classList.add('hidden');
        queuePosition.textContent = 'You have been replaced for the next round';
    } else if (data.newPlayerId === socket.id) {
        // This player is now playing
        currentUser.isPlaying = true;
        waitingArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        playerRole.textContent = 'You are playing in the next round!';
        playerRole.style.color = 'green';
    }
    
    // Update player names in display
    const player1Name = playerOne.querySelector('.player-name').textContent;
    const player2Name = playerTwo.querySelector('.player-name').textContent;
    
    if (player1Name === data.oldPlayerName) {
        playerOne.querySelector('.player-name').textContent = data.newPlayerName;
    } else if (player2Name === data.oldPlayerName) {
        playerTwo.querySelector('.player-name').textContent = data.newPlayerName;
    }
});

// Buzz in handler
buzzButton.addEventListener('click', () => {
    console.log('Buzz button clicked!');
    console.log('Current user state:', {
        isPlaying: currentUser.isPlaying,
        hasBuzzed: currentUser.hasBuzzed,
        buttonDisabled: buzzButton.disabled
    });
    
    if (currentUser.isPlaying && !currentUser.hasBuzzed && !buzzButton.disabled) {
        console.log('Sending buzzIn event to server');
        socket.emit('buzzIn');
        buzzButton.disabled = true;
        currentUser.hasBuzzed = true;
        // Update the button state
        updateBuzzButton();
    } else {
        console.log('Buzz ignored - user not playing, already buzzed, or button disabled');
    }
});