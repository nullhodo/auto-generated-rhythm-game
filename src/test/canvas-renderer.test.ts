import { describe, expect, it, vi } from "vitest";
import { CanvasRenderer } from "../game/canvas-renderer";
import type {
  ActiveNote,
  GameLayout,
  HitEffect,
  LaneEffect,
  Particle,
} from "../types/game";

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowColor: "",
    shadowBlur: 0,
    font: "",
    textAlign: "left",
    textBaseline: "top",
  } as unknown as CanvasRenderingContext2D;
}

describe("CanvasRenderer Tests", () => {
  const layout: GameLayout = {
    width: 800,
    height: 600,
    laneWidth: 80,
    totalLaneWidth: 320,
    laneXStart: 240,
    judgeLineY: 500,
  };

  it("should render cleanly with empty lanes without throwing exceptions", () => {
    const mockCtx = createMockCanvasContext();
    const renderer = new CanvasRenderer(mockCtx);

    const emptyLanes: ActiveNote[][] = [[], [], [], []];
    const laneEffects: LaneEffect[] = [];
    const hitEffects: HitEffect[] = [];
    const particles: Particle[] = [];

    expect(() => {
      renderer.render(
        layout,
        1000,
        600,
        emptyLanes,
        laneEffects,
        hitEffects,
        particles,
      );
    }).not.toThrow();

    // 画面クリアと判定ライン描画が呼ばれていること
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it("should render normal and long notes properly", () => {
    const mockCtx = createMockCanvasContext();
    const renderer = new CanvasRenderer(mockCtx);

    const lanes: ActiveNote[][] = [
      [
        // レーン0: 通常ノーツ
        {
          time: 1200,
          endTime: 1200,
          lane: 0,
          noteType: "normal",
          processed: false,
          isHit: false,
          isHolding: false,
        },
      ],
      [
        // レーン1: ロングノーツ (ホールド中)
        {
          time: 1000,
          endTime: 1800,
          lane: 1,
          noteType: "long",
          processed: false,
          isHit: false,
          isHolding: true,
        },
      ],
      [],
      [],
    ];

    renderer.render(layout, 1100, 600, lanes, [], [], []);

    // ノーツ描画の矩形やパスが呼び出されたことを検証
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it("should decay laneEffects life and remove expired ones", () => {
    const mockCtx = createMockCanvasContext();
    const renderer = new CanvasRenderer(mockCtx);

    const laneEffects: LaneEffect[] = [
      { lane: 0, life: 10 },
      { lane: 1, life: 1 },
    ];

    renderer.render(layout, 0, 600, [[], [], [], []], laneEffects, [], []);

    // 1フレーム経過後: lifeが減少し、life 1のものは削除される
    expect(laneEffects.length).toBe(1);
    expect(laneEffects[0].lane).toBe(0);
    expect(laneEffects[0].life).toBe(9);
  });

  it("should decay hitEffects and particles and remove expired ones", () => {
    const mockCtx = createMockCanvasContext();
    const renderer = new CanvasRenderer(mockCtx);

    const hitEffects: HitEffect[] = [
      {
        x: 300,
        y: 500,
        text: "PERFECT",
        color: [0, 229, 255],
        life: 2,
      },
      {
        x: 380,
        y: 500,
        text: "GOOD",
        color: [255, 234, 0],
        life: 1,
      },
    ];

    const particles: Particle[] = [
      {
        x: 300,
        y: 500,
        vx: 1,
        vy: -2,
        size: 5,
        color: [0, 255, 136],
        life: 10,
      },
      {
        x: 300,
        y: 500,
        vx: 2,
        vy: -1,
        size: 4,
        color: [255, 255, 255],
        life: 2,
      },
    ];

    renderer.render(
      layout,
      0,
      600,
      [[], [], [], []],
      [],
      hitEffects,
      particles,
    );

    // life 1だったhitEffectと、life 2だったparticle (life -= 2) が削除され、残りの要素の寿命が減少していること
    expect(hitEffects.length).toBe(1);
    expect(hitEffects[0].text).toBe("PERFECT");
    expect(hitEffects[0].life).toBe(1);

    expect(particles.length).toBe(1);
    expect(particles[0].life).toBe(8);
  });
});
