import type { NoteEvent, SongMeta, SoundEvent } from "../types/game";

interface GeneratedSong {
  events: (SoundEvent | NoteEvent)[];
  bpm: number;
  songEndTime: number;
  rootNote: number;
  meta: SongMeta;
}

export function midiToFreq(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

const ROOT_NOTES = [57, 59, 60, 62, 64]; // A3, B3, C4, D4, E4

const KEY_DETAILS: Record<number, { keyName: string; chords: string[] }> =
  {
    57: {
      keyName: "A Minor",
      chords: ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
    },
    59: {
      keyName: "B Minor",
      chords: ["Bm", "C#dim", "D", "Em", "F#m", "G", "A"],
    },
    60: {
      keyName: "C Minor",
      chords: ["Cm", "Ddim", "Eb", "Fm", "Gm", "Ab", "Bb"],
    },
    62: {
      keyName: "D Minor",
      chords: ["Dm", "Edim", "F", "Gm", "Am", "Bb", "C"],
    },
    64: {
      keyName: "E Minor",
      chords: ["Em", "F#dim", "G", "Am", "Bm", "C", "D"],
    },
  };

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

const PROGRESSION_INFOS = [
  { pattern: [5, 6, 0, 0], label: "VI - VII - i - i (小室進行風)" },
  { pattern: [3, 4, 0, 0], label: "iv - v - i - i (EDM定番進行)" },
  { pattern: [0, 5, 2, 6], label: "i - VI - III - VII (王道進行)" },
  { pattern: [5, 6, 2, 0], label: "VI - VII - III - i (カノン派生進行)" },
];

/**
 * 4小節（32サブビート = 8分音符32個分）からなる1つのフレーズ単位
 */
interface PhraseNote {
  subBeat: number; // 0..31
  scaleToneIndex: number; // 3オクターブスケール内のインデックス (0..20)
  noteType: "normal" | "long";
  lane: number; // 0..3
}

/**
 * 4小節のメロディフレーズ（モチーフ）をプロシージャル生成
 */
function createMelodyPhrase(
  rng: () => number,
  progression: number[],
  scaleLength: number,
  isBridge = false,
): PhraseNote[] {
  const notes: PhraseNote[] = [];
  let currentTone = isBridge ? 9 : 7; // 中域からスタート
  let currentLane = Math.floor(rng() * 4);

  // 4小節 (小節0..3)
  for (let bar = 0; bar < 4; bar++) {
    const degree = progression[bar % 4];
    const chordTones = CHORDS[degree];

    // 小節内のリズムパターン
    // 8つのサブビート (8分音符単位: 0..7)
    // キャッチーなEDMリズム（強拍とシンコペーション）
    for (let sub = 0; sub < 8; sub++) {
      const isDownBeat = sub === 0 || sub === 4;
      const isSyncopation = sub === 2 || sub === 6 || sub === 7;

      // 音を鳴らす確率
      let playChance = isDownBeat ? 0.9 : isSyncopation ? 0.65 : 0.25;
      if (isBridge) playChance *= 0.75; // ブリッジは少し間引いて静けさを演出

      if (rng() < playChance) {
        if (isDownBeat) {
          // 強拍はコードトーンを狙って和音感を安定させる
          const baseChordTone =
            chordTones[Math.floor(rng() * chordTones.length)];
          const octave = rng() < 0.6 ? 7 : 14;
          currentTone = baseChordTone + octave;
        } else {
          // 弱拍・裏拍は順次進行（近くの音へステップ移動）
          const step = Math.floor(rng() * 5) - 2; // -2, -1, 0, 1, 2
          currentTone += step;
        }

        // 音域制限
        currentTone = Math.max(2, Math.min(scaleLength - 3, currentTone));

        // ノーツ種別 (ロングノーツは小節の終盤や強拍にアクセントとして出現)
        const isLong = (sub === 0 || sub === 4) && rng() < 0.22;
        const noteType: "normal" | "long" = isLong ? "long" : "normal";

        // レーン選択 (音高の上下に合わせて自然に移動)
        const laneStep = rng() < 0.5 ? (rng() < 0.5 ? -1 : 1) : 0;
        currentLane = Math.max(0, Math.min(3, currentLane + laneStep));

        notes.push({
          subBeat: bar * 8 + sub,
          scaleToneIndex: currentTone,
          noteType,
          lane: currentLane,
        });
      }
    }
  }

  return notes;
}

/**
 * 楽曲とノーツ譜面をプロシージャルに自動生成する
 * 1曲あたりに核となる「フレーズA（メインリフ）」と「フレーズB（ブリッジ）」を定義し、
 * 曲の構成（Aメロ → Aメロ変奏 → Bメロ → ビルドアップ → サビでのオクターブ大復活）に沿って反復・展開する
 */
export function generateSong(
  rng: () => number = Math.random,
): GeneratedSong {
  const songData: (SoundEvent | NoteEvent)[] = [];
  const bpm = Math.floor(140 + rng() * 35); // 140 - 174
  const beatTime = 60000 / bpm;
  const subBeatTime = beatTime / 2; // 8分音符の長さ

  const rootIndex = Math.floor(rng() * ROOT_NOTES.length);
  const rootNote = ROOT_NOTES[rootIndex];

  // 3オクターブ分のスケール展開
  const baseScale = MINOR_INTERVALS.map((i) => rootNote + i);
  const scaleExt = baseScale
    .concat(baseScale.map((i) => i + 12))
    .concat(baseScale.map((i) => i + 24));

  const progIndex = Math.floor(rng() * PROGRESSION_INFOS.length);
  const chosenProgInfo = PROGRESSION_INFOS[progIndex];
  const chosenProg = chosenProgInfo.pattern;

  // キーとコード進行のメタデータ構築
  const keyDetail = KEY_DETAILS[rootNote] || {
    keyName: "A Minor",
    chords: ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
  };
  const chordNames = chosenProg.map(
    (deg) => keyDetail.chords[deg] || `deg-${deg}`,
  );
  const chordProgressionStr = chordNames.join(" → ");

  const meta: SongMeta = {
    keyName: keyDetail.keyName,
    scaleName: "Natural Minor",
    progressionPattern: chosenProgInfo.label,
    chordProgression: chordProgressionStr,
  };

  // ★ 1曲の核となる「フレーズ」を定義 ★
  // Phrase A: メインテーマ（Verseとサビで反復されるキラーリフ）
  const phraseA = createMelodyPhrase(
    rng,
    chosenProg,
    scaleExt.length,
    false,
  );
  // Phrase B: Bメロ用（対比と助走のフレーズ）
  const phraseB = createMelodyPhrase(
    rng,
    chosenProg,
    scaleExt.length,
    true,
  );

  const totalBars = 32;
  const songEndTime = totalBars * 4 * beatTime;
  const lastNoteEndTimes = [0, 0, 0, 0];
  let currentTime = 0;

  for (let bar = 0; bar < totalBars; bar++) {
    const isChorus = bar >= 20 && bar < 28;
    const isBuildUp = bar >= 16 && bar < 20;

    const degree = chosenProg[bar % 4];
    const chordTones = CHORDS[degree];
    const chordRootMidi = scaleExt[chordTones[0]];

    // ドラム・ベース・コードの生成 (各拍)
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
        // ビルドアップ時はスネアが加速ロール
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

      // コード（和音バッキング）: 小節頭およびサビの2拍目
      if (beat === 0 || (isChorus && beat === 2)) {
        const chordMidis = chordTones.map((idx) => scaleExt[idx]);
        songData.push({
          type: "sound",
          soundType: "chord",
          time: t,
          chordNotes: chordMidis,
          played: false,
        });
      }

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
    }

    currentTime += beatTime * 4;
  }

  // ★ フレーズを曲の構成に沿って配置する ★
  // 32小節の構成:
  // - 0..3: Intro (ドラムとベースのみ、ノーツは助走なし)
  // - 4..7: Verse 1 (Phrase A - メインフレーズの提示)
  // - 8..11: Verse 2 (Phrase A - 変奏)
  // - 12..15: Bridge (Phrase B - サビへの助走)
  // - 16..19: Build-up (Phrase A の冒頭モチーフのスタッター連打)
  // - 20..23: Chorus 1 / Drop (Phrase A が1オクターブ上で大復活！)
  // - 24..27: Chorus 2 / Drop (Phrase A' のオクターブ上クライマックス)
  // - 28..31: Outro (Phrase A のフェードアウト余韻)

  const applyPhraseToBars = (
    phrase: PhraseNote[],
    startBar: number,
    octaveOffset = 0,
    variationPitchOffset = 0,
    stutterCount = 0,
  ) => {
    const phraseStartTime = startBar * 4 * beatTime;

    if (stutterCount > 0) {
      // ビルドアップ用: フレーズの最初の2音〜4音を小節ごとに細かく連打
      const leadNotes = phrase.slice(0, 3);
      for (let b = 0; b < 4; b++) {
        const barStart = phraseStartTime + b * 4 * beatTime;
        for (let rep = 0; rep < b + 1; rep++) {
          for (let ni = 0; ni < leadNotes.length; ni++) {
            const pNote = leadNotes[ni];
            const noteTime =
              barStart + rep * (beatTime * 1.5) + ni * subBeatTime;
            const toneIdx = Math.min(
              scaleExt.length - 1,
              pNote.scaleToneIndex + octaveOffset,
            );
            const midi = scaleExt[toneIdx];

            songData.push({
              type: "sound",
              soundType: "melody",
              time: noteTime,
              note: midi,
              played: false,
            });

            // ノーツ追加
            const lane = pNote.lane;
            if (noteTime > lastNoteEndTimes[lane] + 90) {
              songData.push({
                type: "note",
                time: noteTime,
                endTime: noteTime,
                lane,
                noteType: "normal",
                spawned: false,
              });
              lastNoteEndTimes[lane] = noteTime;
            }
          }
        }
      }
      return;
    }

    // 通常のフレーズ展開
    for (const pNote of phrase) {
      const noteTime = phraseStartTime + pNote.subBeat * subBeatTime;
      const duration = pNote.noteType === "long" ? beatTime : 0;
      const endTime = noteTime + duration;

      const rawTone =
        pNote.scaleToneIndex + octaveOffset + variationPitchOffset;
      const clampedTone = Math.max(
        0,
        Math.min(scaleExt.length - 1, rawTone),
      );
      const midi = scaleExt[clampedTone];

      songData.push({
        type: "sound",
        soundType: "melody",
        time: noteTime,
        note: midi,
        played: false,
      });

      // ノーツの配置
      const lane = pNote.lane;
      if (noteTime > lastNoteEndTimes[lane] + 100) {
        songData.push({
          type: "note",
          time: noteTime,
          endTime,
          lane,
          noteType: pNote.noteType,
          spawned: false,
        });
        lastNoteEndTimes[lane] = endTime;
      }
    }
  };

  // 1. Verse 1 (Bars 4..7): Phrase A を中音域で演奏
  applyPhraseToBars(phraseA, 4, 0, 0);

  // 2. Verse 2 (Bars 8..11): Phrase A の後半変奏
  applyPhraseToBars(phraseA, 8, 0, 1);

  // 3. Bridge (Bars 12..15): Phrase B (落ち着いた別メロディ)
  applyPhraseToBars(phraseB, 12, 0, 0);

  // 4. Build-up (Bars 16..19): Phrase A の冒頭モチーフのスタッター連打
  applyPhraseToBars(phraseA, 16, 0, 0, 4);

  // 5. Chorus 1 (Bars 20..23): ★ Phrase A が 1オクターブ上 (+7スケール = +12半音) で大復活！
  applyPhraseToBars(phraseA, 20, 7, 0);

  // 6. Chorus 2 (Bars 24..27): ★ Phrase A' のオクターブ上クライマックス
  applyPhraseToBars(phraseA, 24, 7, 2);

  // 7. Outro (Bars 28..31): Phrase A のフェードアウト
  applyPhraseToBars(
    phraseA.slice(0, Math.floor(phraseA.length / 2)),
    28,
    0,
    0,
  );

  // 時間順にソート
  songData.sort((a, b) => a.time - b.time);

  return {
    events: songData,
    bpm,
    songEndTime,
    rootNote,
    meta,
  };
}
