import { motion } from "framer-motion";
import { Music, Play, Sparkles } from "lucide-react";
import type React from "react";

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(7, 7, 12, 0.88)",
        backdropFilter: "blur(4px)",
        zIndex: 10,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.2rem",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 4,
            ease: "easeInOut",
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#00e5ff",
          }}
        >
          <Sparkles size={28} />
          <Music size={28} />
        </motion.div>

        <h1
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#00e5ff",
            textShadow: "0 0 24px rgba(0, 229, 255, 0.6)",
            margin: 0,
          }}
        >
          NEON OVERDRIVE
        </h1>

        <p
          style={{
            fontSize: "clamp(0.95rem, 2vw, 1.25rem)",
            color: "rgba(255, 255, 255, 0.75)",
            margin: 0,
          }}
        >
          Procedural Beat Engine v2.1
        </p>

        <motion.button
          type="button"
          onClick={onStart}
          animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 1.5,
            ease: "easeInOut",
          }}
          style={{
            marginTop: "1.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            backgroundColor: "#00e5ff",
            color: "#07070c",
            padding: "0.85rem 2rem",
            borderRadius: "9999px",
            fontSize: "1.1rem",
            fontWeight: 700,
            boxShadow: "0 0 20px rgba(0, 229, 255, 0.5)",
            cursor: "pointer",
            border: "none",
          }}
        >
          <Play size={20} fill="#07070c" />
          PRESS ANY KEY TO START
        </motion.button>

        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            gap: "0.8rem",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: "0.9rem",
            }}
          >
            CONTROLS:
          </span>
          {["D", "F", "J", "K"].map((k) => (
            <span
              key={k}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                border: "1px solid rgba(0, 229, 255, 0.5)",
                borderRadius: "6px",
                color: "#00e5ff",
                fontSize: "1rem",
                fontWeight: 700,
                backgroundColor: "rgba(0, 229, 255, 0.1)",
              }}
            >
              {k}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
