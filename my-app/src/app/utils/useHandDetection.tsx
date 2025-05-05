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

  // Constants for gesture detection
  const MIN_CONFIDENCE = 0.75;
  const CLOSE = 0.1; // Threshold for closed hand (thumb to index finger distance)
  const OPEN = 0.2;  // Threshold for open hand (hysteresis)

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
          numHands: 2, // Allow detecting both hands
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

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        video.srcObject = stream;
        await video.play();

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        
        // Size canvas to match the bounding box
        const rect = box.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        function detectLoop() {
          if (!landmarkerRef.current || !video) return;
          
          const result: HandLandmarkerResult = landmarkerRef.current.detectForVideo(
            video,
            performance.now()
          );

          // Clear the canvas for new drawing
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Map Category[] to string labels
          const categories = result.handednesses || [];
          const labels = categories.map(cats => cats[0].categoryName as 'Left' | 'Right');
          const confidences = categories.map(cats => cats[0].score);
          handednessRef.current = labels;

          result.landmarks?.forEach((landmarks, i) => {
            // 1) confidence filtering
            if (confidences[i] < MIN_CONFIDENCE) return;
          
            // 2) screen coords
            const rect = boundingBoxRef.current!.getBoundingClientRect();
            
            // Use palm center (average of base palm landmarks)
            const p0 = landmarks[0], p5 = landmarks[5], p17 = landmarks[17];
            const palmX = (p0.x + p5.x + p17.x) / 3;
            const palmY = (p0.y + p5.y + p17.y) / 3;
            
            // Convert normalized coordinates to screen coordinates
            const x = palmX * rect.width;
            const y = palmY * rect.height;
            
            // Update hand position state
            setHandPosition({ x, y });
          
            // 3) Calculate grab gesture for BOTH hands
            // For both left and right hands, we measure the distance between thumb (landmark 4)
            // and index finger (landmark 8) tips
            const dx = landmarks[4].x - landmarks[8].x;
            const dy = landmarks[4].y - landmarks[8].y;
            const dist = Math.hypot(dx, dy);
            
            const was = grabbingRef.current[i] || false;
            const now = was ? dist < OPEN : dist < CLOSE;
            grabbingRef.current[i] = now;
          
            const handedness = labels[i];
            
            // Draw hand bounding box
            const pts = landmarks.map(p => ({
              x: p.x * canvas.width,
              y: p.y * canvas.height
            }));
            
            // Compute bounding box
            const xs = pts.map(p => p.x);
            const ys = pts.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            
            // Draw box
            ctx.strokeStyle = handedness === 'Left' ? 'blue' : 'green';
            ctx.lineWidth = 2;
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
            
            // Draw landmarks
            ctx.fillStyle = 'cyan';
            pts.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            });
            
            // Draw hand state label
            const grabText = now ? 'closed' : 'open';
            ctx.fillStyle = 'yellow';
            ctx.font = '16px sans-serif';
            ctx.fillText(`${handedness}: ${grabText}`, minX, minY - 10);
            
            // Emit events based on state changes
            if (now !== was) {
              setIsGrabbing(now);
              setLastGestureTime(Date.now());
              if (now) onGrabRef.current(i, x, y, handedness);
              else onReleaseRef.current(i, handedness);
            } else {
              // Always emit move for smooth tracking
              onMoveRef.current(i, x, y, handedness);
            }
          });

          if (!cancelled) {
            rafRef.current = requestAnimationFrame(detectLoop);
          }
        }
        
        detectLoop();
      } catch (err) {
        console.error("❌ Camera error:", err);
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
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