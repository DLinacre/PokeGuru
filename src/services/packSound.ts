/**
 * Synthesised opening sounds.
 *
 * No audio files ship with the app — every cue is generated with WebAudio so
 * the feature stays small, works offline, and cannot be mistaken for licensed
 * product audio. Everything is gated on the user's mute setting and only ever
 * starts after a user gesture (browser autoplay rules).
 *
 * The cue set is deliberately tiered. Flipping a common card is a soft tick;
 * pulling a chase card stacks a rising arpeggio, a shimmer and a noise whoosh
 * so rarity is audible before the artwork has even registered. Cues are also
 * throttled and overlap-capped, because the reveal is designed to be spammed.
 */

type Cue = "tear" | "flip" | "reveal" | "rare" | "hype" | "complete" | "denied";

/** How exciting a pull is, derived from its rarity tier. */
export type CueIntensity = "low" | "mid" | "high";

let context: AudioContext | null = null;
let muted = true;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

/** Timestamps of recent cues, used to keep spamming from turning into mush. */
const recent: number[] = [];
const MAX_CUES_PER_SECOND = 14;
const MIN_GAP_MS: Partial<Record<Cue, number>> = {
  // Repeated rare fanfares are the most tiring, so they get the widest gap.
  rare: 110,
  hype: 160,
  complete: 200,
  tear: 120,
  flip: 35,
  reveal: 60,
  denied: 400,
};

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (!master) {
    // One bus for every cue, so the whole experience can be trimmed at once
    // (and so a phone speaker is never driven into clipping by a fanfare).
    master = context.createGain();
    master.gain.value = 0.9;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(context.destination);
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  return context;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const frames = Math.floor(ctx.sampleRate * 1.2);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) {
    // Gentle decay so the same buffer works for short ticks and long whooshes.
    data[index] = (Math.random() * 2 - 1) * (1 - index / frames);
  }
  noise = buffer;
  return buffer;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gain = 0.08,
  type: OscillatorType = "sine",
  glideTo?: number,
): void {
  const oscillator = ctx.createOscillator();
  const volume = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      glideTo,
      start + duration,
    );
  }
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume).connect(master ?? ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Filtered noise sweep — the "shhh" behind sparks and wrapper tears. */
function whoosh(
  ctx: AudioContext,
  start: number,
  duration: number,
  from: number,
  to: number,
  gain = 0.12,
  type: BiquadFilterType = "bandpass",
): void {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const volume = ctx.createGain();
  source.buffer = noiseBuffer(ctx);
  filter.type = type;
  filter.Q.value = type === "bandpass" ? 1.2 : 0.7;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + duration);
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source
    .connect(filter)
    .connect(volume)
    .connect(master ?? ctx.destination);
  source.start(start);
  source.stop(start + duration);
}

/** Rising sparkle, used for chase pulls. */
function sparkle(
  ctx: AudioContext,
  start: number,
  notes: number[],
  gain = 0.05,
  spacing = 0.055,
): void {
  notes.forEach((frequency, index) => {
    tone(ctx, frequency, start + index * spacing, 0.22, gain, "triangle");
  });
}

export function setSoundEnabled(enabled: boolean): void {
  muted = !enabled;
  if (muted) recent.length = 0;
}

export function isSoundEnabled(): boolean {
  return !muted;
}

/**
 * Rate limit. Returns false when the cue should be dropped, so a fast reveal
 * stays crisp instead of clipping into a wall of noise.
 */
function allow(cue: Cue): boolean {
  const time = nowMs();
  while (recent.length && time - recent[0] > 1000) recent.shift();
  if (recent.length >= MAX_CUES_PER_SECOND) return false;
  const gap = MIN_GAP_MS[cue];
  if (gap) {
    const last = recent[recent.length - 1];
    if (last !== undefined && time - last < gap) return false;
  }
  recent.push(time);
  return true;
}

/**
 * Play one cue. Safe to call at any time; silently does nothing when muted or
 * when the user is spamming faster than the audio can stay musical.
 */
export function playCue(cue: Cue): void {
  if (muted) return;
  if (!allow(cue)) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  switch (cue) {
    case "tear": {
      whoosh(ctx, now, 0.34, 1800, 380, 0.16);
      whoosh(ctx, now + 0.02, 0.18, 5200, 2400, 0.05, "highpass");
      return;
    }
    case "flip": {
      tone(ctx, 520, now, 0.06, 0.04, "triangle", 660);
      return;
    }
    case "reveal": {
      tone(ctx, 660, now, 0.13, 0.05, "triangle");
      tone(ctx, 880, now + 0.05, 0.15, 0.04, "triangle");
      return;
    }
    case "rare": {
      // Fanfare: rising major arpeggio + shimmer + a short sparkle tail.
      sparkle(ctx, now, [587.33, 739.99, 880, 1174.66], 0.055);
      tone(ctx, 293.66, now, 0.32, 0.05, "sawtooth");
      whoosh(ctx, now, 0.36, 900, 5200, 0.07, "highpass");
      return;
    }
    case "hype": {
      // Top-tier pull: bigger, longer, with a sub-bass thump and bell tail.
      const start = now;
      whoosh(ctx, start, 0.5, 400, 7000, 0.1, "highpass");
      tone(ctx, 110, start, 0.26, 0.12, "sine", 70);
      sparkle(
        ctx,
        start + 0.03,
        [523.25, 659.25, 783.99, 1046.5, 1318.51],
        0.06,
        0.05,
      );
      sparkle(ctx, start + 0.3, [1567.98, 2093.0], 0.04, 0.06);
      tone(ctx, 2093, start + 0.42, 0.5, 0.03, "sine");
      return;
    }
    case "complete": {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(ctx, frequency, now + index * 0.07, 0.26, 0.045, "triangle");
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

/**
 * Cheer for a whole batch, scaled by how good it was: a run of commons gets a
 * light chime, a multi-rare run gets the full fanfare.
 */
export function playBatchCheer(intensity: CueIntensity): void {
  if (muted) return;
  if (intensity === "low") {
    playCue("complete");
    return;
  }
  playCue(intensity === "high" ? "hype" : "rare");
}

/** Release the audio context (used when the user leaves the opening screen). */
export function closeAudio(): void {
  if (context) {
    void context.close().catch(() => undefined);
    context = null;
    master = null;
    noise = null;
  }
  recent.length = 0;
}
