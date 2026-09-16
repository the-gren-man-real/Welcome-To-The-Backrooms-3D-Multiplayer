const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
// Serves static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store
const users = {};
const players = {};

// Register API
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

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        return res.json({ success: true });
    }
    res.json({ success: false, message: 'Invalid credentials' });
});

// Socket.io Multiplayer Handling
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
