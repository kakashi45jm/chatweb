import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  userName: string;
  roomId?: string;
  userProfile?: any;
}

interface RoomState {
  id: string;
  name: string;
  createdAt: number;
  participants: Map<string, any>;
  messages: any[];
  activeCall: any | null;
}

const rooms = new Map<string, RoomState>();
const clients = new Map<WebSocket, ClientConnection>();

function getOrCreateRoom(roomId: string, roomName?: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      name: roomName || `Room #${roomId.substring(0, 6)}`,
      createdAt: Date.now(),
      participants: new Map(),
      messages: [],
      activeCall: null,
    });
  }
  return rooms.get(roomId)!;
}

function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const [ws, client] of clients.entries()) {
    if (client.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function sendToUser(roomId: string, targetUserId: string, message: any) {
  const payload = JSON.stringify(message);
  for (const [ws, client] of clients.entries()) {
    if (client.roomId === roomId && client.userId === targetUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '15mb' }));

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      connectedClients: clients.size,
      timestamp: Date.now(),
    });
  });

  app.get('/api/rooms', (req, res) => {
    const roomList = Array.from(rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      participantCount: r.participants.size,
      hasActiveCall: !!r.activeCall,
    }));
    res.json({ rooms: roomList });
  });

  // WebSocket Server with explicit upgrade routing
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === '/ws' || pathname === '/' || pathname === '') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        // Ignore or destroy other upgrades (e.g. Vite HMR if disabled)
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    const client: ClientConnection = {
      ws,
      userId: '',
      userName: '',
    };
    clients.set(ws, client);

    ws.on('message', (rawData: string) => {
      try {
        const msg = JSON.parse(rawData.toString());

        switch (msg.type) {
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }

          case 'join_room': {
            const { roomId, user } = msg;
            client.userId = user.id;
            client.userName = user.name;
            client.roomId = roomId;
            client.userProfile = user;

            const room = getOrCreateRoom(roomId);
            room.participants.set(user.id, user);

            // Send full room state to joined user
            const participantsArray = Array.from(room.participants.values());
            ws.send(JSON.stringify({
              type: 'room_state',
              room: {
                id: room.id,
                name: room.name,
                createdAt: room.createdAt,
                participants: participantsArray,
              },
              messages: room.messages.slice(-50),
              activeCall: room.activeCall,
            }));

            // Broadcast user joined to other participants
            broadcastToRoom(roomId, {
              type: 'user_joined',
              user,
            }, ws);

            // Send system message
            const sysMsg = {
              id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              roomId,
              senderId: 'system',
              senderName: 'System',
              senderAvatarColor: '#64748b',
              text: `${user.name} joined the room`,
              timestamp: Date.now(),
              isSystem: true,
            };
            room.messages.push(sysMsg);
            broadcastToRoom(roomId, {
              type: 'chat_message',
              message: sysMsg,
            });
            break;
          }

          case 'leave_room': {
            if (client.roomId && client.userId) {
              const room = rooms.get(client.roomId);
              if (room) {
                room.participants.delete(client.userId);
                broadcastToRoom(client.roomId, {
                  type: 'user_left',
                  userId: client.userId,
                });

                if (room.activeCall && (room.activeCall.initiatorId === client.userId || room.participants.size === 0)) {
                  room.activeCall = null;
                  broadcastToRoom(client.roomId, {
                    type: 'call_end',
                    callId: 'active',
                    userId: client.userId,
                  });
                }
              }
              client.roomId = undefined;
            }
            break;
          }

          case 'chat_message': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (room) {
              const chatMsg = {
                ...msg.message,
                timestamp: Date.now(),
              };
              room.messages.push(chatMsg);
              // Keep last 100 messages in memory
              if (room.messages.length > 100) {
                room.messages.shift();
              }
              broadcastToRoom(client.roomId, {
                type: 'chat_message',
                message: chatMsg,
              });
            }
            break;
          }

          case 'typing': {
            if (!client.roomId) return;
            broadcastToRoom(client.roomId, {
              type: 'typing',
              userId: client.userId,
              userName: client.userName,
              isTyping: msg.isTyping,
            }, ws);
            break;
          }

          case 'call_initiate': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (room) {
              room.activeCall = {
                ...msg.call,
                status: 'ringing',
                startedAt: Date.now(),
                participants: [client.userId],
              };
              broadcastToRoom(client.roomId, {
                type: 'call_initiate',
                call: room.activeCall,
              });
            }
            break;
          }

          case 'call_accept': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (room && room.activeCall) {
              room.activeCall.status = 'connected';
              if (!room.activeCall.participants.includes(msg.userId)) {
                room.activeCall.participants.push(msg.userId);
              }
              if (msg.streamMode) {
                room.activeCall.streamMode = msg.streamMode;
              }
              broadcastToRoom(client.roomId, {
                type: 'call_accept',
                callId: msg.callId,
                userId: msg.userId,
                streamMode: room.activeCall.streamMode,
              });
            }
            break;
          }

          case 'call_reject': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (room && room.activeCall) {
              broadcastToRoom(client.roomId, {
                type: 'call_reject',
                callId: msg.callId,
                userId: msg.userId,
              });
              // If only 1 person or initiator left
              if (room.activeCall.initiatorId === msg.userId || room.participants.size <= 2) {
                room.activeCall = null;
              }
            }
            break;
          }

          case 'call_end': {
            if (!client.roomId) return;
            const room = rooms.get(client.roomId);
            if (room) {
              room.activeCall = null;
              broadcastToRoom(client.roomId, {
                type: 'call_end',
                callId: msg.callId,
                userId: msg.userId,
              });
            }
            break;
          }

          // WebRTC Signaling Pass-Through
          case 'webrtc_offer':
          case 'webrtc_answer':
          case 'webrtc_ice': {
            if (!client.roomId) return;
            if (msg.targetUserId) {
              sendToUser(client.roomId, msg.targetUserId, msg);
            } else {
              broadcastToRoom(client.roomId, msg, ws);
            }
            break;
          }

          // Legacy Streaming Relay (Frame-by-frame MJPEG canvas & audio chunks for iOS 9.3.5 / legacy webviews)
          case 'relay_video_frame': {
            if (!client.roomId) return;
            broadcastToRoom(client.roomId, {
              type: 'relay_video_frame',
              callId: msg.callId,
              senderId: client.userId,
              frame: msg.frame,
              width: msg.width,
              height: msg.height,
            }, ws);
            break;
          }

          case 'relay_audio_chunk': {
            if (!client.roomId) return;
            broadcastToRoom(client.roomId, {
              type: 'relay_audio_chunk',
              callId: msg.callId,
              senderId: client.userId,
              audioData: msg.audioData,
            }, ws);
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      if (client.roomId && client.userId) {
        const room = rooms.get(client.roomId);
        if (room) {
          room.participants.delete(client.userId);
          broadcastToRoom(client.roomId, {
            type: 'user_left',
            userId: client.userId,
          });

          if (room.activeCall && room.activeCall.initiatorId === client.userId) {
            room.activeCall = null;
            broadcastToRoom(client.roomId, {
              type: 'call_end',
              callId: 'active',
              userId: client.userId,
            });
          }

          // Clean empty room if older than 1 hour
          if (room.participants.size === 0 && Date.now() - room.createdAt > 3600000) {
            rooms.delete(room.id);
          }
        }
      }
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('WebSocket client error:', err);
    });
  });

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LiveCall Server running on http://localhost:${PORT}`);
  });
}

startServer();
