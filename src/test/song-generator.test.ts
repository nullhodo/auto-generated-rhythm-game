import { describe, expect, it } from "vitest";
import { generateSong, midiToFreq } from "../audio/song-generator";

describe("Song Generator Tests", () => {
  it("should generate valid song structure and notes", () => {
    const song = generateSong();

    // BPMの範囲検証
    expect(song.bpm).toBeGreaterThanOrEqual(140);
    expect(song.bpm).toBeLessThanOrEqual(175);

    // メタデータ（キー・コード進行）の検証
    expect(song.meta.keyName).toBeTruthy();
    expect(song.meta.scaleName).toBe("Natural Minor");
    expect(song.meta.chordProgression).toContain("→");
    expect(song.meta.progressionPattern).toBeTruthy();

    // 演奏時間検証 (32小節分)
    expect(song.songEndTime).toBeGreaterThan(0);

    // イベント配列の存在
    expect(song.events.length).toBeGreaterThan(0);

    // 時間順に昇順ソートされているか検証
    for (let i = 1; i < song.events.length; i++) {
      expect(song.events[i].time).toBeGreaterThanOrEqual(
        song.events[i - 1].time,
      );
    }

    // ノーツイベントとサウンドイベントの整合性
    const notes = song.events.filter((e) => e.type === "note");
    expect(notes.length).toBeGreaterThan(0);

    for (const note of notes) {
      if (note.type === "note") {
        expect(note.lane).toBeGreaterThanOrEqual(0);
        expect(note.lane).toBeLessThanOrEqual(3);
        expect(note.time).toBeGreaterThanOrEqual(0);
        expect(note.time).toBeLessThanOrEqual(song.songEndTime + 100);

        if (note.noteType === "long") {
          expect(note.endTime).toBeGreaterThan(note.time);
        }
      }
    }
  });

  it("should calculate correct frequencies from MIDI note numbers", () => {
    // A4 (MIDI 69) は 440Hz
    expect(Math.round(midiToFreq(69))).toBe(440);
    // A3 (MIDI 57) は 220Hz
    expect(Math.round(midiToFreq(57))).toBe(220);
    // A5 (MIDI 81) は 880Hz
    expect(Math.round(midiToFreq(81))).toBe(880);
  });

  it("should distribute notes evenly across all 4 lanes without bias", () => {
    const song = generateSong();
    const notes = song.events.filter((e) => e.type === "note");
    const laneCounts = [0, 0, 0, 0];
    for (const note of notes) {
      if (note.type === "note") {
        laneCounts[note.lane]++;
      }
    }

    // 4レーン全てにバランスよくノーツが割り当てられていること
    expect(laneCounts[0]).toBeGreaterThan(0);
    expect(laneCounts[1]).toBeGreaterThan(0);
    expect(laneCounts[2]).toBeGreaterThan(0);
    expect(laneCounts[3]).toBeGreaterThan(0);

    // 1つのレーンへの極端な偏りがないことを検証
    const minCount = Math.min(...laneCounts);
    const maxCount = Math.max(...laneCounts);
    expect(minCount).toBeGreaterThan(notes.length * 0.12);
    expect(maxCount).toBeLessThan(notes.length * 0.45);
  });
});
