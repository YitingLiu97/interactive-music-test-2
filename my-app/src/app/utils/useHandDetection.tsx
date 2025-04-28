"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-core';

// Hook return types
interface HandDetectionReturn {
  isHandDetectionActive: boolean;
  toggleHandDetection: () => void;
  handPosition: { x: number; y: number } | null;
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
  const [modelLoaded, setModelLoaded] = useState(false);
  const [handPosition, setHandPosition] = useState<{ x: number; y: number } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [lastGestureTime, setLastGestureTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const modelRef = useRef<handpose.HandPose | null>(null);
  const rafRef = useRef<number>(null);
  const grabbingRef = useRef(false);
  const prevPosRef = useRef<{ x: number; y: number } | null>(null);
  const MOVEMENT_THRESHOLD = 5; // Minimum pixel movement to consider

  // Store callbacks in refs to avoid re-deps
  const onMoveRef = useRef(onHandMove);
  const onGrabRef = useRef(onHandGrab);
  const onReleaseRef = useRef(onHandRelease);
  useEffect(() => { onMoveRef.current = onHandMove; }, [onHandMove]);
  useEffect(() => { onGrabRef.current = onHandGrab; }, [onHandGrab]);
  useEffect(() => { onReleaseRef.current = onHandRelease; }, [onHandRelease]);

  const toggleHandDetection = useCallback(() => {
    setIsHandDetectionActive(active => !active);
  }, []);

  // 1) Load model once
  useEffect(() => {
    let cancelled = false;
    handpose.load()
      .then(m => {
        if (cancelled) return;
        modelRef.current = m;
        setModelLoaded(true);
        console.log('🤖 Handpose model loaded');
      })
      .catch(err => console.error('❌ Model load error:', err));
    return () => { cancelled = true; };
  }, []);

  // 2) Camera + detection loop
  useEffect(() => {
    if (!isHandDetectionActive || !modelLoaded) return;

    let stream: MediaStream;
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    const boxEl = boundingBoxRef.current;
    if (!videoEl || !canvasEl || !boxEl) {
      console.error('🚨 Missing refs', { videoEl, canvasEl, boxEl });
      return;
    }

    const detectLoop = async () => {
      const model = modelRef.current!;
      const hands = await model.estimateHands(videoEl);
      const ctx = canvasEl.getContext('2d')!;
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      if (hands.length) {
        const { landmarks } = hands[0];
        const [p0, p5, p17] = [landmarks[0], landmarks[5], landmarks[17]];
        const palmX = (p0[0] + p5[0] + p17[0]) / 3;
        const palmY = (p0[1] + p5[1] + p17[1]) / 3;

        const { left, top, width, height } = boxEl.getBoundingClientRect();
        const vw = videoEl.videoWidth || videoEl.width;
        const vh = videoEl.videoHeight || videoEl.height;
        const x = vw-( left + (palmX / vw) * width);// reverse x 
        const y = top + (palmY / vh) * height;

        const d = Math.hypot(
          landmarks[4][0] - landmarks[8][0],
          landmarks[4][1] - landmarks[8][1]
        );
        const grab = d < 50;

        ctx.fillStyle = grab ? 'red' : 'green';
        ctx.beginPath();
        ctx.arc(palmX, palmY, 8, 0, Math.PI * 2);
        ctx.fill();

        const prev = prevPosRef.current;
        // On grab state change
        if (grab !== grabbingRef.current) {
          prevPosRef.current = { x, y };
          grabbingRef.current = grab;
          setIsGrabbing(grab);
          setLastGestureTime(Date.now());
          setHandPosition({ x, y });
          if(grab){
            onGrabRef.current(x, y);

          }
          else{onReleaseRef.current();
          }
        } else if (grab) {
          // Continuous grab
          onGrabRef.current(x, y);
        } else {
          // Movement with threshold
          const dx = prev ? Math.abs(x - prev.x) : Infinity;
          const dy = prev ? Math.abs(y - prev.y) : Infinity;
          if (dx > MOVEMENT_THRESHOLD || dy > MOVEMENT_THRESHOLD) {
            prevPosRef.current = { x, y };
            setHandPosition({ x, y });
            onMoveRef.current(x, y);
          }
        }
      } else {
        // No hand
        setHandPosition(null);
        if (grabbingRef.current) {
          grabbingRef.current = false;
          setIsGrabbing(false);
          onReleaseRef.current();
        }
      }

      rafRef.current = requestAnimationFrame(detectLoop);
    };

    // start camera
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        videoEl.srcObject = stream;
        await videoEl.play();
        console.log('📸 Camera started');
        detectLoop();
      } catch (err) {
        console.error('❌ Camera error:', err);
      }
    })();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
      console.log('🛑 Camera stopped');
    };
  }, [isHandDetectionActive, modelLoaded, boundingBoxRef]);

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
