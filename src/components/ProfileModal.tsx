import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { UserAvatar } from './UserAvatar';
import { COVER_PRESETS, AVATAR_PRESETS, MediaPreset } from '../utils/profileMediaPresets';
import { 
  X, 
  User, 
  Smile, 
  Globe, 
  Tablet, 
  MessageSquare, 
  Phone, 
  Video, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  AtSign, 
  Save,
  Camera,
  Film,
  Upload,
  Image as ImageIcon,
  Link,
  Trash2,
  Play,
  RotateCcw,
  Palette
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetUser?: UserProfile | null; // If provided, viewing other user; if null/undefined, editing my profile
  onSaveProfile?: (updated: UserProfile) => void;
  onStartDirectMessage?: (target: UserProfile) => void;
  onStart1v1Call?: (target: UserProfile, type: 'audio' | 'video') => void;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'English', label: 'English (US/UK)' },
  { code: 'Tagalog', label: 'Tagalog / Filipino' },
  { code: 'Spanish', label: 'Spanish (Español)' },
  { code: 'Japanese', label: 'Japanese (日本語)' },
  { code: 'Korean', label: 'Korean (한국어)' },
  { code: 'French', label: 'French (Français)' },
  { code: 'German', label: 'German (Deutsch)' },
  { code: 'Chinese (Simplified)', label: 'Chinese (简体中文)' },
  { code: 'Arabic', label: 'Arabic (العربية)' },
  { code: 'Portuguese', label: 'Portuguese (Português)' },
  { code: 'Russian', label: 'Russian (Русский)' },
  { code: 'Indonesian', label: 'Indonesian (Bahasa)' },
  { code: 'Vietnamese', label: 'Vietnamese (Tiếng Việt)' },
];

const EMOJI_STATUS_PRESETS = ['🟢', '🎧', '📱', '☕', '🚀', '✨', '🔥', '💻', '🏝️', '⚡'];

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
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

  // Form states for editing
  const [name, setName] = useState(currentUser.name);
  const [handle, setHandle] = useState(currentUser.handle || `@${currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || 'Available on LiveCall');
  const [statusEmoji, setStatusEmoji] = useState(currentUser.customStatusEmoji || '🟢');
  const [bio, setBio] = useState(currentUser.bio || 'Real-time calling and messaging enthusiast.');
  const [avatarColor, setAvatarColor] = useState(currentUser.avatarColor);
  const [preferredLanguage, setPreferredLanguage] = useState(currentUser.preferredLanguage || 'English');
  const [autoTranslate, setAutoTranslate] = useState(currentUser.autoTranslate ?? true);

  // Custom Media states (Cover & Avatar: Photo / Video)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(currentUser.coverUrl);
  const [coverMediaType, setCoverMediaType] = useState<'image' | 'video'>(currentUser.coverMediaType || 'image');
  
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);
  const [avatarMediaType, setAvatarMediaType] = useState<'image' | 'video'>(currentUser.avatarMediaType || 'image');

  // Media Picker Submodal / Dialog state
  const [mediaPickerTarget, setMediaPickerTarget] = useState<MediaTarget | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customUrlType, setCustomUrlType] = useState<'image' | 'video'>('image');

  // Active Tab in Edit Mode
  const [activeEditTab, setActiveEditTab] = useState<'media' | 'info' | 'language'>('media');

  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(activeUser.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open Media Picker for Cover or Avatar
  const handleOpenMediaPicker = (target: MediaTarget) => {
    setMediaPickerTarget(target);
    setCustomUrlInput('');
    setCustomUrlType('image');
  };

  // Handle local file upload (Image or Video)
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
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Select Preset
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

  // Apply custom URL
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

  // Clear Cover or Avatar Media
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
      statusMessage: statusMessage.trim(),
      customStatusEmoji: statusEmoji,
      bio: bio.trim(),
      avatarColor,
      avatarUrl,
      avatarMediaType,
      coverUrl,
      coverMediaType,
      preferredLanguage,
      autoTranslate,
    };

    if (onSaveProfile) {
      onSaveProfile(updatedProfile);
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const currentCover = isViewingOther ? activeUser.coverUrl : coverUrl;
  const currentCoverType = isViewingOther ? (activeUser.coverMediaType || 'image') : coverMediaType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      
      {/* Hidden File Input for Image/Video uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] relative my-auto">
        
        {/* 16:9 Aspect Ratio Widescreen Cover Banner */}
        <div 
          className="relative w-full aspect-video sm:max-h-64 bg-slate-900 overflow-hidden flex flex-col justify-between p-3 sm:p-4 transition-all"
        >
          {/* Cover Media: Video OR Image OR Gradient Pattern */}
          {currentCover ? (
            currentCoverType === 'video' ? (
              <video
                src={currentCover}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <img
                src={currentCover}
                alt="Profile Cover"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )
          ) : (
            <div 
              className="absolute inset-0 w-full h-full opacity-90 transition-all"
              style={{ 
                background: `linear-gradient(135deg, ${isViewingOther ? activeUser.avatarColor : avatarColor}, #0f172a, #1e1b4b)` 
              }}
            >
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>
          )}

          {/* Dark scrim overlay gradient at top and bottom for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />

          {/* Top Bar on Cover */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-xs font-semibold border border-white/20 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>16:9 Widescreen Cover</span>
              </span>

              {currentCover && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-medium border border-white/20">
                  {currentCoverType === 'video' ? <Film className="w-3 h-3 text-cyan-300" /> : <ImageIcon className="w-3 h-3 text-emerald-300" />}
                  <span>{currentCoverType === 'video' ? 'Cover Video Loop' : 'Cover Photo'}</span>
                </span>
              )}
            </div>

            <button
              id="close-profile-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition active:scale-95 border border-white/20"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Controls on Cover (When editing my profile) */}
          {!isViewingOther && (
            <div className="relative z-10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleOpenMediaPicker('cover')}
                className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/30 transition shadow-lg"
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                <span>{coverUrl ? 'Change Cover (Photo/Video)' : 'Add 16:9 Cover Photo/Video'}</span>
              </button>

              {coverUrl && (
                <button
                  type="button"
                  onClick={() => handleClearMedia('cover')}
                  className="p-1.5 rounded-xl bg-red-600/80 hover:bg-red-700 active:scale-95 text-white text-xs font-bold backdrop-blur-md border border-red-400/30 transition shadow-lg"
                  title="Remove custom cover (revert to color gradient)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Profile Picture / Avatar & Primary Header Row */}
        <div className="px-5 sm:px-6 pt-0 pb-4 relative border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-3">
            
            {/* Avatar with Photo / Video support and Edit badge */}
            <div className="relative group">
              <div className="rounded-3xl p-1 bg-white shadow-xl">
                <UserAvatar
                  user={activeUser}
                  avatarColor={isViewingOther ? activeUser.avatarColor : avatarColor}
                  avatarUrl={isViewingOther ? activeUser.avatarUrl : avatarUrl}
                  avatarMediaType={isViewingOther ? activeUser.avatarMediaType : avatarMediaType}
                  customStatusEmoji={isViewingOther ? activeUser.customStatusEmoji : statusEmoji}
                  showEmojiStatus={true}
                  size="hero"
                  shape="rounded-2xl"
                  className="ring-2 ring-slate-100"
                />
              </div>

              {/* Edit Avatar Overlay Button (When editing own profile) */}
              {!isViewingOther && (
                <button
                  type="button"
                  onClick={() => handleOpenMediaPicker('avatar')}
                  className="absolute inset-0 m-1 rounded-2xl bg-black/60 hover:bg-black/75 text-white opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[11px] font-bold backdrop-blur-xs cursor-pointer shadow-lg"
                  title="Change Profile Picture or Video"
                >
                  <Camera className="w-5 h-5 text-cyan-300" />
                  <span>Change Avatar</span>
                </button>
              )}

              {/* Avatar Type Badge */}
              {(isViewingOther ? activeUser.avatarUrl : avatarUrl) && (
                <div className="absolute -top-2 -left-2 px-1.5 py-0.5 rounded-md bg-slate-900/90 text-white text-[9px] font-mono font-bold border border-white/20 shadow-xs flex items-center gap-1">
                  {(isViewingOther ? activeUser.avatarMediaType : avatarMediaType) === 'video' ? (
                    <>
                      <Film className="w-2.5 h-2.5 text-cyan-400" />
                      <span>Video Avatar</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Photo Avatar</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions (Copy ID & Edit Media Shortcut) */}
            <div className="flex items-center gap-2">
              {!isViewingOther && avatarUrl && (
                <button
                  type="button"
                  onClick={() => handleClearMedia('avatar')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-semibold flex items-center gap-1 transition"
                  title="Reset to default initial avatar"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset Avatar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyId}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                title="Copy User ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Copied ID' : 'Copy ID'}</span>
              </button>
            </div>
          </div>

          {/* User Name, Handle, Device & Badges */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>{activeUser.name}</span>
              {activeUser.isIosLegacy && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  iOS 9.3.5
                </span>
              )}
            </h2>
            <p className="text-xs font-mono text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{activeUser.handle || `@${activeUser.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 flex items-center gap-1 font-sans">
                <Tablet className="w-3.5 h-3.5 text-blue-500" />
                {activeUser.deviceType}
              </span>
            </p>
          </div>
        </div>

        {/* Edit Tabs (Media & Appearance / Profile Info / AI Translation) */}
        {!isViewingOther && (
          <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-xs font-bold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveEditTab('media')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeEditTab === 'media'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Cover & Profile Media</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditTab('info')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeEditTab === 'info'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Personal Info</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveEditTab('language')}
              className={`pb-2.5 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeEditTab === 'language'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>AI Translation</span>
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {isViewingOther ? (
            /* VIEWING OTHER USER PROFILE */
            <div className="space-y-5">
              {/* Status & Bio */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</div>
                <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                  <span className="text-lg">{activeUser.customStatusEmoji || '🟢'}</span>
                  <span>{activeUser.statusMessage || 'Available'}</span>
                </div>
                {activeUser.bio && (
                  <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600 leading-relaxed">
                    {activeUser.bio}
                  </div>
                )}
              </div>

              {/* Language & Capabilities */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1">
                  <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> Preferred Language
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {activeUser.preferredLanguage || 'English'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
                  <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Hardware Mode
                  </div>
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {activeUser.isIosLegacy ? 'Legacy Relay Safe' : 'Full WebRTC HD'}
                  </div>
                </div>
              </div>

              {/* Direct Communication Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  id="profile-start-dm-btn"
                  onClick={() => {
                    if (onStartDirectMessage) onStartDirectMessage(activeUser);
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send 1v1 Private Message</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="profile-start-audio-btn"
                    onClick={() => {
                      if (onStart1v1Call) onStart1v1Call(activeUser, 'audio');
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Audio Call</span>
                  </button>

                  <button
                    id="profile-start-video-btn"
                    onClick={() => {
                      if (onStart1v1Call) onStart1v1Call(activeUser, 'video');
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 transition"
                  >
                    <Video className="w-3.5 h-3.5 text-blue-600" />
                    <span>Video Call</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* EDITING MY OWN PROFILE FORM */
            <form onSubmit={handleSave} className="space-y-5">
              
              {/* TAB 1: MEDIA & APPEARANCE (Cover Photo/Video & Profile Picture/Video) */}
              {activeEditTab === 'media' && (
                <div className="space-y-5">
                  
                  {/* Cover Photo / Video Section */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5 text-blue-600" />
                          <span>16:9 Cover Photo or Video</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Upload high-resolution 16:9 images or short looping MP4/WebM video backgrounds.
                        </p>
                      </div>

                      {coverUrl && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                          {coverMediaType === 'video' ? 'Video Active' : 'Photo Active'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenMediaPicker('cover')}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{coverUrl ? 'Change Cover Media' : 'Choose 16:9 Cover'}</span>
                      </button>

                      {coverUrl && (
                        <button
                          type="button"
                          onClick={() => handleClearMedia('cover')}
                          className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Cover</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Profile Picture / Video Section */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-purple-600" />
                          <span>Profile Picture or Video Avatar</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Use custom photos or looping video avatars to stand out during live calls and chats.
                        </p>
                      </div>

                      {avatarUrl && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold">
                          {avatarMediaType === 'video' ? 'Video Avatar Active' : 'Photo Avatar Active'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenMediaPicker('avatar')}
                        className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>{avatarUrl ? 'Change Profile Media' : 'Choose Avatar Photo/Video'}</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => handleClearMedia('avatar')}
                          className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 active:scale-95 text-red-700 text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Media</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Avatar Theme Color */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-slate-500" />
                      <span>Fallback Theme & Badge Color</span>
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      {AVATAR_COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setAvatarColor(col)}
                          className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center text-white ${
                            avatarColor === col ? 'scale-110 ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: col }}
                        >
                          {avatarColor === col && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: PERSONAL INFO (Name, Handle, Status, Bio) */}
              {activeEditTab === 'info' && (
                <div className="space-y-4">
                  {/* Display Name & Handle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Display Name</label>
                      <input
                        id="edit-profile-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-medium text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <AtSign className="w-3 h-3 text-slate-400" /> Username Handle
                      </label>
                      <input
                        id="edit-profile-handle"
                        type="text"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Status Emoji & Message */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Custom Status</label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto max-w-[140px] shrink-0">
                        {EMOJI_STATUS_PRESETS.slice(0, 5).map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setStatusEmoji(em)}
                            className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center transition ${
                              statusEmoji === em ? 'bg-white shadow-xs scale-110' : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                      <input
                        id="edit-profile-status"
                        type="text"
                        value={statusMessage}
                        onChange={(e) => setStatusMessage(e.target.value)}
                        placeholder="What's happening?"
                        className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">About Me / Bio</label>
                    <textarea
                      id="edit-profile-bio"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell peers about your setup or interests..."
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-hidden text-slate-800 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: AI TRANSLATION & LANGUAGE */}
              {activeEditTab === 'language' && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <span>AI Translation & Language Settings</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900">
                      Gemini AI
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Preferred Target Language</label>
                    <select
                      id="edit-profile-language"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoTranslate}
                      onChange={(e) => setAutoTranslate(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs text-slate-700 font-medium">
                      Show quick 1-click AI translation on foreign messages
                    </span>
                  </label>
                </div>
              )}

              {/* Save / Submit Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="text-[11px] text-slate-500">
                  Changes update immediately for all active peers.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-profile-submit-btn"
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition"
                  >
                    {savedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
                    <span>{savedSuccess ? 'Saved Profile!' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>

        {/* MEDIA PICKER MODAL OVERLAY (Upload, Presets, Custom URL) */}
        {mediaPickerTarget && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md p-4 sm:p-6 flex flex-col justify-between text-white animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {mediaPickerTarget === 'cover' ? <Film className="w-5 h-5 text-amber-400" /> : <User className="w-5 h-5 text-purple-400" />}
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {mediaPickerTarget === 'cover' ? 'Select 16:9 Cover Photo or Video' : 'Select Avatar Photo or Video'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Upload from your device, choose from curated looping presets, or paste a link.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMediaPickerTarget(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              
              {/* Option 1: Upload from Device */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload File from Device (Photo or Video)</span>
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload Image Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'video/mp4,video/webm,video/quicktime';
                        fileInputRef.current.click();
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95"
                  >
                    <Film className="w-4 h-4" />
                    <span>Upload Looping Video</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Curated Presets */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instant Presets (Photos & Looping Videos)</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(mediaPickerTarget === 'cover' ? COVER_PRESETS : AVATAR_PRESETS).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-white/40 aspect-video flex flex-col justify-end p-2 text-left transition hover:scale-102 active:scale-98 bg-slate-800"
                    >
                      {preset.type === 'video' ? (
                        <video
                          src={preset.url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      <div className="relative z-10">
                        <span className="text-[10px] font-bold text-white line-clamp-1 flex items-center gap-1">
                          {preset.type === 'video' ? <Film className="w-2.5 h-2.5 text-cyan-400" /> : <ImageIcon className="w-2.5 h-2.5 text-emerald-400" />}
                          {preset.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Custom Media URL */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Or Enter Direct Image or Video URL</span>
                </h4>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://example.com/media.mp4 or .jpg"
                    className="flex-1 px-3 py-2 text-xs bg-black/40 border border-white/20 rounded-xl text-white outline-hidden focus:border-blue-400 font-mono"
                  />

                  <div className="flex items-center gap-2">
                    <select
                      value={customUrlType}
                      onChange={(e) => setCustomUrlType(e.target.value as any)}
                      className="px-2.5 py-2 text-xs bg-slate-800 border border-white/20 rounded-xl text-white outline-hidden"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video (Loop)</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleApplyCustomUrl}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition active:scale-95"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setMediaPickerTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
              >
                Close
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
