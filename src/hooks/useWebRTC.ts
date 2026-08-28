import { useState, useEffect, useRef, useCallback } from 'react';
import { ActiveCallState, CallType, StreamMode } from '../types';
import { polyfillGetUserMedia, getSafeAudioContext, pcmToWavBase64, unlockAudio, runDeviceDiagnostics } from '../utils/legacyCompatibility';
import { soundEffects } from '../utils/audioHelper';

// Public STUN servers for reliable NAT traversal
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

interface UseWebRTCOptions {
  userId: string;
  roomId: string;
  sendWS: (msg: any) => void;
  streamModePreference: StreamMode;
  isLowMemoryMode: boolean;
}

export function useWebRTC({
  userId,
  roomId,
  sendWS,
  streamModePreference,
  isLowMemoryMode,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [effectiveStreamMode, setEffectiveStreamMode] = useState<'webrtc' | 'legacy_relay'>('webrtc');
  const [remoteFrameData, setRemoteFrameData] = useState<string | null>(null);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState<number>(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('good');
  const [mediaError, setMediaError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const legacyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const legacyFrameIntervalRef = useRef<any>(null);
  const callTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Initialize polyfills on mount
  useEffect(() => {
    polyfillGetUserMedia();
    audioContextRef.current = getSafeAudioContext();
  }, []);

  // Duration timer
  useEffect(() => {
    if (activeCall?.status === 'connected') {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCall?.status]);

  // Handle local video element binding
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      try {
        localVideoRef.current.srcObject = localStream;
      } catch (e) {
        // Fallback for older Safari
        localVideoRef.current.src = URL.createObjectURL(localStream as any);
      }
    }
  }, [localStream]);

  // Handle remote video element binding
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      try {
        remoteVideoRef.current.srcObject = remoteStream;
      } catch (e) {
        remoteVideoRef.current.src = URL.createObjectURL(remoteStream as any);
      }
    }
  }, [remoteStream]);

  // Setup Audio Analyser for local voice detection
  const setupAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const ctx = audioContextRef.current || getSafeAudioContext();
      if (!ctx) return;
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudio = () => {
        if (!audioAnalyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setLocalAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        if (activeCall?.status === 'connected') {
          requestAnimationFrame(checkAudio);
        }
      };
      checkAudio();
    } catch (e) {
      console.warn('Audio analyser setup failed:', e);
    }
  }, [activeCall?.status]);

  // Start Media Stream (Video/Audio)
  // Start Media Stream (Video/Audio) with automatic fallback for older Safari
  const startMedia = useCallback(async (callType: CallType, facing: 'user' | 'environment' = 'user'): Promise<MediaStream | null> => {
    setMediaError(null);
    unlockAudio(audioContextRef.current);

    // iPad mini 2 / older Safari optimization: low resolution (320x240 / 480p) to avoid A7 thermal throttling & memory crash
    const videoConstraints: MediaTrackConstraints = isLowMemoryMode
      ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 }, facingMode: facing }
      : { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 }, facingMode: facing };

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video' ? videoConstraints : false,
    };

    try {
      let stream: MediaStream | null = null;

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        const legacyGUM = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).getUserMedia;
        if (legacyGUM) {
          stream = await new Promise((resolve, reject) => {
            legacyGUM.call(navigator, constraints, resolve, reject);
          });
        }
      }

      if (stream) {
        setLocalStream(stream);
        setupAudioAnalyser(stream);
        return stream;
      }
    } catch (err: any) {
      console.warn('getUserMedia failed with video constraints, auto-enabling audio-only fallback for Safari:', err);
      try {
        // Automatic fallback to audio-only if video camera fails or is blocked on older Safari
        let audioOnlyStream: MediaStream | null = null;
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          const legacyGUM = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).getUserMedia;
          if (legacyGUM) {
            audioOnlyStream = await new Promise((resolve, reject) => {
              legacyGUM.call(navigator, { audio: true }, resolve, reject);
            });
          }
        }

        if (audioOnlyStream) {
          setLocalStream(audioOnlyStream);
          setMediaError('Auto-enabled Audio-Only Call (Older Safari / Camera Restricted)');
          setupAudioAnalyser(audioOnlyStream);
          return audioOnlyStream;
        }
      } catch (audioErr: any) {
        console.error('Microphone also failed:', audioErr);
        setMediaError('Could not access microphone. Tap screen to unlock Safari permissions.');
      }
    }
    return null;
  }, [isLowMemoryMode, setupAudioAnalyser]);

  // Stop Media Stream & Clear
  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      setRemoteStream(null);
    }
    if (legacyFrameIntervalRef.current) {
      clearInterval(legacyFrameIntervalRef.current);
      legacyFrameIntervalRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteFrameData(null);
    setLocalAudioLevel(0);
    setRemoteAudioLevel(0);
  }, [localStream, remoteStream]);

  // Setup Legacy Relay Streaming (MJPEG Canvas Loop + Audio Chunks for iOS 9.3.5)
  const startLegacyRelay = useCallback((stream: MediaStream, callId: string) => {
    if (legacyFrameIntervalRef.current) clearInterval(legacyFrameIntervalRef.current);

    const canvas = document.createElement('canvas');
    legacyCanvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    const video = document.createElement('video');
    video.autoplay = true;
    (video as any).playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    video.play().catch(() => {});

    // Target dimensions for iPad mini 2 memory safety
    const targetWidth = isLowMemoryMode ? 240 : 320;
    const targetHeight = isLowMemoryMode ? 180 : 240;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const fpsInterval = isLowMemoryMode ? 100 : 80; // 10-12 fps

    legacyFrameIntervalRef.current = setInterval(() => {
      if (video.readyState >= 2 && ctx && !isVideoOff) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        try {
          const frameBase64 = canvas.toDataURL('image/jpeg', isLowMemoryMode ? 0.4 : 0.55);
          sendWS({
            type: 'relay_video_frame',
            callId,
            frame: frameBase64,
            width: targetWidth,
            height: targetHeight,
          });
        } catch (e) {}
      }
    }, fpsInterval);

    // Audio chunk streaming via Web Audio ScriptProcessor
    try {
      const audioCtx = audioContextRef.current || getSafeAudioContext();
      if (audioCtx && stream.getAudioTracks().length > 0) {
        const audioSource = audioCtx.createMediaStreamSource(stream);
        const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = scriptProcessor;

        scriptProcessor.onaudioprocess = (e) => {
          if (isMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);
          try {
            const wavBase64 = pcmToWavBase64(inputData, audioCtx.sampleRate);
            sendWS({
              type: 'relay_audio_chunk',
              callId,
              audioData: wavBase64,
            });
          } catch (err) {}
        };

        audioSource.connect(scriptProcessor);
        scriptProcessor.connect(audioCtx.destination);
      }
    } catch (e) {
      console.warn('Legacy audio relay setup error:', e);
    }
  }, [isLowMemoryMode, isMuted, isVideoOff, sendWS]);

  // Create or retrieve RTCPeerConnection
  const createPeerConnection = useCallback((callId: string, isInitiator: boolean) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    try {
      const RTCPC = (window as any).RTCPeerConnection || (window as any).webkitRTCPeerConnection;
      if (!RTCPC) {
        throw new Error('RTCPeerConnection not supported in this browser environment');
      }

      const pc = new RTCPC(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      // Handle remote tracks
      pc.ontrack = (event: RTCTrackEvent) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          const inboundStream = new MediaStream();
          inboundStream.addTrack(event.track);
          setRemoteStream(inboundStream);
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          sendWS({
            type: 'webrtc_ice',
            callId,
            senderId: userId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionQuality('excellent');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionQuality('poor');
        }
      };

      return pc;
    } catch (err) {
      console.warn('Failed to create WebRTC PeerConnection:', err);
      return null;
    }
  }, [localStream, sendWS, userId]);

  // Initiate Outgoing Call (Auto-selects Legacy Relay on older Safari / iPad mini 2 or handles 1v1 direct calling)
  const startCall = useCallback(async (
    type: CallType, 
    optionsOrMode?: 'webrtc' | 'legacy_relay' | { isPrivate?: boolean; recipientId?: string; recipientName?: string; mode?: 'webrtc' | 'legacy_relay' }
  ) => {
    soundEffects.startRingtone(false);
    
    let isPrivate = false;
    let recipientId: string | undefined;
    let targetMode: 'webrtc' | 'legacy_relay' | undefined;

    if (typeof optionsOrMode === 'string') {
      targetMode = optionsOrMode;
    } else if (optionsOrMode && typeof optionsOrMode === 'object') {
      isPrivate = !!optionsOrMode.isPrivate;
      recipientId = optionsOrMode.recipientId;
      targetMode = optionsOrMode.mode;
    }

    // Auto-detect optimal mode
    let mode = targetMode;
    if (!mode) {
      if (streamModePreference === 'auto') {
        const diag = runDeviceDiagnostics();
        mode = diag.recommendedMode;
      } else {
        mode = streamModePreference;
      }
    }
    setEffectiveStreamMode(mode);

    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const callState: ActiveCallState = {
      roomId,
      callId,
      initiatorId: userId,
      initiatorName: 'You',
      type,
      status: 'calling',
      startedAt: Date.now(),
      streamMode: mode,
      participants: [userId],
      isPrivate,
      recipientId,
    };
    setActiveCall(callState);

    const stream = await startMedia(type, cameraFacing);
    if (!stream) return;

    sendWS({
      type: 'call_initiate',
      call: callState,
    });

    if (mode === 'legacy_relay') {
      startLegacyRelay(stream, callId);
    }
  }, [cameraFacing, roomId, sendWS, startLegacyRelay, startMedia, streamModePreference, userId]);

  // Accept Incoming Call (Auto-enables Older Safari Audio & Stream Relay)
  const acceptCall = useCallback(async (call: ActiveCallState) => {
    soundEffects.stopRingtone();
    soundEffects.playCallConnect();

    // Auto-determine mode
    let mode = streamModePreference === 'legacy_relay' ? 'legacy_relay' : call.streamMode;
    if (streamModePreference === 'auto') {
      const diag = runDeviceDiagnostics();
      if (diag.recommendedMode === 'legacy_relay' || call.streamMode === 'legacy_relay') {
        mode = 'legacy_relay';
      }
    }
    setEffectiveStreamMode(mode);

    const updatedCall = {
      ...call,
      status: 'connected' as const,
      streamMode: mode,
    };
    setActiveCall(updatedCall);

    const stream = await startMedia(call.type, cameraFacing);

    sendWS({
      type: 'call_accept',
      callId: call.callId,
      userId,
      streamMode: mode,
    });

    if (mode === 'webrtc' && stream) {
      const pc = createPeerConnection(call.callId, false);
      if (pc) {
        // Ready for offer
      }
    } else if (stream) {
      startLegacyRelay(stream, call.callId);
    }
  }, [cameraFacing, createPeerConnection, sendWS, startLegacyRelay, startMedia, streamModePreference, userId]);

  // Reject Incoming Call
  const rejectCall = useCallback((callId: string) => {
    soundEffects.stopRingtone();
    soundEffects.playCallEnd();
    sendWS({
      type: 'call_reject',
      callId,
      userId,
    });
    setActiveCall(null);
    stopMedia();
  }, [sendWS, stopMedia, userId]);

  // End Active Call
  const endCall = useCallback(() => {
    soundEffects.stopRingtone();
    soundEffects.playCallEnd();
    if (activeCall) {
      sendWS({
        type: 'call_end',
        callId: activeCall.callId,
        userId,
      });
    }
    setActiveCall(null);
    stopMedia();
  }, [activeCall, sendWS, stopMedia, userId]);

  // Toggle Microphone Mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // toggle
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted, localStream]);

  // Toggle Video Camera
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff; // toggle
      });
      setIsVideoOff(!isVideoOff);
    }
  }, [isVideoOff, localStream]);

  // Switch Front/Rear Camera
  const switchCamera = useCallback(async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    if (activeCall && activeCall.type === 'video') {
      stopMedia();
      const stream = await startMedia('video', nextFacing);
      if (stream && effectiveStreamMode === 'legacy_relay' && activeCall) {
        startLegacyRelay(stream, activeCall.callId);
      }
    }
  }, [activeCall, cameraFacing, effectiveStreamMode, startLegacyRelay, startMedia, stopMedia]);

  // Handle incoming signaling WS messages
  const handleWSMessage = useCallback(async (msg: any) => {
    switch (msg.type) {
      case 'call_initiate': {
        if (msg.call.initiatorId !== userId) {
          setActiveCall(msg.call);
          soundEffects.startRingtone(true);
        }
        break;
      }

      case 'call_accept': {
        soundEffects.stopRingtone();
        soundEffects.playCallConnect();
        setActiveCall((prev) => prev ? { ...prev, status: 'connected', streamMode: msg.streamMode } : null);

        if (msg.streamMode === 'webrtc' && localStream) {
          const pc = createPeerConnection(msg.callId, true);
          if (pc) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendWS({
                type: 'webrtc_offer',
                callId: msg.callId,
                senderId: userId,
                sdp: offer,
              });
            } catch (e) {
              console.warn('Create offer failed:', e);
            }
          }
        }
        break;
      }

      case 'call_reject':
      case 'call_end': {
        soundEffects.stopRingtone();
        soundEffects.playCallEnd();
        setActiveCall(null);
        stopMedia();
        break;
      }

      case 'webrtc_offer': {
        if (msg.senderId !== userId && effectiveStreamMode === 'webrtc') {
          const pc = createPeerConnection(msg.callId, false);
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendWS({
                type: 'webrtc_answer',
                callId: msg.callId,
                senderId: userId,
                sdp: answer,
              });
            } catch (e) {
              console.warn('Set remote/create answer error:', e);
            }
          }
        }
        break;
      }

      case 'webrtc_answer': {
        if (msg.senderId !== userId && peerConnectionRef.current) {
          try {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } catch (e) {
            console.warn('Set answer remote description error:', e);
          }
        }
        break;
      }

      case 'webrtc_ice': {
        if (msg.senderId !== userId && peerConnectionRef.current && msg.candidate) {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.warn('Add ICE candidate error:', e);
          }
        }
        break;
      }

      // Legacy Video Frame Relay Receiver
      case 'relay_video_frame': {
        if (msg.senderId !== userId) {
          setRemoteFrameData(msg.frame);
          setRemoteAudioLevel(prev => Math.max(10, (prev + 5) % 80));
        }
        break;
      }

      // Legacy Audio Chunk Receiver (decode & play via Web Audio context)
      case 'relay_audio_chunk': {
        if (msg.senderId !== userId && msg.audioData) {
          try {
            const ctx = audioContextRef.current || getSafeAudioContext();
            if (ctx) {
              unlockAudio(ctx);
              const binary = atob(msg.audioData);
              const len = binary.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              ctx.decodeAudioData(bytes.buffer, (buffer) => {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start();
                setRemoteAudioLevel(55);
                setTimeout(() => setRemoteAudioLevel(0), 200);
              }, () => {});
            }
          } catch (e) {}
        }
        break;
      }
    }
  }, [createPeerConnection, effectiveStreamMode, localStream, sendWS, stopMedia, userId]);

  return {
    localStream,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isVideoOff,
    cameraFacing,
    activeCall,
    callDuration,
    effectiveStreamMode,
    remoteFrameData,
    localAudioLevel,
    remoteAudioLevel,
    connectionQuality,
    mediaError,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    handleWSMessage,
  };
}
