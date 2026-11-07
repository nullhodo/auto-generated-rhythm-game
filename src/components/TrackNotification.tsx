import { AnimatePresence, motion } from "framer-motion";
import { useAtomValue } from "jotai";
import { Disc3 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { gameStateAtom, songMetaAtom } from "../state/atoms";

export const TrackNotification: React.FC = () => {
  const gameState = useAtomValue(gameStateAtom);
  const songMeta = useAtomValue(songMetaAtom);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (gameState === "PLAYING" && songMeta) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 4200); // 4.2秒間表示したのち右へフェードアウト
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [gameState, songMeta]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: "32px",
        right: "32px",
        zIndex: 6,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {visible && songMeta && (
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
              textAlign: "right",
              background: "none", // 背景なし
              padding: 0,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#00e5ff",
                fontSize: "0.85rem",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textShadow: "0 0 10px rgba(0, 229, 255, 0.7)",
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 3,
                  ease: "linear",
                }}
                style={{ display: "flex", alignItems: "center" }}
              >
                <Disc3 size={16} />
              </motion.div>
              <span>TRACK INFO</span>
            </div>

            <div
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#ffffff",
                textShadow: "0 0 12px rgba(255, 255, 255, 0.6)",
              }}
            >
              {songMeta.keyName} ({songMeta.scaleName})
            </div>

            {songMeta.melodyStyle && (
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#ff007f",
                  textShadow: "0 0 10px rgba(255, 0, 127, 0.6)",
                  letterSpacing: "0.08em",
                }}
              >
                STYLE: {songMeta.melodyStyle}
              </div>
            )}

            <div
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#00ff88",
                textShadow: "0 0 10px rgba(0, 255, 136, 0.6)",
                fontFamily: "monospace",
                letterSpacing: "0.05em",
              }}
            >
              {songMeta.chordProgression}
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "rgba(255, 255, 255, 0.65)",
                textShadow: "0 0 8px rgba(0, 0, 0, 0.9)",
              }}
            >
              {songMeta.progressionPattern}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
