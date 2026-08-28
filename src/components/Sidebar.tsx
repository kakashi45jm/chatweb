import React, { useState } from 'react';
import { UserProfile, RoomInfo, StreamMode, DirectMessageThread } from '../types';
import { 
  Users, 
  MessageSquare, 
  Plus, 
  Settings, 
  Tablet, 
  Radio, 
  Sparkles, 
  Volume2, 
  Cpu, 
  LogOut,
  Hash,
  Shield,
  Circle,
  User,
  Lock,
  Search,
  Globe,
  Crown,
  ShieldCheck,
  Megaphone
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { UserBadges } from './UserBadges';
import { getSafeAudioContext, unlockAudio } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';

interface Props {
  currentUser: UserProfile;
  participants: UserProfile[];
  onlineUsers?: UserProfile[];
  currentRoomId: string;
  currentRoomName: string;
  activeDmPartnerId?: string | null;
  dmThreads?: DirectMessageThread[];
  onUpdateUserName: (name: string) => void;
  onUpdateAvatarColor: (color: string) => void;
  onSwitchRoom: (roomId: string) => void;
  onSelectDirectMessage: (partner: UserProfile) => void;
  onOpenMyProfile: () => void;
  onOpenUserProfile: (user: UserProfile) => void;
  onOpenDiagnostics: () => void;
  isLowMemoryMode: boolean;
  onToggleLowMemory: () => void;
  streamModePreference: StreamMode;
  isConnected: boolean;
  onLogout?: () => void;
  onAdminBroadcast?: (announcement: string) => void;
}

const PRESET_ROOMS = [
  { id: 'general', name: 'General Lobby' },
  { id: 'ipad-testing', name: 'iPad mini 2 Lab' },
  { id: 'video-lounge', name: 'Pink Void Lounge' },
];

export function Sidebar({
  currentUser,
  participants,
  onlineUsers = [],
  currentRoomId,
  currentRoomName,
  activeDmPartnerId,
  dmThreads = [],
  onUpdateUserName,
  onUpdateAvatarColor,
  onSwitchRoom,
  onSelectDirectMessage,
  onOpenMyProfile,
  onOpenUserProfile,
  onOpenDiagnostics,
  isLowMemoryMode,
  onToggleLowMemory,
  streamModePreference,
  isConnected,
  onLogout,
  onAdminBroadcast,
}: Props) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'direct_messages'>('rooms');
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminBroadcastPrompt, setShowAdminBroadcastPrompt] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');

  const handleJoinCustomRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customRoomInput.trim()) {
      const cleanId = customRoomInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      onSwitchRoom(cleanId);
      setCustomRoomInput('');
      setShowNewRoom(false);
    }
  };

  const handleAudioUnlock = () => {
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);
    soundEffects.playMessageSound(false);
  };

  const handleSendAdminBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    onAdminBroadcast?.(broadcastText.trim());
    setBroadcastText('');
    setShowAdminBroadcastPrompt(false);
  };

  // Combine participants and known online users for DM directory
  const allKnownUsersMap = new Map<string, UserProfile>();
  participants.forEach((u) => allKnownUsersMap.set(u.id, u));
  onlineUsers.forEach((u) => allKnownUsersMap.set(u.id, u));
  dmThreads.forEach((t) => allKnownUsersMap.set(t.partnerUser.id, t.partnerUser));
  allKnownUsersMap.delete(currentUser.id); // exclude self

  const peerList = Array.from(allKnownUsersMap.values()).filter(
    (u) =>
      !searchQuery.trim() ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.handle && u.handle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <aside id="app-sidebar" className="w-full sm:w-80 flex flex-col h-full bg-[#0c0e1a] text-slate-200 border-r border-pink-500/20">
      
      {/* Brand Header */}
      <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#101222]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-pink-600/30">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="font-black text-sm text-white tracking-wide flex items-center gap-1.5">
              <span>PINK VOID</span>
              <span className="text-[10px] text-pink-400 font-bold px-1.5 py-0.2 rounded-md bg-pink-950/60 border border-pink-500/30">LIVE</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{isConnected ? 'Signaling Connected' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="sidebar-diagnostics-btn"
            onClick={onOpenDiagnostics}
            title="Hardware & Codec Diagnostics"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition"
          >
            <Cpu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Profile Tile & Edit Profile Trigger */}
      <div className="p-3.5 border-b border-pink-500/20 bg-[#121528]/80">
        <div 
          onClick={onOpenMyProfile}
          className="flex items-center space-x-3 cursor-pointer group p-1.5 rounded-2xl hover:bg-white/5 transition"
          title="Click to edit profile personal info & custom title"
        >
          <div className="relative">
            <UserAvatar
              user={currentUser}
              showEmojiStatus={true}
              size="lg"
              shape="rounded-2xl"
              className="ring-2 ring-pink-500/30 group-hover:ring-pink-500 transition"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-white group-hover:text-pink-400 transition truncate flex items-center gap-1">
                <span>{currentUser.name}</span>
                <UserBadges user={currentUser} size="xs" showTitle={false} />
              </div>
              <span className="text-[10px] font-bold text-pink-400 bg-pink-950/60 px-1.5 py-0.5 rounded-md border border-pink-500/30 group-hover:bg-pink-900/60">
                Edit
              </span>
            </div>

            <div className="text-[11px] text-pink-200/80 truncate mt-0.5">
              {currentUser.customTitle || currentUser.statusMessage || currentUser.handle}
            </div>

            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              {currentUser.isAdmin ? (
                <>
                  <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-amber-300 font-bold">Admin</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                  <span>{currentUser.deviceType}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Admin Broadcast Quick Action */}
        {currentUser.isAdmin && (
          <div className="mt-2 pt-2 border-t border-pink-500/20 flex items-center justify-between">
            <span className="text-[10px] font-bold text-pink-400 flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-400" /> Admin Controls
            </span>
            <button
              id="admin-broadcast-toggle-btn"
              type="button"
              onClick={() => setShowAdminBroadcastPrompt(!showAdminBroadcastPrompt)}
              className="px-2 py-0.5 rounded-md bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1 transition"
            >
              <Megaphone className="w-3 h-3" />
              <span>Announce</span>
            </button>
          </div>
        )}

        {showAdminBroadcastPrompt && (
          <form onSubmit={handleSendAdminBroadcast} className="mt-2 space-y-1.5 p-2 bg-black/50 rounded-xl border border-pink-500/30 animate-in fade-in duration-100">
            <span className="text-[10px] font-bold text-slate-300 block">Broadcast Announcement:</span>
            <input
              type="text"
              required
              placeholder="Type system alert..."
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 outline-hidden"
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAdminBroadcastPrompt(false)}
                className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-0.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold"
              >
                Broadcast
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Mode Navigation Tabs (Rooms vs 1v1 Direct Messages) */}
      <div className="px-3 pt-3 pb-1">
        <div className="grid grid-cols-2 p-1 bg-black/50 rounded-2xl border border-pink-500/20 text-xs font-bold">
          <button
            id="tab-rooms-btn"
            onClick={() => setActiveTab('rooms')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'rooms'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Rooms</span>
          </button>

          <button
            id="tab-direct-messages-btn"
            onClick={() => setActiveTab('direct_messages')}
            className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'direct_messages'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>1v1 Direct</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        
        {activeTab === 'rooms' ? (
          /* ROOMS & PARTICIPANTS TAB */
          <>
            {/* Rooms Section */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                <span>Channels & Rooms</span>
                <button
                  id="new-room-toggle-btn"
                  onClick={() => setShowNewRoom(!showNewRoom)}
                  className="text-pink-400 hover:text-pink-300 p-0.5 rounded"
                  title="Create or Join Custom Room"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showNewRoom && (
                <form onSubmit={handleJoinCustomRoom} className="mb-2 flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="room-name"
                    value={customRoomInput}
                    onChange={(e) => setCustomRoomInput(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-black/40 border border-slate-700 rounded-lg text-white placeholder-slate-500 outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-xs font-bold rounded-lg text-white"
                  >
                    Join
                  </button>
                </form>
              )}

              <div className="space-y-1">
                {PRESET_ROOMS.map((room) => {
                  const isActive = !activeDmPartnerId && currentRoomId === room.id;
                  return (
                    <button
                      key={room.id}
                      id={`room-btn-${room.id}`}
                      onClick={() => onSwitchRoom(room.id)}
                      className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold shadow-md shadow-pink-600/30'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5 text-pink-400" />
                      <span className="truncate">{room.name}</span>
                    </button>
                  );
                })}

                {!PRESET_ROOMS.some((r) => r.id === currentRoomId) && !activeDmPartnerId && (
                  <button
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md"
                  >
                    <Hash className="w-3.5 h-3.5 text-white" />
                    <span className="truncate">{currentRoomName}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Room Participants Section */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                <span>Room Members ({participants.length})</span>
              </div>

              <div className="space-y-1.5">
                {participants.map((user) => {
                  const isMe = user.id === currentUser.id;
                  return (
                    <div
                      key={user.id}
                      onClick={() => {
                        if (isMe) onOpenMyProfile();
                        else onOpenUserProfile(user);
                      }}
                      className="flex items-center justify-between p-2 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 cursor-pointer transition group"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <UserAvatar
                          user={user}
                          showOnlineDot={true}
                          isOnline={true}
                          size="sm"
                          shape="rounded-lg"
                        />

                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate flex items-center gap-1">
                            <span>{user.name}</span>
                            <UserBadges user={user} size="xs" showTitle={false} />
                            {user.customStatusEmoji && <span className="text-[10px]">{user.customStatusEmoji}</span>}
                            {isMe && <span className="text-[10px] text-pink-400 font-bold">(You)</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {user.customTitle || user.statusMessage || user.deviceType}
                          </div>
                        </div>
                      </div>

                      {!isMe && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDirectMessage(user);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-pink-400 hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition"
                          title="1v1 Private Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* 1V1 DIRECT MESSAGES TAB */
          <div className="space-y-4">
            
            {/* Search peers */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search users for 1v1..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-hidden focus:border-pink-500"
              />
            </div>

            {/* Direct Message List */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1 flex items-center justify-between">
                <span>Direct Conversations</span>
                <span className="text-xs text-pink-400">{peerList.length} Available</span>
              </div>

              {peerList.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  <User className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <span>No other users online right now. Invite a friend using room link!</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {peerList.map((user) => {
                    const isSelected = activeDmPartnerId === user.id;
                    return (
                      <button
                        key={user.id}
                        onClick={() => onSelectDirectMessage(user)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition ${
                          isSelected
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold shadow-md shadow-pink-600/30'
                            : 'bg-black/40 hover:bg-white/5 text-slate-200 border border-white/5'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <UserAvatar
                            user={user}
                            showEmojiStatus={true}
                            size="md"
                            shape="rounded-xl"
                          />

                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate flex items-center gap-1">
                              <span>{user.name}</span>
                              <UserBadges user={user} size="xs" showTitle={false} />
                            </div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-pink-100' : 'text-slate-400'}`}>
                              {user.customTitle || user.statusMessage || user.handle || 'Tap to chat 1v1'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <MessageSquare className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* iPad mini 2 / iOS 9 Optimization & Audio Bar */}
      <div className="p-3 border-t border-pink-500/20 bg-[#101222] space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-pink-400" /> iPad RAM Saver
          </span>
          <button
            id="sidebar-toggle-low-memory-btn"
            onClick={onToggleLowMemory}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              isLowMemoryMode
                ? 'bg-pink-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isLowMemoryMode ? 'Active (240p)' : 'Off (HD)'}
          </button>
        </div>

        <button
          id="unlock-audio-sidebar-btn"
          onClick={handleAudioUnlock}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-black/40 hover:bg-pink-950/40 text-slate-300 text-[11px] font-medium transition active:scale-95 border border-white/5"
        >
          <Volume2 className="w-3.5 h-3.5 text-pink-400" />
          <span>Enable iOS Audio Engine</span>
        </button>

        {onLogout && (
          <div className="pt-1 flex justify-center">
            <button
              id="sidebar-logout-btn"
              type="button"
              onClick={onLogout}
              className="text-[10px] text-slate-400 hover:text-pink-400 flex items-center gap-1 transition"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>
        )}
      </div>

    </aside>
  );
}
