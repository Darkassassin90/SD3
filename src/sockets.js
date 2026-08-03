const jwt = require('jsonwebtoken');
const pool = require('./db');
const { addSocket, removeSocket } = require('./presence');

function initSockets(io) {
  // Authenticate every socket connection using the same JWT issued by /api/auth/login
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required.'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: payload.id, username: payload.username };
      next();
    } catch (err) {
      next(new Error('Invalid or expired session.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    addSocket(userId, socket.id);
    socket.join(`user_${userId}`);

    // Tell this user's friends that they just came online
    try {
      const [friends] = await pool.query('SELECT friend_id FROM friends WHERE user_id = ?', [userId]);
      friends.forEach(({ friend_id }) => {
        io.to(`user_${friend_id}`).emit('presence_update', { userId, online: true });
      });
    } catch (err) {
      console.error('Presence broadcast (connect) error:', err);
    }

    socket.on('disconnect', async () => {
      const wentOffline = removeSocket(userId, socket.id);
      if (!wentOffline) return; // user still has other open tabs/sockets

      try {
        const [friends] = await pool.query('SELECT friend_id FROM friends WHERE user_id = ?', [userId]);
        friends.forEach(({ friend_id }) => {
          io.to(`user_${friend_id}`).emit('presence_update', { userId, online: false });
        });
      } catch (err) {
        console.error('Presence broadcast (disconnect) error:', err);
      }
    });

    // Lightweight typing indicator (optional UX nicety, not persisted)
    socket.on('typing', ({ friendId }) => {
      if (!Number.isInteger(friendId)) return;
      io.to(`user_${friendId}`).emit('typing', { userId });
    });
  });
}

module.exports = initSockets;
