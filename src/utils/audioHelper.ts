import { getSafeAudioContext, unlockAudio } from './legacyCompatibility';

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private ringOsc1: OscillatorNode | null = null;
  private ringOsc2: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;
  private ringInterval: any = null;
  public isRinging: boolean = false;

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = getSafeAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Play gentle notification sound for chat messages
  public playMessageSound(isSent: boolean = false) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (isSent) {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      } else {
        osc.frequency.setValueAtTime(783.99, now); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6
      }

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch (e) {
      console.warn('Audio play message error:', e);
    }
  }

  // Ringtone for incoming/outgoing call (Standard dual-tone phone cadence)
  public startRingtone(isIncoming: boolean = true) {
    if (this.isRinging) return;
    this.isRinging = true;

    const playRingCycle = () => {
      if (!this.isRinging) return;
      try {
        const ctx = this.getContext();
        if (!ctx) return;
        unlockAudio(ctx);

        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        if (isIncoming) {
          // European / Modern ringtone: 440Hz + 480Hz
          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);
        } else {
          // Outgoing ringback tone: 400Hz + 450Hz
          osc1.frequency.setValueAtTime(400, now);
          osc2.frequency.setValueAtTime(450, now);
        }

        osc1.type = 'sine';
        osc2.type = 'sine';

        // Pulse 1.2s on, then off
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.setValueAtTime(0.18, now + 1.2);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.3);
        osc2.stop(now + 1.3);
      } catch (e) {
        console.warn('Ringtone cycle error:', e);
      }
    };

    playRingCycle();
    this.ringInterval = setInterval(playRingCycle, 3000);
  }

  public stopRingtone() {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (this.ringOsc1) {
      try { this.ringOsc1.stop(); } catch (e) {}
      this.ringOsc1 = null;
    }
    if (this.ringOsc2) {
      try { this.ringOsc2.stop(); } catch (e) {}
      this.ringOsc2 = null;
    }
  }

  // Call connected celebratory double chime
  public playCallConnect() {
    this.stopRingtone();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = now + idx * 0.08;

        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.22);
      });
    } catch (e) {}
  }

  // End call disconnect triple beep
  public playCallEnd() {
    this.stopRingtone();
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [600, 450, 300].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = now + idx * 0.1;

        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.14);
      });
    } catch (e) {}
  }
}

export const soundEffects = new SoundEffectsEngine();
