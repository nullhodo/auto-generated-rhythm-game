import { describe, expect, it, vi } from "vitest";
import type { AudioEngine } from "../audio/audio-engine";
import {
  GameEngine,
  KEY_TO_LANE,
  evaluateTiming,
} from "../game/game-engine";
import type { GameLayout, SongEvent } from "../types/game";

describe("Game Engine & Timing Evaluation Tests", () => {
  const defaultLayout: GameLayout = {
    width: 800,
    height: 600,
    laneWidth: 80,
    totalLaneWidth: 320,
    laneXStart: 240,
    judgeLineY: 500,
  };

  it("should evaluate PERFECT window correctly", () => {
    const perfectOnTime = evaluateTiming(0);
    expect(perfectOnTime).toEqual({
      judge: "PERFECT",
      score: 300,
      color: [0, 229, 255],
    });

    const perfectEarly = evaluateTiming(-44);
    expect(perfectEarly?.judge).toBe("PERFECT");

    const perfectLate = evaluateTiming(44);
    expect(perfectLate?.judge).toBe("PERFECT");
  });

  it("should evaluate GREAT window correctly", () => {
    const greatEarly = evaluateTiming(-45);
    expect(greatEarly).toEqual({
      judge: "GREAT",
      score: 150,
      color: [0, 255, 136],
    });

    const greatLate = evaluateTiming(89);
    expect(greatLate?.judge).toBe("GREAT");
  });

  it("should evaluate GOOD window correctly", () => {
    const goodEarly = evaluateTiming(-90);
    expect(goodEarly).toEqual({
      judge: "GOOD",
      score: 70,
      color: [255, 234, 0],
    });

    const goodLate = evaluateTiming(139);
    expect(goodLate?.judge).toBe("GOOD");
  });

  it("should return null for out-of-range timing", () => {
    expect(evaluateTiming(140)).toBeNull();
    expect(evaluateTiming(-141)).toBeNull();
    expect(evaluateTiming(300)).toBeNull();
  });

  it("should map keys properly to lanes 0-3", () => {
    expect(KEY_TO_LANE.KeyD).toBe(0);
    expect(KEY_TO_LANE.KeyF).toBe(1);
    expect(KEY_TO_LANE.KeyJ).toBe(2);
    expect(KEY_TO_LANE.KeyK).toBe(3);

    expect(KEY_TO_LANE.d).toBe(0);
    expect(KEY_TO_LANE.f).toBe(1);
    expect(KEY_TO_LANE.j).toBe(2);
    expect(KEY_TO_LANE.k).toBe(3);

    expect(KEY_TO_LANE.D).toBe(0);
    expect(KEY_TO_LANE.F).toBe(1);
    expect(KEY_TO_LANE.J).toBe(2);
    expect(KEY_TO_LANE.K).toBe(3);
  });

  it("should ignore invalid lanes in key presses safely", () => {
    const mockAudioEngine = {
      updateSidechain: vi.fn(),
      playEvent: vi.fn(),
      playHitSound: vi.fn(),
      playHoldTick: vi.fn(),
      fadeOutAndStop: vi.fn(),
      toggleMute: vi.fn(),
    } as unknown as AudioEngine;

    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: vi.fn(),
      onComboChange: vi.fn(),
      onMaxComboChange: vi.fn(),
      onGameClear: vi.fn(),
    });

    // 負のレーンや4以上のレーンでエラーを投げないこと
    expect(() => engine.handleKeyDown(-1, defaultLayout)).not.toThrow();
    expect(() => engine.handleKeyDown(4, defaultLayout)).not.toThrow();
    expect(() => engine.handleKeyUp(-1, defaultLayout)).not.toThrow();
    expect(() => engine.handleKeyUp(4, defaultLayout)).not.toThrow();
  });

  it("should track score, combo, and maxCombo correctly upon consecutive hits", () => {
    const scores: number[] = [];
    const combos: number[] = [];
    const maxCombos: number[] = [];

    const mockAudioEngine = {
      updateSidechain: vi.fn(),
      playEvent: vi.fn(),
      playHitSound: vi.fn(),
      playHoldTick: vi.fn(),
      fadeOutAndStop: vi.fn(),
      toggleMute: vi.fn(),
    } as unknown as AudioEngine;

    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: (s) => scores.push(s),
      onComboChange: (c) => combos.push(c),
      onMaxComboChange: (m) => maxCombos.push(m),
      onGameClear: vi.fn(),
    });

    const now = performance.now();
    engine.startTime = now;

    // レーン0に通常ノーツを2つ配置
    engine.lanes[0].push({
      time: 500,
      endTime: 500,
      lane: 0,
      noteType: "normal",
      processed: false,
      isHit: false,
      isHolding: false,
    });
    engine.lanes[0].push({
      time: 900,
      endTime: 900,
      lane: 0,
      noteType: "normal",
      processed: false,
      isHit: false,
      isHolding: false,
    });

    // 1つ目のノーツ打鍵 (PERFECT)
    engine.startTime = performance.now() - 500;
    engine.handleKeyDown(0, defaultLayout);

    expect(engine.score).toBe(300);
    expect(engine.combo).toBe(1);
    expect(engine.maxCombo).toBe(1);

    // 2つ目のノーツ打鍵 (PERFECT)
    engine.startTime = performance.now() - 900;
    engine.handleKeyDown(0, defaultLayout);

    expect(engine.score).toBe(600);
    expect(engine.combo).toBe(2);
    expect(engine.maxCombo).toBe(2);
  });

  it("should mark passed notes as MISS and reset combo", () => {
    let playedSound: string | null = null;
    const comboChanges: number[] = [];

    const mockAudioEngine = {
      updateSidechain: vi.fn(),
      playEvent: vi.fn(),
      playHitSound: (judge: string) => {
        playedSound = judge;
      },
      playHoldTick: vi.fn(),
      fadeOutAndStop: vi.fn(),
      toggleMute: vi.fn(),
    } as unknown as AudioEngine;

    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: vi.fn(),
      onComboChange: (c) => comboChanges.push(c),
      onMaxComboChange: vi.fn(),
      onGameClear: vi.fn(),
    });

    engine.startTime = 0;
    engine.combo = 5;
    engine.maxCombo = 5;

    // 判定ラインを通り過ぎたノーツ (time: 1000ms)
    engine.lanes[2].push({
      time: 1000,
      endTime: 1000,
      lane: 2,
      noteType: "normal",
      processed: false,
      isHit: false,
      isHolding: false,
    });

    // 現在時刻が 1000 + 250 = 1250ms (見逃しMISS閾値 200ms を超過)
    engine.update(1250, defaultLayout);

    expect(engine.combo).toBe(0);
    expect(engine.maxCombo).toBe(5); // 最大コンボは維持
    expect(playedSound).toBe("MISS");
    expect(engine.lanes[2][0].processed).toBe(true);
    expect(comboChanges).toContain(0);

    // さらに時間が経過 (1000 + 550 = 1550ms) で配列からクリーンアップされる
    engine.update(1550, defaultLayout);
    expect(engine.lanes[2].length).toBe(0);
  });

  it("should handle long note full lifecycle (hold, tick, complete, and early release)", () => {
    const playedSounds: string[] = [];
    let holdTickCount = 0;

    const mockAudioEngine = {
      updateSidechain: vi.fn(),
      playEvent: vi.fn(),
      playHitSound: (judge: string) => {
        playedSounds.push(judge);
      },
      playHoldTick: () => {
        holdTickCount++;
      },
      fadeOutAndStop: vi.fn(),
      toggleMute: vi.fn(),
    } as unknown as AudioEngine;

    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: vi.fn(),
      onComboChange: vi.fn(),
      onMaxComboChange: vi.fn(),
      onGameClear: vi.fn(),
    });

    // 1. 正常なロングノーツ完走パターン
    engine.startTime = 0;
    const longNote = {
      time: 1000,
      endTime: 1600,
      lane: 1,
      noteType: "long" as const,
      processed: false,
      isHit: false,
      isHolding: false,
    };
    engine.lanes[1].push(longNote);

    // 開始打鍵 (1000ms時点)
    vi.spyOn(performance, "now").mockReturnValue(1000);
    engine.handleKeyDown(1, defaultLayout);
    expect(longNote.isHolding).toBe(true);
    expect(playedSounds).toContain("PERFECT");

    // ホールド中のtick (1000ms -> 1070ms で 65ms 超過)
    engine.update(1070, defaultLayout);
    expect(holdTickCount).toBeGreaterThanOrEqual(1);

    // 終了タイミングでの適切な離し (1600ms時点)
    vi.spyOn(performance, "now").mockReturnValue(1600);
    engine.handleKeyUp(1, defaultLayout);
    expect(longNote.isHolding).toBe(false);
    expect(longNote.processed).toBe(true);
    expect(longNote.isHit).toBe(true);
    expect(playedSounds).toContain("COMPLETE");

    // 2. 早離しによるMISSパターン
    const earlyReleaseNote = {
      time: 2000,
      endTime: 3000,
      lane: 3,
      noteType: "long" as const,
      processed: false,
      isHit: false,
      isHolding: false,
    };
    engine.lanes[3].push(earlyReleaseNote);

    vi.spyOn(performance, "now").mockReturnValue(2000);
    engine.handleKeyDown(3, defaultLayout);
    expect(earlyReleaseNote.isHolding).toBe(true);

    // 終了時刻3000msより大幅に早い2200msで離してしまう
    vi.spyOn(performance, "now").mockReturnValue(2200);
    engine.handleKeyUp(3, defaultLayout);
    expect(earlyReleaseNote.isHolding).toBe(false);
    expect(earlyReleaseNote.processed).toBe(true);
    expect(earlyReleaseNote.isHit).toBe(false);
    expect(playedSounds).toContain("MISS");
    expect(engine.combo).toBe(0);
  });

  it("should trigger sound events and game clear callback on schedule", () => {
    let playedSoundEvent: SongEvent | null = null;
    let gameClearCalled = false;

    const mockAudioEngine = {
      updateSidechain: vi.fn(),
      playEvent: (ev: SongEvent) => {
        playedSoundEvent = ev;
      },
      playHitSound: vi.fn(),
      playHoldTick: vi.fn(),
      fadeOutAndStop: vi.fn(),
      toggleMute: vi.fn(),
    } as unknown as AudioEngine;

    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: vi.fn(),
      onComboChange: vi.fn(),
      onMaxComboChange: vi.fn(),
      onGameClear: () => {
        gameClearCalled = true;
      },
    });

    engine.startTime = 1000;
    engine.songEndTime = 5000;
    engine.songData = [
      {
        type: "sound",
        time: 500,
        soundType: "kick",
        played: false,
      },
    ];

    // まだ時刻に達していない (currentTime: 400ms)
    engine.update(1400, defaultLayout);
    expect(playedSoundEvent).toBeNull();

    // 時刻に到達 (currentTime: 600ms)
    engine.update(1600, defaultLayout);
    const event = playedSoundEvent as SongEvent | null;
    expect(event).not.toBeNull();
    if (event && event.type === "sound") {
      expect(event.soundType).toBe("kick");
    }

    // 楽曲終了時刻 + 2000ms を超過すると onGameClear が呼ばれる
    engine.update(1000 + 5000 + 2100, defaultLayout);
    expect(gameClearCalled).toBe(true);
  });

  it("should initialize cleanly on start()", () => {
    const mockAudioEngine = {
      updateSidechain: vi.fn(),
      playEvent: vi.fn(),
      playHitSound: vi.fn(),
      playHoldTick: vi.fn(),
      fadeOutAndStop: vi.fn(),
      toggleMute: vi.fn(),
    } as unknown as AudioEngine;

    let receivedMeta = false;
    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: vi.fn(),
      onComboChange: vi.fn(),
      onMaxComboChange: vi.fn(),
      onSongMeta: () => {
        receivedMeta = true;
      },
      onGameClear: vi.fn(),
    });

    engine.start();

    expect(engine.score).toBe(0);
    expect(engine.combo).toBe(0);
    expect(engine.maxCombo).toBe(0);
    expect(engine.songData.length).toBeGreaterThan(0);
    expect(engine.bpm).toBeGreaterThan(0);
    expect(engine.songEndTime).toBeGreaterThan(0);
    expect(receivedMeta).toBe(true);
  });
});
