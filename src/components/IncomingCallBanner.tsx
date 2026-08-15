import { ActiveCallState } from '../types';
import { Phone, PhoneOff, Video, Mic, Volume2 } from 'lucide-react';
import { getSafeAudioContext, unlockAudio } from '../utils/legacyCompatibility';

interface Props {
  activeCall: ActiveCallState | null;
  currentUserId: string;
  onAccept: (call: ActiveCallState) => void;
  onReject: (callId: string) => void;
}

export function IncomingCallBanner({
  activeCall,
  currentUserId,
  onAccept,
  onReject,
}: Props) {
  if (!activeCall || activeCall.status !== 'ringing' || activeCall.initiatorId === currentUserId) {
    return null;
  }

  const isVideo = activeCall.type === 'video';

  const handleAccept = () => {
    // Unlock iOS Safari AudioContext on click
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);
    onAccept(activeCall);
  };

  const handleReject = () => {
    onReject(activeCall.callId);
  };

  return (
    <div
      id="incoming-call-overlay"
      className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-50 animate-bounce-short"
    >
      <div className="p-4 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/50 shadow-2xl text-white backdrop-blur-md">
        <div className="flex items-center space-x-3.5">
          
          {/* Pulsing Avatar */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-emerald-500/40 animate-ping" />
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-bold text-lg text-white shadow-md">
              {activeCall.initiatorName.charAt(0).toUpperCase()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              {isVideo ? <Video className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>Incoming {isVideo ? 'Video' : 'Audio'} Call</span>
            </div>
            <h4 className="text-sm font-bold text-white truncate mt-0.5">
              {activeCall.initiatorName}
            </h4>
            <p className="text-[11px] text-slate-400">Ringing from room channel...</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button
            id="decline-call-btn"
            onClick={handleReject}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-red-600/90 hover:bg-red-600 active:scale-95 text-white text-xs font-bold transition shadow-md"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            id="accept-call-btn"
            onClick={handleAccept}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition shadow-md animate-pulse"
          >
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            <span>Accept Call</span>
          </button>
        </div>

      </div>
    </div>
  );
}
