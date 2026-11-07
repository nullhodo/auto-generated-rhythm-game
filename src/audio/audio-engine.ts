import type { SoundEvent } from "../types/game";
import { midiToFreq } from "./song-generator";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
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
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new AudioContextClass();

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    // マスターチェイン: MasterGain -> Compressor -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

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
    }
  }

  private playKick(now: number): void {
    if (!this.ctx || !this.masterGain) return;

    // サブベースオシレーター（ピッチベンド）
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);

    // アタックのクリック音
    if (this.whiteNoiseBuffer) {
      const click = this.ctx.createBufferSource();
      const clickGain = this.ctx.createGain();
      click.buffer = this.whiteNoiseBuffer;
      clickGain.gain.setValueAtTime(0.6, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      click.connect(clickGain);
      clickGain.connect(this.masterGain);
      click.start(now);
      click.stop(now + 0.02);
    }

    // サイドチェイン圧縮効果
    this.sidechainAmount = 0.2;
  }

  private playSnare(now: number): void {
    if (!this.ctx || !this.masterGain || !this.pinkNoiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.pinkNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1000, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.18);
  }

  private playHat(now: number): void {
    if (!this.ctx || !this.masterGain || !this.whiteNoiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7000, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.05);
  }

  private playBass(midiNote: number, now: number): void {
    if (!this.ctx || !this.masterGain) return;
    const freq = midiToFreq(midiNote);

    // Sawtooth
    const saw = this.ctx.createOscillator();
    const sawGain = this.ctx.createGain();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(freq, now);

    sawGain.gain.setValueAtTime(0.001, now);
    sawGain.gain.linearRampToValueAtTime(0.4, now + 0.01);
    sawGain.gain.exponentialRampToValueAtTime(0.15, now + 0.2);
    sawGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    saw.connect(sawGain);
    sawGain.connect(this.masterGain);
    saw.start(now);
    saw.stop(now + 0.35);

    // Sub sine (1オクターブ下)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(midiToFreq(midiNote - 12), now);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.5, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.4);
  }

  private playMelody(midiNote: number, now: number): void {
    if (!this.ctx || !this.masterGain) return;
    const freq = midiToFreq(midiNote);

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  public fadeOutAndStop(durationSec = 0.5): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.001, now + durationSec);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        this.isMuted ? 0 : 0.6,
        this.ctx.currentTime,
      );
    }
    return this.isMuted;
  }
}
