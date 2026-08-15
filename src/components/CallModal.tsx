import React, { useEffect, useRef, useState, RefObject } from 'react';
import { ActiveCallState } from '../types';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  SwitchCamera, 
  Maximize2, 
  Minimize2, 
  ShieldCheck, 
  Volume2, 
  Radio, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { unlockAudio, getSafeAudioContext } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';

interface Props {
  activeCall: ActiveCallState | null;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remoteFrameData: string | null;
  effectiveStreamMode: 'webrtc' | 'legacy_relay';
  isMuted: boolean;
  isVideoOff: boolean;
  cameraFacing: 'user' | 'environment';
  callDuration: number;
  localAudioLevel: number;
  remoteAudioLevel: number;
  connectionQuality: 'excellent' | 'good' | 'poor';
  mediaError: string | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
  isLowMemoryMode: boolean;
}

export function CallModal({
  activeCall,
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  remoteFrameData,
  effectiveStreamMode,
  isMuted,
  isVideoOff,
  cameraFacing,
  callDuration,
  localAudioLevel,
  remoteAudioLevel,
  connectionQuality,
  mediaError,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onEndCall,
  isLowMemoryMode,
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipPosition, setPipPosition] = useState<'br' | 'tr' | 'bl' | 'tl'>('br');
  const containerRef = useRef<HTMLDivElement>(null);
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Render legacy video frame onto remote canvas
  useEffect(() => {
    if (remoteFrameData && remoteCanvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = remoteCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      img.src = remoteFrameData;
    }
  }, [remoteFrameData]);

  // Unlock audio on touch inside call modal (vital for iPad mini 2 iOS 9.3.5)
  const handleModalTouch = () => {
    const ctx = getSafeAudioContext();
    unlockAudio(ctx);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!activeCall || activeCall.status === 'idle') return null;

  const isVideoCall = activeCall.type === 'video';
  const isCalling = activeCall.status === 'calling';
  const isRinging = activeCall.status === 'ringing';
  const isConnected = activeCall.status === 'connected';

  return (
    <div
      ref={containerRef}
      id="active-call-modal"
      onClick={handleModalTouch}
      className={`fixed inset-0 z-40 flex flex-col bg-slate-950 text-white ${
        isLowMemoryMode ? '' : 'backdrop-blur-md'
      }`}
    >
      {/* Top Status Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
            </span>
            <span className="font-semibold text-slate-200">
              {isCalling ? 'Calling...' : isRinging ? 'Ringing...' : formatTime(callDuration)}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] text-slate-300">
            <Radio className="w-3 h-3 text-blue-400" />
            <span>{effectiveStreamMode === 'webrtc' ? 'WebRTC P2P' : 'Safari Legacy Relay (Auto)'}</span>
          </div>

          {/* Safari Audio Unlock Quick Pill */}
          <button
            id="call-unlock-audio-btn"
            onClick={(e) => {
              e.stopPropagation();
              const ctx = getSafeAudioContext();
              unlockAudio(ctx);
              soundEffects.playCallConnect();
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-500/40 text-[11px] text-emerald-200 transition active:scale-95"
            title="Ensure Safari Audio is Playing"
          >
            <Volume2 className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Audio Ready</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="call-fullscreen-btn"
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-black/40 hover:bg-black/70 text-slate-300 hover:text-white transition"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Video & Audio Presentation Canvas */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-slate-900">
        
        {/* Error notification banner */}
        {mediaError && (
          <div className="absolute top-16 z-30 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-900/80 border border-amber-600/50 text-amber-200 text-xs shadow-lg">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{mediaError}</span>
          </div>
        )}

        {/* Video Mode View */}
        {isVideoCall ? (
          <div className="relative w-full h-full flex items-center justify-center">
            
            {/* Remote Video Stream or Remote Canvas Frame */}
            {effectiveStreamMode === 'webrtc' && remoteStream ? (
              <video
                ref={remoteVideoRef}
                id="remote-video-stream"
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : remoteFrameData ? (
              <canvas
                ref={remoteCanvasRef}
                id="remote-legacy-canvas"
                className="w-full h-full object-contain"
              />
            ) : (
              /* Remote placeholder when video hasn't arrived */
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className={`w-28 h-28 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-2xl ${
                    remoteAudioLevel > 15 ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-slate-950 scale-105 transition-all' : ''
                  }`}>
                    {activeCall.initiatorName.charAt(0).toUpperCase()}
                  </div>
                  {remoteAudioLevel > 10 && (
                    <div className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white uppercase tracking-wider">
                      Speaking
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{activeCall.initiatorName}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {isConnected ? 'Connecting media feed...' : 'Waiting for answer...'}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video Picture-In-Picture (PiP) */}
            <div
              id="local-pip-video-container"
              onClick={() => {
                const positions: Array<'br' | 'tr' | 'bl' | 'tl'> = ['br', 'bl', 'tl', 'tr'];
                const next = positions[(positions.indexOf(pipPosition) + 1) % positions.length];
                setPipPosition(next);
              }}
              className={`absolute z-20 w-32 h-44 sm:w-44 sm:h-56 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800 transition-all duration-300 cursor-pointer ${
                pipPosition === 'br' ? 'bottom-24 right-4' :
                pipPosition === 'bl' ? 'bottom-24 left-4' :
                pipPosition === 'tr' ? 'top-16 right-4' : 'top-16 left-4'
              }`}
            >
              {localStream && !isVideoOff ? (
                <video
                  ref={localVideoRef}
                  id="local-video-preview"
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 p-2 text-center">
                  <VideoOff className="w-6 h-6 mb-1" />
                  <span className="text-[10px]">Camera Off</span>
                </div>
              )}

              {/* Local speaking indicator */}
              {localAudioLevel > 15 && (
                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-[9px] font-semibold text-white">
                  Mic Active
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Audio Call Dedicated View */
          <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
            
            <div className="relative">
              {/* Pulsing Audio Ripples */}
              <div className={`absolute -inset-4 rounded-full bg-blue-500/20 transition-all duration-300 ${
                remoteAudioLevel > 10 ? 'scale-125 opacity-100' : 'scale-90 opacity-0'
              }`} />
              <div className={`absolute -inset-8 rounded-full bg-blue-500/10 transition-all duration-500 ${
                remoteAudioLevel > 25 ? 'scale-150 opacity-100' : 'scale-75 opacity-0'
              }`} />

              {/* Central Avatar */}
              <div className={`relative w-32 h-32 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl border-4 ${
                remoteAudioLevel > 15 ? 'border-emerald-400 shadow-emerald-500/20' : 'border-white/20'
              }`}>
                {activeCall.initiatorName.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">{activeCall.initiatorName}</h2>
              <p className="text-sm text-slate-400 font-medium">
                {isCalling ? 'Calling peer...' : isRinging ? 'Ringing...' : `Audio Call (${formatTime(callDuration)})`}
              </p>
            </div>

            {/* Audio Waveform Simulator */}
            <div className="flex items-center space-x-1 h-10 px-6 py-2 rounded-full bg-white/5 border border-white/10">
              {[20, 45, 80, 60, 30, 90, 40, 70, 35, 85, 50, 65, 25].map((val, idx) => {
                const dynamicHeight = isConnected
                  ? Math.max(8, Math.min(36, (val * (remoteAudioLevel + localAudioLevel + 10)) / 100))
                  : 8;
                return (
                  <div
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      remoteAudioLevel > 20 ? 'bg-emerald-400' : 'bg-blue-400'
                    }`}
                    style={{ height: `${dynamicHeight}px` }}
                  />
                );
              })}
            </div>

          </div>
        )}

      </div>

      {/* Bottom Call Controls Bar */}
      <div className="relative z-30 flex items-center justify-center gap-3 sm:gap-6 p-4 sm:p-6 bg-slate-950/90 border-t border-white/10">
        
        {/* Toggle Microphone */}
        <button
          id="call-mute-toggle-btn"
          onClick={onToggleMute}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition active:scale-95 ${
            isMuted ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          <span className="text-[10px] mt-1 font-medium">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Toggle Video (in video call) */}
        {isVideoCall && (
          <button
            id="call-video-toggle-btn"
            onClick={onToggleVideo}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition active:scale-95 ${
              isVideoOff ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
            <span className="text-[10px] mt-1 font-medium">{isVideoOff ? 'Cam On' : 'Cam Off'}</span>
          </button>
        )}

        {/* Switch Front/Rear Camera (in video call) */}
        {isVideoCall && (
          <button
            id="call-switch-camera-btn"
            onClick={onSwitchCamera}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          >
            <SwitchCamera className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Flip</span>
          </button>
        )}

        {/* End Call Button */}
        <button
          id="call-end-btn"
          onClick={onEndCall}
          className="flex flex-col items-center justify-center w-16 h-14 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-lg shadow-red-600/30 transition"
        >
          <PhoneOff className="w-6 h-6" />
          <span className="text-[10px] mt-1 font-bold">End</span>
        </button>

      </div>
    </div>
  );
}
