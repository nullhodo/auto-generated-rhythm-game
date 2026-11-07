import { useAtomValue } from "jotai";
import p5 from "p5";
import type React from "react";
import { useEffect, useRef } from "react";
import { bpmAtom, gameStateAtom } from "../state/atoms";

interface Star {
  x: number;
  y: number;
  size: number;
  baseBrightness: number;
  blinkSpeed: number;
}

interface GridPulseWave {
  z: number; // 0 (奥) .. 1 (手前)
  lane: number;
  alpha: number;
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
    let baseHue = 280; // ネオンマゼンタ / サイバーパープル開始
    const stars: Star[] = [];
    const pulseWaves: GridPulseWave[] = [];
    const STAR_COUNT = 45;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.frameRate(60);
        p.colorMode(p.HSB, 360, 100, 100, 1);

        // 星空の初期化 (画面上半分に配置)
        for (let i = 0; i < STAR_COUNT; i++) {
          stars.push({
            x: p.random(p.width),
            y: p.random(p.height * 0.46),
            size: p.random(1.0, 2.2),
            baseBrightness: p.random(45, 90),
            blinkSpeed: p.random(0.02, 0.06),
          });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        for (const s of stars) {
          s.x = p.random(p.width);
          s.y = p.random(p.height * 0.46);
        }
      };

      p.draw = () => {
        const isPlaying = gameStateRef.current === "PLAYING";
        const currentBpm = bpmRef.current || 145;

        // エネルギー減衰
        kickEnergy *= 0.9;
        hitEnergy *= 0.88;

        // 色相の緩やかなシフト
        const hueSpeed = isPlaying ? 0.2 + kickEnergy * 0.5 : 0.08;
        baseHue = (baseHue + hueSpeed) % 360;

        // 背景クリア
        p.background(255, 60, 6 + kickEnergy * 3, 1.0);

        const horizonY = p.height * 0.46;
        const centerX = p.width / 2;
        const ctx = p.drawingContext as CanvasRenderingContext2D;

        // ==========================================
        // 1. 空のグラデーション (LinearGradientで一発描画・超軽量)
        // ==========================================
        p.push();
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        // HSBからRGB相当のグラデーションを定義
        const topHue = (baseHue + 40) % 360;
        skyGrad.addColorStop(0, `hsla(${topHue}, 80%, 6%, 0.95)`);
        skyGrad.addColorStop(
          1,
          `hsla(${baseHue}, 70%, ${16 + kickEnergy * 10}%, 0.9)`,
        );

        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, p.width, horizonY);

        // 星々 (軽量描画)
        p.noStroke();
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const blink = p.sin(p.frameCount * s.blinkSpeed + i) * 20;
          const bri = Math.min(
            100,
            Math.max(20, s.baseBrightness + blink),
          );
          p.fill((baseHue + 60) % 360, 35, bri, 0.75);
          p.circle(s.x, s.y, s.size * (1 + kickEnergy * 0.35));
        }
        p.pop();

        // ==========================================
        // 2. レトロSynthwave ネオンサン (Neon Sun)
        // ==========================================
        p.push();
        const sunRadius =
          Math.min(p.width, p.height) * 0.16 * (1 + kickEnergy * 0.08);
        const sunCenterY = horizonY - sunRadius * 0.22;

        // 太陽の背後グロー (RadialGradient 1回で描画)
        const glowRadius = sunRadius * 1.5;
        const sunGlow = ctx.createRadialGradient(
          centerX,
          sunCenterY,
          sunRadius * 0.6,
          centerX,
          sunCenterY,
          glowRadius,
        );
        sunGlow.addColorStop(
          0,
          `hsla(${(baseHue + 25) % 360}, 90%, 90%, ${0.28 + kickEnergy * 0.2})`,
        );
        sunGlow.addColorStop(
          1,
          `hsla(${(baseHue + 10) % 360}, 90%, 60%, 0)`,
        );
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(centerX, sunCenterY, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 太陽本体 (LinearGradient 1回で円を描画)
        const sunGrad = ctx.createLinearGradient(
          0,
          sunCenterY - sunRadius,
          0,
          sunCenterY + sunRadius,
        );
        sunGrad.addColorStop(0, `hsl(${(baseHue + 55) % 360}, 95%, 65%)`);
        sunGrad.addColorStop(1, `hsl(${baseHue}, 90%, 55%)`);
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(centerX, sunCenterY, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        // 太陽の下半分スリット (背景色の水平帯を数本描くだけで完全に表現)
        const slitCount = 6;
        p.noStroke();
        p.fill(255, 60, 6 + kickEnergy * 3, 1.0); // 背景と同じ色でマスク
        for (let s = 1; s <= slitCount; s++) {
          const ratio = s / (slitCount + 1);
          // 下に行くほどスリット間隔と太さが広がる
          const slitY = sunCenterY + ratio * sunRadius;
          const slitHeight = 2.2 + ratio * 4.5;
          const dy = slitY - sunCenterY;
          const halfW = Math.sqrt(
            Math.max(0, sunRadius * sunRadius - dy * dy),
          );
          if (halfW > 0) {
            p.rect(
              centerX - halfW - 2,
              slitY - slitHeight / 2,
              (halfW + 2) * 2,
              slitHeight,
            );
          }
        }
        p.pop();

        // ==========================================
        // 3. サイバー山脈 (Wireframe Mountains)
        // ==========================================
        p.push();
        p.stroke((baseHue + 30) % 360, 75, 80 + kickEnergy * 15, 0.65);
        p.strokeWeight(1.4);
        p.fill(260, 60, 8, 0.85);

        // 左山脈
        const mountainSegments = 16;
        p.beginShape();
        p.vertex(0, horizonY);
        for (let i = 0; i <= mountainSegments; i++) {
          const mx = (p.width * 0.48 * i) / mountainSegments;
          const n = p.noise(i * 0.26, 10);
          const peakH = p.map(n, 0.2, 0.8, 15, 85 + kickEnergy * 25);
          const taper = p.map(i, 0, mountainSegments, 1.0, 0.08);
          p.vertex(mx, horizonY - peakH * taper);
        }
        p.vertex(p.width * 0.48, horizonY);
        p.endShape(p.CLOSE);

        // 右山脈
        p.beginShape();
        p.vertex(p.width, horizonY);
        for (let i = 0; i <= mountainSegments; i++) {
          const mx = p.width - (p.width * 0.48 * i) / mountainSegments;
          const n = p.noise(i * 0.26 + 50, 20);
          const peakH = p.map(n, 0.2, 0.8, 15, 85 + kickEnergy * 25);
          const taper = p.map(i, 0, mountainSegments, 1.0, 0.08);
          p.vertex(mx, horizonY - peakH * taper);
        }
        p.vertex(p.width * 0.52, horizonY);
        p.endShape(p.CLOSE);
        p.pop();

        // ==========================================
        // 4. 無限3Dパースペクティブグリッド (Synthwave Grid)
        // ==========================================
        p.push();
        const gridBottom = p.height;
        const gridTotalHeight = gridBottom - horizonY;

        // ★ 奥から手前へ滑らかに疾走するスクロール進行度 (0..1) ★
        // 時間経過で scrollProgress が増加し、ラインが地平線から手前（下）へ走る
        const scrollSpeed = (currentBpm / 60) * 0.7;
        const scrollProgress = (p.millis() * 0.001 * scrollSpeed) % 1.0;

        // A. 奥行き横ライン (奥から手前へ迫り来る指数透視投影)
        const HORIZON_LINES = 18;
        for (let i = 0; i < HORIZON_LINES; i++) {
          // (i + scrollProgress) により、時間経過とともに fraction が増加して奥から手前へ進む
          const lineFraction =
            ((i + scrollProgress) % HORIZON_LINES) / HORIZON_LINES;
          if (lineFraction <= 0.03) continue; // 地平線直下はフォグで遮蔽

          // 指数カーブでリアルな3Dパースペクティブ
          const depthCurve = lineFraction ** 2.5;
          const y = horizonY + depthCurve * gridTotalHeight;

          // 奥（地平線）はフェードアウト、手前ほど鮮明に発光
          const fadeAlpha = lineFraction ** 1.5;
          const gridColorHue =
            (baseHue + p.lerp(0, 35, lineFraction)) % 360;

          p.stroke(
            gridColorHue,
            85,
            p.lerp(50, 95, lineFraction) + kickEnergy * 15,
            fadeAlpha * (0.7 + kickEnergy * 0.3),
          );
          p.strokeWeight(p.lerp(0.8, 2.0, lineFraction));
          p.line(0, y, p.width, y);
        }

        // B. 放射状縦ライン (中央消失点から広がるラインを分割なしで1パス描画)
        const VERTICAL_LINES = 18; // 左右合計37本
        p.stroke((baseHue + 15) % 360, 75, 85, 0.45 + kickEnergy * 0.3);
        p.strokeWeight(1.2);
        for (let i = -VERTICAL_LINES; i <= VERTICAL_LINES; i++) {
          const bottomX = centerX + (i * p.width) / 16;
          const topX = centerX + (i * p.width) / 95;
          // 分割ループを廃止し、1回の直線描画（奥は地平線フォグで自然にフェードアウト）
          p.line(topX, horizonY, bottomX, gridBottom);
        }

        // C. 打鍵パルス波 (ノーツ打鍵時に奥から手前へ疾走する光ビーム)
        for (let i = pulseWaves.length - 1; i >= 0; i--) {
          const pw = pulseWaves[i];
          pw.z += 0.038; // 奥から手前へ疾走
          pw.alpha *= 0.94;

          if (pw.z >= 1.0 || pw.alpha <= 0.02) {
            pulseWaves.splice(i, 1);
            continue;
          }

          const pulseY = horizonY + pw.z ** 2.5 * gridTotalHeight;
          const beamW = p.width * pw.z * 0.35;
          const targetLaneX =
            centerX + (pw.lane - 1.5) * (p.width * 0.15 * pw.z);

          p.stroke(180, 90, 100, pw.alpha * 0.85);
          p.strokeWeight(3.5 * pw.z + 1);
          p.line(
            targetLaneX - beamW / 2,
            pulseY,
            targetLaneX + beamW / 2,
            pulseY,
          );
        }
        p.pop();

        // ==========================================
        // 5. 地平線アトモスフェリック・フォグ (LinearGradient 1回で描画)
        // ==========================================
        p.push();
        const fogH = 60;
        const fogGrad = ctx.createLinearGradient(
          0,
          horizonY - fogH / 2,
          0,
          horizonY + fogH / 2,
        );
        const fogColor = `hsla(${(baseHue + 10) % 360}, 75%, ${15 + kickEnergy * 10}%, `;
        fogGrad.addColorStop(0, `${fogColor}0)`);
        fogGrad.addColorStop(
          0.5,
          `${fogColor}${0.7 + kickEnergy * 0.25})`,
        );
        fogGrad.addColorStop(1, `${fogColor}0)`);

        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, horizonY - fogH / 2, p.width, fogH);
        p.pop();

        // ==========================================
        // 6. 打鍵レーザーフラッシュ (画面両端の垂直パルス)
        // ==========================================
        if (hitEnergy > 0.05) {
          p.push();
          const flashAlpha = hitEnergy * 0.35;
          p.stroke((baseHue + 160) % 360, 85, 100, flashAlpha);
          p.strokeWeight(hitEnergy * 6);
          p.line(10, 0, 10, p.height);
          p.line(p.width - 10, 0, p.width - 10, p.height);
          p.pop();
        }
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
      } else if (detail.type === "hit") {
        hitEnergy = 1.0;
        if (detail.lane !== undefined) {
          hitLane = detail.lane;
          // グリッドを奥から手前へ疾走するパルス波
          pulseWaves.push({
            z: 0.05,
            lane: hitLane,
            alpha: 1.0,
          });
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
