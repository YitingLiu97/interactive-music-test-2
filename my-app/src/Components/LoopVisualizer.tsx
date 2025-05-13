// Enhanced LoopVisualizer.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Button, Flex, Text, Slider } from '@radix-ui/themes';
import { PlayIcon, PauseIcon, RecordButtonIcon, StopIcon } from '@radix-ui/react-icons';

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
  waveformData?: Float32Array[];
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
  waveformData
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Calculate waveform data from buffer if not provided
  const getWaveformData = () => {
    if (waveformData) return waveformData;
    
    if (!loopBuffer) return [new Float32Array(0)];
    
    const channelData: Float32Array[] = [];
    for (let i = 0; i < loopBuffer.numberOfChannels; i++) {
      channelData.push(loopBuffer.getChannelData(i));
    }
    return channelData;
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
    if (data.length > 0 && data[0].length > 0) {
      const channelData = data[0]; // Use first channel for visualization
      const samplesPerPixel = Math.floor(channelData.length / width);
      
      ctx.strokeStyle = '#3b82f6'; // Blue waveform
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      // Start at middle
      const centerY = height / 2;
      ctx.moveTo(0, centerY);
      
      // Draw waveform
      for (let x = 0; x < width; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel);
        if (sampleIndex < channelData.length) {
          const sampleValue = channelData[sampleIndex];
          // Scale to half the canvas height
          const y = centerY - (sampleValue * (height / 2) * 0.9);
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    // Draw current position indicator (playhead)
    const playheadX = (loopPosition / loopDuration) * width;
    
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
    waveformData
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
          disabled={false}
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