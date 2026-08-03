// Tracks which users currently have an open socket connection.
// userId -> Set of socket ids (a user may have multiple tabs/devices open)
const onlineUsers = new Map();

function addSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeSocket(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true; // user just went fully offline
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId);
}

module.exports = { onlineUsers, addSocket, removeSocket, isOnline };
