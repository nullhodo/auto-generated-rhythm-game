import type { NoteEvent, SoundEvent } from "../types/game";

interface GeneratedSong {
  events: (SoundEvent | NoteEvent)[];
  bpm: number;
  songEndTime: number;
  rootNote: number;
}

export function midiToFreq(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

const ROOT_NOTES = [57, 59, 60, 62, 64]; // A3, B3, C4, D4, E4
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const CHORDS = [
  [0, 2, 4], // i
  [1, 3, 5], // ii°
  [2, 4, 6], // III
  [3, 5, 7], // iv
  [4, 6, 8], // v
  [5, 7, 9], // VI
  [6, 8, 10], // VII
];
const PROGRESSIONS = [
  [5, 6, 0, 0], // VI - VII - i - i (小室進行風)
  [3, 4, 0, 0], // iv - v - i - i
  [0, 5, 2, 6], // i - VI - III - VII
  [5, 6, 2, 0], // VI - VII - III - i
];

/**
 * 楽曲とノーツ譜面をプロシージャルに自動生成する
 */
export function generateSong(
  rng: () => number = Math.random,
): GeneratedSong {
  const songData: (SoundEvent | NoteEvent)[] = [];
  const bpm = Math.floor(140 + rng() * 35); // 140 - 174
  const beatTime = 60000 / bpm;

  const rootIndex = Math.floor(rng() * ROOT_NOTES.length);
  const rootNote = ROOT_NOTES[rootIndex];

  // 3オクターブ分のスケール展開
  const baseScale = MINOR_INTERVALS.map((i) => rootNote + i);
  const scaleExt = baseScale
    .concat(baseScale.map((i) => i + 12))
    .concat(baseScale.map((i) => i + 24));

  const progIndex = Math.floor(rng() * PROGRESSIONS.length);
  const chosenProg = PROGRESSIONS[progIndex];

  const totalBars = 32;
  const songEndTime = totalBars * 4 * beatTime;
  const lastNoteEndTimes = [0, 0, 0, 0];
  let currentTime = 0;
  let prevMelIndex = 7; // 中央付近の音から開始

  for (let bar = 0; bar < totalBars; bar++) {
    const isChorus = bar >= 20 && bar < 28;
    const isBuildUp = bar >= 16 && bar < 20;

    const degree = chosenProg[bar % 4];
    const chordTones = CHORDS[degree];
    const chordRootMidi = scaleExt[chordTones[0]];

    for (let beat = 0; beat < 4; beat++) {
      const t = currentTime + beat * beatTime;

      // ドラムイベント
      songData.push({
        type: "sound",
        soundType: "kick",
        time: t,
        played: false,
      });

      if (isBuildUp) {
        songData.push({
          type: "sound",
          soundType: "snare",
          time: t,
          played: false,
        });
        songData.push({
          type: "sound",
          soundType: "snare",
          time: t + beatTime / 2,
          played: false,
        });
      } else if (beat === 1 || beat === 3) {
        songData.push({
          type: "sound",
          soundType: "snare",
          time: t,
          played: false,
        });
      }

      songData.push({
        type: "sound",
        soundType: "hat",
        time: t + beatTime / 2,
        played: false,
      });

      // ベース
      songData.push({
        type: "sound",
        soundType: "bass",
        time: t,
        note: chordRootMidi - 24,
        played: false,
      });

      if (isChorus || isBuildUp) {
        songData.push({
          type: "sound",
          soundType: "bass",
          time: t + beatTime / 2,
          note: chordRootMidi - 24,
          played: false,
        });
      }

      // メロディ & ノーツ配置
      let chance = isChorus ? 0.85 : 0.5;
      if (isBuildUp) chance = 0.2;

      for (let sub = 0; sub < 2; sub++) {
        const mt = t + sub * (beatTime / 2);
        const isDownBeat = sub === 0;

        if (rng() < chance) {
          let noteIndex: number;
          if (isDownBeat) {
            const baseTone =
              chordTones[Math.floor(rng() * chordTones.length)];
            const octaveOffset = rng() < 0.5 ? 0 : 7;
            noteIndex = baseTone + octaveOffset;
          } else {
            const step = Math.floor(rng() * 5) - 2; // -2, -1, 0, 1, 2
            noteIndex = prevMelIndex + step;
          }

          noteIndex = Math.max(
            0,
            Math.min(scaleExt.length - 1, noteIndex),
          );
          prevMelIndex = noteIndex;

          const midi = scaleExt[noteIndex];
          songData.push({
            type: "sound",
            soundType: "melody",
            time: mt,
            note: midi,
            played: false,
          });

          // ノーツ生成
          let lane = -1;
          const noteType = rng() < 0.2 ? "long" : "normal";
          const eTime = noteType === "long" ? mt + beatTime : mt;

          for (let k = 0; k < 8; k++) {
            const candidateLane = Math.floor(rng() * 4);
            if (mt > lastNoteEndTimes[candidateLane] + 100) {
              lane = candidateLane;
              break;
            }
          }

          if (lane !== -1) {
            songData.push({
              type: "note",
              time: mt,
              endTime: eTime,
              lane,
              noteType,
              spawned: false,
            });
            lastNoteEndTimes[lane] = eTime;
          }
        }
      }
    }
    currentTime += beatTime * 4;
  }

  // 時間順にソート
  songData.sort((a, b) => a.time - b.time);

  return {
    events: songData,
    bpm,
    songEndTime,
    rootNote,
  };
}
