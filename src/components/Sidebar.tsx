import React, { useState } from 'react';
import { UserProfile, RoomInfo, StreamMode } from '../types';
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
  Circle
} from 'lucide-react';
import { getSafeAudioContext, unlockAudio } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';

interface Props {
  currentUser: UserProfile;
  participants: UserProfile[];
  currentRoomId: string;
  currentRoomName: string;
  onUpdateUserName: (name: string) => void;
  onUpdateAvatarColor: (color: string) => void;
  onSwitchRoom: (roomId: string) => void;
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
  currentRoomId,
  currentRoomName,
  onUpdateUserName,
  onUpdateAvatarColor,
  onSwitchRoom,
  onOpenDiagnostics,
  isLowMemoryMode,
  onToggleLowMemory,
  streamModePreference,
  isConnected,
  onLogout,
}: Props) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentUser.name);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [showNewRoom, setShowNewRoom] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
      setIsEditingName(false);
    }
  };

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

        <button
          id="sidebar-diagnostics-btn"
          onClick={onOpenDiagnostics}
          title="Hardware Diagnostics"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <Cpu className="w-4 h-4" />
        </button>
      </div>

      {/* User Profile Tile */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md shrink-0 ring-2 ring-white/10"
            style={{ backgroundColor: currentUser.avatarColor }}
          >
            {currentUser.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-md text-white"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-blue-600 text-[10px] font-bold rounded-md text-white"
                >
                  Save
                </button>
              </form>
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="cursor-pointer group flex items-center justify-between"
              >
                <div className="font-semibold text-xs text-white group-hover:text-blue-400 transition truncate">
                  {currentUser.name}
                </div>
                <span className="text-[10px] text-slate-500 group-hover:text-slate-400">Edit</span>
              </div>
            )}

            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Tablet className="w-3 h-3 text-slate-500" />
              <span className="truncate">{currentUser.deviceType}</span>
            </div>
          </div>
        </div>

        {/* Color Palette Picker & Logout */}
        <div className="flex items-center justify-between gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 mr-0.5">Theme:</span>
            {AVATAR_COLORS.map((col) => (
              <button
                key={col}
                onClick={() => onUpdateAvatarColor(col)}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${
                  currentUser.avatarColor === col ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>

          {onLogout && (
            <button
              id="sidebar-logout-btn"
              type="button"
              onClick={onLogout}
              className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800/80 transition"
              title="Sign Out / Switch Account"
            >
              <LogOut className="w-3 h-3" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Rooms / Channels */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            <span>Rooms & Channels</span>
            <button
              id="new-room-toggle-btn"
              onClick={() => setShowNewRoom(!showNewRoom)}
              className="text-blue-400 hover:text-blue-300 p-0.5 rounded"
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
              const isActive = currentRoomId === room.id;
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

            {!PRESET_ROOMS.some((r) => r.id === currentRoomId) && (
              <button
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white"
              >
                <Hash className="w-3.5 h-3.5 text-white" />
                <span className="truncate">{currentRoomName}</span>
              </button>
            )}
          </div>
        </div>

        {/* Room Participants */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            <span>Online In Room ({participants.length})</span>
          </div>

          <div className="space-y-1.5">
            {participants.map((user) => {
              const isMe = user.id === currentUser.id;
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-800"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="relative">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: user.avatarColor }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate flex items-center gap-1">
                        <span>{user.name}</span>
                        {isMe && <span className="text-[10px] text-blue-400 font-bold">(You)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {user.deviceType}
                      </div>
                    </div>
                  </div>

                  {user.isIosLegacy && (
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      iOS 9
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* iPad mini 2 / iOS 9 Optimization Bar */}
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
      </div>

    </aside>
  );
}
