const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());

// Serve static files from the public directory
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// In-memory data store
const users = {};
const players = {};

// Authentication API Routes
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Missing username or password' });
    }
    if (users[username]) {
        return res.json({ success: false, message: 'Username already taken' });
    }
    users[username] = { password };
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        return res.json({ success: true });
    }
    res.json({ success: false, message: 'Invalid credentials' });
});

// Socket.IO Multiplayer Logic
io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        players[socket.id] = {
            username: username || 'Player',
            x: 0, y: 1.6, z: 0,
            rx: 0, ry: 0,
            level: 0,
            skinData: null
        };

        socket.emit('initGame', {
            id: socket.id,
            level: players[socket.id].level,
            players: players
        });

        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            player: players[socket.id]
        });
    });

    socket.on('updateSkin', (skinDataUrl) => {
        if (players[socket.id]) {
            players[socket.id].skinData = skinDataUrl;
            io.emit('skinUpdated', { id: socket.id, skinData: skinDataUrl });
        }
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rx = data.rx;
            players[socket.id].ry = data.ry;

            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                ...data
            });
        }
    });

    socket.on('changeLevel', (newLevel) => {
        if (players[socket.id]) {
            players[socket.id].level = newLevel;
            socket.emit('loadLevel', newLevel);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

// Explicit wildcard route to resolve single-page app routing on Render
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Dynamic port assignment required for Render deployment
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
