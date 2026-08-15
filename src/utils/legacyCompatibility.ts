import { DeviceDiagnostics } from '../types';

/**
 * Diagnostics and polyfills specifically designed for iOS 9.3.5, iPad mini 2,
 * and older Safari/WebKit engines.
 */

export function runDeviceDiagnostics(): DeviceDiagnostics {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIpad = /iPad/.test(ua) || (isiOS && Math.max(window.screen.width, window.screen.height) >= 1024);

  // Extract iOS version
  let iosVersion: string | null = null;
  const match = ua.match(/OS (\d+)_?(\d+)?_?(\d+)?/);
  if (match && match[1]) {
    iosVersion = `${match[1]}.${match[2] || 0}.${match[3] || 0}`;
  }

  // Detect older Safari (iOS <= 12, Safari < 14, or WebKit without full WebRTC)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  const safariVersionMatch = ua.match(/Version\/(\d+(\.\d+)?)/);
  const safariVersion = safariVersionMatch ? parseFloat(safariVersionMatch[1]) : null;
  const isOlderSafari = (isiOS && (iosVersion ? parseFloat(iosVersion) < 13.0 : true)) ||
    (isSafari && (safariVersion !== null ? safariVersion < 14.0 : false)) ||
    (!((window as any).RTCPeerConnection && (navigator?.mediaDevices && navigator.mediaDevices.getUserMedia)));

  // iPad mini 2 detection heuristics (A7 chip, 1024x768 logical viewport, Retina pixel ratio 2)
  const isRetina = typeof window !== 'undefined' && window.devicePixelRatio >= 2;
  const isTabletDims = typeof window !== 'undefined' && (
    (window.screen.width === 768 && window.screen.height === 1024) ||
    (window.screen.width === 1024 && window.screen.height === 768)
  );
  const isiPadMini2Suspected = isIpad && isRetina && (iosVersion?.startsWith('9.') || iosVersion?.startsWith('10.') || iosVersion?.startsWith('12.') || isTabletDims);

  const hasGetUserMedia = !!(
    (navigator?.mediaDevices && navigator.mediaDevices.getUserMedia) ||
    (navigator as any)?.webkitGetUserMedia ||
    (navigator as any)?.mozGetUserMedia ||
    (navigator as any)?.getUserMedia
  );

  const hasRTCPeerConnection = !!(
    (window as any).RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection
  );

  const hasAudioContext = !!(
    (window as any).AudioContext ||
    (window as any).webkitAudioContext
  );

  const hasMediaRecorder = typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined';
  const hasWebSocket = typeof WebSocket !== 'undefined';
  const hasCanvas = typeof document !== 'undefined' && !!document.createElement('canvas').getContext;

  // On iOS <= 12 or when RTCPeerConnection is missing or older Safari, recommended mode is legacy relay
  const isLegacyIos = isiOS && (iosVersion ? parseFloat(iosVersion) < 13.0 : false);
  const recommendedMode: 'webrtc' | 'legacy_relay' = (!hasRTCPeerConnection || isLegacyIos || isiPadMini2Suspected || isOlderSafari) ? 'legacy_relay' : 'webrtc';

  return {
    userAgent: ua,
    isiPad: isIpad,
    isiOS,
    iosVersion,
    isiPadMini2Suspected,
    isOlderSafari,
    autoEnabledAudioCall: isOlderSafari || isiPadMini2Suspected || isLegacyIos,
    hasGetUserMedia,
    hasRTCPeerConnection,
    hasAudioContext,
    hasMediaRecorder,
    hasWebSocket,
    hasCanvas,
    recommendedMode,
  };
}

/**
 * Ensures navigator.mediaDevices.getUserMedia is available via polyfill
 */
export function polyfillGetUserMedia(): void {
  if (typeof navigator === 'undefined') return;

  if (!navigator.mediaDevices) {
    (navigator as any).mediaDevices = {};
  }

  if (!navigator.mediaDevices.getUserMedia) {
    const legacyGUM = (navigator as any).webkitGetUserMedia ||
                      (navigator as any).mozGetUserMedia ||
                      (navigator as any).getUserMedia;

    if (legacyGUM) {
      navigator.mediaDevices.getUserMedia = function (constraints: MediaStreamConstraints): Promise<MediaStream> {
        return new Promise((resolve, reject) => {
          legacyGUM.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }
}

/**
 * Creates an AudioContext safely with webkitAudioContext fallback
 */
export function getSafeAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx();
    return ctx;
  } catch (err) {
    console.warn('Failed to create AudioContext:', err);
    return null;
  }
}

let audioUnlocked = false;

/**
 * Unlocks iOS Safari AudioContext and HTML5 Audio upon first touch
 */
export function unlockAudio(ctx?: AudioContext | null): Promise<boolean> {
  if (audioUnlocked && ctx?.state === 'running') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    try {
      // 1. Resume AudioContext
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // 2. Play silent buffer
      if (ctx) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      audioUnlocked = true;
      resolve(true);
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Helper to encode Float32Array PCM samples to 16-bit PCM WAV base64
 * for iOS 9.3.5 / legacy audio streaming where MediaRecorder is missing
 */
export function pcmToWavBase64(samples: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels (Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio data
  let index = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    index += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Automatically initializes and enables compatibility mode for older Safari / iOS
 */
export function autoEnableOlderSafariCompatibility(): {
  isAutoEnabled: boolean;
  diag: DeviceDiagnostics;
} {
  polyfillGetUserMedia();
  const diag = runDeviceDiagnostics();
  const ctx = getSafeAudioContext();

  if (typeof window !== 'undefined') {
    const unlockHandler = () => {
      unlockAudio(ctx);
    };

    ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { once: false, passive: true });
    });
  }

  return {
    isAutoEnabled: diag.autoEnabledAudioCall,
    diag,
  };
}

