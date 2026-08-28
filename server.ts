import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

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
const globalUsers = new Map<string, any>();
const dmStore = new Map<string, any[]>();

function getDmKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(':::');
}

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

function broadcastToAll(message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const [ws] of clients.entries()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
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

function sendDirectToUser(targetUserId: string, message: any) {
  const payload = JSON.stringify(message);
  for (const [ws, client] of clients.entries()) {
    if (client.userId === targetUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Lazy Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
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
      onlineUsers: globalUsers.size,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
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

  app.get('/api/users/online', (req, res) => {
    const onlineList = Array.from(globalUsers.values());
    res.json({ users: onlineList });
  });

  // AI Translation & Grammar Polish API (Gemini 3.7 Flash)
  app.post('/api/ai/translate', async (req, res) => {
    try {
      const { text, targetLanguage = 'English', mode = 'translate', tone = 'conversational' } = req.body;

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Text is required for translation.' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        // High quality local fallback if key not configured
        return res.json({
          translatedText: text,
          detectedLanguage: 'Auto',
          targetLanguage,
          grammarNotes: 'Gemini API key is configuring. Showing original text.',
          isEnhanced: false,
        });
      }

      const prompt = `You are a real-time multilingual translator and linguistic editor for a live messaging and calling app.
Task:
1. Detect the source language.
2. If mode is "translate": Translate the input text faithfully and accurately into ${targetLanguage}. Ensure correct grammar, natural native phrasing, perfect punctuation, and keep the tone ${tone}. Maintain emojis, code snippets, numbers, and proper nouns.
3. If mode is "enhance": Polish the grammar, spelling, clarity, and sentence flow of the text in its original language, keeping the exact meaning.
4. If mode is "both": Provide both the grammatical polish in the original language and the high-accuracy translation into ${targetLanguage}.

Input Text:
"""${text.trim()}"""

Target Language: ${targetLanguage}
Requested Mode: ${mode}

Respond in STRICT JSON format matching this schema:
{
  "detectedLanguage": "string (e.g. Tagalog, Spanish, English, Japanese, etc.)",
  "translatedText": "string (the final translated or enhanced text with polished grammar)",
  "originalEnhanced": "string (the grammar-corrected version of original text)",
  "grammarNotes": "string (brief 1-sentence explanation of correction if needed, or empty string)",
  "isEnhanced": true
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const responseText = response.text || '{}';
      let parsedResult: any;
      try {
        parsedResult = JSON.parse(responseText);
      } catch {
        parsedResult = {
          detectedLanguage: 'Auto',
          translatedText: responseText.replace(/```json|```/g, '').trim(),
          targetLanguage,
          isEnhanced: true,
        };
      }

      res.json({
        detectedLanguage: parsedResult.detectedLanguage || 'Auto',
        translatedText: parsedResult.translatedText || text,
        originalEnhanced: parsedResult.originalEnhanced,
        grammarNotes: parsedResult.grammarNotes,
        targetLanguage,
        isEnhanced: true,
      });
    } catch (err: any) {
      console.error('Gemini translation error:', err);
      res.status(500).json({
        error: 'Translation service encountered an error',
        details: err?.message || 'Unknown error',
        fallback: req.body.text,
      });
    }
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

            globalUsers.set(user.id, user);

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

            // Also broadcast to all clients for 1v1 direct messaging availability
            broadcastToAll({
              type: 'user_updated',
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

          case 'user_updated': {
            if (msg.user && msg.user.id) {
              client.userProfile = msg.user;
              client.userName = msg.user.name;
              globalUsers.set(msg.user.id, msg.user);

              if (client.roomId) {
                const room = rooms.get(client.roomId);
                if (room) {
                  room.participants.set(msg.user.id, msg.user);
                }
              }

              broadcastToAll({
                type: 'user_updated',
                user: msg.user,
              });
            }
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

          // 1v1 Private Direct Messaging
          case 'private_chat_message': {
            const { message } = msg;
            if (!message || !message.recipientId) return;

            const chatMsg = {
              ...message,
              isPrivate: true,
              timestamp: Date.now(),
            };

            const dmKey = getDmKey(chatMsg.senderId, chatMsg.recipientId);
            if (!dmStore.has(dmKey)) {
              dmStore.set(dmKey, []);
            }
            const history = dmStore.get(dmKey)!;
            history.push(chatMsg);
            if (history.length > 150) {
              history.shift();
            }

            // Send to recipient
            sendDirectToUser(chatMsg.recipientId, {
              type: 'private_chat_message',
              message: chatMsg,
            });

            // Echo back to sender (all active tabs of sender)
            sendDirectToUser(chatMsg.senderId, {
              type: 'private_chat_message',
              message: chatMsg,
            });
            break;
          }

          case 'get_private_history': {
            const { partnerId } = msg;
            if (client.userId && partnerId) {
              const dmKey = getDmKey(client.userId, partnerId);
              const history = dmStore.get(dmKey) || [];
              ws.send(JSON.stringify({
                type: 'private_history',
                partnerId,
                messages: history,
              }));
            }
            break;
          }

          case 'typing': {
            if (msg.isPrivate && msg.targetUserId) {
              // 1v1 Private typing indicator
              sendDirectToUser(msg.targetUserId, {
                type: 'typing',
                userId: client.userId,
                userName: client.userName,
                isTyping: msg.isTyping,
                isPrivate: true,
                targetUserId: msg.targetUserId,
              });
            } else if (client.roomId) {
              broadcastToRoom(client.roomId, {
                type: 'typing',
                userId: client.userId,
                userName: client.userName,
                isTyping: msg.isTyping,
              }, ws);
            }
            break;
          }

          case 'call_initiate': {
            if (msg.call.isPrivate && msg.call.recipientId) {
              // 1v1 Private Call
              sendDirectToUser(msg.call.recipientId, {
                type: 'call_initiate',
                call: {
                  ...msg.call,
                  status: 'ringing',
                  startedAt: Date.now(),
                  participants: [client.userId],
                },
              });
            } else if (client.roomId) {
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
            }
            break;
          }

          case 'call_accept': {
            if (msg.isPrivate && msg.targetUserId) {
              sendDirectToUser(msg.targetUserId, {
                type: 'call_accept',
                callId: msg.callId,
                userId: msg.userId,
                streamMode: msg.streamMode || 'webrtc',
              });
            } else if (client.roomId) {
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
            }
            break;
          }

          case 'call_reject': {
            if (msg.isPrivate && msg.targetUserId) {
              sendDirectToUser(msg.targetUserId, {
                type: 'call_reject',
                callId: msg.callId,
                userId: msg.userId,
              });
            } else if (client.roomId) {
              const room = rooms.get(client.roomId);
              if (room && room.activeCall) {
                broadcastToRoom(client.roomId, {
                  type: 'call_reject',
                  callId: msg.callId,
                  userId: msg.userId,
                });
                if (room.activeCall.initiatorId === msg.userId || room.participants.size <= 2) {
                  room.activeCall = null;
                }
              }
            }
            break;
          }

          case 'call_end': {
            if (msg.isPrivate && msg.targetUserId) {
              sendDirectToUser(msg.targetUserId, {
                type: 'call_end',
                callId: msg.callId,
                userId: msg.userId,
              });
            } else if (client.roomId) {
              const room = rooms.get(client.roomId);
              if (room) {
                room.activeCall = null;
                broadcastToRoom(client.roomId, {
                  type: 'call_end',
                  callId: msg.callId,
                  userId: msg.userId,
                });
              }
            }
            break;
          }

          // WebRTC Signaling Pass-Through
          case 'webrtc_offer':
          case 'webrtc_answer':
          case 'webrtc_ice': {
            if (msg.targetUserId) {
              sendDirectToUser(msg.targetUserId, msg);
            } else if (client.roomId) {
              broadcastToRoom(client.roomId, msg, ws);
            }
            break;
          }

          // Legacy Streaming Relay (Frame-by-frame MJPEG canvas & audio chunks for iOS 9.3.5 / legacy webviews)
          case 'relay_video_frame': {
            if (msg.targetUserId) {
              sendDirectToUser(msg.targetUserId, {
                type: 'relay_video_frame',
                callId: msg.callId,
                senderId: client.userId,
                frame: msg.frame,
                width: msg.width,
                height: msg.height,
              });
            } else if (client.roomId) {
              broadcastToRoom(client.roomId, {
                type: 'relay_video_frame',
                callId: msg.callId,
                senderId: client.userId,
                frame: msg.frame,
                width: msg.width,
                height: msg.height,
              }, ws);
            }
            break;
          }

          case 'relay_audio_chunk': {
            if (msg.targetUserId) {
              sendDirectToUser(msg.targetUserId, {
                type: 'relay_audio_chunk',
                callId: msg.callId,
                senderId: client.userId,
                audioData: msg.audioData,
              });
            } else if (client.roomId) {
              broadcastToRoom(client.roomId, {
                type: 'relay_audio_chunk',
                callId: msg.callId,
                senderId: client.userId,
                audioData: msg.audioData,
              }, ws);
            }
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    });

    ws.on('close', () => {
      if (client.userId) {
        globalUsers.delete(client.userId);
        broadcastToAll({
          type: 'user_left',
          userId: client.userId,
        });
      }

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

