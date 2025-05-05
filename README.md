# Quiz Faceoff Application

A real-time quiz competition application where an admin can manage questions, select participants, and run a competitive buzzer-style quiz game.

## Features

### Admin Features
- Add questions to a local queue
- View connected users in real-time via WebSocket
- Select two users for faceoff rounds
- Choose questions from the queue
- Monitor which user buzzes in first (with visual indicator)
- Select round winners
- Replace players between rounds (winner gets replaced, loser stays)

### User Features
- Join the application with a username
- Queue for participation
- View active rounds (even when not participating)
- Buzz in to answer questions when selected to play
- Visual indicator shows who buzzed in first

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **Deployment**: Railway.app

## Project Structure

```
quiz-faceoff/
├── package.json          # Node.js dependencies
├── .gitignore            # Git ignore file
├── server.js             # Main server file with WebSocket logic
├── .env                  # Environment variables
├── public/               # Static files
│   ├── index.html        # User interface
│   ├── admin.html        # Admin interface
│   ├── css/              # Stylesheets
│   │   ├── style.css     # Main styles
│   │   └── admin.css     # Admin-specific styles
│   └── js/               # Client-side JavaScript
│       ├── main.js       # User interface logic
│       └── admin.js      # Admin interface logic
└── README.md             # This file
```

## How It Works

1. **Connection & Registration**
   - Users connect to the application and register with a username
   - Admins log in with a password to access the admin panel

2. **Waiting Queue**
   - Users join a waiting queue upon registration
   - Admin can see all connected users and the queue

3. **Game Flow**
   - Admin selects two users from the queue for a faceoff
   - Admin chooses a question from the question queue
   - Selected users see a "Buzz In" button
   - First user to buzz in gets highlighted with a light indicator
   - Admin selects the winner of the round
   - Winner is moved to a winners list and cannot play in future rounds
   - Loser remains for the next round
   - Admin can replace the winner with a new user from the queue

4. **Real-time Updates**
   - All actions are synchronized in real-time using WebSockets
   - All users (active and spectators) can see the game progress

## Setup and Installation

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/quiz-faceoff.git
   cd quiz-faceoff
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following content:
   ```
   PORT=3000
   ADMIN_PASSWORD=your-secure-password
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Access the application:
   - User interface: http://localhost:3000
   - Admin interface: http://localhost:3000/admin

### Production Deployment

Follow the instructions in [Railway Deployment Guide](./RAILWAY.md) to deploy the application to Railway.app.

## Usage Guide

### Admin Guide

1. **Login**
   - Navigate to `/admin`
   - Enter the admin password

2. **Managing Questions**
   - Add questions using the "Add New Question" form
   - Questions appear in the Questions Queue

3. **Starting a Round**
   - Select two players from the Connected Users or User Queue
   - Click "Start Faceoff"
   - Select a question from the Questions Queue

4. **During a Round**
   - A player's light will activate when they buzz in
   - Click "Select Winner" to choose who wins the round
   - The winner is added to the Previous Winners list

5. **Replacing Players**
   - After selecting a winner, use the "Replace Player" controls
   - Select which player to replace and a new player from the queue
   - Click "Replace Player" to make the switch

### User Guide

1. **Joining**
   - Enter your name to join the waiting queue
   - Wait for the admin to select you for a round

2. **Playing**
   - When selected, you'll see a "BUZZ IN!" button
   - Click the button as fast as possible when you know the answer
   - Only the first player to buzz in will be highlighted

3. **After a Round**
   - If you win, you'll be replaced with a new player
   - If you lose, you'll stay for the next round
   - Previous winners cannot play in future rounds

## WebSocket Events

The application uses the following WebSocket events for communication:

- `register`: User registration
- `userQueued`: New user added to queue
- `selectPlayers`: Admin selects players for a round
- `playersSelected`: Players have been selected for a round
- `addQuestion`: Admin adds a new question
- `questionAdded`: New question has been added
- `selectQuestion`: Admin selects a question for the round
- `questionSelected`: Question has been selected
- `buzzIn`: Player buzzes in to answer
- `playerBuzzed`: A player has buzzed in
- `selectWinner`: Admin selects the round winner
- `winnerSelected`: A winner has been selected
- `replacePlayer`: Admin replaces a player
- `playerReplaced`: A player has been replaced
- `playerDisconnected`: Player disconnection notification
- `getState`: Admin requests current game state
- `fullState`: Full game state response
- `gameState`: Game state update for users

## License

MIT