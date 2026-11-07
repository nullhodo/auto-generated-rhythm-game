import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
  bpmAtom,
  comboAtom,
  gameStateAtom,
  isMutedAtom,
  maxComboAtom,
  scoreAtom,
  songMetaAtom,
} from "../state/atoms";
import type { SongMeta } from "../types/game";

describe("Jotai Atoms State Tests", () => {
  it("should initialize all atoms with appropriate default values", () => {
    const store = createStore();

    expect(store.get(gameStateAtom)).toBe("START");
    expect(store.get(scoreAtom)).toBe(0);
    expect(store.get(comboAtom)).toBe(0);
    expect(store.get(maxComboAtom)).toBe(0);
    expect(store.get(bpmAtom)).toBe(145);
    expect(store.get(isMutedAtom)).toBe(false);
    expect(store.get(songMetaAtom)).toBeNull();
  });

  it("should handle game state transitions cleanly", () => {
    const store = createStore();

    // START -> PLAYING
    store.set(gameStateAtom, "PLAYING");
    expect(store.get(gameStateAtom)).toBe("PLAYING");

    // PLAYING -> RESULT
    store.set(gameStateAtom, "RESULT");
    expect(store.get(gameStateAtom)).toBe("RESULT");

    // RESULT -> START
    store.set(gameStateAtom, "START");
    expect(store.get(gameStateAtom)).toBe("START");
  });

  it("should update score and combo states accurately", () => {
    const store = createStore();

    store.set(scoreAtom, 1500);
    expect(store.get(scoreAtom)).toBe(1500);

    store.set(comboAtom, 12);
    store.set(maxComboAtom, 25);
    expect(store.get(comboAtom)).toBe(12);
    expect(store.get(maxComboAtom)).toBe(25);
  });

  it("should store and retrieve current song metadata", () => {
    const store = createStore();

    const sampleMeta: SongMeta = {
      keyName: "A Minor",
      scaleName: "Natural Minor",
      progressionPattern: "VI - VII - i - i (小室進行風)",
      chordProgression: "F → G → Am → Am",
    };

    store.set(songMetaAtom, sampleMeta);
    const retrieved = store.get(songMetaAtom);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.keyName).toBe("A Minor");
    expect(retrieved?.progressionPattern).toContain("小室進行風");
    expect(retrieved?.chordProgression).toBe("F → G → Am → Am");
  });

  it("should toggle mute state", () => {
    const store = createStore();

    expect(store.get(isMutedAtom)).toBe(false);
    store.set(isMutedAtom, true);
    expect(store.get(isMutedAtom)).toBe(true);
    store.set(isMutedAtom, false);
    expect(store.get(isMutedAtom)).toBe(false);
  });
});
