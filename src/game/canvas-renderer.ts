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

    // 全体背景クリア (背面のp5 VJビジュアライザーを透過表示)
    ctx.clearRect(0, 0, width, height);

    // プレイエリア背景 (ノーツの視認性を保つため半透明の遮光ダークネイビー)
    ctx.fillStyle = "rgba(12, 12, 18, 0.88)";
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
          this.renderLongNote(
            note,
            x,
            y,
            endY,
            laneWidth,
            judgeLineY,
            currentTime,
          );
        }
      }
    }
  }

  private renderLongNote(
    note: ActiveNote,
    x: number,
    y: number,
    endY: number,
    laneWidth: number,
    judgeLineY: number,
    currentTime: number,
  ): void {
    const { ctx } = this;
    let tailY = Math.min(y, judgeLineY);
    if (!note.isHolding) {
      tailY = y;
    }

    const bodyTop = endY;
    const bodyBottom = tailY;
    const bodyHeight = bodyBottom - bodyTop;

    if (bodyHeight > 0) {
      ctx.save();

      // 1. ホールド中のレーンエネルギービーム (判定ラインから上部へのネオングロー)
      if (note.isHolding) {
        const beamTop = Math.max(0, endY - 60);
        const beamGrad = ctx.createLinearGradient(
          0,
          judgeLineY,
          0,
          beamTop,
        );
        beamGrad.addColorStop(0, "rgba(0, 255, 136, 0.35)");
        beamGrad.addColorStop(0.6, "rgba(0, 255, 136, 0.15)");
        beamGrad.addColorStop(1, "rgba(0, 255, 136, 0)");
        ctx.fillStyle = beamGrad;
        ctx.fillRect(x, beamTop, laneWidth, judgeLineY - beamTop);
      }

      // 2. 帯本体のグラデーション塗り
      const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
      if (note.isHolding) {
        bodyGrad.addColorStop(0, "rgba(0, 255, 136, 0.3)");
        bodyGrad.addColorStop(0.7, "rgba(0, 255, 136, 0.55)");
        bodyGrad.addColorStop(1, "rgba(120, 255, 190, 0.75)");
      } else {
        bodyGrad.addColorStop(0, "rgba(0, 255, 136, 0.2)");
        bodyGrad.addColorStop(1, "rgba(0, 255, 136, 0.45)");
      }

      const bodyX = x + 12;
      const bodyW = laneWidth - 24;
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(bodyX, bodyTop, bodyW, bodyHeight);

      // 3. 左右のネオンレールライン
      ctx.strokeStyle = note.isHolding
        ? "rgba(180, 255, 210, 0.95)"
        : "rgba(0, 255, 136, 0.75)";
      ctx.lineWidth = note.isHolding ? 3 : 2;
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = note.isHolding ? 10 : 6;
      ctx.beginPath();
      ctx.moveTo(bodyX, bodyTop);
      ctx.lineTo(bodyX, bodyBottom);
      ctx.moveTo(bodyX + bodyW, bodyTop);
      ctx.lineTo(bodyX + bodyW, bodyBottom);
      ctx.stroke();

      // 4. 帯内部のエネルギーパルス模様 (下方向へ流れるストライプ)
      const stripeSpacing = 28;
      const stripeOffset = (currentTime * 0.15) % stripeSpacing;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (
        let sy = bodyBottom - stripeOffset;
        sy >= bodyTop;
        sy -= stripeSpacing
      ) {
        ctx.moveTo(bodyX + 4, sy);
        ctx.lineTo(bodyX + bodyW - 4, sy);
      }
      ctx.stroke();

      ctx.restore();
    }

    // 5. 終端 (Tail Cap) バーの描画
    ctx.save();
    ctx.fillStyle = "#00ff88";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 8;
    this.roundRect(x + 6, endY - 8, laneWidth - 12, 16, 4);
    ctx.fill();
    ctx.stroke();

    // 終端センターアクセント
    ctx.fillStyle = "#ffffff";
    this.roundRect(x + laneWidth / 2 - 10, endY - 2, 20, 4, 2);
    ctx.fill();
    ctx.restore();

    // 6. ヘッドバーの描画
    ctx.save();
    if (note.isHolding) {
      // ホールド中の打鍵点パルス拡大
      const pulse = Math.sin(currentTime * 0.03) * 3;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 18;
      this.roundRect(
        x + 2 - pulse / 2,
        tailY - 14 - pulse / 2,
        laneWidth - 4 + pulse,
        28 + pulse,
        8,
      );
      ctx.fill();

      // インサイドコア
      ctx.fillStyle = "#00ff88";
      this.roundRect(x + 8, tailY - 8, laneWidth - 16, 16, 4);
      ctx.fill();

      // HOLDING テキスト
      ctx.font = 'bold 13px "Zen Maru Gothic", sans-serif';
      ctx.fillStyle = "#00ff88";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 8;
      ctx.fillText("HOLDING", x + laneWidth / 2, tailY - 18);
    } else {
      ctx.fillStyle = "#00ff88";
      ctx.shadowColor = "rgba(0, 255, 136, 0.7)";
      ctx.shadowBlur = 8;
      this.roundRect(x + 4, tailY - 12, laneWidth - 8, 24, 6);
      ctx.fill();

      // センターハイライト
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      this.roundRect(x + 10, tailY - 4, laneWidth - 20, 8, 2);
      ctx.fill();
    }
    ctx.restore();
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
