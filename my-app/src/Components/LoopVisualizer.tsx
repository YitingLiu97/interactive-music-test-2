import React, { useRef, useEffect, useState } from 'react';
import { Button, Flex, Text } from '@radix-ui/themes';
import { PlayIcon, PauseIcon, StopIcon } from '@radix-ui/react-icons';

// Simple Record Button Icon Component
const RecordButtonIcon = () => (
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

interface LoopVisualizerProps {
  // Loop properties
  loopBuffer: AudioBuffer | null;
  loopDuration: number;
  loopPosition: number;
  
  // State flags
  isLoopPlaybackActive: boolean;
  isLoopRecording: boolean;
  
  // Recording segments
  recordingSegments: { start: number; end: number | null }[];
  
  // Control functions
  onPlayPause: () => void;
  onRecord: () => void;
  onStop: () => void;
  onPositionChange?: (position: number) => void;
  
  // Optional waveform data for visualization
  waveformData?: number[] | Float32Array[];
  
  // Audio level for real-time reactivity (new prop)
  audioLevel?: number;
}

const LoopVisualizer: React.FC<LoopVisualizerProps> = ({
  loopBuffer,
  loopDuration,
  loopPosition,
  isLoopPlaybackActive,
  isLoopRecording,
  recordingSegments = [],
  onPlayPause,
  onRecord,
  onStop,
  onPositionChange,
  waveformData,
  audioLevel = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Audio level position (for animation)
  const [levelX, setLevelX] = useState(0);
  
  // Update level X position based on current loop position
  useEffect(() => {
    if (canvasRef.current) {
      const width = canvasRef.current.width;
      setLevelX((loopPosition / loopDuration) * width);
    }
  }, [loopPosition, loopDuration]);
  
  // Calculate waveform data from buffer if not provided
  const getWaveformData = () => {
    if (waveformData) {
      if (Array.isArray(waveformData) && waveformData.length > 0) {
        if (waveformData[0] instanceof Float32Array) {
          // It's an array of Float32Arrays, use the first one
          return waveformData[0];
        }
        // It's a simple array of numbers
        return waveformData;
      }
    }
    
    if (!loopBuffer) return new Float32Array(0);
    
    // If we have a buffer but no waveform data, extract from buffer
    return loopBuffer.getChannelData(0);
  };
  
  // Draw the canvas with all visualization elements
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Fill background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    
    // Vertical time markers
    const numMarkers = Math.ceil(loopDuration);
    for (let i = 0; i <= numMarkers; i++) {
      const x = (i / loopDuration) * width;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Add time label
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${i}s`, x + 2, height - 5);
    }
    
    // Draw recording segments as colored backgrounds
    if (recordingSegments.length > 0) {
      recordingSegments.forEach(segment => {
        const startX = (segment.start / loopDuration) * width;
        const endX = segment.end !== null 
          ? ((segment.end > loopDuration ? loopDuration : segment.end) / loopDuration) * width
          : ((loopPosition / loopDuration) * width);
          
        const segmentWidth = endX - startX;
        
        // Skip invalid segments
        if (segmentWidth <= 0) return;
        
        ctx.fillStyle = '#e5f6ff'; // Light blue background for recorded segments
        ctx.fillRect(startX, 0, segmentWidth, height);
      });
    }
    
    // Draw waveform if available
    const data = getWaveformData();
    if (data && data.length > 0) {
      const samplesPerPixel = Math.floor(data.length / width);
      
      ctx.strokeStyle = '#3b82f6'; // Blue waveform
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      // Start at middle
      const centerY = height / 2;
      ctx.moveTo(0, centerY);
      
      // Draw waveform
      for (let x = 0; x < width; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel);
        if (sampleIndex < data.length) {
          const sampleValue = typeof data[sampleIndex] === 'number' ? 
            data[sampleIndex] : 0;
          // Scale to half the canvas height
          const y = centerY - (sampleValue * (height / 2) * 0.9);
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    // Draw current position indicator (playhead)
    const playheadX = (loopPosition / loopDuration) * width;
    
    // Draw audio level indicator at playhead if recording
    if (isLoopRecording && audioLevel > 0) {
      // Calculate level height as percentage of canvas height
      const levelHeight = (audioLevel / 100) * (height * 0.8);
      
      // Draw level meter at current position
      const levelBarWidth = 8; // Width of level indicator
      
      // Gradient for level meter
      const gradient = ctx.createLinearGradient(0, height, 0, height - levelHeight);
      gradient.addColorStop(0, '#ef4444'); // Red at bottom
      gradient.addColorStop(0.6, '#f97316'); // Orange in middle
      gradient.addColorStop(1, '#22c55e'); // Green at top
      
      ctx.fillStyle = gradient;
      ctx.fillRect(
        playheadX - levelBarWidth / 2, 
        height - levelHeight, 
        levelBarWidth, 
        levelHeight
      );
      
      // Draw outline
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        playheadX - levelBarWidth / 2, 
        height - levelHeight, 
        levelBarWidth, 
        levelHeight
      );
      
      // Add "ripple" effect at current recording position
      ctx.beginPath();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Transparent red
      ctx.arc(playheadX, height/2, audioLevel * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Playhead line
    ctx.strokeStyle = isLoopRecording ? '#ef4444' : '#3b82f6'; // Red if recording, blue otherwise
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    
    // Playhead handle
    ctx.fillStyle = isLoopRecording ? '#ef4444' : '#3b82f6';
    ctx.beginPath();
    ctx.arc(playheadX, 10, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw recording or playing indicator
    if (isLoopRecording || isLoopPlaybackActive) {
      ctx.fillStyle = isLoopRecording ? '#ef4444' : '#3b82f6';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(
        isLoopRecording ? 'RECORDING' : 'PLAYING', 
        10, 
        20
      );
      
      // Add audio level text when recording
      if (isLoopRecording) {
        ctx.fillStyle = '#ef4444';
        ctx.font = '10px sans-serif';
        ctx.fillText(
          `Level: ${audioLevel}%`, 
          90, 
          20
        );
      }
    }
    
    // Current time indicator
    ctx.fillStyle = '#000000';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `${loopPosition.toFixed(1)}s / ${loopDuration.toFixed(1)}s`,
      width - 120,
      20
    );
    
  }, [
    loopBuffer, 
    loopDuration, 
    loopPosition, 
    isLoopRecording, 
    isLoopPlaybackActive, 
    recordingSegments,
    waveformData,
    audioLevel,
    levelX
  ]);
  
  // Handle canvas mouse events for position control
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!onPositionChange || isLoopRecording) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / canvas.width;
    const newPosition = ratio * loopDuration;
    
    onPositionChange(newPosition);
  };
  
  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLoopRecording) return;
    setIsDragging(true);
    handleCanvasClick(e);
  };
  
  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !onPositionChange) return;
    handleCanvasClick(e);
  };
  
  // Handle mouse up to stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Add/remove window event listeners for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);
  
  return (
    <div className="loop-visualizer">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={160}
        className="w-full h-40 border border-gray-300 rounded-md cursor-pointer"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      
      {/* Transport controls */}
      <Flex gap="2" justify="center" mt="2">
        <Button 
          variant="soft" 
          color={isLoopPlaybackActive ? "amber" : "green"} 
          onClick={onPlayPause}
        >
          {isLoopPlaybackActive ? <PauseIcon /> : <PlayIcon />}
          {isLoopPlaybackActive ? "Pause" : "Play"}
        </Button>
        
        <Button 
          variant="soft" 
          color={isLoopRecording ? "red" : "gray"} 
          onClick={onRecord}
          disabled={!isLoopPlaybackActive && !isLoopRecording}
        >
          <RecordButtonIcon />
          {isLoopRecording ? "Stop Recording" : "Record"}
        </Button>
        
        <Button 
          variant="soft" 
          color="red" 
          onClick={onStop}
          disabled={!isLoopPlaybackActive && !isLoopRecording}
        >
          <StopIcon />
          Stop All
        </Button>
      </Flex>
    </div>
  );
};

export default LoopVisualizer;