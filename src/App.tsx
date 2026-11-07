import { useAtom } from "jotai";
import type React from "react";
import { GameCanvas } from "./components/GameCanvas";
import { HUD } from "./components/HUD";
import { ResultScreen } from "./components/ResultScreen";
import { StartScreen } from "./components/StartScreen";
import { TrackNotification } from "./components/TrackNotification";
import { VJBackground } from "./components/VJBackground";
import { gameStateAtom } from "./state/atoms";

export const App: React.FC = () => {
  const [gameState, setGameState] = useAtom(gameStateAtom);

  const handleToggleMute = () => {
    window.dispatchEvent(new CustomEvent("toggle-audio-mute"));
  };

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <VJBackground />
      <GameCanvas />

      {gameState === "START" && (
        <StartScreen onStart={() => setGameState("PLAYING")} />
      )}

      {gameState === "PLAYING" && <HUD onToggleMute={handleToggleMute} />}

      <TrackNotification />

      {gameState === "RESULT" && (
        <ResultScreen onRestart={() => setGameState("PLAYING")} />
      )}
    </main>
  );
};
