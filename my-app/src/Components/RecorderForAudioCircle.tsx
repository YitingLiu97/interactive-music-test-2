// Debug version of RecorderForAudioCircle
"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Flex, Text, Progress } from '@radix-ui/themes';
import { PlayIcon, StopIcon } from '@radix-ui/react-icons';
const MicrophoneIcon=()=> {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-6 h-6 text-white"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 1v10m0 0a4 4 0 004-4V5a4 4 0 00-8 0v2a4 4 0 004 4zm6 2a6 6 0 01-12 0M5 15v2a7 7 0 0014 0v-2"
      />
    </svg>
  );
}

interface RecorderForAudioCircleProps {
  width: number;
  height: number;
  loopDurationFromStem: number;
  onRecordingComplete: (blobUrl: string) => void;
  onRecordingStart: () => void;
  isVisible?: boolean;
}

export default function RecorderForAudioCircle({
  width,
  height,
  loopDurationFromStem,
  onRecordingComplete,
  onRecordingStart,
  isVisible = true
}: RecorderForAudioCircleProps) {
  // Debug: Log when callbacks are received
  useEffect(() => {
    console.log("🔧 RecorderForAudioCircle received callbacks:", {
      onRecordingComplete: typeof onRecordingComplete,
      onRecordingStart: typeof onRecordingStart,
      hasComplete: !!onRecordingComplete,
      hasStart: !!onRecordingStart
    });
  }, [onRecordingComplete, onRecordingStart]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const initializeRecorder = useCallback(async () => {
    console.log("🚀 Initializing recorder...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log("✅ Got media stream:", stream);
      streamRef.current = stream;
      
      // Check supported MIME types
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];
      
      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      console.log("🎵 Using MIME type:", supportedType);
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType || 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Debug: Log all MediaRecorder events
      mediaRecorder.onstart = () => {
        console.log("🎤 MediaRecorder started");
      };
      
      mediaRecorder.ondataavailable = (event) => {
        console.log("📦 Data available:", {
          size: event.data.size,
          type: event.data.type
        });
        
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log("📦 Added chunk, total chunks:", audioChunksRef.current.length);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log("🛑 MediaRecorder stopped");
        console.log("📦 Total chunks collected:", audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          console.error("❌ No audio chunks recorded!");
          return;
        }
        
        try {
          const blob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
          });
          
          console.log("✅ Created blob:", {
            size: blob.size,
            type: blob.type
          });
          
          if (blob.size === 0) {
            console.error("❌ Blob is empty!");
            return;
          }
          
          // Set state first
          setRecordingBlob(blob);
          setHasRecording(true);
          
          // Create blob URL
          const blobUrl = URL.createObjectURL(blob);
          console.log("✅ Created blob URL:", blobUrl);
          
          // Test the blob URL
          const testAudio = new Audio(blobUrl);
          
          testAudio.onloadedmetadata = () => {
            console.log("✅ Blob URL is valid, duration:", testAudio.duration);
            
            // Call the callback
            console.log("📞 Calling onRecordingComplete with:", blobUrl);
            if (onRecordingComplete && typeof onRecordingComplete === 'function') {
              onRecordingComplete(blobUrl);
              console.log("✅ onRecordingComplete called successfully");
            } else {
              console.error("❌ onRecordingComplete is not a function:", typeof onRecordingComplete);
            }
          };
          
          testAudio.onerror = (error) => {
            console.error("❌ Blob URL test failed:", error);
            // Still try to call the callback
            if (onRecordingComplete && typeof onRecordingComplete === 'function') {
              onRecordingComplete(blobUrl);
            }
          };
          
          // Load to trigger the test
          testAudio.load();
          
          // Reset chunks for next recording
          audioChunksRef.current = [];
          
        } catch (error) {
          console.error("❌ Error processing recording:", error);
        }
      };
      
      mediaRecorder.onerror = (error) => {
        console.error("❌ MediaRecorder error:", error);
      };
      
      console.log("✅ MediaRecorder initialized successfully");
      
    } catch (error) {
      console.error("❌ Error initializing recorder:", error);
    }
  }, [onRecordingComplete]);

  // Initialize recorder on mount
  useEffect(() => {
    initializeRecorder();
    
    return () => {
      console.log("🧹 Cleaning up recorder...");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log("🛑 Stopping track:", track.kind);
          track.stop();
        });
      }
    };
  }, []); // Empty dependency array - initialize once

  const startRecording = useCallback(() => {
    console.log("🎬 Starting recording...");
    
    if (!mediaRecorderRef.current) {
      console.error("❌ MediaRecorder not initialized!");
      return;
    }
    
    if (mediaRecorderRef.current.state !== 'inactive') {
      console.error("❌ MediaRecorder is not in inactive state:", mediaRecorderRef.current.state);
      return;
    }
    
    try {
      // Reset state
      setRecordingTime(0);
      setIsRecording(true);
      setIsPaused(false);
      setHasRecording(false);
      audioChunksRef.current = [];
      
      // Call onRecordingStart
      console.log("📞 Calling onRecordingStart");
      if (onRecordingStart && typeof onRecordingStart === 'function') {
        onRecordingStart();
        console.log("✅ onRecordingStart called successfully");
      } else {
        console.error("❌ onRecordingStart is not a function:", typeof onRecordingStart);
      }
      
      // Start recording
      mediaRecorderRef.current.start(100);
      console.log("✅ MediaRecorder.start() called");
      
      // Start timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 0.1;
          if (newTime >= loopDurationFromStem) {
            console.log("⏰ Auto-stopping at loop duration");
            stopRecording();
            return loopDurationFromStem;
          }
          return newTime;
        });
      }, 100);
      
    } catch (error) {
      console.error("❌ Error starting recording:", error);
      setIsRecording(false);
    }
  }, [onRecordingStart, loopDurationFromStem]);

  const stopRecording = useCallback(() => {
    console.log("🛑 Stopping recording...");
    
    if (!mediaRecorderRef.current || !isRecording) {
      console.log("⚠️ Not recording or MediaRecorder not available");
      return;
    }
    
    try {
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.stop();
        console.log("✅ MediaRecorder.stop() called");
      }
      
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
    } catch (error) {
      console.error("❌ Error stopping recording:", error);
    }
  }, [isRecording]);

  const progress = (recordingTime / loopDurationFromStem) * 100;

  return (
    <div className="recorder-for-audio-circle border p-4" style={{ width, height }}>
      <Flex direction="column" gap="4">
        <Text size="4" weight="bold">
          Audio Recorder (Debug Mode)
        </Text>
        
        <div className="text-xs bg-gray-100 p-2 rounded">
          <div>State: Recording={isRecording.toString()}, HasRecording={hasRecording.toString()}</div>
          <div>Callbacks: Start={typeof onRecordingStart}, Complete={typeof onRecordingComplete}</div>
          <div>MediaRecorder: {mediaRecorderRef.current ? mediaRecorderRef.current.state : 'null'}</div>
        </div>
        
        {isVisible && (
          <>
            <Progress value={progress} max={100} />
            
            <Text size="2">
              {recordingTime.toFixed(1)}s / {loopDurationFromStem}s
            </Text>
            
            <Flex gap="2" justify="center">
              {!isRecording ? (
                <Button onClick={startRecording} color="red">
                  <MicrophoneIcon />
                  Start Recording
                </Button>
              ) : (
                <Button onClick={stopRecording} color="gray">
                  <StopIcon />
                  Stop Recording
                </Button>
              )}
              
              {hasRecording && recordingBlob && (
                <Button 
                  onClick={() => {
                    const url = URL.createObjectURL(recordingBlob);
                    const audio = new Audio(url);
                    audio.play();
                  }} 
                  color="green"
                >
                  <PlayIcon />
                  Test Play
                </Button>
              )}
            </Flex>
            
            {isRecording && (
              <Flex align="center" justify="center" gap="2">
                <div className="animate-pulse w-3 h-3 bg-red-500 rounded-full" />
                <Text size="2" color="red">RECORDING</Text>
              </Flex>
            )}
          </>
        )}
      </Flex>
    </div>
  );
}