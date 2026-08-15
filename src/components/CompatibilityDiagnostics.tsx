import { useState, useEffect } from 'react';
import { DeviceDiagnostics, StreamMode } from '../types';
import { runDeviceDiagnostics, unlockAudio, getSafeAudioContext } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Cpu, 
  Tablet, 
  Volume2, 
  Mic, 
  Video, 
  Radio, 
  Settings, 
  X,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  streamModePreference: StreamMode;
  onStreamModeChange: (mode: StreamMode) => void;
  isLowMemoryMode: boolean;
  onToggleLowMemory: () => void;
}

export function CompatibilityDiagnostics({
  isOpen,
  onClose,
  streamModePreference,
  onStreamModeChange,
  isLowMemoryMode,
  onToggleLowMemory,
}: Props) {
  const [diag, setDiag] = useState<DeviceDiagnostics>(runDeviceDiagnostics());
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [audioUnlockedStatus, setAudioUnlockedStatus] = useState(false);

  useEffect(() => {
    setDiag(runDeviceDiagnostics());
  }, [isOpen]);

  const testAudioPlayback = async () => {
    const ctx = getSafeAudioContext();
    const success = await unlockAudio(ctx);
    setAudioUnlockedStatus(success);
    soundEffects.playMessageSound(false);
  };

  const testMicrophone = async () => {
    if (micTesting) return;
    setMicTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getSafeAudioContext();
      if (ctx) {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        let count = 0;
        const interval = setInterval(() => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          setMicLevel(Math.min(100, Math.round((sum / data.length / 128) * 100)));
          count++;
          if (count > 30) {
            clearInterval(interval);
            stream.getTracks().forEach((t) => t.stop());
            setMicTesting(false);
            setMicLevel(0);
          }
        }, 100);
      }
    } catch (e) {
      alert('Microphone permission check failed. On iOS Safari, check Settings > Safari > Camera & Microphone.');
      setMicTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="diagnostics-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div id="diagnostics-modal-card" className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Device & Compatibility Suite</h2>
              <p className="text-xs text-slate-500">iPad mini 2 & iOS 9.3.5 Hardware Diagnostics</p>
            </div>
          </div>
          <button
            id="close-diagnostics-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-slate-700">
          
          {/* iOS / iPad mini 2 Detection Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 flex items-center gap-2">
                <Tablet className="w-4 h-4 text-blue-600" /> Detected Device Environment
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                {diag.isiPadMini2Suspected ? 'iPad mini 2 (A7)' : diag.isiPad ? 'Apple iPad' : diag.isiOS ? 'iOS Device' : 'Standard Web'}
              </span>
            </div>

            {/* Auto-Enable Status Banner */}
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
              <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Older Safari Call & Audio Compatibility:
              </span>
              <span className="font-bold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded-full">
                Auto-Enabled
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-100">
              <div>
                <span className="font-medium text-slate-400">iOS Detected:</span>{' '}
                <span className="font-semibold text-slate-800">{diag.isiOS ? (diag.iosVersion || 'Legacy iOS') : 'No (Non-iOS)'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-400">Display Density:</span>{' '}
                <span className="font-semibold text-slate-800">{typeof window !== 'undefined' ? `${window.devicePixelRatio}x Retina` : '1x'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-400">Viewport:</span>{' '}
                <span className="font-semibold text-slate-800">{typeof window !== 'undefined' ? `${window.innerWidth} × ${window.innerHeight}` : 'Standard'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-400">Engine:</span>{' '}
                <span className="font-semibold text-slate-800">WebKit / Safari</span>
              </div>
            </div>
          </div>

          {/* Core Feature Matrix */}
          <div>
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600" /> Media & WebRTC Compatibility Matrix
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Mic className="w-3.5 h-3.5 text-slate-500" /> AudioContext / Web Audio
                </span>
                {diag.hasAudioContext ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 font-semibold">
                    <XCircle className="w-3.5 h-3.5" /> Unavailable
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Video className="w-3.5 h-3.5 text-slate-500" /> getUserMedia (Camera/Mic)
                </span>
                {diag.hasGetUserMedia ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Fallback Mode
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Radio className="w-3.5 h-3.5 text-slate-500" /> RTCPeerConnection (P2P)
                </span>
                {diag.hasRTCPeerConnection ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Legacy Relay
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <Radio className="w-3.5 h-3.5 text-slate-500" /> WebSocket Signaling
                </span>
                {diag.hasWebSocket ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 font-semibold">
                    <XCircle className="w-3.5 h-3.5" /> Unavailable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Hardware Testers */}
          <div className="p-4 rounded-xl border border-slate-200 bg-blue-50/40 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-900">
              Hardware & Sound Verification
            </h3>
            
            <div className="flex flex-wrap gap-2">
              <button
                id="test-speaker-btn"
                onClick={testAudioPlayback}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition"
              >
                <Volume2 className="w-4 h-4" />
                Test Speaker / Unlock Audio
              </button>

              <button
                id="test-microphone-btn"
                onClick={testMicrophone}
                disabled={micTesting}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg text-white transition ${
                  micTesting ? 'bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                <Mic className="w-4 h-4" />
                {micTesting ? `Listening (${micLevel}%)...` : 'Test Microphone'}
              </button>
            </div>

            {micTesting && (
              <div className="space-y-1">
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">Speak into your iPad microphone to test audio gain</p>
              </div>
            )}
          </div>

          {/* Call Stream Mode Selector */}
          <div className="space-y-3">
            <label className="block font-bold text-slate-900">Media Stream Engine Preference</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'auto', label: 'Auto (Recommended)', desc: 'Selects WebRTC or Legacy based on browser' },
                { id: 'webrtc', label: 'WebRTC P2P', desc: 'Direct encrypted HD stream (iOS 11+, Mac, Android, PC)' },
                { id: 'legacy_relay', label: 'Legacy iOS 9 Relay', desc: 'MJPEG canvas + PCM audio over WebSocket' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  id={`mode-select-${opt.id}`}
                  onClick={() => onStreamModeChange(opt.id as StreamMode)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                    streamModePreference === opt.id
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-xs">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* iPad mini 2 Optimization Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-amber-50/50">
            <div>
              <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> iPad mini 2 Battery & RAM Safe Mode
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Limits video to 240p/15fps, disables heavy CSS blurs to prevent Safari tab reload on 1GB RAM.
              </div>
            </div>
            <button
              id="toggle-low-memory-btn"
              onClick={onToggleLowMemory}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isLowMemoryMode ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isLowMemoryMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            id="done-diagnostics-btn"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
}
