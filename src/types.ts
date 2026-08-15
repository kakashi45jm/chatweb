export type CallType = 'audio' | 'video';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export type StreamMode = 'webrtc' | 'legacy_relay' | 'auto';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
  deviceType: string;
  isIosLegacy: boolean;
  joinedAt: number;
}

export interface ChatAttachment {
  type: 'image' | 'audio' | 'file';
  url: string; // base64 or blob URL
  name?: string;
  duration?: number; // for audio
  size?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatarColor: string;
  text: string;
  attachment?: ChatAttachment;
  timestamp: number;
  isSystem?: boolean;
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
  | { type: 'room_state'; room: RoomInfo; messages: ChatMessage[]; activeCall: ActiveCallState | null }
  | { type: 'user_joined'; user: UserProfile }
  | { type: 'user_left'; userId: string }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'typing'; userId: string; userName: string; isTyping: boolean }
  | { type: 'call_initiate'; call: ActiveCallState }
  | { type: 'call_accept'; callId: string; userId: string; streamMode: 'webrtc' | 'legacy_relay' }
  | { type: 'call_reject'; callId: string; userId: string }
  | { type: 'call_end'; callId: string; userId: string }
  | { type: 'webrtc_offer'; callId: string; targetUserId?: string; senderId: string; sdp: any }
  | { type: 'webrtc_answer'; callId: string; targetUserId?: string; senderId: string; sdp: any }
  | { type: 'webrtc_ice'; callId: string; targetUserId?: string; senderId: string; candidate: any }
  | { type: 'relay_video_frame'; callId: string; senderId: string; frame: string; width: number; height: number }
  | { type: 'relay_audio_chunk'; callId: string; senderId: string; audioData: string }
  | { type: 'ping' }
  | { type: 'pong' };
