import { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage, RoomInfo, StreamMode, WSMessage, DirectMessageThread } from './types';
import { useWebRTC } from './hooks/useWebRTC';
import { runDeviceDiagnostics, unlockAudio, getSafeAudioContext, autoEnableOlderSafariCompatibility } from './utils/legacyCompatibility';
import { safeSetStorage, safeGetStorage, safeRemoveStorage, sanitizeUserForStorage } from './utils/safeStorage';
import { soundEffects } from './utils/audioHelper';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CallModal } from './components/CallModal';
import { IncomingCallBanner } from './components/IncomingCallBanner';
import { CompatibilityDiagnostics } from './components/CompatibilityDiagnostics';
import { InviteModal } from './components/InviteModal';
import { LoginForm } from './components/LoginForm';
import { ProfileModal } from './components/ProfileModal';
import { UserAvatar } from './components/UserAvatar';
import { Menu, X, Radio, Tablet, Sparkles, CheckCircle, Volume2, Cpu, LogOut } from 'lucide-react';

const INITIAL_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

export default function App() {
  // Initial device diagnostics & auto-enable routine
  const autoInit = autoEnableOlderSafariCompatibility();
  const diagnostics = autoInit.diag;

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const remember = safeGetStorage('livecall_remember_me');
    const savedUser = safeGetStorage('livecall_auth_user');
    return remember === 'true' && !!savedUser;
  });

  // User Profile
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    let savedUserObj: any = null;
    const raw = safeGetStorage('livecall_auth_user');
    if (raw) {
      try {
        savedUserObj = JSON.parse(raw);
      } catch {}
    }

    const savedName = savedUserObj?.name || safeGetStorage('livecall_username');
    const savedColor = savedUserObj?.avatarColor || safeGetStorage('livecall_avatar_color');
    const savedIsAdmin = savedUserObj?.isAdmin ?? false;
    const deviceName = savedIsAdmin
      ? 'Admin'
      : diagnostics.isiPadMini2Suspected
      ? 'iPad mini 2'
      : diagnostics.isiPad
      ? 'iPad'
      : diagnostics.isiOS
      ? `iOS ${diagnostics.iosVersion || 'Device'}`
      : diagnostics.isOlderSafari
      ? 'Older Safari'
      : 'Web Client';

    const defaultName = savedName || `Guest ${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: savedUserObj?.id || `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: defaultName,
      handle: savedUserObj?.handle || `@${defaultName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      email: savedUserObj?.email,
      avatarColor: savedColor || INITIAL_COLORS[Math.floor(Math.random() * INITIAL_COLORS.length)],
      avatarUrl: savedUserObj?.avatarUrl,
      avatarMediaType: savedUserObj?.avatarMediaType || 'image',
      coverUrl: savedUserObj?.coverUrl,
      coverMediaType: savedUserObj?.coverMediaType || 'image',
      isAdmin: savedIsAdmin,
      isVerified: savedUserObj?.isVerified ?? (savedIsAdmin ? true : false),
      isVip: savedUserObj?.isVip ?? (savedIsAdmin ? true : false),
      customTitle: savedUserObj?.customTitle || (savedIsAdmin ? 'Founder & Administrator' : undefined),
      statusMessage: savedUserObj?.statusMessage || (savedIsAdmin ? '⚡ LiveCall Administrator' : 'Available on LiveCall'),
      customStatusEmoji: savedUserObj?.customStatusEmoji || (savedIsAdmin ? '👑' : '🟢'),
      bio: savedUserObj?.bio || (savedIsAdmin ? 'Official LiveCall System Administrator & Founder.' : 'Real-time calling and messaging enthusiast.'),
      preferredLanguage: savedUserObj?.preferredLanguage || 'English',
      autoTranslate: savedUserObj?.autoTranslate ?? true,
      deviceType: savedIsAdmin ? 'Admin' : deviceName,
      isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
      joinedAt: Date.now(),
    };
  });

  // Room State
  const [currentRoomId, setCurrentRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room');
      if (r) return r.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    }
    return 'general';
  });

  const [currentRoomName, setCurrentRoomName] = useState<string>('General Lobby');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<UserProfile[]>([currentUser]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 1v1 Direct Messaging State
  const [activeDmPartner, setActiveDmPartner] = useState<UserProfile | null>(null);
  const [dmMessagesMap, setDmMessagesMap] = useState<{ [partnerId: string]: ChatMessage[] }>({});
  const [dmTypingMap, setDmTypingMap] = useState<{ [partnerId: string]: boolean }>({});

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [viewingTargetProfile, setViewingTargetProfile] = useState<UserProfile | null>(null);

  // Settings & Modes (Auto-configured for older Safari / iPad mini 2)
  const [streamModePreference, setStreamModePreference] = useState<StreamMode>(
    autoInit.isAutoEnabled ? 'legacy_relay' : diagnostics.recommendedMode
  );
  const [isLowMemoryMode, setIsLowMemoryMode] = useState<boolean>(
    autoInit.isAutoEnabled || diagnostics.isiPadMini2Suspected || diagnostics.isiOS
  );
  const [showAutoSafariBanner, setShowAutoSafariBanner] = useState<boolean>(autoInit.isAutoEnabled);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);

  // Helper to send messages over WebSocket
  const sendWS = useCallback((msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // WebRTC Hook
  const {
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isVideoOff,
    cameraFacing,
    activeCall,
    callDuration,
    effectiveStreamMode,
    remoteFrameData,
    localAudioLevel,
    remoteAudioLevel,
    connectionQuality,
    mediaError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    handleWSMessage,
  } = useWebRTC({
    userId: currentUser.id,
    roomId: activeDmPartner ? `dm-${[currentUser.id, activeDmPartner.id].sort().join('-')}` : currentRoomId,
    sendWS,
    streamModePreference,
    isLowMemoryMode,
  });

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Join room immediately
        ws.send(JSON.stringify({
          type: 'join_room',
          roomId: currentRoomId,
          user: currentUser,
        }));

        // Setup ping/pong keepalive
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'room_state': {
              setCurrentRoomName(msg.room.name);
              setParticipants(msg.room.participants);
              if (Array.isArray(msg.messages)) {
                setMessages(msg.messages);
                safeSetStorage(`livecall_room_msgs_${currentRoomId}`, JSON.stringify(msg.messages.slice(-50)));
              }
              if (msg.activeCall) {
                handleWSMessage({ type: 'call_initiate', call: msg.activeCall });
              }
              break;
            }

            case 'user_joined': {
              setParticipants((prev) => {
                if (prev.some((p) => p.id === msg.user.id)) return prev;
                return [...prev, msg.user];
              });
              setOnlineUsers((prev) => {
                if (prev.some((p) => p.id === msg.user.id)) return prev;
                return [...prev, msg.user];
              });
              break;
            }

            case 'user_updated': {
              setParticipants((prev) => prev.map((p) => (p.id === msg.user.id ? msg.user : p)));
              setOnlineUsers((prev) => {
                if (prev.some((p) => p.id === msg.user.id)) {
                  return prev.map((p) => (p.id === msg.user.id ? msg.user : p));
                }
                return [...prev, msg.user];
              });
              if (activeDmPartner && activeDmPartner.id === msg.user.id) {
                setActiveDmPartner(msg.user);
              }
              break;
            }

            case 'user_left': {
              setParticipants((prev) => prev.filter((p) => p.id !== msg.userId));
              setOnlineUsers((prev) => prev.filter((p) => p.id !== msg.userId));
              setTypingUsers((prev) => prev.filter((u) => u !== msg.userId));
              break;
            }

            case 'chat_message': {
              setMessages((prev) => {
                const next = [...prev, msg.message];
                safeSetStorage(`livecall_room_msgs_${currentRoomId}`, JSON.stringify(next.slice(-50)));
                return next;
              });
              if (msg.message.senderId !== currentUser.id && !msg.message.isSystem) {
                soundEffects.playMessageSound(false);
              }
              break;
            }

            // 1v1 Private Direct Message Received
            case 'private_chat_message': {
              const chatMsg = msg.message;
              const partnerId = chatMsg.senderId === currentUser.id ? chatMsg.recipientId! : chatMsg.senderId;

              setDmMessagesMap((prev) => {
                const list = prev[partnerId] || [];
                const next = [...list, chatMsg];
                safeSetStorage(`livecall_dm_msgs_${partnerId}`, JSON.stringify(next.slice(-50)));
                return {
                  ...prev,
                  [partnerId]: next,
                };
              });

              if (chatMsg.senderId !== currentUser.id) {
                soundEffects.playMessageSound(false);
              }
              break;
            }

            case 'private_history': {
              setDmMessagesMap((prev) => {
                safeSetStorage(`livecall_dm_msgs_${msg.partnerId}`, JSON.stringify(msg.messages.slice(-50)));
                return {
                  ...prev,
                  [msg.partnerId]: msg.messages,
                };
              });
              break;
            }

            case 'typing': {
              if (msg.isPrivate && msg.targetUserId === currentUser.id) {
                setDmTypingMap((prev) => ({
                  ...prev,
                  [msg.userId]: msg.isTyping,
                }));
              } else if (!msg.isPrivate) {
                if (msg.isTyping) {
                  setTypingUsers((prev) => (prev.includes(msg.userName) ? prev : [...prev, msg.userName]));
                } else {
                  setTypingUsers((prev) => prev.filter((u) => u !== msg.userName));
                }
              }
              break;
            }

            default:
              // Pass WebRTC & Call signaling to useWebRTC hook
              handleWSMessage(msg);
              break;
          }
        } catch (err) {
          console.warn('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Attempt reconnect after 2.5s
        reconnectTimerRef.current = setTimeout(connectWebSocket, 2500);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('WebSocket connection init failed:', e);
      reconnectTimerRef.current = setTimeout(connectWebSocket, 3000);
    }
  }, [currentRoomId, currentUser, activeDmPartner, handleWSMessage]);

  useEffect(() => {
    if (!isLoggedIn) return;
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket, isLoggedIn]);

  // Handle Login / Join from LoginForm
  const handleLogin = (user: UserProfile, targetRoomId: string) => {
    setCurrentUser(user);
    setCurrentRoomId(targetRoomId);
    setCurrentRoomName(targetRoomId.charAt(0).toUpperCase() + targetRoomId.slice(1).replace(/-/g, ' '));
    setIsLoggedIn(true);

    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', `?room=${targetRoomId}`);
    }
  };

  // Handle Logout / Switch User
  const handleLogout = () => {
    if (activeCall) {
      endCall();
    }
    safeRemoveStorage('livecall_auth_user');
    safeRemoveStorage('livecall_remember_me');
    if (wsRef.current) {
      sendWS({ type: 'leave_room', roomId: currentRoomId });
      wsRef.current.close();
    }
    setIsLoggedIn(false);
  };

  // Global touch unlock listener for iPad / iOS Safari Audio
  useEffect(() => {
    const handleFirstGesture = () => {
      const ctx = getSafeAudioContext();
      unlockAudio(ctx);
    };
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    window.addEventListener('click', handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
    };
  }, []);

  // Update Profile (Name, Bio, Handle, Avatar, Language)
  const handleSaveProfile = (updatedProfile: UserProfile) => {
    setCurrentUser(updatedProfile);
    const sanitized = sanitizeUserForStorage(updatedProfile);
    safeSetStorage('livecall_auth_user', JSON.stringify(sanitized));
    safeSetStorage('livecall_username', updatedProfile.name);
    safeSetStorage('livecall_avatar_color', updatedProfile.avatarColor);
    
    // Sync permanently to backend database
    const username = updatedProfile.handle?.replace(/^@/, '') || updatedProfile.name;
    fetch('/api/auth/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        userId: updatedProfile.id,
        updates: updatedProfile,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.user) {
          setCurrentUser((prev) => ({
            ...prev,
            ...data.user,
            deviceType: data.user.isAdmin ? 'Admin' : prev.deviceType,
          }));
        }
      })
      .catch(() => {});

    sendWS({
      type: 'user_updated',
      user: updatedProfile,
    });
  };

  // Restore Authoritative Profile from Backend on Initial Mount & Reconnect
  useEffect(() => {
    if (!isLoggedIn || !currentUser.id) return;
    const lookupKey = currentUser.username || currentUser.handle?.replace(/^@/, '') || currentUser.name;
    fetch(`/api/auth/me?id=${encodeURIComponent(currentUser.id)}&username=${encodeURIComponent(lookupKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.user) {
          setCurrentUser((prev) => ({
            ...prev,
            ...data.user,
            deviceType: data.user.isAdmin ? 'Admin' : prev.deviceType,
          }));
          const sanitized = sanitizeUserForStorage({
            ...currentUser,
            ...data.user,
          });
          safeSetStorage('livecall_auth_user', JSON.stringify(sanitized));
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // Load Persistent Room Messages on Room Change & Startup
  useEffect(() => {
    if (!isLoggedIn || !currentRoomId) return;

    // Load from local storage cache first for instant rendering
    const cached = safeGetStorage(`livecall_room_msgs_${currentRoomId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {}
    }

    // Fetch latest persistent messages from backend
    fetch(`/api/rooms/${encodeURIComponent(currentRoomId)}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
          safeSetStorage(`livecall_room_msgs_${currentRoomId}`, JSON.stringify(data.messages.slice(-50)));
        }
      })
      .catch(() => {});
  }, [currentRoomId, isLoggedIn]);

  // Load Persistent DM Messages when Opening 1v1 Direct Message
  useEffect(() => {
    if (!isLoggedIn || !activeDmPartner || !currentUser.id) return;
    const partnerId = activeDmPartner.id;

    // Load from local storage cache first for instant rendering
    const cached = safeGetStorage(`livecall_dm_msgs_${partnerId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDmMessagesMap((prev) => ({ ...prev, [partnerId]: parsed }));
        }
      } catch {}
    }

    // Fetch latest persistent DMs from backend
    fetch(`/api/dms/${encodeURIComponent(partnerId)}?userId=${encodeURIComponent(currentUser.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.messages)) {
          setDmMessagesMap((prev) => ({ ...prev, [partnerId]: data.messages }));
          safeSetStorage(`livecall_dm_msgs_${partnerId}`, JSON.stringify(data.messages.slice(-50)));
        }
      })
      .catch(() => {});
  }, [activeDmPartner?.id, currentUser.id, isLoggedIn]);

  // Switch Room (exits DM mode)
  const handleSwitchRoom = (newRoomId: string) => {
    setActiveDmPartner(null);
    if (newRoomId === currentRoomId) return;

    sendWS({ type: 'leave_room', roomId: currentRoomId });
    setCurrentRoomId(newRoomId);
    setCurrentRoomName(newRoomId.charAt(0).toUpperCase() + newRoomId.slice(1).replace(/-/g, ' '));
    setMessages([]);
    setParticipants([currentUser]);
    setIsMobileSidebarOpen(false);

    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', `?room=${newRoomId}`);
    }

    sendWS({
      type: 'join_room',
      roomId: newRoomId,
      user: currentUser,
    });
  };

  // Select 1v1 Direct Message Conversation
  const handleSelectDirectMessage = (partner: UserProfile) => {
    setActiveDmPartner(partner);
    setIsMobileSidebarOpen(false);

    // Request private message history if needed
    sendWS({
      type: 'get_private_history',
      partnerId: partner.id,
    });
  };

  // Send Chat Message (handles both Room & 1v1 Direct Message)
  const handleSendMessage = (text: string, attachment?: any) => {
    if (activeDmPartner) {
      // 1v1 Direct Message
      const chatMsg: ChatMessage = {
        id: `dm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        roomId: `dm-${[currentUser.id, activeDmPartner.id].sort().join('-')}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatarColor: currentUser.avatarColor,
        senderAvatarUrl: currentUser.avatarUrl,
        senderAvatarMediaType: currentUser.avatarMediaType,
        recipientId: activeDmPartner.id,
        recipientName: activeDmPartner.name,
        isPrivate: true,
        text,
        attachment,
        timestamp: Date.now(),
      };

      sendWS({
        type: 'private_chat_message',
        message: chatMsg,
      });
    } else {
      // Room Message
      const chatMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        roomId: currentRoomId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatarColor: currentUser.avatarColor,
        senderAvatarUrl: currentUser.avatarUrl,
        senderAvatarMediaType: currentUser.avatarMediaType,
        text,
        attachment,
        timestamp: Date.now(),
      };

      sendWS({
        type: 'chat_message',
        message: chatMsg,
      });
    }
  };

  // Broadcast Typing
  const handleTyping = (isTyping: boolean) => {
    if (activeDmPartner) {
      sendWS({
        type: 'typing',
        isTyping,
        isPrivate: true,
        targetUserId: activeDmPartner.id,
      });
    } else {
      sendWS({
        type: 'typing',
        isTyping,
      });
    }
  };

  // Start 1v1 or Room Call
  const handleStartCall = (type: 'audio' | 'video') => {
    if (activeDmPartner) {
      startCall(type, {
        isPrivate: true,
        recipientId: activeDmPartner.id,
        recipientName: activeDmPartner.name,
      });
    } else {
      startCall(type);
    }
  };

  // Open Profile Modals
  const handleOpenMyProfile = () => {
    setViewingTargetProfile(null); // editing my profile
    setIsProfileModalOpen(true);
  };

  const handleOpenUserProfile = (user: UserProfile) => {
    setViewingTargetProfile(user);
    setIsProfileModalOpen(true);
  };

  if (!isLoggedIn) {
    return (
      <LoginForm
        initialRoomId={currentRoomId}
        diagnostics={diagnostics}
        onLogin={handleLogin}
      />
    );
  }

  // Active messages depending on Room vs 1v1 Direct Message
  const activeMessageList = activeDmPartner
    ? dmMessagesMap[activeDmPartner.id] || []
    : messages;

  const activeTypingList = activeDmPartner
    ? dmTypingMap[activeDmPartner.id] ? [activeDmPartner.name] : []
    : typingUsers;

  // Admin Actions
  const handleAdminClearChat = () => {
    if (!currentUser.isAdmin) return;
    if (confirm('Are you sure you want to clear all messages in this room?')) {
      sendWS({
        type: 'admin_clear_chat',
        roomId: currentRoomId,
      });
      setMessages([]);
    }
  };

  const handleAdminBroadcast = (announcement: string) => {
    if (!currentUser.isAdmin) return;
    sendWS({
      type: 'admin_broadcast',
      announcement,
    });
  };

  return (
    <div id="livecall-app-root" className="flex h-screen w-screen overflow-hidden bg-slate-900 font-sans select-none antialiased">
      
      {/* Mobile Top Bar for toggling sidebar on smaller screens */}
      <div className="sm:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-white">
        <button
          id="mobile-sidebar-toggle-btn"
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-200"
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        
        <div className="font-bold text-sm flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-pink-400" />
          <span>Pink Void Live</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="mobile-profile-btn"
            onClick={handleOpenMyProfile}
            className="cursor-pointer"
            title="My Profile"
          >
            <UserAvatar
              user={currentUser}
              size="sm"
              shape="circle"
            />
          </button>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        </div>
      </div>

      {/* Sidebar (Desktop persistent, Mobile drawer) */}
      <div
        className={`fixed inset-y-0 left-0 z-40 sm:static sm:z-auto transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        }`}
      >
        <Sidebar
          currentUser={currentUser}
          participants={participants}
          onlineUsers={onlineUsers}
          currentRoomId={currentRoomId}
          currentRoomName={currentRoomName}
          activeDmPartnerId={activeDmPartner?.id || null}
          onUpdateUserName={(newName) => handleSaveProfile({ ...currentUser, name: newName })}
          onUpdateAvatarColor={(newColor) => handleSaveProfile({ ...currentUser, avatarColor: newColor })}
          onSwitchRoom={handleSwitchRoom}
          onSelectDirectMessage={handleSelectDirectMessage}
          onOpenMyProfile={handleOpenMyProfile}
          onOpenUserProfile={handleOpenUserProfile}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          isLowMemoryMode={isLowMemoryMode}
          onToggleLowMemory={() => setIsLowMemoryMode(!isLowMemoryMode)}
          streamModePreference={streamModePreference}
          isConnected={isConnected}
          onLogout={handleLogout}
          onAdminBroadcast={handleAdminBroadcast}
        />
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="sm:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-xs"
        />
      )}

      {/* Main Chat & Interactive Canvas Area */}
      <main className="flex-1 flex flex-col h-full pt-12 sm:pt-0 overflow-hidden bg-[#0d0f1a]">
        
        {/* Older Safari Auto-Enable Compatibility Bar */}
        {showAutoSafariBanner && (
          <div id="safari-compat-banner" className="bg-emerald-900/90 text-emerald-100 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-emerald-700/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white">Older Safari / iPad mini 2 Auto-Enabled:</strong> Low-latency Relay mode and audio engine are primed for instant video & audio calling.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-test-safari-audio"
                onClick={() => {
                  unlockAudio(getSafeAudioContext());
                  soundEffects.playCallConnect();
                  setIsAudioUnlocked(true);
                }}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
              >
                <Volume2 className="w-3 h-3" />
                <span>Test Audio</span>
              </button>
              <button
                id="btn-dismiss-safari-banner"
                onClick={() => setShowAutoSafariBanner(false)}
                className="p-1 hover:bg-emerald-800 rounded text-emerald-300 hover:text-white"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <ChatArea
          messages={activeMessageList}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          roomName={currentRoomName}
          roomId={currentRoomId}
          participants={participants}
          typingUsers={activeTypingList}
          streamModePreference={streamModePreference}
          onSendMessage={handleSendMessage}
          onStartCall={handleStartCall}
          onOpenInvite={() => setIsInviteOpen(true)}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          onTyping={handleTyping}
          isLowMemoryMode={isLowMemoryMode}
          isDirectMessage={!!activeDmPartner}
          dmPartner={activeDmPartner || undefined}
          onOpenUserProfile={handleOpenUserProfile}
          preferredLanguage={currentUser.preferredLanguage || 'English'}
          isAdmin={currentUser.isAdmin}
          onAdminClearChat={handleAdminClearChat}
        />
      </main>

      {/* Incoming Call Ringing Notification Banner */}
      <IncomingCallBanner
        activeCall={activeCall}
        currentUserId={currentUser.id}
        onAccept={acceptCall}
        onReject={rejectCall}
      />

      {/* Fullscreen / Floating Video & Audio Call Modal */}
      <CallModal
        activeCall={activeCall}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        localStream={localStream}
        remoteStream={remoteStream}
        remoteFrameData={remoteFrameData}
        effectiveStreamMode={effectiveStreamMode}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        cameraFacing={cameraFacing}
        callDuration={callDuration}
        localAudioLevel={localAudioLevel}
        remoteAudioLevel={remoteAudioLevel}
        connectionQuality={connectionQuality}
        mediaError={mediaError}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onSwitchCamera={switchCamera}
        onEndCall={endCall}
        isLowMemoryMode={isLowMemoryMode}
      />

      {/* User Profile / Edit Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        targetUser={viewingTargetProfile}
        onSaveProfile={handleSaveProfile}
        onStartDirectMessage={(partner) => {
          handleSelectDirectMessage(partner);
        }}
        onStart1v1Call={(partner, callType) => {
          setActiveDmPartner(partner);
          startCall(callType, {
            isPrivate: true,
            recipientId: partner.id,
            recipientName: partner.name,
          });
        }}
      />

      {/* iPad mini 2 & iOS 9.3.5 Hardware Diagnostics Modal */}
      <CompatibilityDiagnostics
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        streamModePreference={streamModePreference}
        onStreamModeChange={setStreamModePreference}
        isLowMemoryMode={isLowMemoryMode}
        onToggleLowMemory={() => setIsLowMemoryMode(!isLowMemoryMode)}
      />

      {/* Invite & QR Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={currentRoomId}
        roomName={currentRoomName}
      />

    </div>
  );
}
