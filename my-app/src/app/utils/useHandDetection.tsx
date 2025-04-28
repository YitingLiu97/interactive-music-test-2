"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-core';

// Define return types for our hook
interface HandDetectionReturn {
  isHandDetectionActive: boolean;
  toggleHandDetection: () => void;
  handPosition: { x: number, y: number } | null;
  isGrabbing: boolean;
  lastGestureTime: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function useHandDetection(
  boundingBoxRef: React.RefObject<HTMLDivElement | null>,
  onHandMove: (x: number, y: number) => void,
  onHandGrab: (x: number, y: number) => void,
  onHandRelease: () => void
): HandDetectionReturn {
  const [isHandDetectionActive, setIsHandDetectionActive] = useState(false);
  const [handPosition, setHandPosition] = useState<{ x: number, y: number } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [lastGestureTime, setLastGestureTime] = useState(0);
  
  // Use non-null assertion for refs that will be initialized with createRef
  const videoRef = useRef<HTMLVideoElement>(null!) as React.RefObject<HTMLVideoElement>;
  const canvasRef = useRef<HTMLCanvasElement>(null!) as React.RefObject<HTMLCanvasElement>;
  const handposeModelRef = useRef<handpose.HandPose>(null);
  const requestAnimationFrameId = useRef<number | null>(null);
  
  // Toggle hand detection on/off
  const toggleHandDetection = useCallback(() => {
    setIsHandDetectionActive(prev => !prev);
  }, []);

  // Main hand detection loop
  const startHandDetection = useCallback(async () => {
    if (!handposeModelRef.current || !videoRef.current || !canvasRef.current || !boundingBoxRef.current) {
      requestAnimationFrameId.current = requestAnimationFrame(startHandDetection);
      return;
    }

    try {
      // Detect hand landmarks
      const hands = await handposeModelRef.current.estimateHands(videoRef.current);
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      if (hands.length > 0) {
        // Get the first detected hand
        const hand = hands[0];
        
        // Extract landmarks
        const landmarks = hand.landmarks;
        
        // Calculate palm position (use center of palm)
        const palmBase = landmarks[0]; // Base of palm
        const indexFingerBase = landmarks[5]; // Base of index finger
        const pinkyBase = landmarks[17]; // Base of pinky
        
        // Compute palm center
        const palmX = (palmBase[0] + indexFingerBase[0] + pinkyBase[0]) / 3;
        const palmY = (palmBase[1] + indexFingerBase[1] + pinkyBase[1]) / 3;
        
        // Get bounding box dimensions and position
        const boxRect = boundingBoxRef.current.getBoundingClientRect();
        
        // Map video coordinates to bounding box coordinates
        const canvasToBoxX = (x: number) => {
          // Map from canvas space to percentage in box
          const videoWidth = videoRef.current?.videoWidth || 640;
          const percentX = 1-x / videoWidth;// mirror x only 
          return (percentX * boxRect.width) + boxRect.left;
        };
        
        const canvasToBoxY = (y: number) => {
          // Map from canvas space to percentage in box
          const videoHeight = videoRef.current?.videoHeight || 480;
          const percentY = y / videoHeight;
          return (percentY * boxRect.height) + boxRect.top;
        };
        
        // Convert to box coordinates
        const boxX = canvasToBoxX(palmX);
        const boxY = canvasToBoxY(palmY);
        
        // Detect if hand is open or closed (grabbing)
        // A simple heuristic: measure distance between thumb tip and index finger tip
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        const distance = Math.sqrt(
          Math.pow(thumbTip[0] - indexTip[0], 2) + 
          Math.pow(thumbTip[1] - indexTip[1], 2)
        );
        
        // Threshold for grabbing - may need tuning
        const isCurrentlyGrabbing = distance < 50; // pixels
        
        // Visualize hand landmarks
        ctx.fillStyle = isCurrentlyGrabbing ? 'red' : 'green';
        ctx.beginPath();
        ctx.arc(palmX, palmY, 10, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw lines connecting landmarks
        ctx.strokeStyle = isCurrentlyGrabbing ? 'red' : 'green';
        ctx.lineWidth = 2;
        
        // Draw hand skeleton
        const fingerPairs = [
          // Thumb
          [0, 1], [1, 2], [2, 3], [3, 4],
          // Index finger
          [5, 6], [6, 7], [7, 8],
          // Middle finger
          [9, 10], [10, 11], [11, 12],
          // Ring finger
          [13, 14], [14, 15], [15, 16],
          // Pinky
          [17, 18], [18, 19], [19, 20],
          // Palm
          [0, 5], [5, 9], [9, 13], [13, 17]
        ];
        
        for (const [i, j] of fingerPairs) {
          ctx.beginPath();
          ctx.moveTo(landmarks[i][0], landmarks[i][1]);
          ctx.lineTo(landmarks[j][0], landmarks[j][1]);
          ctx.stroke();
        }
        
        // Update state
        setHandPosition({ x: boxX, y: boxY });
        
        // Handle gesture changes
        if (isCurrentlyGrabbing !== isGrabbing) {
          setIsGrabbing(isCurrentlyGrabbing);
          setLastGestureTime(Date.now());
          
          if (isCurrentlyGrabbing) {
            // Hand just closed - grab started
            onHandGrab(boxX, boxY);
          } else {
            // Hand just opened - grab released
            onHandRelease();
          }
        } else if (isCurrentlyGrabbing) {
          // Continuous grab/drag
          onHandGrab(boxX, boxY);
        } else {
          // Continuous move
          onHandMove(boxX, boxY);
        }
      } else {
        // No hands detected
        setHandPosition(null);
        
        // If was grabbing, release
        if (isGrabbing) {
          setIsGrabbing(false);
          onHandRelease();
        }
      }
    } catch (error) {
      console.error("Error in hand detection:", error);
    }
    
    // Continue the detection loop
    requestAnimationFrameId.current = requestAnimationFrame(startHandDetection);
  }, [isGrabbing, onHandGrab, onHandMove, onHandRelease, boundingBoxRef]);

  
  // Initialize TensorFlow.js and handpose model
  useEffect(() => {
    async function loadHandposeModel() {
      try {
        if (!handposeModelRef.current) {
          handposeModelRef.current = await handpose.load();
          console.log("Handpose model loaded successfully");
        }
      } catch (error) {
        console.error("Error loading handpose model:", error);
      }
    }

    if (isHandDetectionActive && !handposeModelRef.current) {
      loadHandposeModel();
    }

    return () => {
      // Clean up resources when component unmounts
      if (requestAnimationFrameId.current) {
        cancelAnimationFrame(requestAnimationFrameId.current);
      }
    };
  }, [isHandDetectionActive]);

  // Start webcam when hand detection is active
  useEffect(() => {
    async function setupCamera() {
      if (!videoRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        
        videoRef.current.srcObject = stream;
        
        return new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play();
                resolve();
              }
            };
          }
        });
      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    }

    if (isHandDetectionActive) {
      setupCamera().then(() => {
        startHandDetection();
      });
    } else {
      // Stop the webcam
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Cancel animation frame
      if (requestAnimationFrameId.current) {
        cancelAnimationFrame(requestAnimationFrameId.current);
      }
    }

    return () => {
      if (requestAnimationFrameId.current) {
        cancelAnimationFrame(requestAnimationFrameId.current);
      }
    };
  }, [isHandDetectionActive, startHandDetection]);

  
  return {
    isHandDetectionActive,
    toggleHandDetection,
    handPosition,
    isGrabbing,
    lastGestureTime,
    videoRef,
    canvasRef
  };
}