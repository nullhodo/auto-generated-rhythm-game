import type { AudioEngine } from "../audio/audio-engine";
import { generateSong } from "../audio/song-generator";
import type {
  ActiveNote,
  GameLayout,
  HitEffect,
  HitJudge,
  LaneEffect,
  Particle,
  SongEvent,
} from "../types/game";

export const KEY_TO_LANE: Record<string, number> = {
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
  d: 0,
  f: 1,
  j: 2,
  k: 3,
  D: 0,
  F: 1,
  J: 2,
  K: 3,
};

export const NOTE_SPEED = 600; // ms

interface GameEngineCallbacks {
  onScoreChange: (score: number) => void;
  onComboChange: (combo: number) => void;
  onMaxComboChange: (maxCombo: number) => void;
  onGameClear: () => void;
}

export function evaluateTiming(diff: number): {
  judge: HitJudge;
  score: number;
  color: [number, number, number];
} | null {
  const absD = Math.abs(diff);
  if (absD < 45) {
    return { judge: "PERFECT", score: 300, color: [0, 229, 255] };
  }
  if (absD < 90) {
    return { judge: "GREAT", score: 150, color: [0, 255, 136] };
  }
  if (absD < 140) {
    return { judge: "GOOD", score: 70, color: [255, 234, 0] };
  }
  return null;
}

export class GameEngine {
  public songData: SongEvent[] = [];
  public lanes: ActiveNote[][] = [[], [], [], []];
  public hitEffects: HitEffect[] = [];
  public particles: Particle[] = [];
  public laneEffects: LaneEffect[] = [];

  public score = 0;
  public combo = 0;
  public maxCombo = 0;
  public bpm = 145;
  public songEndTime = 0;
  public startTime = 0;

  private audioEngine: AudioEngine;
  private callbacks: GameEngineCallbacks;

  constructor(audioEngine: AudioEngine, callbacks: GameEngineCallbacks) {
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
  }

  public start(): void {
    const generated = generateSong();
    this.songData = generated.events;
    this.bpm = generated.bpm;
    this.songEndTime = generated.songEndTime;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lanes = [[], [], [], []];
    this.hitEffects = [];
    this.particles = [];
    this.laneEffects = [];

    this.callbacks.onScoreChange(0);
    this.callbacks.onComboChange(0);
    this.callbacks.onMaxComboChange(0);

    this.startTime = performance.now() + 2000;
  }

  public update(now: number, layout: GameLayout): void {
    const currentTime = now - this.startTime;

    this.audioEngine.updateSidechain(currentTime, this.songEndTime);

    if (currentTime > this.songEndTime + 2000) {
      this.callbacks.onGameClear();
      return;
    }

    // 音響イベントの再生
    for (const ev of this.songData) {
      if (ev.type === "sound" && !ev.played && ev.time <= currentTime) {
        this.audioEngine.playEvent(ev);
        ev.played = true;
      }
    }

    // ノーツのスポーン
    for (const ev of this.songData) {
      if (
        ev.type === "note" &&
        !ev.spawned &&
        ev.time - NOTE_SPEED <= currentTime
      ) {
        this.lanes[ev.lane].push({
          time: ev.time,
          endTime: ev.endTime || 0,
          lane: ev.lane,
          noteType: ev.noteType,
          processed: false,
          isHit: false,
          isHolding: false,
        });
        ev.spawned = true;
      }
    }

    // 見逃しMISS判定
    for (let laneIdx = 0; laneIdx < 4; laneIdx++) {
      const laneNotes = this.lanes[laneIdx];
      for (let j = laneNotes.length - 1; j >= 0; j--) {
        const note = laneNotes[j];
        const missTime =
          note.noteType === "long" ? note.endTime : note.time;

        if (
          currentTime > missTime + 200 &&
          !note.isHit &&
          !note.processed
        ) {
          this.combo = 0;
          this.callbacks.onComboChange(0);
          this.addHitText(laneIdx, "MISS", [120, 120, 120], layout);
          note.processed = true;
        }

        if (note.processed && currentTime > missTime + 500) {
          laneNotes.splice(j, 1);
        }
      }
    }
  }

  public handleKeyDown(lane: number, layout: GameLayout): void {
    if (lane < 0 || lane >= 4) return;
    this.laneEffects.push({ lane, life: 10 });
    this.checkHit(lane, "press", layout);
  }

  public handleKeyUp(lane: number, layout: GameLayout): void {
    if (lane < 0 || lane >= 4) return;
    this.checkHit(lane, "release", layout);
  }

  private checkHit(
    lane: number,
    action: "press" | "release",
    layout: GameLayout,
  ): void {
    const currentTime = performance.now() - this.startTime;

    for (const note of this.lanes[lane]) {
      if (note.processed) continue;
      const diff = note.time - currentTime;

      if (note.noteType === "normal" && action === "press") {
        const evalResult = evaluateTiming(diff);
        if (evalResult) {
          note.processed = true;
          note.isHit = true;
          this.combo++;
          this.score += evalResult.score;
          if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
            this.callbacks.onMaxComboChange(this.maxCombo);
          }
          this.callbacks.onScoreChange(this.score);
          this.callbacks.onComboChange(this.combo);

          this.addHitText(
            lane,
            evalResult.judge,
            evalResult.color,
            layout,
          );
          this.createExplosion(lane, evalResult.color, layout);
          return;
        }
      } else if (note.noteType === "long") {
        if (action === "press" && Math.abs(diff) < 140) {
          note.isHolding = true;
          this.combo++;
          this.callbacks.onComboChange(this.combo);
          this.createExplosion(lane, [0, 255, 136], layout);
          return;
        }

        if (action === "release" && note.isHolding) {
          note.isHolding = false;
          if (Math.abs(note.endTime - currentTime) < 180) {
            note.processed = true;
            note.isHit = true;
            this.score += 500;
            this.combo++;
            if (this.combo > this.maxCombo) {
              this.maxCombo = this.combo;
              this.callbacks.onMaxComboChange(this.maxCombo);
            }
            this.callbacks.onScoreChange(this.score);
            this.callbacks.onComboChange(this.combo);
            this.addHitText(lane, "COMPLETE", [255, 255, 255], layout);
          } else {
            note.processed = true;
            this.combo = 0;
            this.callbacks.onComboChange(0);
            this.addHitText(lane, "MISS", [120, 120, 120], layout);
          }
        }
      }
    }
  }

  private addHitText(
    lane: number,
    text: string,
    color: [number, number, number],
    layout: GameLayout,
  ): void {
    const x =
      layout.laneXStart + lane * layout.laneWidth + layout.laneWidth / 2;
    this.hitEffects.push({
      x,
      y: layout.judgeLineY,
      text,
      color,
      life: 30,
    });
  }

  private createExplosion(
    lane: number,
    color: [number, number, number],
    layout: GameLayout,
  ): void {
    const x =
      layout.laneXStart + lane * layout.laneWidth + layout.laneWidth / 2;
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x,
        y: layout.judgeLineY,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 8 - 2,
        size: Math.random() * 7 + 3,
        color,
        life: 70,
      });
    }
  }
}
