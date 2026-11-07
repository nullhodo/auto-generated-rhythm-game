export type GameState = "START" | "PLAYING" | "RESULT";

export type NoteType = "normal" | "long";

export type SoundType = "kick" | "snare" | "hat" | "bass" | "melody";

export type HitJudge = "PERFECT" | "GREAT" | "GOOD" | "MISS" | "COMPLETE";

export interface SoundEvent {
  type: "sound";
  soundType: SoundType;
  time: number;
  note?: number;
  played: boolean;
}

export interface NoteEvent {
  type: "note";
  time: number;
  endTime: number;
  lane: number;
  noteType: NoteType;
  spawned: boolean;
}

export type SongEvent = SoundEvent | NoteEvent;

export interface ActiveNote {
  time: number;
  endTime: number;
  lane: number;
  noteType: NoteType;
  processed: boolean;
  isHit: boolean;
  isHolding: boolean;
}

export interface HitEffect {
  x: number;
  y: number;
  text: string;
  color: [number, number, number];
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: [number, number, number];
  life: number;
}

export interface LaneEffect {
  lane: number;
  life: number;
}

export interface GameLayout {
  width: number;
  height: number;
  laneWidth: number;
  totalLaneWidth: number;
  laneXStart: number;
  judgeLineY: number;
}

