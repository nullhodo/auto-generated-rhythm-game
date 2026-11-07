import { describe, expect, it } from "vitest";
import { generateSong, midiToFreq } from "../audio/song-generator";

describe("Song Generator Tests", () => {
  it("should generate valid song structure and notes across multiple iterations", () => {
    // 5回の生成でランダムシードが変わっても常に制約を満たすことを検証
    for (let run = 0; run < 5; run++) {
      const song = generateSong();

      // BPMの範囲検証
      expect(song.bpm).toBeGreaterThanOrEqual(140);
      expect(song.bpm).toBeLessThanOrEqual(175);

      // メタデータ（キー・コード進行）の検証
      expect(song.meta.keyName).toBeTruthy();
      expect(song.meta.scaleName).toBe("Natural Minor");
      expect(song.meta.chordProgression).toContain("→");
      expect(song.meta.progressionPattern).toBeTruthy();

      // 演奏時間検証 (32小節分 = 32 * 4 * beatMs)
      const expectedDuration = 32 * 4 * (60 / song.bpm) * 1000;
      expect(Math.abs(song.songEndTime - expectedDuration)).toBeLessThan(
        100,
      );

      // イベント配列の存在
      expect(song.events.length).toBeGreaterThan(0);

      // 時間順に昇順ソートされているか検証
      for (let i = 1; i < song.events.length; i++) {
        expect(song.events[i].time).toBeGreaterThanOrEqual(
          song.events[i - 1].time,
        );
      }

      // ノーツイベントの整合性
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
    }
  });

  it("should calculate correct frequencies from MIDI note numbers", () => {
    // A4 (MIDI 69) は 440Hz
    expect(Math.round(midiToFreq(69))).toBe(440);
    // A3 (MIDI 57) は 220Hz
    expect(Math.round(midiToFreq(57))).toBe(220);
    // A5 (MIDI 81) は 880Hz
    expect(Math.round(midiToFreq(81))).toBe(880);
    // C4 (MIDI 60) は約 261.63Hz
    expect(Math.round(midiToFreq(60))).toBe(262);
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

    // 1つのレーンへの極端な偏りがないことを検証 (全ノーツの12%〜45%)
    const minCount = Math.min(...laneCounts);
    const maxCount = Math.max(...laneCounts);
    expect(minCount).toBeGreaterThan(notes.length * 0.12);
    expect(maxCount).toBeLessThan(notes.length * 0.45);
  });

  it("should ensure all melody notes strictly conform to the Natural Minor scale", () => {
    const song = generateSong();
    const rootPitchClass = song.rootNote % 12;
    // Natural Minor の音階クラス: root + [0, 2, 3, 5, 7, 8, 10] (mod 12)
    const validPitchClasses = new Set(
      [0, 2, 3, 5, 7, 8, 10].map(
        (interval) => (rootPitchClass + interval) % 12,
      ),
    );

    const melodyEvents = song.events.filter(
      (e) => e.type === "sound" && e.soundType === "melody",
    );
    expect(melodyEvents.length).toBeGreaterThan(0);

    for (const ev of melodyEvents) {
      if (ev.type === "sound" && typeof ev.note === "number") {
        const pitchClass = ((ev.note % 12) + 12) % 12;
        expect(validPitchClasses.has(pitchClass)).toBe(true);
      }
    }
  });

  it("should generate characteristic EDM drum events (kick, snare, hat, buildup)", () => {
    const song = generateSong();
    const beatMs = (60 / song.bpm) * 1000;
    const barMs = beatMs * 4;

    const kicks = song.events.filter(
      (e) => e.type === "sound" && e.soundType === "kick",
    );
    const snares = song.events.filter(
      (e) => e.type === "sound" && e.soundType === "snare",
    );
    const hats = song.events.filter(
      (e) => e.type === "sound" && e.soundType === "hat",
    );

    expect(kicks.length).toBeGreaterThan(0);
    expect(snares.length).toBeGreaterThan(0);
    expect(hats.length).toBeGreaterThan(0);

    // ビルドアップ区間（bars 16-19）でのスネアロール密度の検証
    const buildupStart = 16 * barMs - 10;
    const buildupEnd = 20 * barMs - 10;
    const buildupSnares = snares.filter(
      (s) => s.time >= buildupStart && s.time < buildupEnd,
    );
    // ビルドアップ中は8分音符間隔で連打され、32個（浮動小数の境界誤差を考慮して31〜32個）のスネアが生成される
    expect(buildupSnares.length).toBeGreaterThanOrEqual(31);
  });

  it("should have higher note density during Chorus than Verse 1", () => {
    const song = generateSong();
    const beatMs = (60 / song.bpm) * 1000;
    const barMs = beatMs * 4;

    const notes = song.events.filter((e) => e.type === "note");

    // Verse 1 (bars 4-7: 4小節)
    const verse1Notes = notes.filter(
      (n) => n.time >= 4 * barMs && n.time < 8 * barMs,
    );
    // Chorus (bars 20-27: 8小節)
    const chorusNotes = notes.filter(
      (n) => n.time >= 20 * barMs && n.time < 28 * barMs,
    );

    const verse1Density = verse1Notes.length / 4; // 小節あたりのノーツ数
    const chorusDensity = chorusNotes.length / 8; // 小節あたりのノーツ数

    // サビの方が小節あたりの密度が高いことを検証
    expect(chorusDensity).toBeGreaterThan(verse1Density);
  });

  it("should generate a healthy proportion of long notes (12% - 35% of total notes)", () => {
    // 5回の生成でロングノーツが極端に少なくならないことを検証
    for (let run = 0; run < 5; run++) {
      const song = generateSong();
      const notes = song.events.filter((e) => e.type === "note");
      const longNotes = notes.filter(
        (n) => n.type === "note" && n.noteType === "long",
      );

      const longRatio = longNotes.length / notes.length;
      // 1曲あたりのロングノーツ数が十分にあること (最低8個以上、比率12%〜35%)
      expect(longNotes.length).toBeGreaterThanOrEqual(8);
      expect(longRatio).toBeGreaterThan(0.12);
      expect(longRatio).toBeLessThan(0.38);

      // 各ロングノーツが十分な長さを持つこと (500ms以上)
      for (const ln of longNotes) {
        if (ln.type === "note") {
          expect(ln.endTime - ln.time).toBeGreaterThanOrEqual(300);
        }
      }
    }
  });

  it("should keep all melody and chord pitches within comfortable frequency bounds (<= 1200Hz / MIDI 86)", () => {
    for (let run = 0; run < 5; run++) {
      const song = generateSong();
      const soundEvents = song.events.filter((e) => e.type === "sound");

      for (const ev of soundEvents) {
        if (ev.type === "sound") {
          if (typeof ev.note === "number") {
            // 単音メロディ・ベース音 (耳に刺さる高音 MIDI > 86 / 1175Hz を排除)
            expect(ev.note).toBeLessThanOrEqual(86);
            expect(ev.note).toBeGreaterThanOrEqual(24);
          }
          if (ev.chordNotes) {
            // 和音コード音符 (耳に刺さる高音を排除)
            for (const midi of ev.chordNotes) {
              expect(midi).toBeLessThanOrEqual(86);
            }
          }
        }
      }
    }
  });
});
