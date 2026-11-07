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
  { pattern: [0, 2, 3, 4], label: "i - III - iv - v (ステップ上昇進行)" },
  {
    pattern: [0, 6, 5, 6],
    label: "i - VII - VI - VII (哀愁アンダルシア進行)",
  },
  {
    pattern: [5, 0, 2, 6],
    label: "VI - i - III - VII (エモーショナル進行)",
  },
  {
    pattern: [3, 0, 4, 4],
    label: "iv - i - v - v (フューチャーベース進行)",
  },
];

type MelodyStyleType =
  | "anthem"
  | "arpeggio"
  | "syncopated"
  | "cascade"
  | "staccato";

interface MelodyStyleInfo {
  type: MelodyStyleType;
  label: string;
}

const MELODY_STYLE_INFOS: MelodyStyleInfo[] = [
  { type: "anthem", label: "Festival Anthem" },
  { type: "arpeggio", label: "Cyber Arpeggio" },
  { type: "syncopated", label: "Syncopated Bounce" },
  { type: "cascade", label: "Melodic Cascade" },
  { type: "staccato", label: "Club Staccato Hook" },
];

type BuildupStyleType =
  | "breakdown" // ドラムを抜いた静寂の美学・コードパッドとロングトーン
  | "syncopated-tease" // テンポ倍速にせず裏拍グルーヴをキープした助走
  | "half-time" // どっしり重厚なハーフテンポ
  | "riser-rush"; // 王道EDM（最後の1小節のみに凝縮したスッキリ展開）

const BUILDUP_STYLES: BuildupStyleType[] = [
  "breakdown",
  "syncopated-tease",
  "half-time",
  "riser-rush",
];

/**
 * 4小節（32サブビート = 8分音符32個分）からなる1つのフレーズ単位
 */
interface PhraseNote {
  subBeat: number; // 0..31
  scaleToneIndex: number; // 3オクターブスケール内のインデックス (0..20)
  noteType: "normal" | "long";
}

/**
 * ノーツを4つのレーンに均等かつ音楽的に自然に配分する
 */
function selectLaneForNote(
  noteTime: number,
  scaleTone: number,
  scaleLength: number,
  lastNoteEndTimes: number[],
  lastLane: number,
  laneUsageCount: number[],
): number {
  // 音高に応じた目安レーン (低音: 0, 1 / 高音: 2, 3)
  const toneRatio = Math.max(
    0,
    Math.min(1, scaleTone / (scaleLength - 1)),
  );
  const preferredLane = Math.min(3, Math.floor(toneRatio * 4));

  // 直前のノーツから90ms以上空いているレーンを候補とする
  const availableLanes: number[] = [];
  for (let l = 0; l < 4; l++) {
    if (noteTime >= lastNoteEndTimes[l] + 90) {
      availableLanes.push(l);
    }
  }

  // もし空きがなければ、最も早く終了するレーンを選ぶ
  if (availableLanes.length === 0) {
    let earliest = 0;
    for (let l = 1; l < 4; l++) {
      if (lastNoteEndTimes[l] < lastNoteEndTimes[earliest]) {
        earliest = l;
      }
    }
    laneUsageCount[earliest]++;
    return earliest;
  }

  // 縦連（同じレーンの連打）を防止するため、直前と異なるレーンを優先
  const differentLanes = availableLanes.filter((l) => l !== lastLane);
  const candidates =
    differentLanes.length > 0 ? differentLanes : availableLanes;

  // 使用頻度の少ないレーン、および音高に近いレーンを優先してソート
  candidates.sort((a, b) => {
    // 1. 各レーンの使用回数を平滑化（偏りを徹底排除）
    const usageDiff = laneUsageCount[a] - laneUsageCount[b];
    if (usageDiff !== 0) {
      return usageDiff;
    }
    // 2. 同数なら音高（低音＝左、高音＝右）に近い方を優先
    const distA = Math.abs(a - preferredLane);
    const distB = Math.abs(b - preferredLane);
    return distA - distB;
  });

  const selected = candidates[0];
  laneUsageCount[selected]++;
  return selected;
}

/**
 * 4小節のメロディフレーズ（モチーフ）をアーキタイプ別にプロシージャル生成
 */
function createMelodyPhrase(
  rng: () => number,
  progression: number[],
  style: MelodyStyleType,
  isBridge = false,
): PhraseNote[] {
  const notes: PhraseNote[] = [];

  // スタイルごとのバリエーション乱数シード
  const arpPatterns = [
    [0, 1, 2, 1, 2, 0, 1],
    [0, 2, 1, 3, 2, 0, 1],
    [0, 1, 2, 3, 2, 1, 0],
  ];
  const chosenArpPattern =
    arpPatterns[Math.floor(rng() * arpPatterns.length)];
  const cascadeTopTone = rng() < 0.5 ? 8 : 7;
  const staccatoJump = rng() < 0.5 ? 4 : 5;

  // スタイルごとのリズムパターンと旋律輪郭の定義 (8サブビート x 4小節)
  for (let bar = 0; bar < 4; bar++) {
    const degree = progression[bar % 4];
    const chordTones = CHORDS[degree];

    switch (style) {
      case "arpeggio": {
        // 1. 疾走アルペジオ: 8分音符でコードトーンを階段状に駆け上がる流麗シーケンス
        for (let sub = 0; sub < 7; sub++) {
          const toneIdx =
            chordTones[chosenArpPattern[sub] % chordTones.length] +
            (sub >= 4 ? 4 : 0);
          const isLong = bar === 3 && sub === 4;
          notes.push({
            subBeat: bar * 8 + sub,
            scaleToneIndex: Math.max(0, Math.min(9, toneIdx)),
            noteType: isLong ? "long" : "normal",
          });
        }
        break;
      }

      case "anthem": {
        // 2. 王道アンセム: 1拍目に力強いロングトーンを提示し、後半で応答するコール＆レスポンス
        const anthemSubs =
          bar % 2 === 0
            ? [
                { sub: 0, long: true, tone: chordTones[0] + 3 },
                { sub: 3, long: false, tone: chordTones[1] + 1 },
                { sub: 4, long: false, tone: chordTones[2] },
                { sub: 6, long: true, tone: chordTones[0] + 2 },
              ]
            : [
                { sub: 0, long: false, tone: chordTones[0] },
                { sub: 2, long: false, tone: chordTones[1] },
                { sub: 4, long: false, tone: chordTones[2] + 1 },
                { sub: 6, long: true, tone: chordTones[0] + 4 },
              ];

        for (const item of anthemSubs) {
          notes.push({
            subBeat: bar * 8 + item.sub,
            scaleToneIndex: Math.max(0, Math.min(9, item.tone)),
            noteType: item.long ? "long" : "normal",
          });
        }
        break;
      }

      case "syncopated": {
        // 3. シンコペーション・バウンス: 表拍を抜いて裏拍で飛び跳ねるダンサブルなグルーヴ
        const synSubs = [1, 2, 4, 5, 7];
        for (let idx = 0; idx < synSubs.length; idx++) {
          const sub = synSubs[idx];
          const tone =
            chordTones[idx % chordTones.length] + (idx % 2 === 0 ? 0 : 2);
          const isLong =
            idx === synSubs.length - 1 && (bar === 1 || bar === 3);
          notes.push({
            subBeat: bar * 8 + sub,
            scaleToneIndex: Math.max(0, Math.min(9, tone)),
            noteType: isLong ? "long" : "normal",
          });
        }
        break;
      }

      case "cascade": {
        // 4. カスケード下降: 高音の頂点から階段状に美しく駆け下りてくるドラマチックな旋律
        const cascadeSubs = [0, 2, 3, 4, 6];
        for (let idx = 0; idx < cascadeSubs.length; idx++) {
          const sub = cascadeSubs[idx];
          const tone = Math.max(
            0,
            cascadeTopTone - idx + (bar % 2 === 0 ? 0 : -1),
          );
          const isLong = idx === cascadeSubs.length - 1;
          notes.push({
            subBeat: bar * 8 + sub,
            scaleToneIndex: Math.max(0, Math.min(9, tone)),
            noteType: isLong ? "long" : "normal",
          });
        }
        break;
      }

      case "staccato": {
        // 5. クラブスタッカート: 同音をト・ト・トと連打し、小節末尾で跳躍するキャッチーなクラブフック
        const baseTone = chordTones[bar % chordTones.length];
        const staccatoSubs = [0, 1, 2, 4, 5, 6];
        for (let idx = 0; idx < staccatoSubs.length; idx++) {
          const sub = staccatoSubs[idx];
          // 最後の音でオクターブまたは5度上にジャンプ！
          const tone = idx >= 4 ? baseTone + staccatoJump : baseTone;
          const isLong = idx === staccatoSubs.length - 1;
          notes.push({
            subBeat: bar * 8 + sub,
            scaleToneIndex: Math.max(0, Math.min(9, tone)),
            noteType: isLong ? "long" : "normal",
          });
        }
        break;
      }
    }
  }

  // ブリッジ時は少し音数を間引いて対比を演出
  const filteredNotes = isBridge
    ? notes.filter(
        (_, idx) => idx % 2 === 0 || notes[idx].noteType === "long",
      )
    : notes;

  // 1フレーズあたり最低4個のロングノーツを確実に保証
  const currentLongCount = filteredNotes.filter(
    (n) => n.noteType === "long",
  ).length;
  if (currentLongCount < 4) {
    const candidates = filteredNotes.filter(
      (n) => n.noteType === "normal",
    );
    candidates.sort(
      (a, b) =>
        (b.subBeat % 4 === 0 ? 1 : 0) - (a.subBeat % 4 === 0 ? 1 : 0),
    );
    for (
      let i = 0;
      i < Math.min(candidates.length, 4 - currentLongCount);
      i++
    ) {
      candidates[i].noteType = "long";
    }
  }

  // ロングノーツの直後 (1サブビート後) に音がある場合は間引いて、悠々とホールドできるようにする
  const cleanNotes: PhraseNote[] = [];
  for (let i = 0; i < filteredNotes.length; i++) {
    const prev = cleanNotes[cleanNotes.length - 1];
    if (
      prev &&
      prev.noteType === "long" &&
      filteredNotes[i].subBeat === prev.subBeat + 1
    ) {
      continue;
    }
    cleanNotes.push(filteredNotes[i]);
  }

  return cleanNotes;
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

  // ★ 楽曲の性格を決定づけるメロディスタイル（アーキタイプ）を選定 ★
  const styleIndex = Math.floor(rng() * MELODY_STYLE_INFOS.length);
  const chosenStyleInfo = MELODY_STYLE_INFOS[styleIndex];

  // ★ サビ前のビルドアップ（助走）スタイルをランダム選定 ★
  const buildupStyleIndex = Math.floor(rng() * BUILDUP_STYLES.length);
  const chosenBuildupStyle = BUILDUP_STYLES[buildupStyleIndex];

  const meta: SongMeta = {
    keyName: keyDetail.keyName,
    scaleName: "Natural Minor",
    progressionPattern: chosenProgInfo.label,
    chordProgression: chordProgressionStr,
    melodyStyle: chosenStyleInfo.label,
  };

  // ★ 1曲の核となる「フレーズ」を定義 ★
  // Phrase A: メインテーマ（選ばれたアーキタイプスタイルで個性を発揮）
  const phraseA = createMelodyPhrase(
    rng,
    chosenProg,
    chosenStyleInfo.type,
    false,
  );
  // Phrase B: Bメロ用（対比と助走のフレーズ）
  const phraseB = createMelodyPhrase(
    rng,
    chosenProg,
    chosenStyleInfo.type,
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

      if (isBuildUp && chosenBuildupStyle === "breakdown") {
        // 1. ブレイクダウン: キック・スネア・ベースを完全カット（静寂と空間）
        // サビ直前の最後の1拍 (bar 19, beat 3) にだけスネア1打フィルイン
        if (bar === 19 && beat === 3) {
          songData.push({
            type: "sound",
            soundType: "snare",
            time: t,
            played: false,
          });
        }
      } else if (isBuildUp && chosenBuildupStyle === "half-time") {
        // 2. ハーフタイム: テンポ感を半分に落とした重厚なビート
        if (beat === 0) {
          songData.push({
            type: "sound",
            soundType: "kick",
            time: t,
            played: false,
          });
        }
        if (beat === 2) {
          songData.push({
            type: "sound",
            soundType: "snare",
            time: t,
            played: false,
          });
        }
        if (beat % 2 === 0) {
          songData.push({
            type: "sound",
            soundType: "hat",
            time: t,
            played: false,
          });
        }
      } else {
        // 3. 通常の4つ打ち、または syncopated-tease / riser-rush
        songData.push({
          type: "sound",
          soundType: "kick",
          time: t,
          played: false,
        });

        if (isBuildUp && chosenBuildupStyle === "riser-rush" && bar === 19) {
          // riser-rush でも最後の小節 (bar 19) のみ加速
          songData.push({
            type: "sound",
            soundType: "snare",
            time: t,
            played: false,
          });
          if (beat < 3) {
            songData.push({
              type: "sound",
              soundType: "snare",
              time: t + beatTime / 2,
              played: false,
            });
          }
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
      }

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

      // ベース (breakdown時は鳴らさない)
      if (!(isBuildUp && chosenBuildupStyle === "breakdown")) {
        if (isBuildUp && chosenBuildupStyle === "half-time") {
          if (beat === 0 || beat === 2) {
            songData.push({
              type: "sound",
              soundType: "bass",
              time: t,
              note: chordRootMidi - 24,
              played: false,
            });
          }
        } else {
          songData.push({
            type: "sound",
            soundType: "bass",
            time: t,
            note: chordRootMidi - 24,
            played: false,
          });

          if (isChorus) {
            songData.push({
              type: "sound",
              soundType: "bass",
              time: t + beatTime / 2,
              note: chordRootMidi - 24,
              played: false,
            });
          }
        }
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

  // 各レーンのノーツ使用回数を追跡して偏りを完全に平滑化
  const laneUsageCount = [0, 0, 0, 0];
  let lastAssignedLane = -1;

  const applyPhraseToBars = (
    phrase: PhraseNote[],
    startBar: number,
    octaveOffset = 0,
    variationPitchOffset = 0,
    isChorusSection = false,
    isRiserRush = false,
  ) => {
    const phraseStartTime = startBar * 4 * beatTime;

    if (isRiserRush) {
      // riser-rush 用: 最初の3小節は通常テンポ、最後の1小節のみ8分音符でスッキリ助走
      const leadNotes = phrase.slice(0, 4);
      for (let b = 0; b < 4; b++) {
        const barStart = phraseStartTime + b * 4 * beatTime;
        if (b < 3) {
          // 前半3小節は4分音符のゆったりした演奏（長すぎる倍速連打を防止）
          for (let step = 0; step < 4; step++) {
            const noteTime = barStart + step * beatTime;
            const pNote = leadNotes[step % leadNotes.length];
            const toneIdx = Math.min(
              scaleExt.length - 1,
              pNote.scaleToneIndex + octaveOffset,
            );
            const rawMidi = scaleExt[toneIdx];
            const midi = rawMidi > 84 ? rawMidi - 12 : rawMidi;

            songData.push({
              type: "sound",
              soundType: "melody",
              time: noteTime,
              note: midi,
              played: false,
            });

            const lane = selectLaneForNote(
              noteTime,
              toneIdx,
              scaleExt.length,
              lastNoteEndTimes,
              lastAssignedLane,
              laneUsageCount,
            );
            lastAssignedLane = lane;

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
        } else {
          // 最後の小節 (bar 19): 8分音符6打 + 1拍ブレイク (サビ前のキレの良い溜め)
          for (let step = 0; step < 6; step++) {
            const noteTime = barStart + step * subBeatTime;
            const pNote = leadNotes[step % leadNotes.length];
            const toneIdx = Math.min(
              scaleExt.length - 1,
              pNote.scaleToneIndex + octaveOffset,
            );
            const rawMidi = scaleExt[toneIdx];
            const midi = rawMidi > 84 ? rawMidi - 12 : rawMidi;

            songData.push({
              type: "sound",
              soundType: "melody",
              time: noteTime,
              note: midi,
              played: false,
            });

            const lane = selectLaneForNote(
              noteTime,
              toneIdx,
              scaleExt.length,
              lastNoteEndTimes,
              lastAssignedLane,
              laneUsageCount,
            );
            lastAssignedLane = lane;

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
      return;
    }

    // 通常のフレーズ展開
    for (let i = 0; i < phrase.length; i++) {
      const pNote = phrase[i];
      const noteTime = phraseStartTime + pNote.subBeat * subBeatTime;

      // 次の音符との間隔を計算 (重なり防止と持続時間最適化)
      const nextNote = phrase[i + 1];
      const nextNoteTime = nextNote
        ? phraseStartTime + nextNote.subBeat * subBeatTime
        : phraseStartTime + 32 * subBeatTime;
      const timeToNext = Math.max(0, nextNoteTime - noteTime);

      // サビでの高揚感を高めるため、小節頭の音をロングノーツへ昇格
      let noteType: "normal" | "long" = pNote.noteType;
      if (
        isChorusSection &&
        pNote.subBeat % 8 === 0 &&
        timeToNext >= beatTime * 1.2
      ) {
        noteType = "long";
      }

      // ロングノーツの持続時間: 最低でも1拍分 (beatTime * 1.0)、次の音の手前60msまでに終了
      let duration = 0;
      if (noteType === "long") {
        duration = Math.max(
          beatTime * 1.0,
          Math.min(
            beatTime * 1.5,
            timeToNext > 0 ? timeToNext - 60 : beatTime * 1.5,
          ),
        );
      }
      const endTime = noteTime + duration;

      const rawTone =
        pNote.scaleToneIndex + octaveOffset + variationPitchOffset;
      const clampedTone = Math.max(
        0,
        Math.min(scaleExt.length - 1, rawTone),
      );
      const rawMidi = scaleExt[clampedTone];
      // 高すぎる耳障りな音 (MIDI > 84 / 1046Hz) を心地よいリード帯域 (C6以下) に制限
      const midi = rawMidi > 84 ? rawMidi - 12 : rawMidi;

      songData.push({
        type: "sound",
        soundType: "melody",
        time: noteTime,
        note: midi,
        played: false,
      });

      // 主ノーツの配置: 4レーン均等分散アルゴリズム
      const lane = selectLaneForNote(
        noteTime,
        clampedTone,
        scaleExt.length,
        lastNoteEndTimes,
        lastAssignedLane,
        laneUsageCount,
      );
      lastAssignedLane = lane;

      songData.push({
        type: "note",
        time: noteTime,
        endTime,
        lane,
        noteType,
        spawned: false,
      });
      lastNoteEndTimes[lane] = endTime;

      // ★ サビの小節頭 (1拍目または裏拍アタック) で美しい協和音ダブルノーツ (同時押し) を生成 ★
      // 2音が重なる時は、不協和音にならないよう「完全オクターブ (±12半音)」の協和ハーモニーとする
      const isDoubleNoteCandidate =
        isChorusSection &&
        (pNote.subBeat % 8 === 0 || pNote.subBeat % 8 === 1);
      if (isDoubleNoteCandidate) {
        // 主音に対してオクターブ上（またはオクターブ下）の完全協和音
        const harmonyMidi = midi <= 72 ? midi + 12 : midi - 12;
        // 反対側のレーン (0<->2, 1<->3) で叩きやすい両手同時押しを配置
        const pairLane = lane < 2 ? lane + 2 : lane - 2;

        if (noteTime >= lastNoteEndTimes[pairLane] + 90) {
          songData.push({
            type: "sound",
            soundType: "melody",
            time: noteTime,
            note: harmonyMidi,
            played: false,
          });

          songData.push({
            type: "note",
            time: noteTime,
            endTime,
            lane: pairLane,
            noteType,
            spawned: false,
          });
          lastNoteEndTimes[pairLane] = endTime;
          laneUsageCount[pairLane]++;
        }
      }
    }
  };

  // 1. Verse 1 (Bars 4..7): Phrase A を中音域で演奏
  applyPhraseToBars(phraseA, 4, 0, 0);

  // 2. Verse 2 (Bars 8..11): Phrase A の後半変奏
  applyPhraseToBars(phraseA, 8, 0, 1);

  // 3. Bridge (Bars 12..15): Phrase B (落ち着いた別メロディ)
  applyPhraseToBars(phraseB, 12, 0, 0);

  // 4. Build-up (Bars 16..19): 多彩なサビ前助走スタイル
  switch (chosenBuildupStyle) {
    case "breakdown":
      // ドラムを抜いた静寂の美学: 落ち着いたロングトーンと空間の広がり（倍速感ゼロ）
      applyPhraseToBars(
        phraseB.filter((_, idx) => idx % 2 === 0),
        16,
        0,
        0,
        false,
      );
      break;
    case "half-time":
      // どっしりハーフテンポ: 2拍に1音の重厚なタメ
      applyPhraseToBars(
        phraseA.filter((p) => p.subBeat % 4 === 0),
        16,
        0,
        -1,
        false,
      );
      break;
    case "syncopated-tease":
      // テンポを崩さない裏拍グルーヴ: メインフレーズの変奏を通常テンポで演奏
      applyPhraseToBars(phraseA, 16, 0, 1, false);
      break;
    case "riser-rush":
      // 王道EDM: 最後の1小節のみに凝縮したスッキリとした駆け上がり
      applyPhraseToBars(phraseA, 16, 0, 0, false, true);
      break;
  }

  // 5. Chorus 1 (Bars 20..23): ★ Phrase A が 1オクターブ上 (+7スケール = +12半音) で大復活！
  applyPhraseToBars(phraseA, 20, 7, 0, true);

  // 6. Chorus 2 (Bars 24..27): ★ Phrase A' のオクターブ上クライマックス
  applyPhraseToBars(phraseA, 24, 7, 2, true);

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
