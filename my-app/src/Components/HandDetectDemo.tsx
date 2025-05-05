'use client'

import React, { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

const Demo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [handPresence, setHandPresence] = useState<boolean | null>(null);
  const MODEL_URL = "/models/hand_landmarker.task";

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    // Initialize the MediaPipe vision tasks
    const initializeHandDetection = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL  },
          numHands: 2,
          runningMode: "VIDEO",
        });
        detectHands();
      } catch (error) {
        console.error("Error initializing hand detection:", error);
      }
    };

    // Draw landmarks on the canvas
    const drawLandmarks = (
      landmarksArray: Array<Array<{ x: number; y: number }>>
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";

      landmarksArray.forEach((landmarks) => {
        landmarks.forEach((landmark) => {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;

          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fill();
        });
      });
    };

    // Main detection loop
    const detectHands = () => {
      if (
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        handLandmarker
      ) {
        const result: HandLandmarkerResult = handLandmarker.detectForVideo(
          videoRef.current,
          performance.now()
        );
        setHandPresence((result.handednesses?.length ?? 0) > 0);

        if (result.landmarks) {
          drawLandmarks(result.landmarks);
        }
      }

      animationFrameId = requestAnimationFrame(detectHands);
    };

    // Start webcam feed and hand detection
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        await initializeHandDetection();
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    };

    startWebcam();

    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
      handLandmarker?.close();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <h1>Is there a Hand? {handPresence ? "Yes" : "No"}</h1>
      <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "600px", height: "480px" }}
        />
        <canvas
          ref={canvasRef}
          width={600}
          height={480}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        />{" "}
      </div>
    </>
  );
};

export default Demo;
