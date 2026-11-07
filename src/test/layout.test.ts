import { describe, expect, it } from "vitest";
import {
  LANE_COUNT,
  MAX_LANE_WIDTH,
  MIN_LANE_WIDTH,
  computeGameLayout,
  isLayoutWithinBounds,
  isNotePositionValid,
} from "../game/layout";

describe("Layout & Boundary Tests", () => {
  const testViewports = [
    { name: "Ultra-small Mobile (320x480)", width: 320, height: 480 },
    { name: "Standard Mobile (390x844)", width: 390, height: 844 },
    { name: "Tablet Portrait (768x1024)", width: 768, height: 1024 },
    { name: "Desktop 1080p (1920x1080)", width: 1920, height: 1080 },
    { name: "4K UHD (3840x2160)", width: 3840, height: 2160 },
    { name: "Ultra-wide (3440x1440)", width: 3440, height: 1440 },
    { name: "Extremely Small Window (120x150)", width: 120, height: 150 },
  ];

  for (const vp of testViewports) {
    it(`should keep all lanes and judge lines strictly within screen bounds for ${vp.name}`, () => {
      const layout = computeGameLayout(vp.width, vp.height);

      // レイアウトが境界内であることの判定
      expect(isLayoutWithinBounds(layout)).toBe(true);

      // 左端・右端のはみ出し検証
      expect(layout.laneXStart).toBeGreaterThanOrEqual(0);
      expect(
        layout.laneXStart + layout.totalLaneWidth,
      ).toBeLessThanOrEqual(layout.width);

      // 判定ラインの画面内検証
      expect(layout.judgeLineY).toBeGreaterThan(0);
      expect(layout.judgeLineY).toBeLessThan(layout.height);

      // 各レーン幅の検証
      expect(layout.laneWidth).toBeGreaterThanOrEqual(MIN_LANE_WIDTH);
      expect(layout.laneWidth).toBeLessThanOrEqual(MAX_LANE_WIDTH);
      expect(layout.totalLaneWidth).toBe(layout.laneWidth * LANE_COUNT);

      // 全4レーンのノーツ描画領域がはみ出さないことを検証
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        expect(isNotePositionValid(lane, layout)).toBe(true);
      }
    });
  }

  it("should enforce minimum width (160) and height (200) bounds", () => {
    const layoutTiny = computeGameLayout(50, 50);
    expect(layoutTiny.width).toBe(160);
    expect(layoutTiny.height).toBe(200);
    expect(isLayoutWithinBounds(layoutTiny)).toBe(true);
  });

  it("should switch horizontal padding based on screen width", () => {
    // 480未満は余白16px、480以上は余白32px
    const narrowLayout = computeGameLayout(400, 800);
    const wideLayout = computeGameLayout(500, 800);

    // narrow: available = 400 - 32 = 368, laneWidth = 368 / 4 = 92
    expect(narrowLayout.laneWidth).toBe(92);
    // wide: available = 500 - 64 = 436, candidate = 436 / 4 = 109 -> MAX_LANE_WIDTH (100)
    expect(wideLayout.laneWidth).toBe(MAX_LANE_WIDTH);
  });

  it("should reject invalid lanes for note positions", () => {
    const layout = computeGameLayout(1920, 1080);
    expect(isNotePositionValid(-1, layout)).toBe(false);
    expect(isNotePositionValid(4, layout)).toBe(false);
    expect(isNotePositionValid(99, layout)).toBe(false);
  });
});
