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
      console.log(`Hand ${handIdx} (${handedness}) grabbed at ${x},${y}`);
      setHandStates((prev) => ({
        ...prev,
        [handIdx]: { x, y, handedness, grabbing: true },
      }));
    },
    []
  );

  const handleMove = useCallback(
    (handIdx: number, x: number, y: number, handedness: "Left" | "Right") => {
      setHandStates((prev) => {
        const state = prev[handIdx];
        return {
          ...prev,
          [handIdx]: {
            x,
            y,
            handedness, // Always use the current handedness
            grabbing: state?.grabbing || false,
          },
        };
      });
    },
    []
  );

  const handleRelease = useCallback((handIdx: number, handedness: "Left" | "Right") => {
    console.log(`Hand ${handIdx} (${handedness}) released`);
    setHandStates((prev) => {
      const state = prev[handIdx];
      if (!state) return prev;
      return {
        ...prev,
        [handIdx]: { ...state, grabbing: false, handedness },
      };
    });
  }, []);

  const { isHandDetectionActive, toggleHandDetection, videoRef, canvasRef } =
    useHandDetection(boxRef, handleGrab, handleMove, handleRelease);

  return (
    <div 
      ref={boxRef} 
      style={{ 
        position: "relative", 
        width: 640, 
        height: 480,
        overflow: "hidden",
        border: "2px solid #333",
        borderRadius: "8px"
      }}
    >
      <button
        onClick={toggleHandDetection}
        style={{ 
          position: "absolute", 
          top: 10, 
          left: 10, 
          zIndex: 10,
          padding: "8px 16px",
          backgroundColor: isHandDetectionActive ? "#f44336" : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        {isHandDetectionActive ? "Stop" : "Start"} Hand Detection
      </button>

      {/* Status display */}
      <div style={{
        position: "absolute",
        bottom: 10,
        left: 10,
        zIndex: 10,
        background: "rgba(0,0,0,0.7)",
        color: "white",
        padding: "8px",
        borderRadius: "4px",
        fontSize: "14px"
      }}>
        {Object.entries(handStates).map(([idx, { handedness, grabbing }]) => (
          <div key={idx}>
            Hand {Number(idx) + 1} ({handedness}): {grabbing ? "CLOSED" : "OPEN"}
          </div>
        ))}
        {Object.keys(handStates).length === 0 && "No hands detected"}
      </div>

      {/* Video element with mirror effect */}
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
          transform: "scaleX(-1)", // Mirror the video
          zIndex: 1,
        }}
      />

      {/* Canvas overlay for visualization */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "scaleX(-1)", // Mirror the canvas to match video
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default TestTwoHands;