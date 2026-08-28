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
  Globe
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
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
}

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const PRESET_ROOMS = [
  { id: 'general', name: 'General Lobby' },
  { id: 'ipad-testing', name: 'iPad mini 2 Lab' },
  { id: 'video-lounge', name: 'Video Lounge' },
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
}: Props) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'direct_messages'>('rooms');
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Combine participants and known online users for DM directory
  const allKnownUsersMap = new Map<string, UserProfile>();
  participants.forEach(u => allKnownUsersMap.set(u.id, u));
  onlineUsers.forEach(u => allKnownUsersMap.set(u.id, u));
  dmThreads.forEach(t => allKnownUsersMap.set(t.partnerUser.id, t.partnerUser));
  allKnownUsersMap.delete(currentUser.id); // exclude self

  const peerList = Array.from(allKnownUsersMap.values()).filter(u => 
    !searchQuery.trim() || 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.handle && u.handle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <aside id="app-sidebar" className="w-full sm:w-80 flex flex-col h-full bg-slate-900 text-slate-200 border-r border-slate-800">
      
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
              LiveCall Web
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{isConnected ? 'Signaling Online' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="sidebar-diagnostics-btn"
            onClick={onOpenDiagnostics}
            title="Hardware Diagnostics"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <Cpu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Profile Tile & Edit Profile Trigger */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/60">
        <div 
          onClick={onOpenMyProfile}
          className="flex items-center space-x-3 cursor-pointer group p-1.5 rounded-2xl hover:bg-slate-800/60 transition"
          title="Click to edit profile & AI settings"
        >
          <div className="relative">
            <UserAvatar
              user={currentUser}
              showEmojiStatus={true}
              size="lg"
              shape="rounded-2xl"
              className="ring-2 ring-white/10 group-hover:ring-blue-500 transition"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-white group-hover:text-blue-400 transition truncate">
                {currentUser.name}
              </div>
              <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20 group-hover:bg-blue-500/20">
                Edit
              </span>
            </div>

            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              {currentUser.statusMessage || currentUser.handle || currentUser.deviceType}
            </div>

            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Globe className="w-3 h-3 text-indigo-400" />
              <span>AI: {currentUser.preferredLanguage || 'English'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs (Rooms vs 1v1 Direct Messages) */}
      <div className="px-3 pt-3 pb-1">
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80 text-xs font-bold">
          <button
            id="tab-rooms-btn"
            onClick={() => setActiveTab('rooms')}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'rooms'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Rooms</span>
          </button>

          <button
            id="tab-direct-messages-btn"
            onClick={() => setActiveTab('direct_messages')}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'direct_messages'
                ? 'bg-blue-600 text-white shadow-xs'
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
                  className="text-blue-400 hover:text-blue-300 p-0.5 rounded"
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
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold rounded-lg text-white"
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
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{room.name}</span>
                    </button>
                  );
                })}

                {!PRESET_ROOMS.some((r) => r.id === currentRoomId) && !activeDmPartnerId && (
                  <button
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white"
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
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 cursor-pointer transition group"
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
                            {user.customStatusEmoji && <span className="text-[10px]">{user.customStatusEmoji}</span>}
                            {isMe && <span className="text-[10px] text-blue-400 font-bold">(You)</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {user.statusMessage || user.deviceType}
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
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition"
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
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Direct Message List */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1 flex items-center justify-between">
                <span>Direct Conversations</span>
                <span className="text-xs text-blue-400">{peerList.length} Available</span>
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
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'bg-slate-800/40 hover:bg-slate-800 text-slate-200 border border-slate-800/80'
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
                            </div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {user.statusMessage || user.handle || 'Tap to chat 1v1'}
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
      <div className="p-3 border-t border-slate-800 bg-slate-950/70 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> iPad RAM Saver
          </span>
          <button
            id="sidebar-toggle-low-memory-btn"
            onClick={onToggleLowMemory}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
              isLowMemoryMode
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isLowMemoryMode ? 'Active (240p)' : 'Off (HD)'}
          </button>
        </div>

        <button
          id="unlock-audio-sidebar-btn"
          onClick={handleAudioUnlock}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition active:scale-95"
        >
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Tap to Enable iOS Audio</span>
        </button>

        {onLogout && (
          <div className="pt-1 flex justify-center">
            <button
              id="sidebar-logout-btn"
              type="button"
              onClick={onLogout}
              className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out / Switch Profile</span>
            </button>
          </div>
        )}
      </div>

    </aside>
  );
}
