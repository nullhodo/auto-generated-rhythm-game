import { motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { RotateCcw, Trophy } from "lucide-react";
import type React from "react";
import { maxComboAtom, scoreAtom } from "../state/atoms";

interface ResultScreenProps {
  onRestart: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  onRestart,
}) => {
  const score = useAtomValue(scoreAtom);
  const maxCombo = useAtomValue(maxComboAtom);

  const formattedScore = score.toString().padStart(7, "0");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(7, 7, 12, 0.9)",
        backdropFilter: "blur(6px)",
        zIndex: 10,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
          style={{ color: "#ffea00" }}
        >
          <Trophy size={48} />
        </motion.div>

        <h2
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#ffffff",
            margin: 0,
          }}
        >
          GAME CLEAR
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}
        >
          <span
            style={{
              fontSize: "0.95rem",
              letterSpacing: "0.1em",
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            FINAL SCORE
          </span>
          <span
            style={{
              fontSize: "clamp(2.8rem, 7vw, 4.8rem)",
              fontWeight: 700,
              color: "#00e5ff",
              textShadow: "0 0 24px rgba(0, 229, 255, 0.7)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formattedScore}
          </span>
        </div>

        <div
          style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            color: "#ffea00",
            textShadow: "0 0 10px rgba(255, 234, 0, 0.5)",
          }}
        >
          MAX COMBO: {maxCombo}
        </div>

        <button
          type="button"
          onClick={onRestart}
          style={{
            marginTop: "1.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            backgroundColor: "#00e5ff",
            color: "#07070c",
            padding: "0.8rem 2rem",
            borderRadius: "9999px",
            fontSize: "1.1rem",
            fontWeight: 700,
            boxShadow: "0 0 20px rgba(0, 229, 255, 0.5)",
            cursor: "pointer",
            border: "none",
          }}
        >
          <RotateCcw size={20} />
          PLAY AGAIN
        </button>

        <span
          style={{
            fontSize: "0.9rem",
            color: "rgba(255, 255, 255, 0.4)",
            marginTop: "0.5rem",
          }}
        >
          Press ANY KEY to Restart
        </span>
      </motion.div>
    </div>
  );
};
