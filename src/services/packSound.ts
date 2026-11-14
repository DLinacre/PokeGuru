/**
 * Synthesised opening sounds.
 *
 * No audio files ship with the app — every cue is generated with WebAudio so
 * the feature stays small, works offline, and cannot be mistaken for licensed
 * product audio. Everything is gated on the user's mute setting and only ever
 * starts after a user gesture (browser autoplay rules).
 */

type Cue = "tear" | "flip" | "reveal" | "rare" | "complete" | "denied";

let context: AudioContext | null = null;
let muted = true;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
}

export function setSoundEnabled(enabled: boolean): void {
  muted = !enabled;
}

export function isSoundEnabled(): boolean {
  return !muted;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
  }
  return buffer;
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, gain = 0.08): void {
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Play one cue. Safe to call at any time; silently does nothing when muted. */
export function playCue(cue: Cue): void {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  switch (cue) {
    case "tear": {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = noiseBuffer(ctx, 0.32);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.3);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(now);
      return;
    }
    case "flip": {
      tone(ctx, 520, now, 0.07, 0.05);
      return;
    }
    case "reveal": {
      tone(ctx, 660, now, 0.14, 0.06);
      tone(ctx, 880, now + 0.05, 0.16, 0.05);
      return;
    }
    case "rare": {
      tone(ctx, 720, now, 0.18, 0.07);
      tone(ctx, 960, now + 0.09, 0.2, 0.06);
      tone(ctx, 1280, now + 0.18, 0.32, 0.05);
      return;
    }
    case "complete": {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(ctx, frequency, now + index * 0.08, 0.28, 0.05);
      });
      return;
    }
    case "denied": {
      tone(ctx, 220, now, 0.16, 0.05);
      return;
    }
    default:
      return;
  }
}

/** Release the audio context (used when the user leaves the opening screen). */
export function closeAudio(): void {
  if (context) {
    void context.close().catch(() => undefined);
    context = null;
  }
}
