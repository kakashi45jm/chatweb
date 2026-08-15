import React, { useState } from 'react';
import { UserProfile, DeviceDiagnostics } from '../types';
import { 
  Radio, 
  User, 
  Lock, 
  Mail, 
  Hash, 
  Eye, 
  EyeOff, 
  LogIn, 
  UserPlus, 
  Tablet, 
  Sparkles, 
  CheckCircle2, 
  Volume2, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { unlockAudio, getSafeAudioContext } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';

interface Props {
  initialRoomId: string;
  diagnostics: DeviceDiagnostics;
  onLogin: (user: UserProfile, roomId: string) => void;
}

const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const PRESET_ACCOUNTS = [
  { name: 'iPad mini 2 User', email: 'ipad@livecall.local', color: '#10b981', role: 'Tablet Client' },
  { name: 'Caller Alpha', email: 'alpha@livecall.local', color: '#3b82f6', role: 'Web Client' },
  { name: 'Caller Beta', email: 'beta@livecall.local', color: '#8b5cf6', role: 'Mobile Client' },
];

export function LoginForm({ initialRoomId, diagnostics, onLogin }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [roomId, setRoomId] = useState(initialRoomId || 'general');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const deviceBadge = diagnostics.isiPadMini2Suspected
    ? 'iPad mini 2 (iOS 9.3.5)'
    : diagnostics.isiPad
    ? 'Apple iPad'
    : diagnostics.isiOS
    ? `iOS ${diagnostics.iosVersion || 'Device'}`
    : diagnostics.isOlderSafari
    ? 'Older Safari'
    : 'Web Browser';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Please enter a display name.');
      return;
    }

    if (mode === 'signup' && email && !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    // Unlock iOS Audio on click gesture
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);
    soundEffects.playCallConnect();

    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'general';

    const newUser: UserProfile = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: trimmedName,
      email: email.trim() || undefined,
      avatarColor: selectedColor,
      deviceType: deviceBadge,
      isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
      joinedAt: Date.now(),
    };

    if (rememberMe && typeof localStorage !== 'undefined') {
      localStorage.setItem('livecall_auth_user', JSON.stringify(newUser));
      localStorage.setItem('livecall_username', newUser.name);
      localStorage.setItem('livecall_avatar_color', newUser.avatarColor);
      localStorage.setItem('livecall_remember_me', 'true');
    }

    onLogin(newUser, cleanRoom);
  };

  const handleQuickPreset = (preset: typeof PRESET_ACCOUNTS[0]) => {
    setName(preset.name);
    setEmail(preset.email);
    setSelectedColor(preset.color);
    setPassword('demo1234');
    setErrorMsg('');

    // Trigger instant login
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);
    soundEffects.playCallConnect();

    const cleanRoom = roomId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-') || 'general';
    const newUser: UserProfile = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: preset.name,
      email: preset.email,
      avatarColor: preset.color,
      deviceType: `${deviceBadge} (${preset.role})`,
      isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
      joinedAt: Date.now(),
    };

    if (rememberMe && typeof localStorage !== 'undefined') {
      localStorage.setItem('livecall_auth_user', JSON.stringify(newUser));
      localStorage.setItem('livecall_username', newUser.name);
      localStorage.setItem('livecall_avatar_color', newUser.avatarColor);
    }

    onLogin(newUser, cleanRoom);
  };

  return (
    <div id="login-screen" className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto">
      <div className="w-full max-w-md my-auto space-y-4">
        
        {/* Brand Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-teal-400 text-white shadow-xl shadow-blue-500/20">
            <Radio className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            LiveCall Web
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            High-compatibility WebRTC & audio/video calling for iOS 9.3.5, iPad mini 2, and modern devices.
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              id="tab-signin"
              onClick={() => { setMode('signin'); setErrorMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-signup"
              onClick={() => { setMode('signup'); setErrorMsg(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Quick Join / Register
            </button>
          </div>

          {/* Device & Auto-Enable Status Chip */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Tablet className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-slate-300 truncate font-medium">{deviceBadge}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold shrink-0">
              Call Engine Ready
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Display Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-name-input"
                  type="text"
                  required
                  placeholder="e.g. Alex (iPad), Sam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                />
              </div>
            </div>

            {/* Email (Optional or for signup) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Email / Account Identifier <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                />
              </div>
            </div>

            {/* Password / Passcode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Passcode / Password <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter passcode"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                />
                <button
                  type="button"
                  id="toggle-password-vis-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Room / Channel */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Join Room Channel
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  id="login-room-input"
                  type="text"
                  placeholder="general"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition font-mono"
                />
              </div>
            </div>

            {/* Avatar Theme Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-300">
                Profile Avatar Color
              </label>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      className={`w-6 h-6 rounded-full transition-transform active:scale-95 ${
                        selectedColor === col
                          ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                          : 'hover:scale-105 opacity-80'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                  style={{ backgroundColor: selectedColor }}
                >
                  {(name || 'U').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                <input
                  id="remember-me-checkbox"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Remember me on this iPad / browser</span>
              </label>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-900/40 border border-red-500/40 text-red-200 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
            >
              {mode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{mode === 'signin' ? 'Enter Chat & Calling' : 'Join Room & Start Calling'}</span>
            </button>

          </form>

          {/* Quick 1-Click Demo Accounts */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Quick 1-Click Join:
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_ACCOUNTS.map((preset) => (
                <button
                  key={preset.name}
                  id={`quick-preset-${preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  type="button"
                  onClick={() => handleQuickPreset(preset)}
                  className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-left transition active:scale-95 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                    <span className="text-[11px] font-bold text-white truncate">{preset.name.split(' ')[0]}</span>
                  </div>
                  <span className="text-[9px] text-slate-400">{preset.role}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
