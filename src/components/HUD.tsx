import { motion } from "framer-motion";
import { useAtom, useAtomValue } from "jotai";
import { Volume2, VolumeX } from "lucide-react";
import type React from "react";
import {
  bpmAtom,
  comboAtom,
  isMutedAtom,
  scoreAtom,
} from "../state/atoms";

interface HUDProps {
  onToggleMute: () => void;
}

export const HUD: React.FC<HUDProps> = ({ onToggleMute }) => {
  const score = useAtomValue(scoreAtom);
  const combo = useAtomValue(comboAtom);
  const bpm = useAtomValue(bpmAtom);
  const [isMuted] = useAtom(isMutedAtom);

  const formattedScore = score.toString().padStart(7, "0");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {/* 左上: スコア */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "rgba(255, 255, 255, 0.6)",
          }}
        >
          SCORE
        </span>
        <span
          style={{
            fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
            fontWeight: 700,
            color: "#ffffff",
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 0 12px rgba(255, 255, 255, 0.4)",
          }}
        >
          {formattedScore}
        </span>
      </div>

      {/* 右上: BPM & 音量 */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          right: "28px",
          display: "flex",
          alignItems: "center",
          gap: "1.2rem",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            fontWeight: 700,
            color: "#00e5ff",
            textShadow: "0 0 8px rgba(0, 229, 255, 0.5)",
          }}
        >
          BPM {bpm}
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            padding: "8px",
            color: isMuted ? "#ff1744" : "#00e5ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* 中央: コンボ */}
      {combo > 1 && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#ffea00",
              textShadow: "0 0 10px rgba(255, 234, 0, 0.6)",
            }}
          >
            COMBO
          </span>
          <motion.span
            key={combo}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            style={{
              fontSize: "clamp(3.5rem, 8vw, 5.5rem)",
              fontWeight: 700,
              lineHeight: 1,
              color: "#ffea00",
              textShadow: "0 0 20px rgba(255, 234, 0, 0.7)",
            }}
          >
            {combo}
          </motion.span>
        </div>
      )}
    </div>
  );
};

