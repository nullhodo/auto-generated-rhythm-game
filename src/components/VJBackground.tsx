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
  z: number; // 0 (手前) .. 1 (奥) または奥から手前
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
    const STAR_COUNT = 80;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.frameRate(60);
        p.colorMode(p.HSB, 360, 100, 100, 1);

        // 星空の初期化 (画面上半分にランダム配置)
        for (let i = 0; i < STAR_COUNT; i++) {
          stars.push({
            x: p.random(p.width),
            y: p.random(p.height * 0.48),
            size: p.random(1.0, 2.6),
            baseBrightness: p.random(50, 95),
            blinkSpeed: p.random(0.02, 0.07),
          });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        // リサイズ時に星を再配置
        for (const s of stars) {
          s.x = p.random(p.width);
          s.y = p.random(p.height * 0.48);
        }
      };

      p.draw = () => {
        const isPlaying = gameStateRef.current === "PLAYING";
        const currentBpm = bpmRef.current || 145;

        // エネルギー減衰
        kickEnergy *= 0.9;
        hitEnergy *= 0.88;

        // 色相の緩やかなシフト (楽曲進行感)
        const hueSpeed = isPlaying ? 0.2 + kickEnergy * 0.5 : 0.08;
        baseHue = (baseHue + hueSpeed) % 360;

        // 背景クリア (ディープサイバースペース: 深遠なダークパープル〜ネイビー)
        p.background(255, 65, 6 + kickEnergy * 4, 1.0);

        const horizonY = p.height * 0.46;
        const centerX = p.width / 2;

        // ==========================================
        // 1. 空のグラデーション & 背景スターフィールド
        // ==========================================
        p.push();
        p.noStroke();
        // 空の上部から地平線に向かうグラデーション
        for (let y = 0; y < horizonY; y += 8) {
          const ratio = y / horizonY;
          // 上空は深紫、地平線近くはネオンピンクのグロー
          const skyHue = p.lerp(baseHue + 40, baseHue, ratio) % 360;
          const skySat = p.lerp(80, 60, ratio);
          const skyBri = p.lerp(6, 18 + kickEnergy * 12, ratio);
          p.fill(skyHue, skySat, skyBri, 0.9);
          p.rect(0, y, p.width, 8);
        }

        // 星々 (キラキラ瞬く微細スター)
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const blink = p.sin(p.frameCount * s.blinkSpeed + i) * 25;
          const bri = Math.min(
            100,
            Math.max(20, s.baseBrightness + blink),
          );
          p.fill((baseHue + 60) % 360, 40, bri, 0.8);
          p.circle(s.x, s.y, s.size * (1 + kickEnergy * 0.4));
        }
        p.pop();

        // ==========================================
        // 2. レトロSynthwave ネオンサン (Neon Sun)
        // ==========================================
        p.push();
        const sunRadius =
          Math.min(p.width, p.height) * 0.16 * (1 + kickEnergy * 0.09);
        const sunCenterY = horizonY - sunRadius * 0.22;

        // 太陽の背後グロー
        p.noStroke();
        for (let r = sunRadius * 1.6; r > sunRadius; r -= 10) {
          const glowAlpha = p.map(
            r,
            sunRadius,
            sunRadius * 1.6,
            0.18 + kickEnergy * 0.15,
            0,
          );
          p.fill((baseHue + 20) % 360, 85, 95, glowAlpha);
          p.circle(centerX, sunCenterY, r * 2);
        }

        // 太陽本体 (上部オレンジ〜下部マゼンタのグラデーション)
        const sunStep = 3;
        for (
          let y = sunCenterY - sunRadius;
          y <= sunCenterY + sunRadius;
          y += sunStep
        ) {
          const dy = y - sunCenterY;
          const halfW = Math.sqrt(
            Math.max(0, sunRadius * sunRadius - dy * dy),
          );
          if (halfW <= 0) continue;

          // 下半分にレトロSynthwave特有の水平スリットを入れる
          const normalizedY =
            (y - (sunCenterY - sunRadius)) / (sunRadius * 2);
          if (normalizedY > 0.45) {
            // 下に行くほどスリット間隔が広がる
            const slitPhase = (y - sunCenterY) % 10;
            const slitCut = p.map(normalizedY, 0.45, 1.0, 1.5, 4.5);
            if (slitPhase < slitCut) {
              continue; // スリットの隙間
            }
          }

          const sunHue = p.lerp(
            (baseHue + 55) % 360,
            baseHue,
            normalizedY,
          );
          p.fill(sunHue, 90, 100, 0.95);
          p.rect(centerX - halfW, y, halfW * 2, sunStep);
        }
        p.pop();

        // ==========================================
        // 3. サイバー山脈 (Wireframe Mountains)
        // ==========================================
        p.push();
        p.stroke((baseHue + 30) % 360, 75, 80 + kickEnergy * 15, 0.65);
        p.strokeWeight(1.5);
        p.fill(260, 60, 8, 0.85); // 山の内部は暗く遮光

        // 左山脈
        p.beginShape();
        p.vertex(0, horizonY);
        const mountainSegments = 24;
        for (let i = 0; i <= mountainSegments; i++) {
          const mx = (p.width * 0.48 * i) / mountainSegments;
          // パーリンノイズによる有機的な峰
          const n = p.noise(i * 0.22, 10);
          const peakH = p.map(n, 0.2, 0.8, 15, 85 + kickEnergy * 25);
          // 中央の太陽に向かってなだらかに下がる
          const taper = p.map(i, 0, mountainSegments, 1.0, 0.1);
          const my = horizonY - peakH * taper;
          p.vertex(mx, my);
        }
        p.vertex(p.width * 0.48, horizonY);
        p.endShape(p.CLOSE);

        // 右山脈
        p.beginShape();
        p.vertex(p.width, horizonY);
        for (let i = 0; i <= mountainSegments; i++) {
          const mx = p.width - (p.width * 0.48 * i) / mountainSegments;
          const n = p.noise(i * 0.22 + 50, 20);
          const peakH = p.map(n, 0.2, 0.8, 15, 85 + kickEnergy * 25);
          const taper = p.map(i, 0, mountainSegments, 1.0, 0.1);
          const my = horizonY - peakH * taper;
          p.vertex(mx, my);
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

        // BPMに同期した滑らかな前進スクロール (0..1)
        const scrollSpeed = (currentBpm / 60) * 0.65;
        const scrollProgress = (p.millis() * 0.001 * scrollSpeed) % 1.0;

        // A. 奥行き横ライン (指数透視投影により手前は広く、奥は高密度に収束)
        const HORIZON_LINES = 28;
        for (let i = 1; i <= HORIZON_LINES; i++) {
          // 0 (地平線直下) .. 1 (画面手前最下部)
          const lineFraction = (i - scrollProgress) / HORIZON_LINES;
          if (lineFraction <= 0 || lineFraction > 1) continue;

          // 指数カーブでリアルな3Dパースペクティブを実現
          const depthCurve = lineFraction ** 2.6;
          const y = horizonY + depthCurve * gridTotalHeight;

          // ★ 奥（地平線付近）は完全フェードアウト、手前ほど鮮やかに発光 ★
          const fadeAlpha = lineFraction ** 1.6;
          const gridColorHue =
            (baseHue + p.lerp(0, 40, lineFraction)) % 360;

          p.stroke(
            gridColorHue,
            85,
            p.lerp(50, 95, lineFraction) + kickEnergy * 15,
            fadeAlpha * (0.7 + kickEnergy * 0.3),
          );
          p.strokeWeight(p.lerp(0.8, 2.2, lineFraction));
          p.line(0, y, p.width, y);
        }

        // B. 放射状縦ライン (中央消失点から画面左右・下端へ広大に広がる)
        const VERTICAL_LINES = 36;
        for (let i = -VERTICAL_LINES; i <= VERTICAL_LINES; i++) {
          // 画面下端でのX座標 (画面外までワイドに展開)
          const bottomX = centerX + (i * p.width) / 16;
          // 地平線でのX座標 (消失点付近へ収束)
          const topX = centerX + (i * p.width) / 95;

          // 縦線も地平線付近を薄く、手前を濃くするために分割描画
          const segments = 12;
          for (let s = 0; s < segments; s++) {
            const frac1 = s / segments;
            const frac2 = (s + 1) / segments;

            const d1 = frac1 ** 2.6;
            const d2 = frac2 ** 2.6;

            const x1 = p.lerp(topX, bottomX, frac1);
            const y1 = horizonY + d1 * gridTotalHeight;
            const x2 = p.lerp(topX, bottomX, frac2);
            const y2 = horizonY + d2 * gridTotalHeight;

            const segAlpha = frac2 ** 1.6 * (0.45 + kickEnergy * 0.3);
            p.stroke((baseHue + 15) % 360, 75, 85, segAlpha);
            p.strokeWeight(p.lerp(0.6, 1.8, frac2));
            p.line(x1, y1, x2, y2);
          }
        }

        // C. 打鍵パルス波 (ノーツ打鍵時にグリッド上を手前へ疾走する光のビーム)
        for (let i = pulseWaves.length - 1; i >= 0; i--) {
          const pw = pulseWaves[i];
          pw.z += 0.035; // 手前へ進む
          pw.alpha *= 0.94;

          if (pw.z >= 1.0 || pw.alpha <= 0.02) {
            pulseWaves.splice(i, 1);
            continue;
          }

          const pulseY = horizonY + pw.z ** 2.6 * gridTotalHeight;
          const beamW = p.width * pw.z * 0.35;
          const targetLaneX =
            centerX + (pw.lane - 1.5) * (p.width * 0.15 * pw.z);

          p.stroke(180, 90, 100, pw.alpha * 0.8);
          p.strokeWeight(4 * pw.z + 1);
          p.line(
            targetLaneX - beamW / 2,
            pulseY,
            targetLaneX + beamW / 2,
            pulseY,
          );
        }
        p.pop();

        // ==========================================
        // 5. 地平線アトモスフェリック・フォグ (Atmospheric Horizon Fog)
        // ==========================================
        p.push();
        p.noStroke();
        // 地平線の境界線を滑らかにぼかし、グリッドの奥を霞の中に完全に溶け込ませる
        const fogRange = 45;
        for (let dy = -fogRange; dy <= fogRange; dy += 4) {
          const distRatio = Math.abs(dy) / fogRange;
          const fogAlpha = Math.max(
            0,
            (1 - distRatio) * (0.65 + kickEnergy * 0.2),
          );
          // 地平線の霧はネオンマゼンタ〜ディープシアンの微粒子光
          p.fill((baseHue + 10) % 360, 70, 14 + kickEnergy * 10, fogAlpha);
          p.rect(0, horizonY + dy, p.width, 5);
        }
        p.pop();

        // ==========================================
        // 6. 打鍵レーザーフラッシュ (画面両端の垂直パルス)
        // ==========================================
        if (hitEnergy > 0.05) {
          p.push();
          const flashAlpha = hitEnergy * 0.4;
          p.stroke((baseHue + 160) % 360, 85, 100, flashAlpha);
          p.strokeWeight(hitEnergy * 8);

          // 画面左右端のサイバーネオンバー
          p.line(12, 0, 12, p.height);
          p.line(p.width - 12, 0, p.width - 12, p.height);
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
          // グリッドを前進する光波パルスを生成
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
