'use client'
import React, { useRef, useEffect, useState } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { PlayIcon, StopIcon } from "@radix-ui/react-icons";

// Define TypeScript interfaces
interface RecordingSegment {
  start: number;
  end: number | null;
}

interface LoopVisualizerProps {
  loopBuffer: AudioBuffer | null;
  loopDuration: number;
  loopPosition: number;
  isLoopPlaybackActive: boolean;
  isLoopRecording: boolean;
  recordingSegments: RecordingSegment[];
  onPlayPause: () => void;
  onRecord: () => void;
  onStop: () => void;
  onPositionChange: (position: number) => void;
  waveformData?: number[];
  audioLevel?: number;
}

// Simple Record Button Icon Component
const RecordButtonIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="7.5"
      cy="7.5"
      r="7"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
    />
  </svg>
);

const LoopVisualizer: React.FC<LoopVisualizerProps> = ({
  // loopBuffer,
  loopDuration,
  loopPosition,
  isLoopPlaybackActive,
  isLoopRecording,
  recordingSegments,
  onPlayPause,
  onRecord,
  onPositionChange,
  waveformData = [],
  audioLevel
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(0);
  const [canvasHeight, setCanvasHeight] = useState<number>(0);
  const [isUserDragging, setIsUserDragging] = useState<boolean>(false);
  
  // Animation frame reference for smooth rendering
  const animationFrameRef = useRef<number | null>(null);

  // Set up canvas size on mount and resize
  useEffect(() => {
    const updateCanvasSize = (): void => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasWidth(rect.width);
        setCanvasHeight(100); // Fixed height
      }
    };

    // Initial size
    updateCanvasSize();

    // Update on resize
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, []);

  // Handle mouse interactions for scrubbing
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;

    const handleMouseDown = (e: MouseEvent): void => {
      if (isLoopRecording) return; // Don't allow scrubbing while recording
      setIsUserDragging(true);
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newPosition = (x / rect.width) * loopDuration;
      onPositionChange(Math.max(0, Math.min(newPosition, loopDuration)));
    };

    const handleMouseMove = (e: MouseEvent): void => {
      if (!isUserDragging) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newPosition = (x / rect.width) * loopDuration;
      onPositionChange(Math.max(0, Math.min(newPosition, loopDuration)));
    };

    const handleMouseUp = (): void => {
      setIsUserDragging(false);
    };

    // Add event listeners
    canvas.addEventListener("mousedown", handleMouseDown as EventListener);
    window.addEventListener("mousemove", handleMouseMove as EventListener);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown as EventListener);
      window.removeEventListener("mousemove", handleMouseMove as EventListener);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [canvasRef, isUserDragging, loopDuration, onPositionChange, isLoopRecording]);

  // Draw the visualizer with animation frame for smooth rendering
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    const draw = (): void => {
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = "#f1f5f9"; // Light gray background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw timeline markers (1 second intervals)
      ctx.fillStyle = "#cbd5e1"; // Light gray markers
      for (let i = 1; i < loopDuration; i++) {
        const x = (i / loopDuration) * canvas.width;
        ctx.fillRect(x - 1, 0, 1, canvas.height);
      }

      // Draw waveform (if data available)
      if (waveformData && waveformData.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "#94a3b8"; // Slate gray for waveform
        ctx.lineWidth = 1.5;

        const middle = canvas.height / 2;
        const amplitudeScale = canvas.height * 0.4; // Scale for visibility

        waveformData.forEach((amplitude, index) => {
          const x = (index / waveformData.length) * canvas.width;
          const y = middle - amplitude * amplitudeScale;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        // Mirror the waveform for the bottom half
        for (let i = waveformData.length - 1; i >= 0; i--) {
          const x = (i / waveformData.length) * canvas.width;
          const y = middle + waveformData[i] * amplitudeScale;
          ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fillStyle = "rgba(148, 163, 184, 0.3)"; // Semi-transparent fill
        ctx.fill();
        ctx.stroke();
      }

      // Draw recording segments with visual distinction
      if (recordingSegments && recordingSegments.length > 0) {
        recordingSegments.forEach((segment, index) => {
          if (segment.start !== undefined && segment.end !== undefined && segment.end !== null) {
            const startX = (segment.start / loopDuration) * canvas.width;
            const endX = (segment.end / loopDuration) * canvas.width;
            const width = endX - startX;
            
            // Use different colors for different segments
            const hue = (index * 30) % 360; // Cycle through different hues
            ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.3)`;
            ctx.fillRect(startX, 0, width, canvas.height);
            
            // Add border
            ctx.strokeStyle = `hsla(${hue}, 90%, 50%, 0.8)`;
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, 0, width, canvas.height);
          }
        });
      }

      // Draw current recording segment if actively recording
      if (isLoopRecording) {
        const startPosition = recordingSegments.length > 0 
          ? recordingSegments[recordingSegments.length - 1].start 
          : 0;
        
        if (startPosition !== undefined) {
          const startX = (startPosition / loopDuration) * canvas.width;
          const currentX = (loopPosition / loopDuration) * canvas.width;
          const width = currentX - startX;
          
          // Highlight current recording with a vibrant red
          ctx.fillStyle = "rgba(239, 68, 68, 0.4)"; // Bright red with transparency
          ctx.fillRect(startX, 0, width, canvas.height);
          
          // Animated border for recording section
          const animPhase = Date.now() % 1000 / 1000; // 0-1 pulsing animation
          const pulseOpacity = 0.5 + 0.5 * Math.sin(animPhase * Math.PI * 2);
          
          ctx.strokeStyle = `rgba(239, 68, 68, ${pulseOpacity})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(startX, 0, width, canvas.height);
          
          // Label for "RECORDING"
          ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          const labelX = startX + width / 2;
          const labelY = canvas.height / 2;
          ctx.fillText("RECORDING", labelX, labelY);
        }
      }

      // Draw playhead/needle with animation
      const needleX = (loopPosition / loopDuration) * canvas.width;
      
      // Shadow for needle
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 5;
      
      // Draw needle line with glow effect
      ctx.beginPath();
      ctx.strokeStyle = isLoopRecording ? "#ef4444" : "#3b82f6"; // Red when recording, blue otherwise
      ctx.lineWidth = 3;
      ctx.moveTo(needleX, 0);
      ctx.lineTo(needleX, canvas.height);
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Draw needle handle/grip at the top
      ctx.fillStyle = isLoopRecording ? "#ef4444" : "#3b82f6";
      ctx.beginPath();
      ctx.arc(needleX, 10, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Display current position text
      ctx.fillStyle = "#1e293b";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      const formattedPosition = loopPosition.toFixed(1) ;
      if(audioLevel){
      const audioLevelInfo = "audio level "+audioLevel?.toFixed(1);
     ctx.fillText(`${audioLevelInfo}s`, needleX, canvas.height - 10);

      }
      ctx.fillText(`${formattedPosition}s`, needleX, canvas.height - 5);

      // Request next frame if active
      if (isLoopPlaybackActive || isLoopRecording) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    // Initial draw
    draw();

    // Continuous redraw if playing or recording
    if (isLoopPlaybackActive || isLoopRecording) {
      animationFrameRef.current = requestAnimationFrame(draw);
    }

    // Cleanup animation frame on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    canvasWidth, 
    canvasHeight, 
    waveformData, 
    loopPosition, 
    loopDuration, 
    isLoopPlaybackActive,
    isLoopRecording,
    recordingSegments
  ]);

  // Format seconds as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="loop-visualizer" ref={containerRef}>
      <Flex direction="column" gap="2">
        <div className="timeline-container" style={{ position: "relative", cursor: isLoopRecording ? "not-allowed" : "pointer" }}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{ 
              width: "100%", 
              height: "100px", 
              borderRadius: "6px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)"
            }}
          />
          
          {/* Time indicators */}
          <Flex justify="between" mt="1">
            <Text size="1">0:00</Text>
            <Text size="1">{formatDuration(loopDuration)}</Text>
          </Flex>
        </div>

        {/* Control buttons */}
        <Flex gap="2" justify="center">
          <Button
            color={isLoopPlaybackActive ? "amber" : "green"}
            onClick={onPlayPause}
          >
            {isLoopPlaybackActive ? <StopIcon /> : <PlayIcon />}
            {isLoopPlaybackActive ? "Stop" : "Play"}
          </Button>

          <Button
            color={isLoopRecording ? "red" : "blue"}
            onClick={onRecord}
          >
            {isLoopRecording ? <StopIcon /> : <RecordButtonIcon />}
            {isLoopRecording ? "Stop Recording" : "Record"}
          </Button>
        </Flex>
      </Flex>
    </div>
  );
};

export default LoopVisualizer;