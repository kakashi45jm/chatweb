import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// Database directory & persistent users store
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'room_messages.json');
const DMS_FILE = path.join(DATA_DIR, 'dm_messages.json');

interface StoredUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  handle: string;
  avatarColor: string;
  avatarUrl?: string;
  avatarMediaType?: 'image' | 'video';
  coverUrl?: string;
  coverMediaType?: 'image' | 'video';
  isAdmin?: boolean;
  isVerified?: boolean;
  isVip?: boolean;
  customTitle?: string;
  statusMessage?: string;
  customStatusEmoji?: string;
  bio?: string;
  preferredLanguage?: string;
  autoTranslate?: boolean;
  createdAt: number;
}

// Ensure data folder and load users
let userDb = new Map<string, StoredUser>();
let roomMessagesDb = new Map<string, any[]>();
let dmStore = new Map<string, any[]>();

function initDatabases() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const list: StoredUser[] = JSON.parse(raw);
      for (const u of list) {
        userDb.set(u.username.toLowerCase(), u);
      }
    }
  } catch (err) {
    console.error('Failed to load user database:', err);
  }

  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [rId, msgs] of Object.entries(obj)) {
        roomMessagesDb.set(rId, Array.isArray(msgs) ? msgs : []);
      }
    }
  } catch (err) {
    console.error('Failed to load room messages database:', err);
  }

  try {
    if (fs.existsSync(DMS_FILE)) {
      const raw = fs.readFileSync(DMS_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [dmKey, msgs] of Object.entries(obj)) {
        dmStore.set(dmKey, Array.isArray(msgs) ? msgs : []);
      }
    }
  } catch (err) {
    console.error('Failed to load DM messages database:', err);
  }

  // Ensure Admin account exists in database
  if (!userDb.has('beneqt23')) {
    const adminUser: StoredUser = {
      id: 'usr-admin-beneqt23',
      username: 'beneqt23',
      password: 'kaizen12',
      name: 'joo',
      handle: '@beneqt23',
      avatarColor: '#ec4899',
      isAdmin: true,
      isVerified: true,
      isVip: true,
      customTitle: 'Founder & Administrator',
      statusMessage: '⚡ LiveCall Administrator',
      customStatusEmoji: '👑',
      bio: 'Official LiveCall System Administrator & Founder.',
      createdAt: Date.now(),
    };
    userDb.set('beneqt23', adminUser);
    saveUserDatabase();
  }
}

function saveUserDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const list = Array.from(userDb.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save user database:', err);
  }
}

let saveMsgTimeout: any = null;
function saveRoomMessagesDebounced() {
  if (saveMsgTimeout) clearTimeout(saveMsgTimeout);
  saveMsgTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const obj: Record<string, any[]> = {};
      for (const [k, v] of roomMessagesDb.entries()) {
        obj[k] = v.slice(-300);
      }
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save room messages:', e);
    }
  }, 150);
}

let saveDmTimeout: any = null;
function saveDmMessagesDebounced() {
  if (saveDmTimeout) clearTimeout(saveDmTimeout);
  saveDmTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const obj: Record<string, any[]> = {};
      for (const [k, v] of dmStore.entries()) {
        obj[k] = v.slice(-300);
      }
      fs.writeFileSync(DMS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save DM messages:', e);
    }
  }, 150);
}

initDatabases();

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

function getDmKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(':::');
}

let currentAnnouncement: string = 'Welcome to LiveCall Web - Ultra-fast Voice, Video & Text Communication';

function getOrCreateRoom(roomId: string, roomName?: string): RoomState {
  if (!rooms.has(roomId)) {
    const persistedMessages = roomMessagesDb.get(roomId) || [];
    rooms.set(roomId, {
      id: roomId,
      name: roomName || `Room #${roomId.substring(0, 6)}`,
      createdAt: Date.now(),
      participants: new Map(),
      messages: [...persistedMessages],
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

  // User Registration Endpoint
  app.post('/api/auth/register', (req, res) => {
    try {
      const { username, password, name, avatarColor } = req.body;
      if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'Username is required.' });
      }
      if (!password || typeof password !== 'string' || password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters.' });
      }

      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      if (userDb.has(cleanUsername)) {
        return res.status(409).json({ error: 'Username is already taken. Please choose another or sign in.' });
      }

      const displayName = (name && typeof name === 'string' && name.trim()) ? name.trim() : username.trim();
      const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4'];
      const chosenColor = avatarColor || colors[Math.floor(Math.random() * colors.length)];

      const newUser: StoredUser = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        username: cleanUsername,
        password: password,
        name: displayName,
        handle: `@${cleanUsername}`,
        avatarColor: chosenColor,
        isAdmin: false,
        isVerified: false,
        isVip: false,
        statusMessage: 'Available on LiveCall',
        customStatusEmoji: '🟢',
        bio: 'Member of Pink Void LiveCall & Web Chat.',
        createdAt: Date.now(),
      };

      userDb.set(cleanUsername, newUser);
      saveUserDatabase();

      // Return public profile (exclude raw password from return or return safely)
      const { password: _, ...safeProfile } = newUser;
      res.json({
        success: true,
        message: 'Account created successfully and saved to database.',
        user: safeProfile,
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Failed to create account.' });
    }
  });

  // User Login Endpoint
  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
      const existingUser = userDb.get(cleanUsername);

      if (!existingUser) {
        return res.status(401).json({ error: 'Account not found. Please register first.' });
      }

      if (existingUser.password && existingUser.password !== password) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      const { password: _, ...safeProfile } = existingUser;
      res.json({
        success: true,
        message: 'Login successful.',
        user: safeProfile,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  // Get Authenticated User Profile Endpoint
  app.get('/api/auth/me', (req, res) => {
    try {
      const { id, username, handle } = req.query;
      let user: StoredUser | undefined;
      if (username) {
        user = userDb.get(String(username).toLowerCase().replace(/^@/, ''));
      }
      if (!user && handle) {
        user = userDb.get(String(handle).toLowerCase().replace(/^@/, ''));
      }
      if (!user && id) {
        for (const u of userDb.values()) {
          if (u.id === id) {
            user = u;
            break;
          }
        }
      }
      if (user) {
        const { password: _, ...safeProfile } = user;
        return res.json({ success: true, user: safeProfile });
      }
      res.status(404).json({ error: 'User not found in database.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch user profile.' });
    }
  });

  // User Profile Update Sync Endpoint (Permanent Storage)
  app.post('/api/auth/update-profile', (req, res) => {
    try {
      const { username, userId, updates } = req.body;
      if (!updates) {
        return res.status(400).json({ error: 'Updates are required.' });
      }

      const cleanUsername = (username || updates.username || updates.handle || updates.name || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/^@/, '');

      const targetId = userId || updates.id;

      // Find existing user by username, handle, or user ID
      let existingUser: StoredUser | undefined;
      if (cleanUsername && userDb.has(cleanUsername)) {
        existingUser = userDb.get(cleanUsername);
      }
      if (!existingUser && targetId) {
        for (const u of userDb.values()) {
          if (u.id === targetId) {
            existingUser = u;
            break;
          }
        }
      }
      if (!existingUser && updates.handle) {
        const cleanHandle = updates.handle.trim().toLowerCase().replace(/^@/, '');
        existingUser = userDb.get(cleanHandle);
      }

      if (existingUser) {
        const updated: StoredUser = {
          ...existingUser,
          name: updates.name || existingUser.name,
          handle: updates.handle || existingUser.handle,
          avatarColor: updates.avatarColor || existingUser.avatarColor,
          avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl : existingUser.avatarUrl,
          avatarMediaType: updates.avatarMediaType || existingUser.avatarMediaType,
          coverUrl: updates.coverUrl !== undefined ? updates.coverUrl : existingUser.coverUrl,
          coverMediaType: updates.coverMediaType || existingUser.coverMediaType,
          customTitle: updates.customTitle !== undefined ? updates.customTitle : existingUser.customTitle,
          statusMessage: updates.statusMessage !== undefined ? updates.statusMessage : existingUser.statusMessage,
          customStatusEmoji: updates.customStatusEmoji !== undefined ? updates.customStatusEmoji : existingUser.customStatusEmoji,
          bio: updates.bio !== undefined ? updates.bio : existingUser.bio,
          preferredLanguage: updates.preferredLanguage || existingUser.preferredLanguage,
          autoTranslate: updates.autoTranslate !== undefined ? updates.autoTranslate : existingUser.autoTranslate,
        };

        userDb.set(existingUser.username.toLowerCase(), updated);
        saveUserDatabase();
        const { password: _, ...safeProfile } = updated;
        return res.json({ success: true, user: safeProfile });
      } else {
        // Create new persistent user record
        const fallbackUsername = cleanUsername || `user_${Date.now()}`;
        const newUser: StoredUser = {
          id: targetId || `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          username: fallbackUsername,
          name: updates.name || fallbackUsername,
          handle: updates.handle || `@${fallbackUsername}`,
          avatarColor: updates.avatarColor || '#ec4899',
          avatarUrl: updates.avatarUrl,
          avatarMediaType: updates.avatarMediaType || 'image',
          coverUrl: updates.coverUrl,
          coverMediaType: updates.coverMediaType || 'image',
          isAdmin: updates.isAdmin || false,
          isVerified: updates.isVerified || false,
          isVip: updates.isVip || false,
          customTitle: updates.customTitle,
          statusMessage: updates.statusMessage || 'Available on LiveCall',
          customStatusEmoji: updates.customStatusEmoji || '🟢',
          bio: updates.bio || 'Member of Pink Void LiveCall & Web Chat.',
          preferredLanguage: updates.preferredLanguage || 'English',
          autoTranslate: updates.autoTranslate !== undefined ? updates.autoTranslate : true,
          createdAt: Date.now(),
        };

        userDb.set(fallbackUsername, newUser);
        saveUserDatabase();
        const { password: _, ...safeProfile } = newUser;
        return res.json({ success: true, user: safeProfile });
      }
    } catch (err: any) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  // Get Room Messages History (Persistent)
  app.get('/api/rooms/:roomId/messages', (req, res) => {
    const { roomId } = req.params;
    const msgs = roomMessagesDb.get(roomId) || rooms.get(roomId)?.messages || [];
    res.json({ messages: msgs });
  });

  // Get DM Messages History (Persistent)
  app.get('/api/dms/:partnerId', (req, res) => {
    const { partnerId } = req.params;
    const userId = req.query.userId as string;
    if (!userId || !partnerId) {
      return res.status(400).json({ error: 'userId and partnerId are required' });
    }
    const dmKey = getDmKey(userId, partnerId);
    const msgs = dmStore.get(dmKey) || [];
    res.json({ messages: msgs });
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
              announcement: currentAnnouncement,
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
              if (!roomMessagesDb.has(client.roomId)) {
                roomMessagesDb.set(client.roomId, []);
              }
              roomMessagesDb.get(client.roomId)!.push(chatMsg);
              
              // Keep last 300 messages
              if (room.messages.length > 300) {
                room.messages.shift();
              }
              if (roomMessagesDb.get(client.roomId)!.length > 300) {
                roomMessagesDb.get(client.roomId)!.shift();
              }

              // Persist permanently to disk
              saveRoomMessagesDebounced();

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
            if (history.length > 300) {
              history.shift();
            }

            // Persist permanently to disk
            saveDmMessagesDebounced();

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

          case 'admin_clear_chat': {
            const targetRoomId = msg.roomId || client.roomId;
            if (targetRoomId) {
              const room = rooms.get(targetRoomId);
              if (room) {
                room.messages = [];
                const sysClearMsg = {
                  id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  roomId: targetRoomId,
                  senderId: 'system',
                  senderName: 'System',
                  senderAvatarColor: '#ef4444',
                  text: `🧹 Room chat was cleared by Administrator ${msg.adminName || client.userName}`,
                  timestamp: Date.now(),
                  isSystem: true,
                };
                room.messages.push(sysClearMsg);
                broadcastToRoom(targetRoomId, {
                  type: 'admin_clear_chat',
                  roomId: targetRoomId,
                  adminName: msg.adminName || client.userName,
                });
                broadcastToRoom(targetRoomId, {
                  type: 'chat_message',
                  message: sysClearMsg,
                });
              }
            }
            break;
          }

          case 'admin_kick_user': {
            const { targetUserId, targetUserName, reason } = msg;
            if (targetUserId) {
              // Send kick notification to target user
              sendDirectToUser(targetUserId, {
                type: 'admin_kick_user',
                targetUserId,
                targetUserName: targetUserName || 'User',
                adminName: msg.adminName || client.userName,
                reason: reason || 'Removed by Administrator',
              });

              // Broadcast notice to room
              if (client.roomId) {
                const room = rooms.get(client.roomId);
                if (room) {
                  room.participants.delete(targetUserId);
                  const sysKickMsg = {
                    id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    roomId: client.roomId,
                    senderId: 'system',
                    senderName: 'System',
                    senderAvatarColor: '#ef4444',
                    text: `⚠️ ${targetUserName || 'User'} was kicked by Administrator ${msg.adminName || client.userName}${reason ? `: "${reason}"` : ''}`,
                    timestamp: Date.now(),
                    isSystem: true,
                  };
                  room.messages.push(sysKickMsg);
                  broadcastToRoom(client.roomId, {
                    type: 'user_left',
                    userId: targetUserId,
                  });
                  broadcastToRoom(client.roomId, {
                    type: 'chat_message',
                    message: sysKickMsg,
                  });
                }
              }
            }
            break;
          }

          case 'admin_broadcast': {
            const announcement = msg.announcement;
            if (announcement) {
              currentAnnouncement = announcement;
              broadcastToAll({
                type: 'admin_broadcast',
                announcement,
                adminName: msg.adminName || client.userName,
              });

              // Also create system chat message in all rooms
              for (const [roomId, room] of rooms.entries()) {
                const sysAnnounceMsg = {
                  id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  roomId,
                  senderId: 'system',
                  senderName: '📢 Official Announcement',
                  senderAvatarColor: '#8b5cf6',
                  text: `📢 ${announcement}`,
                  timestamp: Date.now(),
                  isSystem: true,
                  isAnnouncement: true,
                };
                room.messages.push(sysAnnounceMsg);
                broadcastToRoom(roomId, {
                  type: 'chat_message',
                  message: sysAnnounceMsg,
                });
              }
            }
            break;
          }

          case 'admin_badge_update': {
            const { targetUserId, isVerified, isVip, customTitle } = msg;
            if (targetUserId) {
              const targetProfile = globalUsers.get(targetUserId);
              if (targetProfile) {
                if (isVerified !== undefined) targetProfile.isVerified = isVerified;
                if (isVip !== undefined) targetProfile.isVip = isVip;
                if (customTitle !== undefined) targetProfile.customTitle = customTitle;
                globalUsers.set(targetUserId, targetProfile);

                // Update in rooms
                for (const room of rooms.values()) {
                  if (room.participants.has(targetUserId)) {
                    room.participants.set(targetUserId, targetProfile);
                  }
                }

                broadcastToAll({
                  type: 'user_updated',
                  user: targetProfile,
                });
              }
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

