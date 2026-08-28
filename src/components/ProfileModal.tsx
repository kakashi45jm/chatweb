import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { UserAvatar } from './UserAvatar';
import { UserBadges } from './UserBadges';
import { COVER_PRESETS, AVATAR_PRESETS, MediaPreset } from '../utils/profileMediaPresets';
import { 
  X, 
  User, 
  MessageSquare, 
  Phone, 
  Video, 
  Copy, 
  Check, 
  Sparkles, 
  AtSign, 
  Save,
  Camera,
  Film,
  Upload,
  Image as ImageIcon,
  Tag,
  Palette
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetUser?: UserProfile | null;
  onSaveProfile?: (updated: UserProfile) => void;
  onStartDirectMessage?: (target: UserProfile) => void;
  onStart1v1Call?: (target: UserProfile, type: 'audio' | 'video') => void;
}

const EMOJI_STATUS_PRESETS = ['🟢', '🎧', '📱', '☕', '🚀', '✨', '🔥', '👑', '⚡'];

const AVATAR_COLORS = [
  '#ec4899', // pink void
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
];

type MediaTarget = 'cover' | 'avatar';

export function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  onSaveProfile,
  onStartDirectMessage,
  onStart1v1Call,
}: Props) {
  const isViewingOther = !!targetUser && targetUser.id !== currentUser.id;
  const activeUser = isViewingOther ? targetUser! : currentUser;

  // Form states for personal info
  const [name, setName] = useState(currentUser.name);
  const [handle, setHandle] = useState(currentUser.handle || `@${currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  const [customTitle, setCustomTitle] = useState(currentUser.customTitle || (currentUser.isAdmin ? 'Founder & Administrator' : (currentUser.isVip ? '⭐ VIP Member' : '')));
  const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || 'Available on LiveCall');
  const [statusEmoji, setStatusEmoji] = useState(currentUser.customStatusEmoji || '🟢');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarColor, setAvatarColor] = useState(currentUser.avatarColor);

  // Custom Media states (Cover & Avatar: Photo / Video)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(currentUser.coverUrl);
  const [coverMediaType, setCoverMediaType] = useState<'image' | 'video'>(currentUser.coverMediaType || 'image');
  
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);
  const [avatarMediaType, setAvatarMediaType] = useState<'image' | 'video'>(currentUser.avatarMediaType || 'image');

  // Media Picker Dialog state
  const [mediaPickerTarget, setMediaPickerTarget] = useState<MediaTarget | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customUrlType, setCustomUrlType] = useState<'image' | 'video'>('image');

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(activeUser.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMediaPicker = (target: MediaTarget) => {
    setMediaPickerTarget(target);
    setCustomUrlInput('');
    setCustomUrlType('image');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      if (mediaPickerTarget === 'cover') {
        setCoverUrl(result);
        setCoverMediaType(isVideo ? 'video' : 'image');
      } else if (mediaPickerTarget === 'avatar') {
        setAvatarUrl(result);
        setAvatarMediaType(isVideo ? 'video' : 'image');
      }
      setMediaPickerTarget(null);
    };

    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectPreset = (preset: MediaPreset) => {
    if (mediaPickerTarget === 'cover') {
      setCoverUrl(preset.url);
      setCoverMediaType(preset.type);
    } else if (mediaPickerTarget === 'avatar') {
      setAvatarUrl(preset.url);
      setAvatarMediaType(preset.type);
    }
    setMediaPickerTarget(null);
  };

  const handleApplyCustomUrl = () => {
    if (!customUrlInput.trim()) return;
    const url = customUrlInput.trim();
    const isVideo = customUrlType === 'video' || url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) !== null;

    if (mediaPickerTarget === 'cover') {
      setCoverUrl(url);
      setCoverMediaType(isVideo ? 'video' : 'image');
    } else if (mediaPickerTarget === 'avatar') {
      setAvatarUrl(url);
      setAvatarMediaType(isVideo ? 'video' : 'image');
    }
    setMediaPickerTarget(null);
  };

  const handleClearMedia = (target: MediaTarget) => {
    if (target === 'cover') {
      setCoverUrl(undefined);
      setCoverMediaType('image');
    } else if (target === 'avatar') {
      setAvatarUrl(undefined);
      setAvatarMediaType('image');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updatedProfile: UserProfile = {
      ...currentUser,
      name: name.trim(),
      handle: handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`,
      customTitle: customTitle.trim() || undefined,
      statusMessage: statusMessage.trim(),
      customStatusEmoji: statusEmoji,
      bio: bio.trim(),
      avatarColor,
      avatarUrl,
      avatarMediaType,
      coverUrl,
      coverMediaType,
    };

    if (onSaveProfile) {
      onSaveProfile(updatedProfile);
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 400);
  };

  const currentCover = isViewingOther ? activeUser.coverUrl : coverUrl;
  const currentCoverType = isViewingOther ? (activeUser.coverMediaType || 'image') : coverMediaType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="bg-[#11131f] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-pink-500/20 text-slate-100 flex flex-col max-h-[90vh] relative my-auto">
        
        {/* Clean, High-Clarity Cover Banner (Unobstructed) */}
        <div className="relative w-full h-44 sm:h-52 bg-slate-950 overflow-hidden shrink-0">
          
          {/* Media: Video, Image, or Default Pink Void Gradient */}
          {currentCover ? (
            currentCoverType === 'video' ? (
              <video
                src={currentCover}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={currentCover}
                alt="Profile Cover"
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-pink-600 via-purple-700 to-indigo-800 opacity-90 relative">
              <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
            </div>
          )}

          {/* Close Button Top-Right (Minimalist) */}
          <button
            id="close-profile-modal-btn"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition active:scale-95 border border-white/20 z-20"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Bottom Right Controls (Only on Edit Mode) */}
          {!isViewingOther && (
            <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 z-20">
              <button
                id="edit-cover-photo-btn"
                type="button"
                onClick={() => handleOpenMediaPicker('cover')}
                className="px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-pink-600 backdrop-blur-md text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/20 active:scale-95 shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                <span>Change Cover</span>
              </button>

              {coverUrl && (
                <button
                  type="button"
                  onClick={() => handleClearMedia('cover')}
                  className="px-2 py-1.5 rounded-xl bg-black/60 hover:bg-red-600 backdrop-blur-md text-white text-xs font-medium transition border border-white/10"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* Profile Header Info (Neatly Positioned Under Cover) */}
        <div className="px-5 sm:px-6 pt-3 pb-3 border-b border-white/10 bg-[#11131f] relative z-10 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="ring-2 ring-pink-500/40 rounded-2xl overflow-hidden shadow-lg bg-slate-900">
                <UserAvatar
                  user={activeUser}
                  name={isViewingOther ? activeUser.name : name}
                  avatarColor={isViewingOther ? activeUser.avatarColor : avatarColor}
                  avatarUrl={isViewingOther ? activeUser.avatarUrl : avatarUrl}
                  avatarMediaType={isViewingOther ? activeUser.avatarMediaType : avatarMediaType}
                  size="lg"
                  shape="rounded-2xl"
                />
              </div>

              {/* Edit Avatar Button */}
              {!isViewingOther && (
                <button
                  id="edit-avatar-media-btn"
                  type="button"
                  onClick={() => handleOpenMediaPicker('avatar')}
                  title="Change avatar picture"
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white shadow-md border border-slate-900 transition active:scale-95 flex items-center justify-center"
                >
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Display Name & Badges */}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white leading-tight truncate">
                  {isViewingOther ? activeUser.name : name}
                </h2>
                <UserBadges user={activeUser} customTitle={!isViewingOther ? customTitle : undefined} size="sm" />
              </div>

              <div className="flex items-center gap-2 text-xs text-pink-300/80 font-mono truncate">
                <span>{isViewingOther ? (activeUser.handle || `@${activeUser.name}`) : handle}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-sans truncate">
                  {isViewingOther ? (activeUser.statusMessage || 'Available') : statusMessage}
                </span>
              </div>
            </div>
          </div>

          {/* Quick 1v1 Actions if viewing another user */}
          {isViewingOther && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                id="profile-start-dm-btn"
                onClick={() => {
                  onClose();
                  onStartDirectMessage?.(activeUser);
                }}
                className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-600/30 transition active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Message</span>
              </button>

              <button
                id="profile-start-audio-btn"
                onClick={() => {
                  onClose();
                  onStart1v1Call?.(activeUser, 'audio');
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
                title="Call Audio"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                id="profile-start-video-btn"
                onClick={() => {
                  onClose();
                  onStart1v1Call?.(activeUser, 'video');
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
                title="Call Video"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Clean Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {isViewingOther ? (
            /* Read-only view for another user */
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">About</span>
                <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {activeUser.bio || 'No bio written yet.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs">
                  <span className="text-slate-400 block text-[10px]">User ID</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono text-slate-300 truncate text-[11px]">{activeUser.id}</span>
                    <button onClick={handleCopyId} className="text-pink-400 hover:text-pink-300 ml-1">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs">
                  <span className="text-slate-400 block text-[10px]">Member Since</span>
                  <span className="text-slate-300 font-medium">
                    {new Date(activeUser.joinedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Clean Edit Form */
            <form onSubmit={handleSave} className="space-y-4">
              
              {/* Display Name & Handle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                    <input
                      id="edit-profile-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Handle / Username
                  </label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                    <input
                      id="edit-profile-handle"
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition font-mono"
                      placeholder="@username"
                    />
                  </div>
                </div>
              </div>

              {/* Status Message & Emoji */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Status Message
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={2}
                    value={statusEmoji}
                    onChange={(e) => setStatusEmoji(e.target.value)}
                    className="w-10 text-center py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-sm outline-hidden"
                    title="Status Emoji"
                  />
                  <input
                    id="edit-profile-status-message"
                    type="text"
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    placeholder="What are you up to?"
                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                  />
                </div>
              </div>

              {/* Custom Title / Status Tag */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-pink-400" />
                  <span>Custom Title / Tag</span>
                </label>
                <input
                  id="edit-profile-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Founder & Administrator, VIP Member"
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                />
              </div>

              {/* Bio */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Bio
                </label>
                <textarea
                  id="edit-profile-bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short bio..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition resize-none"
                />
              </div>

              {/* Avatar Color Theme */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Fallback Avatar Color</span>
                </label>
                <div className="flex items-center gap-2">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAvatarColor(col)}
                      className={`w-6 h-6 rounded-full transition-transform active:scale-95 ${
                        avatarColor === col
                          ? 'scale-110 ring-2 ring-pink-400 ring-offset-2 ring-offset-slate-900'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  id="save-profile-btn"
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/30 transition active:scale-98"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Changes Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

      </div>

      {/* Media Picker Submodal for Cover / Avatar */}
      {mediaPickerTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#11131f] border border-pink-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4 text-slate-100">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                {mediaPickerTarget === 'cover' ? (
                  <Camera className="w-5 h-5 text-pink-400" />
                ) : (
                  <Sparkles className="w-5 h-5 text-purple-400" />
                )}
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Choose {mediaPickerTarget === 'cover' ? 'Cover Banner' : 'Profile Picture'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMediaPickerTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Upload from Device */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">Upload Image or Video</span>
                <span className="text-[11px] text-slate-400">JPG, PNG, GIF, MP4, WEBM</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-pink-600/30"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Browse Files</span>
              </button>
            </div>

            {/* Preset Gallery */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400">Select Preset:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {(mediaPickerTarget === 'cover' ? COVER_PRESETS : AVATAR_PRESETS).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="relative aspect-16/9 rounded-xl overflow-hidden border border-slate-700 hover:border-pink-400 group transition text-left"
                  >
                    {preset.type === 'video' ? (
                      <video
                        src={preset.url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                      <span className="text-[10px] font-bold text-white truncate flex items-center gap-1">
                        {preset.type === 'video' && <Film className="w-2.5 h-2.5 text-pink-400" />}
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL Input */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-slate-400">Or Direct Image / Video URL:</span>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/media.mp4"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/10 focus:border-pink-500 rounded-xl text-xs text-white placeholder-slate-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  disabled={!customUrlInput.trim()}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold transition"
                >
                  Apply
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
