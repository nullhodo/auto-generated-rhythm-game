import type { HitJudge, SoundEvent } from "../types/game";
import { midiToFreq } from "./song-generator";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private sidechainAmount = 1.0;
  private isMuted = false;

  public async init(): Promise<void> {
    if (this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext
        : (globalThis as unknown as { AudioContext: typeof AudioContext })
            .AudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    // マスターチェイン: MasterGain -> Compressor -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(25, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // 効果音チェイン (音楽のサイドチェインに影響されない独立ゲイン)
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.sfxGain.connect(this.ctx.destination);

    // ノイズバッファ生成
    this.createNoiseBuffers();
  }

  private createNoiseBuffers(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 1; // 1秒分

    // White Noise
    const whiteBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const whiteData = whiteBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuffer = whiteBuffer;

    // Pink Noise (Paul Kellet's filter)
    const pinkBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const pinkData = pinkBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      pinkData[i] =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.pinkNoiseBuffer = pinkBuffer;
  }

  public updateSidechain(
    currentTimeMs: number,
    songEndTimeMs: number,
  ): void {
    if (!this.ctx || !this.masterGain) return;

    if (currentTimeMs > songEndTimeMs + 2000) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      return;
    }

    if (currentTimeMs > songEndTimeMs - 5000) {
      const remainingRatio = Math.max(
        0,
        Math.min(1, (songEndTimeMs - currentTimeMs) / 5000),
      );
      const targetVol = remainingRatio * 0.6;
      this.masterGain.gain.setValueAtTime(targetVol, this.ctx.currentTime);
    } else {
      // サイドチェインの復帰
      this.sidechainAmount =
        this.sidechainAmount + (1.0 - this.sidechainAmount) * 0.15;
      const baseGain = this.isMuted ? 0 : 0.6;
      this.masterGain.gain.setValueAtTime(
        baseGain * this.sidechainAmount,
        this.ctx.currentTime,
      );
    }
  }

  public playEvent(event: SoundEvent): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    switch (event.soundType) {
      case "kick":
        this.playKick(now);
        break;
      case "snare":
        this.playSnare(now);
        break;
      case "hat":
        this.playHat(now);
        break;
      case "bass":
        if (event.note !== undefined) {
          this.playBass(event.note, now);
        }
        break;
      case "melody":
        if (event.note !== undefined) {
          this.playMelody(event.note, now);
        }
        break;
      case "chord":
        if (event.chordNotes) {
          this.playChord(event.chordNotes, now);
        }
        break;
    }
  }

  private playKick(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    // 重低音サブベースオシレーター (180Hz -> 38Hz 急速指数降下)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(180, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.28);

    // パンチ胴鳴り (Triangle波 120Hz -> 45Hz)
    const punchOsc = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punchOsc.type = "triangle";
    punchOsc.frequency.setValueAtTime(120, now);
    punchOsc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    punchGain.gain.setValueAtTime(0.7, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    punchOsc.connect(punchGain);
    punchGain.connect(this.masterGain);
    punchOsc.start(now);
    punchOsc.stop(now + 0.08);

    // アタックのクリック音
    if (this.whiteNoiseBuffer) {
      const click = this.ctx.createBufferSource();
      const clickGain = this.ctx.createGain();
      click.buffer = this.whiteNoiseBuffer;
      clickGain.gain.setValueAtTime(0.7, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      click.connect(clickGain);
      clickGain.connect(this.masterGain);
      click.start(now);
      click.stop(now + 0.02);
    }

    // サイドチェイン圧縮効果
    this.sidechainAmount = 0.15;
  }

  private playSnare(now: number): void {
    if (!this.ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    // トーン胴鳴り (220Hz -> 80Hz)
    const toneOsc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    toneOsc.type = "sine";
    toneOsc.frequency.setValueAtTime(220, now);
    toneOsc.frequency.exponentialRampToValueAtTime(80, now + 0.09);

    toneGain.gain.setValueAtTime(0.6, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    toneOsc.connect(toneGain);
    toneGain.connect(this.masterGain);
    toneOsc.start(now);
    toneOsc.stop(now + 0.09);

    // ノイズ成分
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(850, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.22);
  }

  private playHat(now: number): void {
    if (!this.ctx || !this.masterGain || !this.whiteNoiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(5200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.05);
  }

  /**
   * 重厚なReese / Cyberpunk Sawベース (デチューン2基 + サブサイン波)
   */
  private playBass(midiNote: number, now: number): void {
    if (!this.ctx || !this.masterGain) return;
    const freq = midiToFreq(midiNote);

    // デチューンSawtooth 2基 (うねりのあるローエンド)
    const saw1 = this.ctx.createOscillator();
    const saw2 = this.ctx.createOscillator();
    saw1.type = "sawtooth";
    saw2.type = "sawtooth";
    saw1.frequency.setValueAtTime(freq, now);
    saw2.frequency.setValueAtTime(freq, now);
    saw1.detune.setValueAtTime(-8, now);
    saw2.detune.setValueAtTime(8, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(2.8, now);

    const sawGain = this.ctx.createGain();
    sawGain.gain.setValueAtTime(0.001, now);
    sawGain.gain.linearRampToValueAtTime(0.45, now + 0.012);
    sawGain.gain.exponentialRampToValueAtTime(0.2, now + 0.2);
    sawGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    saw1.connect(filter);
    saw2.connect(filter);
    filter.connect(sawGain);
    sawGain.connect(this.masterGain);

    saw1.start(now);
    saw2.start(now);
    saw1.stop(now + 0.38);
    saw2.stop(now + 0.38);

    // Sub sine (1オクターブ下で床を鳴らす重低音)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(midiToFreq(midiNote - 12), now);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.55, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.42);
  }

  /**
   * 重厚なコード・パッドバッキング (和音3音の豊かなハーモニー)
   */
  private playChord(chordNotes: number[], now: number): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const masterGain = this.masterGain;

    for (const midi of chordNotes) {
      const freq = midiToFreq(midi);

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1500, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.45);
      filter.Q.setValueAtTime(1.5, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.5);
    }
  }

  /**
   * 華やかで抜けの良いリードメロディ (Square + Sawtooth デチューン合成)
   */
  private playMelody(midiNote: number, now: number): void {
    if (!this.ctx || !this.masterGain) return;
    const freq = midiToFreq(midiNote);

    const oscSquare = this.ctx.createOscillator();
    const oscSaw = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    oscSquare.type = "square";
    oscSquare.frequency.setValueAtTime(freq, now);

    oscSaw.type = "sawtooth";
    oscSaw.frequency.setValueAtTime(freq, now);
    oscSaw.detune.setValueAtTime(6, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(1.2, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    oscSquare.connect(filter);
    oscSaw.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    oscSquare.start(now);
    oscSaw.start(now);
    oscSquare.stop(now + 0.36);
    oscSaw.stop(now + 0.36);
  }

  public fadeOutAndStop(durationSec = 0.5): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.001, now + durationSec);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx) {
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(
          this.isMuted ? 0 : 0.6,
          this.ctx.currentTime,
        );
      }
      if (this.sfxGain) {
        this.sfxGain.gain.setValueAtTime(
          this.isMuted ? 0 : 0.7,
          this.ctx.currentTime,
        );
      }
    }
    return this.isMuted;
  }

  /**
   * 打鍵時のヒットサウンド (短い押し: スネア1音ショット)
   */
  public playHitSound(judge: HitJudge): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    switch (judge) {
      case "PERFECT":
        this.playSnareShot(now, 240, 95, 0.15, 0.65, 0.5);
        break;
      case "GREAT":
        this.playSnareShot(now, 210, 90, 0.12, 0.5, 0.38);
        break;
      case "GOOD":
        this.playSnareShot(now, 180, 85, 0.1, 0.38, 0.28);
        break;
      case "COMPLETE":
        // ロール完了のアクセントスネア + チャイム
        this.playSnareShot(now, 260, 100, 0.2, 0.75, 0.55);
        this.playCompleteChime(now);
        break;
      case "MISS":
        this.playMissSound(now);
        break;
    }
  }

  /**
   * 長押し（ホールド）中のスネア連打（スネアロール）効果音
   */
  public playHoldTick(): void {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    this.playSnareRollTap(now);
  }

  /**
   * スネア1音ショット (胴鳴りトーン + スナッピーノイズ + アタッククリック)
   */
  private playSnareShot(
    now: number,
    startTone: number,
    endTone: number,
    noiseDuration: number,
    toneVolume: number,
    noiseVolume: number,
  ): void {
    if (!this.ctx || !this.sfxGain) return;

    // 1. スネア胴鳴りトーン (Sine波ピッチベンド)
    const toneOsc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    toneOsc.type = "sine";
    toneOsc.frequency.setValueAtTime(startTone, now);
    toneOsc.frequency.exponentialRampToValueAtTime(endTone, now + 0.08);

    toneGain.gain.setValueAtTime(toneVolume, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    toneOsc.connect(toneGain);
    toneGain.connect(this.sfxGain);
    toneOsc.start(now);
    toneOsc.stop(now + 0.08);

    // 2. スネアスナッピー (ピンクノイズ + HighPass)
    if (this.pinkNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.pinkNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1100, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(noiseVolume, now);
      noiseGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + noiseDuration,
      );

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(now);
      noise.stop(now + noiseDuration);
    }

    // 3. アタッククリック (ホワイトノイズ + BandPass 5200Hz)
    if (this.whiteNoiseBuffer) {
      const click = this.ctx.createBufferSource();
      click.buffer = this.whiteNoiseBuffer;

      const clickFilter = this.ctx.createBiquadFilter();
      clickFilter.type = "bandpass";
      clickFilter.frequency.setValueAtTime(3200, now);
      clickFilter.Q.setValueAtTime(2.2, now);

      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(0.3, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.sfxGain);

      click.start(now);
      click.stop(now + 0.016);
    }
  }

  /**
   * スネアロール（連打）用タイトタップ
   */
  private playSnareRollTap(now: number): void {
    if (!this.ctx || !this.sfxGain) return;

    // スティックの打撃感 (微小なピッチ揺らぎでリアルなロール感を演出)
    const pitchJitter = 230 + Math.random() * 40;
    const tone = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();

    tone.type = "triangle";
    tone.frequency.setValueAtTime(pitchJitter, now);
    tone.frequency.exponentialRampToValueAtTime(110, now + 0.03);

    toneGain.gain.setValueAtTime(0.24, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    tone.connect(toneGain);
    toneGain.connect(this.sfxGain);
    tone.start(now);
    tone.stop(now + 0.03);

    if (this.pinkNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.pinkNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1400, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      noise.stop(now + 0.04);
    }
  }

  private playCompleteChime(now: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const sfxGain = this.sfxGain;

    // アルペジオ和音: C5, E5, G5, C6 (温かみのある煌めき)
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, idx) => {
      const delay = idx * 0.025;
      const t = now + delay;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  private playMissSound(now: number): void {
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }
}
