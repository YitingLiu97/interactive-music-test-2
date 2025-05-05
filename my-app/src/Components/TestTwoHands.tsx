"use client";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useHandDetection } from "@/app/utils/useHandDetection";
interface HandState {
  x: number;
  y: number;
  handedness: "Left" | "Right";
  grabbing: boolean;
}

const TestTwoHands: React.FC = () => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [handStates, setHandStates] = useState<Record<number, HandState>>({});

  const handleGrab = useCallback(
    (handIdx: number, x: number, y: number, handedness: "Left" | "Right") => {
      setHandStates((prev) => ({
        ...prev,
        [handIdx]: { x, y, handedness, grabbing: true },
      }));
    },
    []
  );

  const handleMove = useCallback((handIdx: number, x: number, y: number) => {
    setHandStates((prev) => {
      const state = prev[handIdx];
      return {
        ...prev,
        [handIdx]: {
          x,
          y,
          handedness: state?.handedness || "Left",
          grabbing: state?.grabbing || false,
        },
      };
    });
  }, []);

  const handleRelease = useCallback((handIdx: number) => {
    setHandStates((prev) => {
      const state = prev[handIdx];
      if (!state) return prev;
      return {
        ...prev,
        [handIdx]: { ...state, grabbing: false },
      };
    });
  }, []);

  const { isHandDetectionActive, toggleHandDetection, videoRef, canvasRef } =
    useHandDetection(boxRef, handleGrab, handleMove, handleRelease);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    Object.values(handStates).forEach(({ x, y, handedness, grabbing }) => {
      // Flip X for right hand to match mirrored video
      const drawX = handedness === "Right" ? canvas.width - x : x;
      const drawY = y;

      // Color: red for closed palm, blue for open palm
      ctx.fillStyle = grabbing ? "red" : "blue";
      ctx.beginPath();
      ctx.arc(drawX, drawY, 20, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [handStates]);

  return (
    <div ref={boxRef} style={{ position: "relative", width: 640, height: 480 }}>
      <button
        onClick={toggleHandDetection}
        style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}
      >
        {isHandDetectionActive ? "Stop" : "Start"} Hand Detection{" "}
      </button>

      <video
        ref={videoRef}
        width={640}
        height={480}
        autoPlay
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "scaleX(-1)",
          zIndex: 1,
        }}
      />

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default TestTwoHands;
