import type { GameLayout } from "../types/game";

export const MAX_LANE_WIDTH = 100;
export const MIN_LANE_WIDTH = 40;
export const LANE_COUNT = 4;

/**
 * 画面サイズに基づいてゲームのレイアウトを計算する
 * 画面からはみ出さないよう、幅に応じてレーン幅をスケーリング
 */
export function computeGameLayout(
  width: number,
  height: number,
): GameLayout {
  const safeWidth = Math.max(width, 160);
  const safeHeight = Math.max(height, 200);

  // 左右の最小余白を確保しつつレーン幅を決定
  const horizontalPadding = safeWidth < 480 ? 16 : 32;
  const availableWidth = safeWidth - horizontalPadding * 2;
  const candidateLaneWidth = Math.floor(availableWidth / LANE_COUNT);

  const laneWidth = Math.max(
    MIN_LANE_WIDTH,
    Math.min(MAX_LANE_WIDTH, candidateLaneWidth),
  );
  const totalLaneWidth = laneWidth * LANE_COUNT;
  const laneXStart = Math.max(
    0,
    Math.floor((safeWidth - totalLaneWidth) / 2),
  );
  const judgeLineY = Math.floor(safeHeight * 0.82);

  return {
    width: safeWidth,
    height: safeHeight,
    laneWidth,
    totalLaneWidth,
    laneXStart,
    judgeLineY,
  };
}

/**
 * 指定されたレイアウトが画面内に完全に収まっているか判定
 */
export function isLayoutWithinBounds(layout: GameLayout): boolean {
  const leftEdgeValid = layout.laneXStart >= 0;
  const rightEdgeValid =
    layout.laneXStart + layout.totalLaneWidth <= layout.width;
  const judgeLineValid =
    layout.judgeLineY > 0 && layout.judgeLineY < layout.height;
  const laneWidthValid = layout.laneWidth >= MIN_LANE_WIDTH;

  return (
    leftEdgeValid && rightEdgeValid && judgeLineValid && laneWidthValid
  );
}

/**
 * ノーツの描画矩形がレーン幅・画面幅内に収まっているかチェック
 */
export function isNotePositionValid(
  lane: number,
  layout: GameLayout,
  noteWidthPadding = 8,
): boolean {
  if (lane < 0 || lane >= LANE_COUNT) return false;
  const laneLeft = layout.laneXStart + lane * layout.laneWidth;
  const noteX = laneLeft + noteWidthPadding / 2;
  const noteW = layout.laneWidth - noteWidthPadding;
  const noteRight = noteX + noteW;

  return noteX >= layout.laneXStart && noteRight <= layout.width;
}
