// Initialize socket connection
const socket = io();

// DOM Elements
const connectionStatus = document.getElementById('connection-status');
const adminLogin = document.getElementById('admin-login');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const adminPassword = document.getElementById('admin-password');
const usersList = document.getElementById('users-list');
const queueList = document.getElementById('queue-list');
const winnersList = document.getElementById('winners-list');
const questionsList = document.getElementById('questions-list');
const roundNumber = document.getElementById('round-number');
const playerSlot1 = document.getElementById('player-slot-1');
const playerSlot2 = document.getElementById('player-slot-2');
const startGameBtn = document.getElementById('start-game-btn');
const questionText = document.getElementById('question-text');
const selectWinnerBtn = document.getElementById('select-winner-btn');
const playerToReplace = document.getElementById('player-to-replace');
const newPlayer = document.getElementById('new-player');
const replaceBtn = document.getElementById('replace-btn');
const questionInput = document.getElementById('question-input');
const addQuestionBtn = document.getElementById('add-question-btn');

// Admin state
let adminState = {
    loggedIn: false,
    users: [],
    userQueue: [],
    questions: [],
    winners: [],
    selectedPlayers: [null, null],
    selectedQuestion: null,
    currentGame: null,
    buzzedPlayerId: null // Track who has buzzed in
};

// Socket connection status
socket.on('connect', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = 'green';
});

socket.on('disconnect', () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.style.color = 'red';
});

// Admin login
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const password = adminPassword.value;
    if (password) {
        // In a real app, you would validate this server-side
        // For this demo, we'll use a simple check
        // Register as admin
        socket.emit('register', { name: 'Admin', isAdmin: true });
        adminState.loggedIn = true;
        
        // Hide login form and show admin panel
        adminLogin.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        
        // Request current state from server
        socket.emit('getState');
    }
});

// Handle full state update (when admin loads page)
socket.on('fullState', (state) => {
    console.log('Full state received:', state);
    
    // Update admin state
    adminState.users = state.users || [];
    adminState.userQueue = state.userQueue || [];
    adminState.questions = state.questions || [];
    adminState.winners = state.winners || [];
    adminState.currentGame = state.currentGame;
    
    // Ensure selectedPlayers is properly initialized
    if (!Array.isArray(adminState.selectedPlayers) || adminState.selectedPlayers.length !== 2) {
        adminState.selectedPlayers = [null, null];
    }
    
    // Check if someone has already buzzed in
    if (state.currentGame && state.currentGame.buzzedPlayer) {
        adminState.buzzedPlayerId = state.currentGame.buzzedPlayer;
        console.log(`Buzzed player from state: ${adminState.buzzedPlayerId}`);
    }
    
    // Update UI
    updateUsersUI();
    updateQueueUI();
    updateQuestionsUI();
    updateWinnersUI();
    
    if (state.currentGame) {
        roundNumber.textContent = state.currentGame.round || 0;
        
        // Update player slots if players are selected
        if (state.currentGame.players && state.currentGame.players.length === 2) {
            adminState.selectedPlayers = [
                state.currentGame.players[0] || null,
                state.currentGame.players[1] || null
            ];
            console.log('Setting selected players from state:', adminState.selectedPlayers);
            
            const player1 = state.users.find(u => u.id === state.currentGame.players[0]);
            const player2 = state.users.find(u => u.id === state.currentGame.players[1]);
            
            if (player1) {
                selectPlayer(0, player1.id, player1.name);
            }
            
            if (player2) {
                selectPlayer(1, player2.id, player2.name);
            }
            
            // Update replacement dropdowns immediately
            console.log('Updating player replacement dropdowns after state init');
            populatePlayerReplaceDropdown();
            populateNewPlayerDropdown();
        }
        
        // Update current question if one is selected
        if (state.currentGame.question) {
            questionText.textContent = state.currentGame.question.text;
            selectWinnerBtn.disabled = false;
        }
        
        // Update buzzed state if a player has buzzed
        if (state.currentGame.buzzedPlayer) {
            const buzzedPlayerIndex = state.currentGame.players.indexOf(state.currentGame.buzzedPlayer);
            const buzzedPlayerName = state.users.find(u => u.id === state.currentGame.buzzedPlayer)?.name;
            
            if (buzzedPlayerIndex === 0) {
                playerSlot1.querySelector('.player-light').classList.add('active');
            } else if (buzzedPlayerIndex === 1) {
                playerSlot2.querySelector('.player-light').classList.add('active');
            }
            
            // Update the select winner button
            if (buzzedPlayerName) {
                updateGameActionsForBuzz(state.currentGame.buzzedPlayer, buzzedPlayerName);
            }
        }
    }
});

// Helper function to update game actions when a player buzzes in
function updateGameActionsForBuzz(playerId, playerName) {
    // Get the game actions area
    const gameActions = document.getElementById('game-actions');
    
    // Clear previous content
    gameActions.innerHTML = '';
    
    // Add status message
    const statusText = document.createElement('div');
    statusText.className = 'status-message';
    statusText.style.color = 'green';
    statusText.style.fontWeight = 'bold';
    statusText.textContent = `${playerName} buzzed in!`;
    gameActions.appendChild(statusText);
    
    // Add select winner button
    const winnerBtn = document.createElement('button');
    winnerBtn.id = 'select-winner-btn';
    winnerBtn.className = 'btn primary-btn';
    winnerBtn.textContent = `Select ${playerName} as Winner`;
    // Use a separate function to handle click
    winnerBtn.addEventListener('click', function() {
        socket.emit('selectWinner', playerId);
    });
    gameActions.appendChild(winnerBtn);
}

// New user joined
socket.on('userQueued', (user) => {
    // Add to user queue
    adminState.userQueue.push(user);
    updateQueueUI();
});

// User updates
socket.on('usersUpdated', (data) => {
    adminState.users = data.users || [];
    adminState.userQueue = data.userQueue || [];
    updateUsersUI();
    updateQueueUI();
});

// Question added
socket.on('questionAdded', (question) => {
    adminState.questions.push(question);
    updateQuestionsUI();
});

// Players selected (from another admin session)
socket.on('playersSelected', (data) => {
    console.log('Players selected event received:', data);
    adminState.selectedPlayers = data.players.map(p => p.id);
    adminState.userQueue = data.userQueue;
    
    console.log('Updated selected players:', adminState.selectedPlayers);
    
    // Update player slots
    if (data.players.length === 2) {
        selectPlayer(0, data.players[0].id, data.players[0].name);
        selectPlayer(1, data.players[1].id, data.players[1].name);
    }
    
    updateQueueUI();
    resetLights();
    startGameBtn.disabled = true;
    
    // Update replacement controls
    console.log('Updating player replacement controls after players selected');
    populatePlayerReplaceDropdown();
    populateNewPlayerDropdown();
    
    // Enable select winner button
    if (adminState.currentGame && adminState.currentGame.question) {
        selectWinnerBtn.disabled = false;
    }
});

// Question selected
socket.on('questionSelected', (data) => {
    console.log('Question selected:', data);
    questionText.textContent = data.question;
    roundNumber.textContent = data.round;
    
    // Reset lights
    resetLights();
    
    // Reset buzzed player tracking
    adminState.buzzedPlayerId = null;
    
    // Reset game actions area to default
    resetGameActions();
});

// Player buzzed
socket.on('playerBuzzed', (data) => {
    console.log('Player buzzed:', data);
    
    // Update admin state to track who buzzed in
    adminState.buzzedPlayerId = data.playerId;
    
    // Reset both lights first
    resetLights();
    
    // Light up only the player who buzzed based on index
    if (data.playerIndex === 0) {
        playerSlot1.querySelector('.player-light').classList.add('active');
    } else if (data.playerIndex === 1) {
        playerSlot2.querySelector('.player-light').classList.add('active');
    }
    
    // Update game actions UI
    updateGameActionsForBuzz(data.playerId, data.playerName);
});

// Admin notifications (high priority messages)
socket.on('adminNotification', (notification) => {
    console.log('Admin notification received:', notification);
    
    if (notification.type === 'playerBuzzed') {
        const data = notification.data;
        
        // Update admin state
        adminState.buzzedPlayerId = data.playerId;
        
        // Reset lights
        resetLights();
        
        // Light up correct player
        if (data.playerIndex === 0) {
            playerSlot1.querySelector('.player-light').classList.add('active');
        } else if (data.playerIndex === 1) {
            playerSlot2.querySelector('.player-light').classList.add('active');
        }
        
        // Update game actions UI
        updateGameActionsForBuzz(data.playerId, data.playerName);
        
        // Show notification
        alert(`${data.playerName} buzzed in!`);
    }
});

// Reset game actions to default state
function resetGameActions() {
    const gameActions = document.getElementById('game-actions');
    
    // Clear previous content
    gameActions.innerHTML = '';
    
    // Add default select winner button
    const defaultBtn = document.createElement('button');
    defaultBtn.id = 'select-winner-btn';
    defaultBtn.className = 'btn primary-btn';
    defaultBtn.textContent = 'Select Winner';
    defaultBtn.disabled = true; // Disable until someone buzzes
    
    // Add event listener
    defaultBtn.addEventListener('click', handleWinnerSelection);
    gameActions.appendChild(defaultBtn);
}

// Handle winner selection
function handleWinnerSelection() {
    if (adminState.buzzedPlayerId) {
        socket.emit('selectWinner', adminState.buzzedPlayerId);
    } else {
        // If no one buzzed, show modal to pick winner
        const player1Name = playerSlot1.querySelector('.slot-content').textContent;
        const player2Name = playerSlot2.querySelector('.slot-content').textContent;
        
        const winner = confirm(`No player buzzed in. Select ${player1Name} as winner?`);
        if (winner) {
            socket.emit('selectWinner', adminState.selectedPlayers[0]);
        } else {
            socket.emit('selectWinner', adminState.selectedPlayers[1]);
        }
    }
}

// Winner selected
socket.on('winnerSelected', (data) => {
    console.log('Winner selected event received:', data);
    
    // Add winner to winners list
    const winner = { id: data.winnerId, name: data.winnerName };
    if (!adminState.winners.some(w => w.id === winner.id)) {
        adminState.winners.push(winner);
        updateWinnersUI();
    }
    
    // Force update player replacement dropdown
    setTimeout(() => {
        console.log('Updating dropdowns after winner selected');
        populatePlayerReplaceDropdown();
        populateNewPlayerDropdown();
        
        // Explicitly enable the dropdowns
        document.getElementById('player-to-replace').disabled = false;
        document.getElementById('new-player').disabled = adminState.userQueue.length === 0;
        
        // Log the state of the dropdowns
        console.log('Player dropdown disabled:', document.getElementById('player-to-replace').disabled);
        console.log('New player dropdown disabled:', document.getElementById('new-player').disabled);
        console.log('User queue length:', adminState.userQueue.length);
    }, 500);
    
    // Show winner message
    const gameActions = document.getElementById('game-actions');
    const winnerMessage = document.createElement('div');
    winnerMessage.className = 'status-message';
    winnerMessage.style.color = 'green';
    winnerMessage.style.fontWeight = 'bold';
    winnerMessage.textContent = `${data.winnerName} won this round!`;
    
    // Clear and update the game actions area
    gameActions.innerHTML = '';
    gameActions.appendChild(winnerMessage);
    
    // Add instruction to replace player or select new question
    const nextStepMessage = document.createElement('div');
    nextStepMessage.className = 'status-message';
    nextStepMessage.textContent = 'Replace a player or select a new question to continue';
    gameActions.appendChild(nextStepMessage);
});

// Game reset event
socket.on('gameReset', (data) => {
    console.log('Game reset received', data);
    
    // Reset lights
    resetLights();
    
    // Reset buzzed player tracking
    adminState.buzzedPlayerId = null;
    
    // Clear question
    questionText.textContent = 'No question selected';
    
    // Update player information if provided
    if (data && data.currentPlayers) {
        // Make sure the player slots reflect current players
        adminState.selectedPlayers = data.currentPlayers.map(p => p.id);
    }
    
    // Update user queue if provided
    if (data && data.userQueue) {
        adminState.userQueue = data.userQueue;
        console.log('Updated user queue:', adminState.userQueue);
    }
    
    // Update the UI
    updateUsersUI();
    updateQueueUI();
    
    // Force update dropdowns after a delay
    setTimeout(() => {
        console.log('Updating player replacement dropdowns after game reset');
        populatePlayerReplaceDropdown();
        populateNewPlayerDropdown();
        
        // Make sure the replace button is properly initialized
        const replaceBtn = document.getElementById('replace-btn');
        if (replaceBtn) {
            const playerToReplace = document.getElementById('player-to-replace');
            const newPlayer = document.getElementById('new-player');
            
            // The button should be disabled until both dropdowns have values
            const canReplace = playerToReplace.value && newPlayer.value;
            replaceBtn.disabled = !canReplace;
            
            console.log('Replace button state after game reset:', {
                disabled: replaceBtn.disabled,
                canReplace: canReplace,
                playerToReplaceValue: playerToReplace.value,
                newPlayerValue: newPlayer.value
            });
        }
    }, 500);
    
    // Reset game actions area to default
    resetGameActions();
    
    // Show a message indicating the game is ready for next question
    const gameActions = document.getElementById('game-actions');
    const readyMessage = document.createElement('div');
    readyMessage.className = 'status-message';
    readyMessage.textContent = 'Ready for next question. You can also replace a player.';
    readyMessage.style.color = 'blue';
    gameActions.prepend(readyMessage);
});

// Player replaced
socket.on('playerReplaced', (data) => {
    console.log('Player replaced event:', data);
    
    // Update player slots with new player
    if (adminState.selectedPlayers[0] === data.oldPlayerId) {
        adminState.selectedPlayers[0] = data.newPlayerId;
        playerSlot1.querySelector('.slot-content').textContent = data.newPlayerName;
    } else if (adminState.selectedPlayers[1] === data.oldPlayerId) {
        adminState.selectedPlayers[1] = data.newPlayerId;
        playerSlot2.querySelector('.slot-content').textContent = data.newPlayerName;
    }
    
    // Update queue
    adminState.userQueue = data.userQueue;
    
    // Update all UI elements
    updateUsersUI();
    updateQueueUI();
    
    // Update replacement dropdowns
    populatePlayerReplaceDropdown();
    populateNewPlayerDropdown();
    
    // Reset the replacement form
    playerToReplace.value = '';
    newPlayer.value = '';
    replaceBtn.disabled = true;
    
    // Show a success message
    alert(`${data.oldPlayerName} has been replaced with ${data.newPlayerName}`);
});

// Player disconnected
socket.on('playerDisconnected', (player) => {
    // Display notification
    alert(`Player ${player.name} has disconnected!`);
});

// Reset lights
function resetLights() {
    playerSlot1.querySelector('.player-light').classList.remove('active');
    playerSlot2.querySelector('.player-light').classList.remove('active');
}

// Update users list UI
function updateUsersUI() {
    console.log('Updating users UI');
    console.log('All users:', adminState.users);
    console.log('Current selected players:', adminState.selectedPlayers);
    
    usersList.innerHTML = '';
    
    if (adminState.users.length === 0) {
        usersList.innerHTML = '<div class="list-empty-message">No users connected</div>';
        return;
    }
    
    adminState.users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.classList.add('list-item');
        userItem.textContent = user.name;
        userItem.dataset.id = user.id;
        
        // Highlight if user is selected
        if (adminState.selectedPlayers.includes(user.id)) {
            userItem.classList.add('selected');
        }
        
        // Add click handler to select user
        userItem.addEventListener('click', () => {
            console.log(`User item clicked: ${user.name} (${user.id})`);
            
            // Determine which slot to fill
            let targetSlot = 0; // Default to first slot
            
            // If player is already selected, do nothing
            if (adminState.selectedPlayers.includes(user.id)) {
                console.log('User already selected, ignoring click');
                return;
            }
            
            // Check if there's an empty slot
            if (adminState.selectedPlayers[0] === null || adminState.selectedPlayers[0] === undefined) {
                targetSlot = 0;
            } else if (adminState.selectedPlayers[1] === null || adminState.selectedPlayers[1] === undefined) {
                targetSlot = 1;
            } else {
                // Replace first slot if both are full
                targetSlot = 0;
            }
            
            console.log(`Target slot for user: ${targetSlot}`);
            selectPlayer(targetSlot, user.id, user.name);
        });
        
        usersList.appendChild(userItem);
    });
}

// Update queue list UI
function updateQueueUI() {
    console.log('Updating queue UI');
    console.log('Queue users:', adminState.userQueue);
    console.log('Current selected players:', adminState.selectedPlayers);
    
    queueList.innerHTML = '';
    
    if (adminState.userQueue.length === 0) {
        queueList.innerHTML = '<div class="list-empty-message">Queue is empty</div>';
        return;
    }
    
    adminState.userQueue.forEach(user => {
        const queueItem = document.createElement('div');
        queueItem.classList.add('list-item');
        queueItem.textContent = user.name;
        queueItem.dataset.id = user.id;
        
        // Add click handler to select from queue
        queueItem.addEventListener('click', () => {
            console.log(`Queue item clicked: ${user.name} (${user.id})`);
            
            // Find first empty slot or use slot 0 if both are filled
            let targetSlot = 0; // Default to first slot
            
            // Check if there's an empty slot
            if (adminState.selectedPlayers[0] === null || adminState.selectedPlayers[0] === undefined) {
                targetSlot = 0;
            } else if (adminState.selectedPlayers[1] === null || adminState.selectedPlayers[1] === undefined) {
                targetSlot = 1;
            }
            
            console.log(`Target slot for new player: ${targetSlot}`);
            
            // Select the player for the slot
            selectPlayer(targetSlot, user.id, user.name);
            
            // Remove from queue when selected
            const index = adminState.userQueue.findIndex(u => u.id === user.id);
            if (index !== -1) {
                console.log(`Removing user from queue at index ${index}`);
                adminState.userQueue.splice(index, 1);
                updateQueueUI();
            } else {
                console.warn('User not found in queue');
            }
        });
        
        queueList.appendChild(queueItem);
    });
    
    // Update new player dropdown
    populateNewPlayerDropdown();
}

// Update questions list UI
function updateQuestionsUI() {
    questionsList.innerHTML = '';
    
    if (adminState.questions.length === 0) {
        questionsList.innerHTML = '<div class="list-empty-message">No questions added</div>';
        return;
    }
    
    adminState.questions.forEach(question => {
        const questionItem = document.createElement('div');
        questionItem.classList.add('list-item');
        questionItem.textContent = question.text;
        questionItem.dataset.id = question.id;
        
        // Add click handler to select question
        questionItem.addEventListener('click', () => {
            // Only allow selecting question if players are selected
            if (adminState.selectedPlayers[0] && adminState.selectedPlayers[1]) {
                selectQuestion(question.id, question.text);
            } else {
                alert('Please select players first!');
            }
        });
        
        questionsList.appendChild(questionItem);
    });
}

// Update winners list UI
function updateWinnersUI() {
    winnersList.innerHTML = '';
    
    if (adminState.winners.length === 0) {
        winnersList.innerHTML = '<div class="list-empty-message">No winners yet</div>';
        return;
    }
    
    adminState.winners.forEach(winner => {
        const winnerItem = document.createElement('div');
        winnerItem.classList.add('list-item', 'winner');
        winnerItem.textContent = winner.name;
        winnerItem.dataset.id = winner.id;
        winnersList.appendChild(winnerItem);
    });
}

// Select player for a slot
function selectPlayer(slot, id, name) {
    console.log(`Selecting player for slot ${slot}: ${name} (${id})`);
    
    // Ensure the selectedPlayers array is properly initialized
    if (!Array.isArray(adminState.selectedPlayers) || adminState.selectedPlayers.length !== 2) {
        adminState.selectedPlayers = [null, null];
    }
    
    // Update the admin state
    adminState.selectedPlayers[slot] = id;
    
    // Update the UI
    const slotElement = slot === 0 ? playerSlot1 : playerSlot2;
    if (slotElement) {
        const slotContent = slotElement.querySelector('.slot-content');
        if (slotContent) {
            slotContent.textContent = name;
            slotElement.classList.add('selected');
            console.log(`Updated slot ${slot} UI with player: ${name}`);
        } else {
            console.error(`Slot ${slot} content element not found`);
        }
    } else {
        console.error(`Slot ${slot} element not found`);
    }
    
    // Enable start button if both slots are filled
    const bothSlotsFilled = adminState.selectedPlayers[0] && adminState.selectedPlayers[1];
    startGameBtn.disabled = !bothSlotsFilled;
    console.log(`Both slots filled: ${bothSlotsFilled}, Start button disabled: ${startGameBtn.disabled}`);
    
    // Update users UI to highlight selected users
    updateUsersUI();
    
    // Update player replacement dropdown whenever a player is selected
    populatePlayerReplaceDropdown();
    populateNewPlayerDropdown();
}

// Select question
function selectQuestion(id, text) {
    adminState.selectedQuestion = id;
    socket.emit('selectQuestion', id);
}

// Populate player replacement dropdown
function populatePlayerReplaceDropdown() {
    console.log('Populating player replacement dropdown');
    console.log('Current players:', adminState.selectedPlayers);
    console.log('Users:', adminState.users);
    
    // Get the dropdown element
    const dropdown = document.getElementById('player-to-replace');
    if (!dropdown) {
        console.error('Player replacement dropdown not found!');
        return;
    }
    
    // Clear existing options
    dropdown.innerHTML = '<option value="">Select player</option>';
    
    // Add current players to dropdown regardless of winner status
    if (adminState.selectedPlayers && adminState.selectedPlayers.length > 0) {
        adminState.selectedPlayers.forEach((playerId, index) => {
            if (playerId) {
                const playerInfo = adminState.users.find(u => u.id === playerId);
                console.log(`Player ${index + 1}:`, playerInfo);
                
                if (playerInfo) {
                    const option = document.createElement('option');
                    option.value = playerInfo.id;
                    option.textContent = playerInfo.name;
                    dropdown.appendChild(option);
                    console.log(`Added option for ${playerInfo.name}`);
                } else {
                    console.warn(`Player with ID ${playerId} not found in users list`);
                }
            }
        });
    } else {
        console.warn('No selected players found');
    }
    
    // Enable the dropdown if there are any players to replace
    const hasOptions = dropdown.options.length > 1;
    dropdown.disabled = !hasOptions;
    console.log(`Dropdown has ${dropdown.options.length} options, disabled: ${dropdown.disabled}`);
}

// Populate new player dropdown
function populateNewPlayerDropdown() {
    console.log('Populating new player dropdown');
    console.log('User queue:', adminState.userQueue);
    
    // Get the dropdown element
    const dropdown = document.getElementById('new-player');
    if (!dropdown) {
        console.error('New player dropdown not found!');
        return;
    }
    
    // Clear existing options
    dropdown.innerHTML = '<option value="">Select from queue</option>';
    
    // Add queue players to dropdown
    if (adminState.userQueue && adminState.userQueue.length > 0) {
        adminState.userQueue.forEach(user => {
            console.log('Adding user to dropdown:', user);
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            dropdown.appendChild(option);
            console.log(`Added option for ${user.name}`);
        });
        
        // Enable if there are players in queue
        dropdown.disabled = false;
        console.log('New player dropdown enabled - users in queue');
    } else {
        // Disable if no players in queue
        dropdown.disabled = true;
        console.log('New player dropdown disabled - no users in queue');
    }
    
    // Log dropdown state
    console.log(`New player dropdown has ${dropdown.options.length} options, disabled: ${dropdown.disabled}`);
}

// Event Handlers
startGameBtn.addEventListener('click', () => {
    console.log('Start game button clicked');
    console.log('Selected players:', adminState.selectedPlayers);
    
    if (adminState.selectedPlayers[0] && adminState.selectedPlayers[1]) {
        console.log('Sending selectPlayers event to server');
        socket.emit('selectPlayers', adminState.selectedPlayers);
        
        // Immediately update the replacement dropdowns
        console.log('Updating player replacement dropdowns');
        setTimeout(() => {
            populatePlayerReplaceDropdown();
            populateNewPlayerDropdown();
        }, 500);
    } else {
        console.warn('Cannot start game - both player slots must be filled');
    }
});

// Handle player replacement
document.getElementById('replace-btn').addEventListener('click', () => {
    console.log('Replace button clicked');
    
    // Get values directly from the DOM elements
    const oldPlayerId = document.getElementById('player-to-replace').value;
    const newPlayerId = document.getElementById('new-player').value;
    
    console.log('Replace player values:', {
        oldPlayerId,
        newPlayerId,
        selectedPlayers: adminState.selectedPlayers,
        userQueue: adminState.userQueue
    });
    
    if (oldPlayerId && newPlayerId) {
        console.log(`Replacing player ${oldPlayerId} with ${newPlayerId}`);
        socket.emit('replacePlayer', { oldPlayerId, newPlayerId });
    } else {
        console.error('Missing player IDs for replacement');
        if (!oldPlayerId) {
            console.error('No player selected to replace');
        }
        if (!newPlayerId) {
            console.error('No new player selected from queue');
        }
    }
});

addQuestionBtn.addEventListener('click', () => {
    const text = questionInput.value.trim();
    if (text) {
        socket.emit('addQuestion', { text });
        questionInput.value = '';
    }
});

// Update player replacement controls when selections change
document.getElementById('player-to-replace').addEventListener('change', (e) => {
    console.log('Player to replace selection changed:', e.target.value);
    
    const playerToReplaceValue = e.target.value;
    const newPlayerValue = document.getElementById('new-player').value;
    
    const canReplace = playerToReplaceValue && newPlayerValue;
    console.log('Can replace:', canReplace, 'Player to replace:', playerToReplaceValue, 'New player:', newPlayerValue);
    
    // Get the replace button
    const replaceButton = document.getElementById('replace-btn');
    if (replaceButton) {
        replaceButton.disabled = !canReplace;
        console.log('Replace button disabled:', replaceButton.disabled);
    } else {
        console.error('Replace button not found!');
    }
});

document.getElementById('new-player').addEventListener('change', (e) => {
    console.log('New player selection changed:', e.target.value);
    
    const playerToReplaceValue = document.getElementById('player-to-replace').value;
    const newPlayerValue = e.target.value;
    
    const canReplace = playerToReplaceValue && newPlayerValue;
    console.log('Can replace:', canReplace, 'Player to replace:', playerToReplaceValue, 'New player:', newPlayerValue);
    
    // Get the replace button
    const replaceButton = document.getElementById('replace-btn');
    if (replaceButton) {
        replaceButton.disabled = !canReplace;
        console.log('Replace button disabled:', replaceButton.disabled);
    } else {
        console.error('Replace button not found!');
    }
});

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing event listeners');
    
    // Initialize the select winner button event listener
    const selectWinnerBtn = document.getElementById('select-winner-btn');
    if (selectWinnerBtn) {
        selectWinnerBtn.addEventListener('click', handleWinnerSelection);
        console.log('Select winner button event listener added');
    } else {
        console.warn('Select winner button not found during initialization');
    }
    
    // Initialize replace button with disabled state
    const replaceBtn = document.getElementById('replace-btn');
    if (replaceBtn) {
        replaceBtn.disabled = true;
        console.log('Replace button initialized as disabled');
    } else {
        console.warn('Replace button not found during initialization');
    }
    
    // Initialize dropdowns
    setTimeout(() => {
        console.log('Initial population of dropdowns');
        populatePlayerReplaceDropdown();
        populateNewPlayerDropdown();
    }, 1000);
});

// Initialize UI
resetGameActions();