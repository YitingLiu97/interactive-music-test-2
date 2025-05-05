"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export interface HandDetectionReturn {
  isHandDetectionActive: boolean;
  toggleHandDetection: () => void;
  handPosition: { x: number; y: number } | null;
  isGrabbing: boolean;
  lastGestureTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const MODEL_URL = "/models/hand_landmarker.task";

export function useHandDetection(
  boundingBoxRef: React.RefObject<HTMLDivElement | null>,
  onHandGrab: (
    handIndex: number,
    x: number,
    y: number,
    handedness: "Left" | "Right"
  ) => void,
  onHandMove: (
    handIndex: number,
    x: number,
    y: number,
    handedness: "Left" | "Right"
  ) => void,
  onHandRelease: (handIndex: number, handedness: "Left" | "Right") => void
): HandDetectionReturn {
  const [isHandDetectionActive, setIsHandDetectionActive] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [handPosition, setHandPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [lastGestureTime, setLastGestureTime] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const grabbingRef = useRef<boolean[]>([]);
  const handednessRef = useRef<Array<"Left" | "Right">>([]);

  // Stable callback refs
  const onGrabRef = useRef(onHandGrab);
  const onMoveRef = useRef(onHandMove);
  const onReleaseRef = useRef(onHandRelease);


  const MIN_CONFIDENCE = 0.75;
const CLOSE = 0.1;
const OPEN  = 0.2;



  useEffect(() => {
    onGrabRef.current = onHandGrab;
  }, [onHandGrab]);
  useEffect(() => {
    onMoveRef.current = onHandMove;
  }, [onHandMove]);
  useEffect(() => {
    onReleaseRef.current = onHandRelease;
  }, [onHandRelease]);

  const toggleHandDetection = useCallback(() => {
    setIsHandDetectionActive((active) => !active);
  }, []);

  // Load hand landmarker model once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          numHands: 2,
          runningMode: "VIDEO",
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setModelLoaded(true);
      } catch (err) {
        console.error("❌ HandLandmarker init error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Camera and detection loop
  useEffect(() => {
    if (!isHandDetectionActive || !modelLoaded) return;
    let cancelled = false;
    let stream: MediaStream;
    const video = videoRef.current;
    const box = boundingBoxRef.current;
    if (!video || !box) return;

    const detectLoop = () => {
      const landmarker = landmarkerRef.current;
      if (!landmarker) return;
      const result: HandLandmarkerResult = landmarker.detectForVideo(
        video,
        performance.now()
      );

      // Map Category[] to string labels
    
      const categories = result.handednesses || [];
      const labels     = categories.map(cats => cats[0].categoryName as 'Left'|'Right');
      const confidences= categories.map(cats => cats[0].score);
      handednessRef.current = labels;

      result.landmarks?.forEach((landmarks, i) => {
        // 1) confidence filtering
        if (confidences[i] < MIN_CONFIDENCE) return;
      
        // 2) screen coords
        const rect = boundingBoxRef.current!.getBoundingClientRect();
        const p0 = landmarks[0], p5 = landmarks[5], p17 = landmarks[17];
        const palmX = (p0.x + p5.x + p17.x) / 3;
        const palmY = (p0.y + p5.y + p17.y) / 3;
        const x = rect.left  + palmX * rect.width;
        const y = rect.top   + palmY * rect.height;
        setHandPosition({ x, y });
      
        // 3) hysteresis grab/release
        const dx = landmarks[4].x - landmarks[8].x;
        const dy = landmarks[4].y - landmarks[8].y;
        const dist = Math.hypot(dx, dy);
        const was = grabbingRef.current[i] || false;
        const now = was ? dist < OPEN : dist < CLOSE;
        grabbingRef.current[i] = now;
      
        const handedness = labels[i];
        if (now !== was) {
          setIsGrabbing(now);
          setLastGestureTime(Date.now());
          if (now) onGrabRef.current(i, x, y, handedness);
          else     onReleaseRef.current(i, handedness);
        } else {
          // always emit move for smooth color updates
          onMoveRef.current(i, x, y, handedness);
        }});

      if (!cancelled) {
        rafRef.current = requestAnimationFrame(detectLoop);
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        video.srcObject = stream;
        await video.play();
        detectLoop();
      } catch (err) {
        console.error("❌ Camera error:", err);
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      cancelAnimationFrame(rafRef.current);
    };
  }, [isHandDetectionActive, modelLoaded]);

  return {
    isHandDetectionActive,
    toggleHandDetection,
    handPosition,
    isGrabbing,
    lastGestureTime,
    videoRef,
    canvasRef,
  };
}
