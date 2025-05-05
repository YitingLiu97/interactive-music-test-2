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
  
  // Stabilization buffers for grab detection (to reduce flickering)
  const prevDistancesRef = useRef<number[][]>([]);
  const gestureStabilityCounterRef = useRef<number[]>([]);
  
  // Constants for improved gesture detection
  const MIN_CONFIDENCE = 0.8; // Increased confidence threshold
  const CLOSE = 0.08; // Threshold for closed hand (decreased to be more sensitive)
  const OPEN = 0.15;  // Threshold for open hand (decreased for better hysteresis)
  const STABILITY_THRESHOLD = 3; // Number of consistent frames before changing state

  // Stable callback refs
  const onGrabRef = useRef(onHandGrab);
  const onMoveRef = useRef(onHandMove);
  const onReleaseRef = useRef(onHandRelease);

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
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
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

          // Update history buffers if number of hands changed
          if (prevDistancesRef.current.length !== result.landmarks?.length) {
            prevDistancesRef.current = Array(result.landmarks?.length || 0).fill([]).map(() => []);
            gestureStabilityCounterRef.current = Array(result.landmarks?.length || 0).fill(0);
          }

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
          
            // 3) Calculate grab gesture with improved stability
            // For both hands, measure the distance between thumb (landmark 4)
            // and index finger (landmark 8) tips
            const dx = landmarks[4].x - landmarks[8].x;
            const dy = landmarks[4].y - landmarks[8].y;
            const dist = Math.hypot(dx, dy);
            
            // Add to history buffer (keep last 5 values)
            if (!prevDistancesRef.current[i]) {
              prevDistancesRef.current[i] = [];
            }
            prevDistancesRef.current[i].push(dist);
            if (prevDistancesRef.current[i].length > 5) {
              prevDistancesRef.current[i].shift();
            }
            
            // Calculate average distance for stability
            const avgDist = prevDistancesRef.current[i].reduce((a, b) => a + b, 0) / 
                           prevDistancesRef.current[i].length;
            
            // Get current and determine new state with hysteresis
            const was = grabbingRef.current[i] || false;
            const shouldBe = was ? avgDist < OPEN : avgDist < CLOSE;
            
            // Stable state change logic
            if (shouldBe !== was) {
              // Increment stability counter
              gestureStabilityCounterRef.current[i]++;
              
              // Only change state after consistent readings
              if (gestureStabilityCounterRef.current[i] >= STABILITY_THRESHOLD) {
                grabbingRef.current[i] = shouldBe;
                gestureStabilityCounterRef.current[i] = 0;
                
                // Trigger state change events
                if (shouldBe) {
                  onGrabRef.current(i, x, y, labels[i]);
                  setIsGrabbing(true);
                } else {
                  onReleaseRef.current(i, labels[i]);
                  setIsGrabbing(false);
                }
                setLastGestureTime(Date.now());
              }
            } else {
              // Reset stability counter if consistent with current state
              gestureStabilityCounterRef.current[i] = 0;
            }
            
            const handedness = labels[i];
            const isGrabbing = grabbingRef.current[i] || false;
            
            // Convert hand landmarks to canvas coordinates
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
            
            // Draw box with color based on hand state
            ctx.strokeStyle = isGrabbing ? 'red' : (handedness === 'Left' ? 'blue' : 'green');
            ctx.lineWidth = 3;
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
            
            // Draw landmarks with different colors for key points
            pts.forEach((p, idx) => {
              // Different colors for key landmarks
              if (idx === 4) { // Thumb tip
                ctx.fillStyle = 'yellow';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
                ctx.fill();
              } else if (idx === 8) { // Index fingertip
                ctx.fillStyle = 'orange';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
                ctx.fill();
              } else {
                ctx.fillStyle = 'cyan';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
                ctx.fill();
              }
            });
            
            // Draw a line between thumb and index finger
            ctx.strokeStyle = isGrabbing ? 'red' : 'lime';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(pts[4].x, pts[4].y); // Thumb tip
            ctx.lineTo(pts[8].x, pts[8].y); // Index fingertip
            ctx.stroke();
            
            ctx.save();
            // Reverse the mirroring for text only
            ctx.scale(-1, 1);
            // Since the canvas is mirrored, adjust text position accordingly
            const textX = -minX - (maxX - minX);
            const grabText = isGrabbing ? 'CLOSED PALM' : 'OPEN PALM';
            ctx.fillStyle = 'black';
            ctx.font = 'bold 16px sans-serif';
            // Draw text shadow/outline for better visibility
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.strokeText(`${handedness}: ${grabText}`, textX, minY - 10);
            ctx.fillText(`${handedness}: ${grabText}`, textX, minY - 10);
            // Restore canvas state
            ctx.restore();
            // Always emit move for smooth tracking
            onMoveRef.current(i, x, y, handedness);
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