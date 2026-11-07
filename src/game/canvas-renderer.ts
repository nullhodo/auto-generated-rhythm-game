import type {
  ActiveNote,
  GameLayout,
  HitEffect,
  LaneEffect,
  Particle,
} from "../types/game";

const LANE_KEYS = ["D", "F", "J", "K"];

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(
    layout: GameLayout,
    currentTime: number,
    noteSpeed: number,
    lanes: ActiveNote[][],
    laneEffects: LaneEffect[],
    hitEffects: HitEffect[],
    particles: Particle[],
  ): void {
    const { ctx } = this;
    const {
      width,
      height,
      laneWidth,
      totalLaneWidth,
      laneXStart,
      judgeLineY,
    } = layout;

    // 全体背景クリア
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    // プレイエリア背景
    ctx.fillStyle = "#141419";
    ctx.fillRect(laneXStart, 0, totalLaneWidth, height);

    // レーン区切り線
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = laneXStart + i * laneWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // レーンフラッシュ
    for (let i = laneEffects.length - 1; i >= 0; i--) {
      const eff = laneEffects[i];
      eff.life--;
      const alpha = Math.max(0, (eff.life / 10) * 0.45);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(
        laneXStart + eff.lane * laneWidth,
        0,
        laneWidth,
        height,
      );
      if (eff.life <= 0) {
        laneEffects.splice(i, 1);
      }
    }

    // 判定ライン
    ctx.save();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(laneXStart, judgeLineY);
    ctx.lineTo(laneXStart + totalLaneWidth, judgeLineY);
    ctx.stroke();
    ctx.restore();

    // ノーツ描画
    this.renderNotes(
      lanes,
      currentTime,
      noteSpeed,
      laneXStart,
      laneWidth,
      judgeLineY,
    );

    // エフェクト & パーティクル
    this.renderEffects(hitEffects, particles);

    // キーガイド描画
    this.renderKeyGuides(layout);
  }

  private renderNotes(
    lanes: ActiveNote[][],
    currentTime: number,
    noteSpeed: number,
    laneXStart: number,
    laneWidth: number,
    judgeLineY: number,
  ): void {
    const { ctx } = this;

    for (let i = 0; i < 4; i++) {
      const laneNotes = lanes[i];
      for (let j = laneNotes.length - 1; j >= 0; j--) {
        const note = laneNotes[j];
        const noteProgress =
          (currentTime - (note.time - noteSpeed)) / noteSpeed;
        const y = -50 + noteProgress * (judgeLineY - -50);
        const x = laneXStart + i * laneWidth;

        if (note.noteType === "normal") {
          // 通常ノーツ (Cyan)
          ctx.save();
          ctx.fillStyle = "#00e5ff";
          ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
          ctx.shadowBlur = 8;
          this.roundRect(x + 4, y - 12, laneWidth - 8, 24, 6);
          ctx.fill();

          // センターハイライト
          ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
          this.roundRect(x + 10, y - 4, laneWidth - 20, 8, 2);
          ctx.fill();
          ctx.restore();
        } else {
          // ロングノーツ (Green)
          const endProgress =
            (currentTime - (note.endTime - noteSpeed)) / noteSpeed;
          const endY = -50 + endProgress * (judgeLineY - -50);
          let tailY = Math.min(y, judgeLineY);
          if (!note.isHolding) {
            tailY = y;
          }

          // ロングの帯
          ctx.save();
          ctx.fillStyle = "rgba(0, 255, 136, 0.35)";
          ctx.fillRect(x + 10, endY, laneWidth - 20, tailY - endY);

          // ヘッドバー
          ctx.fillStyle = "#00ff88";
          ctx.shadowColor = "rgba(0, 255, 136, 0.6)";
          ctx.shadowBlur = 8;
          this.roundRect(x + 4, tailY - 12, laneWidth - 8, 24, 6);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  private renderEffects(
    hitEffects: HitEffect[],
    particles: Particle[],
  ): void {
    const { ctx } = this;

    // パーティクル
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.life -= 2;

      if (p.life <= 0) {
        particles.splice(i, 1);
      } else {
        const alpha = Math.max(0, p.life / 80);
        ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 判定文字エフェクト
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = hitEffects.length - 1; i >= 0; i--) {
      const eff = hitEffects[i];
      eff.life--;

      const alpha = Math.max(0, eff.life / 30);
      const scale = eff.life > 20 ? 1.0 + (eff.life - 20) * 0.04 : 1.0;
      const offsetY = (30 - eff.life) * 1.5;

      ctx.save();
      ctx.font = `bold ${Math.floor(36 * scale)}px "Zen Maru Gothic", sans-serif`;
      ctx.fillStyle = `rgba(${eff.color[0]}, ${eff.color[1]}, ${eff.color[2]}, ${alpha})`;
      ctx.shadowColor = `rgba(${eff.color[0]}, ${eff.color[1]}, ${eff.color[2]}, 0.8)`;
      ctx.shadowBlur = 10;
      ctx.fillText(eff.text, eff.x, eff.y - offsetY);
      ctx.restore();

      if (eff.life <= 0) {
        hitEffects.splice(i, 1);
      }
    }
  }

  private renderKeyGuides(layout: GameLayout): void {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 22px "Zen Maru Gothic", sans-serif';
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";

    for (let i = 0; i < 4; i++) {
      const x =
        layout.laneXStart + i * layout.laneWidth + layout.laneWidth / 2;
      const y = layout.judgeLineY + 36;
      ctx.fillText(LANE_KEYS[i], x, y);
    }
    ctx.restore();
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + w - radius, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.ctx.lineTo(x + w, y + h - radius);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.ctx.lineTo(x + radius, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
}
