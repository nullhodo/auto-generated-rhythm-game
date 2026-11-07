import { useAtomValue } from "jotai";
import p5 from "p5";
import type React from "react";
import { useEffect, useRef } from "react";
import { bpmAtom, gameStateAtom } from "../state/atoms";

interface Shockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  color: [number, number, number];
}

interface Star {
  x: number;
  y: number;
  z: number;
  prevZ: number;
}

export const VJBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const bpm = useAtomValue(bpmAtom);
  const gameState = useAtomValue(gameStateAtom);

  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    if (!containerRef.current) return;

    let kickEnergy = 0;
    let hitEnergy = 0;
    let hitLane = 1;
    let colorHue = 180; // シアン開始
    const shockwaves: Shockwave[] = [];
    const stars: Star[] = [];
    const STAR_COUNT = 90;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.frameRate(60);
        p.colorMode(p.HSB, 360, 100, 100, 1);

        // スター初期化
        for (let i = 0; i < STAR_COUNT; i++) {
          stars.push({
            x: p.random(-p.width, p.width),
            y: p.random(-p.height, p.height),
            z: p.random(p.width),
            prevZ: p.width,
          });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        const isPlaying = gameStateRef.current === "PLAYING";
        const currentBpm = bpmRef.current || 145;

        // エネルギーの減衰
        kickEnergy *= 0.91;
        hitEnergy *= 0.88;

        // 色相の緩やかな回転 (サビ時は回転加速)
        const hueSpeed = isPlaying ? 0.35 + kickEnergy * 0.8 : 0.15;
        colorHue = (colorHue + hueSpeed) % 360;

        // 背景クリア (わずかなトレイル残しでWMP特有の光の残像を演出)
        p.background(240, 40, 8 + kickEnergy * 6, 0.45);

        p.push();
        p.translate(p.width / 2, p.height / 2);

        // 1. ワープスターフィールド (WMP Warp Speed風)
        const starSpeed = (isPlaying ? 8 : 3) + kickEnergy * 24;
        p.strokeWeight(1.5 + kickEnergy * 1.5);
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.prevZ = s.z;
          s.z -= starSpeed;
          if (s.z <= 0) {
            s.z = p.width;
            s.x = p.random(-p.width, p.width);
            s.y = p.random(-p.height, p.height);
            s.prevZ = s.z;
          }

          const sx = p.map(s.x / s.z, 0, 1, 0, p.width);
          const sy = p.map(s.y / s.z, 0, 1, 0, p.height);
          const px = p.map(s.x / s.prevZ, 0, 1, 0, p.width);
          const py = p.map(s.y / s.prevZ, 0, 1, 0, p.height);

          const starAlpha = p.map(s.z, 0, p.width, 0.9, 0.1);
          p.stroke((colorHue + 60) % 360, 70, 95, starAlpha);
          p.line(px, py, sx, sy);
        }

        // 2. 円形オシロスコープ & 幾何学マンダラ (Windows Media Player風)
        const baseRadius =
          Math.min(p.width, p.height) * 0.22 + kickEnergy * 65;
        const ringCount = 3;

        p.noFill();
        for (let r = 0; r < ringCount; r++) {
          const radius = baseRadius * (0.6 + r * 0.35);
          const points = 8 + r * 4;
          const rotDir = r % 2 === 0 ? 1 : -1;
          const rot =
            p.frameCount * 0.012 * rotDir + kickEnergy * 0.2 * rotDir;

          p.stroke(
            (colorHue + r * 35) % 360,
            80,
            90 + kickEnergy * 10,
            0.45 + kickEnergy * 0.4,
          );
          p.strokeWeight(2 + (ringCount - r) * 0.8 + kickEnergy * 2);

          p.beginShape();
          for (let i = 0; i <= points; i++) {
            const angle = (p.TWO_PI / points) * i + rot;
            // ビートと連動する波打ち
            const wave =
              p.sin(angle * 4 + p.frameCount * 0.08) *
              (8 + kickEnergy * 22);
            const currentR = radius + wave;
            const x = p.cos(angle) * currentR;
            const y = p.sin(angle) * currentR;
            p.vertex(x, y);
          }
          p.endShape(p.CLOSE);
        }

        // 3. ショックウェーブ波紋 (キック発音時の衝撃波)
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.radius += (sw.maxRadius - sw.radius) * 0.09 + 4;
          sw.alpha *= 0.92;

          p.stroke(sw.color[0], sw.color[1], sw.color[2], sw.alpha);
          p.strokeWeight(3 * (sw.alpha + 0.2));
          p.ellipse(0, 0, sw.radius * 2, sw.radius * 2);

          if (sw.alpha <= 0.02 || sw.radius >= sw.maxRadius) {
            shockwaves.splice(i, 1);
          }
        }

        // 4. 打鍵時のサイドレーザー・パルス
        if (hitEnergy > 0.05) {
          const laneOffset = (hitLane - 1.5) * 120;
          p.stroke((colorHue + 140) % 360, 90, 100, hitEnergy * 0.6);
          p.strokeWeight(hitEnergy * 6);
          p.line(laneOffset, -p.height / 2, laneOffset, p.height / 2);
        }

        p.pop();

        // 5. 画面下部 パースペクティブサイバーグリッド
        p.push();
        const horizonY = p.height * 0.58;
        const gridLines = 14;
        const beatOffset = (p.millis() * (currentBpm / 60000) * 80) % 40;

        p.stroke((colorHue + 20) % 360, 60, 70, 0.25 + kickEnergy * 0.25);
        p.strokeWeight(1);

        // 縦方向の収束ライン (左右の画面端)
        for (let i = -gridLines; i <= gridLines; i++) {
          const bottomX = p.width / 2 + (i * p.width) / gridLines;
          const topX = p.width / 2 + (i * p.width) / (gridLines * 3.5);
          p.line(topX, horizonY, bottomX, p.height);
        }

        // 横方向の進行ライン
        for (let y = horizonY; y < p.height; y += 32) {
          const distFromHorizon = y - horizonY + beatOffset;
          const screenY = horizonY + distFromHorizon;
          if (screenY < p.height) {
            const alpha = p.map(screenY, horizonY, p.height, 0.05, 0.35);
            p.stroke((colorHue + 20) % 360, 60, 80, alpha);
            p.line(0, screenY, p.width, screenY);
          }
        }
        p.pop();
      };
    };

    const p5Instance = new p5(sketch, containerRef.current);
    p5InstanceRef.current = p5Instance;

    // VJイベントリスナー (キック・打鍵パルス)
    const handleVJPulse = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: "kick" | "hit";
        lane?: number;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.type === "kick") {
        kickEnergy = 1.0;
        shockwaves.push({
          radius: 20,
          maxRadius:
            Math.max(window.innerWidth, window.innerHeight) * 0.65,
          alpha: 0.8,
          color: [(colorHue + 30) % 360, 85, 95],
        });
      } else if (detail.type === "hit") {
        hitEnergy = 1.0;
        if (detail.lane !== undefined) {
          hitLane = detail.lane;
        }
      }
    };

    window.addEventListener("vj-pulse", handleVJPulse);

    return () => {
      window.removeEventListener("vj-pulse", handleVJPulse);
      p5Instance.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
};
