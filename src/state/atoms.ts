import { atom } from "jotai";
import type { GameState } from "../types/game";

export const gameStateAtom = atom<GameState>("START");
export const scoreAtom = atom<number>(0);
export const comboAtom = atom<number>(0);
export const maxComboAtom = atom<number>(0);
export const bpmAtom = atom<number>(145);
export const isMutedAtom = atom<boolean>(false);

