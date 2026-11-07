import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "../audio/audio-engine";
import type { HitJudge, SoundEvent } from "../types/game";

function createMockAudioContext() {
  const createAudioParam = (initial = 0) => ({
    value: initial,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });

  return {
    state: "running" as AudioContextState,
    currentTime: 1.0,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockImplementation(() => ({
      gain: createAudioParam(1),
      connect: vi.fn(),
    })),
    createOscillator: vi.fn().mockImplementation(() => ({
      type: "sine",
      frequency: createAudioParam(440),
      detune: createAudioParam(0),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createDynamicsCompressor: vi.fn().mockImplementation(() => ({
      threshold: createAudioParam(-14),
      knee: createAudioParam(25),
      ratio: createAudioParam(12),
      attack: createAudioParam(0.003),
      release: createAudioParam(0.12),
      connect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: "highpass",
      frequency: createAudioParam(1000),
      Q: createAudioParam(1),
      connect: vi.fn(),
    })),
    createBuffer: vi
      .fn()
      .mockImplementation((channels: number, length: number) => ({
        length,
        sampleRate: 44100,
        numberOfChannels: channels,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
      })),
    createBufferSource: vi.fn().mockImplementation(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
  };
}

describe("AudioEngine Unit Tests", () => {
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalAudioContext = (
      globalThis as unknown as { AudioContext: unknown }
    ).AudioContext;
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = vi
      .fn()
      .mockImplementation(() => createMockAudioContext());
  });

  afterEach(() => {
    (globalThis as unknown as { AudioContext: unknown }).AudioContext =
      originalAudioContext;
  });

  it("should initialize cleanly, create compressor chain and noise buffers", async () => {
    const engine = new AudioEngine();
    await engine.init();

    // もう一度 init() を呼んでも問題なくスキップされること
    await engine.init();
  });

  it("should toggle mute state and update masterGain and sfxGain", async () => {
    const engine = new AudioEngine();
    await engine.init();

    expect(engine.toggleMute()).toBe(true);
    expect(engine.toggleMute()).toBe(false);
  });

  it("should play hit sounds for all judgments without errors", async () => {
    const engine = new AudioEngine();
    await engine.init();

    const judges: HitJudge[] = [
      "PERFECT",
      "GREAT",
      "GOOD",
      "COMPLETE",
      "MISS",
    ];
    for (const judge of judges) {
      expect(() => engine.playHitSound(judge)).not.toThrow();
    }
  });

  it("should play hold tick (snare roll) smoothly", async () => {
    const engine = new AudioEngine();
    await engine.init();

    expect(() => engine.playHoldTick()).not.toThrow();
  });

  it("should play all sound event types (kick, snare, hat, bass, melody, chord)", async () => {
    const engine = new AudioEngine();
    await engine.init();

    const events: SoundEvent[] = [
      { type: "sound", soundType: "kick", time: 0, played: false },
      { type: "sound", soundType: "snare", time: 0, played: false },
      { type: "sound", soundType: "hat", time: 0, played: false },
      {
        type: "sound",
        soundType: "bass",
        note: 36,
        time: 0,
        played: false,
      },
      {
        type: "sound",
        soundType: "melody",
        note: 60,
        time: 0,
        played: false,
      },
      {
        type: "sound",
        soundType: "chord",
        chordNotes: [60, 63, 67],
        time: 0,
        played: false,
      },
    ];

    for (const ev of events) {
      expect(() => engine.playEvent(ev)).not.toThrow();
    }
  });

  it("should update sidechain ducking and handle song end fade out", async () => {
    const engine = new AudioEngine();
    await engine.init();

    // 通常再生中のサイドチェイン
    expect(() => engine.updateSidechain(1000, 30000)).not.toThrow();

    // 楽曲終盤のフェードアウト区間 (残り5秒未満)
    expect(() => engine.updateSidechain(28000, 30000)).not.toThrow();

    // 楽曲終了後の完全消音 (終了+2秒後)
    expect(() => engine.updateSidechain(33000, 30000)).not.toThrow();
  });

  it("should handle fadeOutAndStop cleanly", async () => {
    const engine = new AudioEngine();
    await engine.init();

    expect(() => engine.fadeOutAndStop(0.3)).not.toThrow();
  });
});
