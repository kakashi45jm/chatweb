import React, { useState } from 'react';
import { UserProfile, DeviceDiagnostics } from '../types';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  UserPlus, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Radio,
  Layers,
  Zap
} from 'lucide-react';
import { unlockAudio, getSafeAudioContext } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';
import { safeSetStorage, sanitizeUserForStorage } from '../utils/safeStorage';

interface Props {
  initialRoomId: string;
  diagnostics: DeviceDiagnostics;
  onLogin: (user: UserProfile, roomId: string) => void;
}

export const ADMIN_CREDENTIALS = {
  username: 'beneqt23',
  displayName: 'joo',
  password: 'kaizen12',
};

export function LoginForm({ initialRoomId, diagnostics, onLogin }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const deviceBadge = diagnostics.isiPadMini2Suspected
    ? 'iPad mini 2'
    : diagnostics.isiPad
    ? 'Apple iPad'
    : diagnostics.isiOS
    ? `iOS ${diagnostics.iosVersion || 'Device'}`
    : 'Web Browser';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!cleanUsername) {
      setErrorMsg('Please enter your username.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (mode === 'signup' && password.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Audio unlock for iOS compatibility
      try {
        unlockAudio();
        getSafeAudioContext();
        soundEffects.playMessageSound(true);
      } catch {}

      if (mode === 'signup') {
        // Register Account in Server Database
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            password: password,
            name: displayName.trim() || cleanUsername,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to register account.');
          setIsLoading(false);
          return;
        }

        setSuccessMsg('Account registered & saved to database!');
        
        // Auto login with new user profile
        const userProfile: UserProfile = {
          ...data.user,
          deviceType: data.user?.isAdmin ? 'Admin' : deviceBadge,
          isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
          joinedAt: data.user.createdAt || Date.now(),
        };

        const sanitized = sanitizeUserForStorage(userProfile);
        safeSetStorage('livecall_remember_me', 'true');
        safeSetStorage('livecall_auth_user', JSON.stringify(sanitized));
        safeSetStorage('livecall_username', userProfile.name);
        safeSetStorage('livecall_avatar_color', userProfile.avatarColor);

        setTimeout(() => {
          onLogin(userProfile, initialRoomId || 'general');
        }, 300);

      } else {
        // Sign In Existing Account from Server Database
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            password: password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          // Check if fallback admin login locally if server DB is offline
          if (cleanUsername === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            const adminProfile: UserProfile = {
              id: 'usr-admin-beneqt23',
              name: ADMIN_CREDENTIALS.displayName,
              handle: `@${ADMIN_CREDENTIALS.username}`,
              avatarColor: '#ec4899',
              isAdmin: true,
              isVerified: true,
              isVip: true,
              customTitle: 'Founder & Administrator',
              statusMessage: '⚡ LiveCall Administrator',
              customStatusEmoji: '👑',
              bio: 'Official LiveCall System Administrator & Founder.',
              deviceType: 'Admin',
              isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
              joinedAt: Date.now(),
            };
            
            const sanitizedAdmin = sanitizeUserForStorage(adminProfile);
            safeSetStorage('livecall_remember_me', 'true');
            safeSetStorage('livecall_auth_user', JSON.stringify(sanitizedAdmin));
            onLogin(adminProfile, initialRoomId || 'general');
            return;
          }

          setErrorMsg(data.error || 'Invalid username or password.');
          setIsLoading(false);
          return;
        }

        const userProfile: UserProfile = {
          ...data.user,
          deviceType: data.user?.isAdmin ? 'Admin' : deviceBadge,
          isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
          joinedAt: data.user.createdAt || Date.now(),
        };

        const sanitized = sanitizeUserForStorage(userProfile);
        safeSetStorage('livecall_remember_me', 'true');
        safeSetStorage('livecall_auth_user', JSON.stringify(sanitized));
        safeSetStorage('livecall_username', userProfile.name);
        safeSetStorage('livecall_avatar_color', userProfile.avatarColor);

        onLogin(userProfile, initialRoomId || 'general');
      }

    } catch (err: any) {
      console.error('Auth request error:', err);
      // Client-side fallback if server endpoint offline
      if (cleanUsername === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const adminProfile: UserProfile = {
          id: 'usr-admin-beneqt23',
          name: ADMIN_CREDENTIALS.displayName,
          handle: `@${ADMIN_CREDENTIALS.username}`,
          avatarColor: '#ec4899',
          isAdmin: true,
          isVerified: true,
          isVip: true,
          customTitle: 'Founder & Administrator',
          statusMessage: '⚡ LiveCall Administrator',
          customStatusEmoji: '👑',
          bio: 'Official LiveCall System Administrator & Founder.',
          deviceType: 'Admin',
          isIosLegacy: diagnostics.isiOS && (diagnostics.iosVersion ? parseFloat(diagnostics.iosVersion) < 13 : true),
          joinedAt: Date.now(),
        };
        const sanitizedAdmin = sanitizeUserForStorage(adminProfile);
        safeSetStorage('livecall_remember_me', 'true');
        safeSetStorage('livecall_auth_user', JSON.stringify(sanitizedAdmin));
        onLogin(adminProfile, initialRoomId || 'general');
        return;
      }

      setErrorMsg('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070d] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden selection:bg-pink-500 selection:text-white">
      
      {/* Pink Void Cyber Atmosphere Background with Pinterest Video Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <video
          src="/assets/login_video.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-20 filter blur-xl scale-110 pointer-events-none"
        />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/25 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[#07070d]/70 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">

        {/* Pink Void Card with Aesthetic Header Banner */}
        <div className="bg-[#11131f]/95 backdrop-blur-xl rounded-3xl border border-pink-500/20 shadow-2xl shadow-pink-950/40 overflow-hidden">
          
          {/* Header Video Banner (Only the user provided video) */}
          <div className="relative w-full h-48 sm:h-56 bg-slate-950 p-6 flex flex-col justify-end overflow-hidden border-b border-pink-500/20">
            {/* Pinterest Video Loop */}
            <video
              src="/assets/login_video.mp4"
              autoPlay
              loop
              muted
              playsInline
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== 'https://v1.pinimg.com/videos/iht/expMp4/46/39/9d/46399d7d0929e1d3ccbcb1052c15d5d9_720w.mp4') {
                  target.src = 'https://v1.pinimg.com/videos/iht/expMp4/46/39/9d/46399d7d0929e1d3ccbcb1052c15d5d9_720w.mp4';
                  target.play().catch(() => {});
                }
              }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-105 transition-opacity duration-700 opacity-90"
            />
            
            {/* Subtle Gradient & Cyber Vignette for crystal-clear readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#11131f] via-black/30 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)] pointer-events-none" />

            <div className="relative z-10 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/30 backdrop-blur-md border border-pink-400/40 text-[10px] font-mono text-pink-200 font-bold uppercase tracking-wider shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse shadow-sm shadow-pink-400" />
                LiveCall & Web Chat
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-rose-200 to-purple-200 tracking-tight drop-shadow-[0_2px_10px_rgba(236,72,153,0.5)]">
                PINK VOID
              </h1>
              
              <p className="text-xs text-pink-100/80 font-medium drop-shadow-sm">
                Ultra-fast Voice, Video & Text Communication
              </p>
            </div>
          </div>

          {/* Auth Card Content */}
          <div className="p-6 sm:p-7 space-y-5">
            
            {/* Mode Switcher Tabs (Sign In / Register Account) */}
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-2xl border border-white/5">
              <button
                id="tab-signin-btn"
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'signin'
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>

              <button
                id="tab-register-btn"
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'signup'
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Register</span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Username <span className="text-pink-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-username-input"
                    type="text"
                    required
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                  />
                </div>
              </div>

              {/* Display Name (Only in Register Mode) */}
              {mode === 'signup' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="block text-xs font-bold text-slate-300">
                    Display Name <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <input
                      id="auth-display-name-input"
                      type="text"
                      placeholder="Your preferred name (e.g. Alex)"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Password <span className="text-pink-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-hidden transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* Submit Action Button */}
              <div className="pt-2">
                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/30 transition active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : mode === 'signin' ? (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In to Pink Void</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account & Save</span>
                    </>
                  )}
                </button>
              </div>

            </form>

            {/* Bottom Toggle Text */}
            <div className="text-center pt-2 text-xs text-slate-400">
              {mode === 'signin' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg('');
                    }}
                    className="text-pink-400 hover:text-pink-300 font-bold underline transition ml-1"
                  >
                    Register here
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg('');
                    }}
                    className="text-pink-400 hover:text-pink-300 font-bold underline transition ml-1"
                  >
                    Sign in here
                  </button>
                </p>
              )}
            </div>

          </div>

        </div>

        {/* Minimal Footer */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <span>Pink Void v2.5</span>
          <span>•</span>
          <span>Compatible with iPad mini 2 & Modern Browsers</span>
        </div>

      </div>

    </div>
  );
}
