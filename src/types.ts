export type CallType = 'audio' | 'video';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export type StreamMode = 'webrtc' | 'legacy_relay' | 'auto';

export interface UserProfile {
  id: string;
  username?: string;
  name: string;
  handle?: string;
  email?: string;
  avatarColor: string;
  avatarUrl?: string;
  avatarMediaType?: 'image' | 'video';
  coverUrl?: string;
  coverMediaType?: 'image' | 'video';
  statusMessage?: string;
  customStatusEmoji?: string;
  bio?: string;
  preferredLanguage?: string;
  autoTranslate?: boolean;
  isAdmin?: boolean;
  isVip?: boolean;
  isVerified?: boolean;
  customTitle?: string;
  deviceType: string;
  isIosLegacy: boolean;
  joinedAt: number;
}

export interface ChatAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string; // base64 or blob URL
  name?: string;
  duration?: number; // for audio
  size?: number;
}

export interface TranslationData {
  translatedText: string;
  detectedLanguage?: string;
  targetLanguage: string;
  grammarNotes?: string;
  isEnhanced?: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatarColor: string;
  senderAvatarUrl?: string;
  senderAvatarMediaType?: 'image' | 'video';
  senderIsAdmin?: boolean;
  senderIsVip?: boolean;
  senderIsVerified?: boolean;
  senderTitle?: string;
  text: string;
  attachment?: ChatAttachment;
  timestamp: number;
  isSystem?: boolean;
  isAnnouncement?: boolean;
  isPrivate?: boolean;
  recipientId?: string;
  recipientName?: string;
  translation?: TranslationData;
}

export interface DirectMessageThread {
  partnerId: string;
  partnerUser: UserProfile;
  unreadCount: number;
  lastMessage?: ChatMessage;
}

export interface RoomInfo {
  id: string;
  name: string;
  createdAt: number;
  participants: UserProfile[];
}

export interface ActiveCallState {
  roomId: string;
  callId: string;
  initiatorId: string;
  initiatorName: string;
  type: CallType;
  status: CallStatus;
  startedAt?: number;
  streamMode: 'webrtc' | 'legacy_relay';
  participants: string[];
  isPrivate?: boolean;
  recipientId?: string;
}

export interface DeviceDiagnostics {
  userAgent: string;
  isiPad: boolean;
  isiOS: boolean;
  iosVersion: string | null;
  isiPadMini2Suspected: boolean;
  isOlderSafari: boolean;
  autoEnabledAudioCall: boolean;
  hasGetUserMedia: boolean;
  hasRTCPeerConnection: boolean;
  hasAudioContext: boolean;
  hasMediaRecorder: boolean;
  hasWebSocket: boolean;
  hasCanvas: boolean;
  recommendedMode: 'webrtc' | 'legacy_relay';
}

export type WSMessage =
  | { type: 'join_room'; roomId: string; user: UserProfile }
  | { type: 'leave_room'; roomId: string }
  | { type: 'room_state'; room: RoomInfo; messages: ChatMessage[]; activeCall: ActiveCallState | null; announcement?: string }
  | { type: 'user_joined'; user: UserProfile }
  | { type: 'user_left'; userId: string }
  | { type: 'user_updated'; user: UserProfile }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'private_chat_message'; message: ChatMessage }
  | { type: 'private_history'; partnerId: string; messages: ChatMessage[] }
  | { type: 'typing'; userId: string; userName: string; isTyping: boolean; isPrivate?: boolean; targetUserId?: string }
  | { type: 'admin_clear_chat'; roomId: string; adminName: string }
  | { type: 'admin_kick_user'; targetUserId: string; targetUserName: string; adminName: string; reason?: string }
  | { type: 'admin_broadcast'; announcement: string; adminName: string }
  | { type: 'admin_badge_update'; targetUserId: string; isVerified?: boolean; isVip?: boolean; customTitle?: string; adminName: string }
  | { type: 'call_initiate'; call: ActiveCallState }
  | { type: 'call_accept'; callId: string; userId: string; streamMode: 'webrtc' | 'legacy_relay' }
  | { type: 'call_reject'; callId: string; userId: string }
  | { type: 'call_end'; callId: string; userId: string }
  | { type: 'webrtc_offer'; callId: string; targetUserId?: string; senderId: string; sdp: any }
  | { type: 'webrtc_answer'; callId: string; targetUserId?: string; senderId: string; sdp: any }
  | { type: 'webrtc_ice'; callId: string; targetUserId?: string; senderId: string; candidate: any }
  | { type: 'relay_video_frame'; callId: string; senderId: string; frame: string; width: number; height: number; targetUserId?: string }
  | { type: 'relay_audio_chunk'; callId: string; senderId: string; audioData: string; targetUserId?: string }
  | { type: 'ping' }
  | { type: 'pong' };

