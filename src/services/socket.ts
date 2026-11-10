import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const socketUrl = API_BASE_URL || window.location.origin;
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket.io Client] Conectado con ID:', socket?.id);
      // Auto-reunirse a la sala si el usuario ya está autenticado
      try {
        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          if (userData?.idcliente) {
            socket?.emit('join-client-room', userData.idcliente);
            console.log(`[Socket.io Client] Re-unido automáticamente a sala de cliente: ${userData.idcliente}`);
          }
        }
      } catch (err) {
        console.error('[Socket.io Client] Error al obtener userData:', err);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io Client] Desconectado. Motivo:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.io Client] Error de conexión:', error.message);
    });
  }
  return socket;
};

export const joinClientRoom = (idCliente: string | number) => {
  const s = getSocket();
  if (idCliente) {
    s.emit('join-client-room', idCliente);
    console.log(`[Socket.io Client] Unido a sala: client_${idCliente}`);
  }
};

