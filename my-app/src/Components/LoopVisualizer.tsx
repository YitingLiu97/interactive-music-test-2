"use client";
import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Flex, Text } from "@radix-ui/themes";

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
// const RecordButtonIcon: React.FC = () => (
//   <svg
//     width="15"
//     height="15"
//     viewBox="0 0 15 15"
//     fill="none"
//     xmlns="http://www.w3.org/2000/svg"
//   >
//     <circle
//       cx="7.5"
//       cy="7.5"
//       r="7"
//       fill="currentColor"
//       stroke="currentColor"
//       strokeWidth="1"
//     />
//   </svg>
// );

const LoopVisualizer: React.FC<LoopVisualizerProps> = ({
  loopDuration,
  loopPosition,
  isLoopPlaybackActive,
  isLoopRecording,
  recordingSegments,
  // onPlayPause,
  // onRecord,
  onPositionChange,
  waveformData = [],
  audioLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(0);
  const [canvasHeight, setCanvasHeight] = useState<number>(0);
  const [isUserDragging, setIsUserDragging] = useState<boolean>(false);
  
  // Use refs for the values we don't need to trigger renders with
  const lastPositionRef = useRef<number>(loopPosition);
  const lastAudioLevelRef = useRef<number | undefined>(audioLevel);
  const animationFrameRef = useRef<number | null>(null);
  const needsRenderRef = useRef<boolean>(true);
  
  // Separate completed segments from active recording segment for efficiency
  const completedSegments = useMemo(() => {
    return recordingSegments.filter(segment => segment.end !== null);
  }, [recordingSegments]);
  
  const activeRecordingSegment = useMemo(() => {
    if (!isLoopRecording) return null;
    // Get the segment that is still recording (end is null)
    return recordingSegments.find(segment => segment.end === null) || null;
  }, [isLoopRecording, recordingSegments]);

  // Calculate canvas size on mount and resize
  useEffect(() => {
    const updateCanvasSize = (): void => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        // Only update if size actually changed
        if (rect.width !== canvasWidth || 100 !== canvasHeight) {
          setCanvasWidth(rect.width);
          setCanvasHeight(100);
          
          // Important: also set the actual canvas dimensions
          canvasRef.current.width = rect.width;
          canvasRef.current.height = 100;
          needsRenderRef.current = true;
        }
      }
    };
    
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [canvasWidth, canvasHeight]);

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
    canvas.addEventListener("mousemove", handleMouseMove as EventListener);
    canvas.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseup", handleMouseUp); // Catch mouse up outside canvas

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown as EventListener);
      canvas.removeEventListener("mousemove", handleMouseMove as EventListener);
      canvas.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [canvasRef, loopDuration, onPositionChange, isLoopRecording]);
  
  // Efficient rendering function - only renders when something important changes
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Check if we really need to render
    const positionChanged = Math.abs(lastPositionRef.current - loopPosition) > 0.01;
    const audioLevelChanged = audioLevel !== lastAudioLevelRef.current;
    
    if (!positionChanged && !audioLevelChanged && !needsRenderRef.current && 
        !isLoopPlaybackActive && !isLoopRecording) {
      // Skip rendering if nothing important changed
      return;
    }
    
    // Update refs to current values
    lastPositionRef.current = loopPosition;
    lastAudioLevelRef.current = audioLevel;
    needsRenderRef.current = false;// used to be false
    
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
          ctx.lineTo(x, y);// this is printing but it is not displaying the visual
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

    // Draw completed recording segments in their colors
    if (completedSegments && completedSegments.length > 0) {
      completedSegments.forEach((segment, index) => {
        if (segment.start !== undefined && segment.end !== null) {
          const startX = (segment.start / loopDuration) * canvas.width;
          const endX = (segment.end / loopDuration) * canvas.width;
          const width = endX - startX;

          // Use different colors for different completed segments
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

    // Draw ONLY the active recording segment with highlight if recording
    if (isLoopRecording && activeRecordingSegment) {
      console.log("loop is recording");
      const startPosition = activeRecordingSegment.start;
      const startX = (startPosition / loopDuration) * canvas.width;
      const currentX = (loopPosition / loopDuration) * canvas.width;
      const width = currentX - startX;
    
      if (width > 0) {
        // Highlight current recording with a vibrant red
        ctx.fillStyle = "rgba(239, 68, 68, 0.4)"; // Bright red with transparency
        ctx.fillRect(startX, 0, width, canvas.height);

        // Animated border for recording section
        const animPhase = (Date.now() % 1000) / 1000; // 0-1 pulsing animation
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

    // Draw audio level meter if recording or playing - optimized to only show when needed
    if ((isLoopPlaybackActive || isLoopRecording) && audioLevel !== undefined) {
      // Only draw the level meter on the right side
      const meterWidth = 15;
      const meterX = canvas.width - meterWidth - 10;
      
      // Background for meter
      ctx.fillStyle = "#e2e8f0"; 
      ctx.fillRect(meterX, 0, meterWidth, canvas.height);
      
      // Level fill - green to yellow to red based on level
      const level = Math.max(0, Math.min(100, audioLevel));
      const levelHeight = (level / 100) * canvas.height;
      const levelColor = level < 30 ? "green" : 
                       level < 70 ? "orange" : 
                       "red";
      
      ctx.fillStyle = levelColor;
      ctx.fillRect(meterX, canvas.height - levelHeight, meterWidth, levelHeight);
      
      // Border
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, 0, meterWidth, canvas.height);
      
      // Only add level labels when actually recording/playing
      if (isLoopRecording || isLoopPlaybackActive) {
        ctx.fillStyle = "#334155";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${level.toFixed(0)}%`, meterX - 2, canvas.height - 5);
      }
    } 

    // Draw playhead/needle with animation
    const needleX = (loopPosition / loopDuration) * canvas.width;
    // Shadow for needle
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 5;

    // Draw needle line with glow effect - red for both recording and playback
    ctx.beginPath();
    ctx.strokeStyle = isLoopRecording || isLoopPlaybackActive ? "#ef4444" : "#3b82f6"; 
    ctx.lineWidth = 3;
    ctx.moveTo(needleX, 0);
    ctx.lineTo(needleX, canvas.height);
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Draw needle handle/grip at the top
    ctx.fillStyle = isLoopRecording || isLoopPlaybackActive ? "#ef4444" : "#3b82f6";
    ctx.beginPath();
    ctx.arc(needleX, 10, 8, 0, Math.PI * 2);
    ctx.fill();

    // Display current position text
    ctx.fillStyle = "#1e293b";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${loopPosition.toFixed(1)}s`, needleX, canvas.height - 5);
  },[loopPosition,activeRecordingSegment,isLoopPlaybackActive,loopDuration,waveformData,completedSegments,isLoopRecording,audioLevel]);

  // Set up animation frame for continuous rendering
  useEffect(() => {
    // Update the needsRender flag when important props change
    needsRenderRef.current = true;
    
    // Animation function that uses requestAnimationFrame
    const animate = () => {
      renderCanvas();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);
    
    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    loopDuration, 
    waveformData, 
    isLoopPlaybackActive, 
    isLoopRecording,
    canvasWidth, 
    canvasHeight, 
    recordingSegments,
    completedSegments,
    activeRecordingSegment,
    needsRenderRef, renderCanvas
  ]);
  
  // Format seconds as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

// useEffect(() => {
//   console.log("LoopVisualizer received position:", loopPosition);
//   console.log("LoopVisualizer position ratio:", loopPosition / loopDuration);
// }, [loopPosition, loopDuration]);


  return (
    <div className="loop-visualizer" ref={containerRef}>
      <Flex direction="column" gap="2">
        <div
          className="timeline-container"
          style={{
            position: "relative",
            cursor: isLoopRecording ? "not-allowed" : "pointer",
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            style={{
              width: "100%",
              height: "100px",
              borderRadius: "6px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          />

          {/* Time indicators */}
          <Flex justify="between" mt="1">
            <Text size="1">0:00</Text>
            <Text size="1">{formatDuration(loopDuration)}</Text>
          </Flex>
        </div>

        {/* Control buttons */}
        {/* <Flex gap="2" justify="center">
          <Button
            color={isLoopPlaybackActive ? "red" : "green"}
            onClick={onPlayPause}
          >
            {isLoopPlaybackActive ? <StopIcon /> : <PlayIcon />}
            {isLoopPlaybackActive ? "Stop" : "Play"}
          </Button>

          <Button color={isLoopRecording ? "red" : "blue"} onClick={onRecord}>
            {isLoopRecording ? <StopIcon /> : <RecordButtonIcon />}
            {isLoopRecording ? "Stop Recording" : "Record"}
          </Button>
        </Flex> */}
      </Flex>
    </div>
  );
};

export default LoopVisualizer;