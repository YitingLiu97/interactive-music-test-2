"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-core';

// Return types for our hook
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

  const onMoveRef = useRef(onHandMove);
  const onGrabRef = useRef(onHandGrab);
  const onReleaseRef = useRef(onHandRelease);
  useEffect(() => { onMoveRef.current = onHandMove; }, [onHandMove]);
  useEffect(() => { onGrabRef.current = onHandGrab; }, [onHandGrab]);
  useEffect(() => { onReleaseRef.current = onHandRelease; }, [onHandRelease]);

  const toggleHandDetection = useCallback(() => {
    setIsHandDetectionActive(active => !active);
  }, []);

  // Load model once
  useEffect(() => {
    let cancelled = false;
    handpose.load()
      .then(model => {
        if (!cancelled) {
          modelRef.current = model;
          setModelLoaded(true);
          console.log('🤖 Model loaded');
        }
      })
      .catch(err => console.error('❌ Model error:', err));
    return () => { cancelled = true; };
  }, []);

  // Camera & detection
  useEffect(() => {
    if (!isHandDetectionActive || !modelLoaded) return;

    let stream: MediaStream;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const box = boundingBoxRef.current;
    if (!video || !canvas || !box) return;

    const detectLoop = async () => {
      const model = modelRef.current!;
      const hands = await model.estimateHands(video);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (hands.length) {
        const { landmarks } = hands[0];
        const [p0,p5,p17] = [landmarks[0],landmarks[5],landmarks[17]];
        const palmX = (p0[0]+p5[0]+p17[0])/3;
        const palmY = (p0[1]+p5[1]+p17[1])/3;
        const rect = box.getBoundingClientRect();
        const vw = video.videoWidth || video.width;
        const vh = video.videoHeight || video.height;
        const x = rect.width - ( rect.left + (palmX/vw)*rect.width);
        const y = rect.top  + (palmY/vh)*rect.height;
        setHandPosition({ x, y });

        // Heuristic distance
        const d = Math.hypot(
          landmarks[4][0]-landmarks[8][0],
          landmarks[4][1]-landmarks[8][1]
        );
        // Hysteresis thresholds
        const CLOSE_THRESH = 40;
        const OPEN_THRESH  = 80;
        const wasGrab = grabbingRef.current;
        const nowGrab = wasGrab ? d < OPEN_THRESH : d < CLOSE_THRESH;

        // Visual feedback
        ctx.fillStyle = nowGrab ? 'red' : 'green';
        ctx.beginPath(); ctx.arc(palmX, palmY, 8, 0, Math.PI*2); ctx.fill();

        // Handle transitions
        if (nowGrab !== grabbingRef.current) {
          grabbingRef.current = nowGrab;
          setIsGrabbing(nowGrab);
          setLastGestureTime(Date.now());
          if(nowGrab){
            onGrabRef.current(x,y);
          } else{ onReleaseRef.current();}
        } else {
          if(nowGrab){ onGrabRef.current(x,y);}
          else{
            onMoveRef.current(x,y);
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

    // Start camera
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video:{width:640,height:480},audio:false });
        video.srcObject = stream;
        await video.play();
        console.log('📸 Camera on');
        detectLoop();
      } catch(e) {
        console.error('❌ Cam error:', e);
      }
    })();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach(t=>t.stop());
      console.log('🛑 Camera off');
    };
  }, [isHandDetectionActive, modelLoaded, boundingBoxRef]);

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
