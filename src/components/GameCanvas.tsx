import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { AudioEngine } from "../audio/audio-engine";
import { CanvasRenderer } from "../game/canvas-renderer";
import { GameEngine, KEY_TO_LANE, NOTE_SPEED } from "../game/game-engine";
import { computeGameLayout } from "../game/layout";
import {
  bpmAtom,
  comboAtom,
  gameStateAtom,
  isMutedAtom,
  maxComboAtom,
  scoreAtom,
  songMetaAtom,
} from "../state/atoms";
import type { GameLayout } from "../types/game";

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useAtom(gameStateAtom);
  const setScore = useSetAtom(scoreAtom);
  const setCombo = useSetAtom(comboAtom);
  const setMaxCombo = useSetAtom(maxComboAtom);
  const setBpm = useSetAtom(bpmAtom);
  const setIsMuted = useSetAtom(isMutedAtom);
  const setSongMeta = useSetAtom(songMetaAtom);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const layoutRef = useRef<GameLayout>({
    width: window.innerWidth,
    height: window.innerHeight,
    laneWidth: 100,
    totalLaneWidth: 400,
    laneXStart: 0,
    judgeLineY: 500,
  });

  // オーディオエンジンの初期化
  useEffect(() => {
    const audio = new AudioEngine();
    audioEngineRef.current = audio;

    const engine = new GameEngine(audio, {
      onScoreChange: (s) => setScore(s),
      onComboChange: (c) => setCombo(c),
      onMaxComboChange: (mc) => setMaxCombo(mc),
      onSongMeta: (m) => setSongMeta(m),
      onGameClear: () => setGameState("RESULT"),
    });
    gameEngineRef.current = engine;

    return () => {
      audio.fadeOutAndStop();
    };
  }, [setScore, setCombo, setMaxCombo, setSongMeta, setGameState]);

  // ゲームステートの変化を監視
  useEffect(() => {
    if (gameState === "PLAYING") {
      if (audioEngineRef.current) {
        audioEngineRef.current.init().catch(console.error);
      }
      if (gameEngineRef.current) {
        gameEngineRef.current.start();
        setBpm(gameEngineRef.current.bpm);
      }
    }
  }, [gameState, setBpm]);

  // レンダリングループ & リサイズ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    rendererRef.current = new CanvasRenderer(ctx);

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      layoutRef.current = computeGameLayout(w, h);
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);

    let animationFrameId: number;

    const loop = () => {
      const now = performance.now();
      const layout = layoutRef.current;
      const engine = gameEngineRef.current;
      const renderer = rendererRef.current;

      if (engine && renderer) {
        if (gameState === "PLAYING") {
          engine.update(now, layout);
        }

        const currentTime = engine.startTime ? now - engine.startTime : 0;
        renderer.render(
          layout,
          currentTime,
          NOTE_SPEED,
          engine.lanes,
          engine.laneEffects,
          engine.hitEffects,
          engine.particles,
        );
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (gameState === "START") {
        setGameState("PLAYING");
        return;
      }

      if (gameState === "RESULT") {
        setGameState("START");
        return;
      }

      if (gameState === "PLAYING") {
        if (e.key === "Escape") {
          if (audioEngineRef.current) {
            audioEngineRef.current.fadeOutAndStop();
          }
          setGameState("START");
          return;
        }

        const lane = KEY_TO_LANE[e.code] ?? KEY_TO_LANE[e.key];
        if (lane !== undefined && gameEngineRef.current) {
          gameEngineRef.current.handleKeyDown(lane, layoutRef.current);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameState === "PLAYING") {
        const lane = KEY_TO_LANE[e.code] ?? KEY_TO_LANE[e.key];
        if (lane !== undefined && gameEngineRef.current) {
          gameEngineRef.current.handleKeyUp(lane, layoutRef.current);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, setGameState]);

  // タッチ/マウスクリックによるレーン入力
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== "PLAYING") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const layout = layoutRef.current;

    if (
      x >= layout.laneXStart &&
      x <= layout.laneXStart + layout.totalLaneWidth
    ) {
      const lane = Math.floor((x - layout.laneXStart) / layout.laneWidth);
      if (lane >= 0 && lane < 4 && gameEngineRef.current) {
        gameEngineRef.current.handleKeyDown(lane, layout);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== "PLAYING") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const layout = layoutRef.current;

    if (
      x >= layout.laneXStart &&
      x <= layout.laneXStart + layout.totalLaneWidth
    ) {
      const lane = Math.floor((x - layout.laneXStart) / layout.laneWidth);
      if (lane >= 0 && lane < 4 && gameEngineRef.current) {
        gameEngineRef.current.handleKeyUp(lane, layout);
      }
    }
  };

  // 音量トグル関数をwindowに露出するか、カスタムイベント等で連携
  useEffect(() => {
    const handleMuteToggle = () => {
      if (audioEngineRef.current) {
        const muted = audioEngineRef.current.toggleMute();
        setIsMuted(muted);
      }
    };
    window.addEventListener("toggle-audio-mute", handleMuteToggle);
    return () =>
      window.removeEventListener("toggle-audio-mute", handleMuteToggle);
  }, [setIsMuted]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{
        position: "relative",
        zIndex: 1,
        display: "block",
        width: "100vw",
        height: "100vh",
        touchAction: "none",
      }}
    />
  );
};
