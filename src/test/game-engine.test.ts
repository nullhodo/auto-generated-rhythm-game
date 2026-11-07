import { describe, expect, it } from "vitest";
import type { AudioEngine } from "../audio/audio-engine";
import {
  GameEngine,
  KEY_TO_LANE,
  evaluateTiming,
} from "../game/game-engine";

describe("Game Engine & Timing Evaluation Tests", () => {
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
  });

  it("should trigger hit sounds via AudioEngine when hitting notes", () => {
    let playedSound: string | null = null;
    let holdTickCalled = false;

    const mockAudioEngine = {
      updateSidechain: () => {},
      playEvent: () => {},
      playHitSound: (judge: string) => {
        playedSound = judge;
      },
      playHoldTick: () => {
        holdTickCalled = true;
      },
      fadeOutAndStop: () => {},
      toggleMute: () => false,
    } as unknown as AudioEngine;

    const engine = new GameEngine(mockAudioEngine, {
      onScoreChange: () => {},
      onComboChange: () => {},
      onMaxComboChange: () => {},
      onGameClear: () => {},
    });

    const layout = {
      width: 800,
      height: 600,
      laneWidth: 80,
      totalLaneWidth: 320,
      laneXStart: 240,
      judgeLineY: 500,
    };

    engine.startTime = performance.now() - 1000;
    // レーン0に通常ノーツを配置 (time: 1000ms = ちょうど現在時刻)
    engine.lanes[0].push({
      time: 1000,
      endTime: 1000,
      lane: 0,
      noteType: "normal",
      processed: false,
      isHit: false,
      isHolding: false,
    });

    engine.handleKeyDown(0, layout);
    expect(playedSound).toBe("PERFECT");

    // レーン1にロングノーツを配置
    engine.lanes[1].push({
      time: 1000,
      endTime: 1500,
      lane: 1,
      noteType: "long",
      processed: false,
      isHit: false,
      isHolding: false,
    });
    engine.handleKeyDown(1, layout);
    expect(engine.lanes[1][0].isHolding).toBe(true);

    // update で holdTick が呼ばれること
    engine.update(performance.now() + 100, layout);
    expect(holdTickCalled).toBe(true);
  });
});
