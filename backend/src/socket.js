import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;
export function initSocket(server, origin) {
  io = new Server(server, { cors: { origin, credentials: true } });
  io.use((socket, next) => {
    try {
      const user = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      socket.user = user;
      next();
    } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('admins');
  });
  return io;
}
export const getIO = () => io;
export const emitTo = (room, event, payload) => io?.to(room).emit(event, payload);
