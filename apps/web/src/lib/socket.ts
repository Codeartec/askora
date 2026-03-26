import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const wsUrl = import.meta.env.VITE_WS_URL || '';
    const token = localStorage.getItem('askora_token');
    const sessionToken = localStorage.getItem('askora_session');

    socket = io(wsUrl, {
      auth: {
        token: token || undefined,
        sessionToken: sessionToken || undefined,
      },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
