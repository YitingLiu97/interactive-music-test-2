// 1. LoopControls.tsx - Just the loop controls
'use client'
import React, { useState, useEffect } from 'react';
import { Button, Flex, Text, Card } from '@radix-ui/themes';
import { ReloadIcon, TimerIcon, PlayIcon, StopIcon } from '@radix-ui/react-icons';
import LoopVisualizer from './LoopVisualizer';
interface LoopControlsProps {
  loopDuration: number; 
  loopPosition: number;
  isLoopPlaybackActive: boolean;
  isLoopRecording: boolean;
  initializeLoopBuffer: (duration: number) => Promise<boolean>;
  startLoopRecordingAt: (startPosition: number, duration: number) => Promise<boolean>;
  playLoopWithTracking: () => Promise<boolean>;
  stopLoopPlayback: () => boolean;
  loopRecordingError: string | null;
}

const LoopControls: React.FC<LoopControlsProps> = ({
  loopDuration,
  loopPosition, 
  isLoopPlaybackActive,
  isLoopRecording,
  initializeLoopBuffer,

  startLoopRecordingAt,
  playLoopWithTracking,
  stopLoopPlayback
}) => {
  // Local state for this component only
  const [loopDurationInput, setLoopDurationInput] = useState("4");
  const [recordSegmentStart, setRecordSegmentStart] = useState(0);
  const [recordSegmentDuration, setRecordSegmentDuration] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
    
  // New state for tracking recording segments
  const [recordingSegments, setRecordingSegments] = useState<Array<{start: number; end: number | null}>>([]);
  
  // Example waveform data (replace with actual data from your audio buffer)
  const [waveformData, setWaveformData] = useState<number[]>([]);
    useEffect(() => {
    // Generate placeholder waveform data
    const generateWaveform = () => {
      const data = [];
      for (let i = 0; i < 1000; i++) {
        const x = i / 1000;
        const y = Math.sin(x * Math.PI * 20) * 0.3 + Math.sin(x * Math.PI * 7) * 0.4;
        data.push(y);
      }
      return data;
    };
    
    setWaveformData(generateWaveform());
  }, []);
  
  // Track recording segments
  useEffect(() => {
    if (isLoopRecording && recordingSegments.length === 0) {
      // If we just started recording, add a new segment
      setRecordingSegments([{ start: loopPosition, end: null }]);
    } else if (isLoopRecording && recordingSegments.length > 0) {
      // Update the current recording segment's end position
      setRecordingSegments(prev => {
        const updated = [...prev];
        updated[updated.length - 1].end = null; // Still recording
        return updated;
      });
    } else if (!isLoopRecording && recordingSegments.length > 0 && recordingSegments[recordingSegments.length - 1].end === null) {
      // If we just stopped recording, update the end position
      setRecordingSegments(prev => {
        const updated = [...prev];
        updated[updated.length - 1].end = loopPosition;
        return updated;
      });
    }
  }, [isLoopRecording, loopPosition]);

  // Handle creating a new loop
  const handleCreateNewLoop = async () => {
    try {
      const duration = parseInt(loopDurationInput, 10) || 4;
      setStatusMessage(`Creating new ${duration}s loop...`);
      
      const success = await initializeLoopBuffer(duration);
      if (success) {
        setStatusMessage("New loop created");
          setRecordingSegments([]);
} else {
        setStatusMessage("Failed to create new loop");
      }
    } catch (err) {
      console.error("Error creating loop:", err);
      setStatusMessage(`Loop creation error: ${err}`);
    }
  };
  
  // Handle recording a segment
  const handleStartSegmentRecording = async () => {
    try {
      setStatusMessage(`Recording segment...`);
      const success = await startLoopRecordingAt(recordSegmentStart, recordSegmentDuration);
      if (!success) {
        setStatusMessage("Failed to start recording");
      }else{
           setRecordingSegments(prev => [
          ...prev, 
          { start: recordSegmentStart, end: null }
        ]);
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setStatusMessage(`Recording error: ${err}`);
    }
  };
  
  // Handle loop playback
  const handleToggleLoopPlayback = async () => {
    try {
      if (isLoopPlaybackActive) {
        stopLoopPlayback();
        setStatusMessage("Playback stopped");
      } else {
        setStatusMessage("Starting playback...");
        const success = await playLoopWithTracking();
        
        if (success) {
          setStatusMessage(null);
        } else {
          setStatusMessage("Failed to start playback");
        }
      }
    } catch (err) {
      console.error("Error toggling playback:", err);
      setStatusMessage(`Playback error: ${err}`);
    }
  };
  
  return (
    <Card className="p-4 mt-4">
      {statusMessage && (
        <Text size="2" className="text-amber-500 mb-2">{statusMessage}</Text>
      )}
      
        {/* Add the new visualizer at the top */}
      <Card className="p-4 bg-white border border-gray-200 mb-4">
        <Text size="2" weight="medium" mb="2">Loop Visualizer</Text>
        <LoopVisualizer
          waveformData={waveformData}
          loopDuration={loopDuration}
          loopPosition={loopPosition}
          isLoopRecording={isLoopRecording}
          isLoopPlaybackActive={isLoopPlaybackActive}
          recordingSegments={recordingSegments}
        />
        {/* Position indicator */}
        <Flex justify="between" mt="2">
          <Text size="2">0s</Text>
          <Text size="2">
            Position: {loopPosition.toFixed(1)}s / {loopDuration}s
          </Text>
          <Text size="2">{loopDuration}s</Text>
        </Flex>
      </Card>

      {/* Loop Configuration */}
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center">
          <Text size="2" weight="medium">Loop Configuration</Text>
          <Flex gap="2" align="center">
            <Text size="2">Duration:</Text>
            <input
              type="number"
              min="1"
              max="60"
              value={loopDurationInput}
              onChange={(e) => setLoopDurationInput(e.target.value)}
              className="w-12 px-2 py-1 border border-gray-300 rounded-md"
              disabled={isLoopRecording || isLoopPlaybackActive}
            />
            <Text size="2">sec</Text>
            <Button 
              size="1" 
              variant="soft" 
              onClick={handleCreateNewLoop}
              disabled={isLoopRecording || isLoopPlaybackActive}
            >
              <ReloadIcon /> New Loop
            </Button>
          </Flex>
        </Flex>
      </Flex>
      
      {/* Playback Controls */}
      <Flex justify="between" align="center" className="mt-4">
        <Text size="2">
          Loop: {Math.round(loopPosition * 10) / 10}s / {loopDuration}s
        </Text>
        <Button 
          size="2" 
          color={isLoopPlaybackActive ? "amber" : "green"}
          onClick={handleToggleLoopPlayback}
          disabled={isLoopRecording}
        >
          {isLoopPlaybackActive ? <StopIcon /> : <PlayIcon />}
          {isLoopPlaybackActive ? "Stop" : "Play"}
        </Button>
      </Flex>
      
      {/* Recording Controls */}
      <Flex direction="column" gap="3" className="mt-4">
        <Text size="2" weight="medium">Record Segment</Text>
        
        <Flex gap="3" align="center">
          <Flex direction="column" gap="1">
            <Text size="1">Start Position (seconds)</Text>
            <input
              type="number"
              min="0"
              max={loopDuration}
              step="0.1"
              value={recordSegmentStart}
              onChange={(e) => setRecordSegmentStart(parseFloat(e.target.value) || 0)}
              className="w-20 px-2 py-1 border border-gray-300 rounded-md"
              disabled={isLoopRecording}
            />
          </Flex>
          
          <Flex direction="column" gap="1">
            <Text size="1">Duration (seconds)</Text>
            <input
              type="number"
              min="0.1"
              max={loopDuration - recordSegmentStart}
              step="0.1"
              value={recordSegmentDuration}
              onChange={(e) => setRecordSegmentDuration(parseFloat(e.target.value) || 0.1)}
              className="w-20 px-2 py-1 border border-gray-300 rounded-md"
              disabled={isLoopRecording}
            />
          </Flex>
          
          <Button
            size="3"
            color="red"
            disabled={isLoopPlaybackActive || isLoopRecording}
            onClick={handleStartSegmentRecording}
          >
            {isLoopRecording ? <StopIcon /> : <TimerIcon />}
            {isLoopRecording ? "Stop Recording" : "Record Segment"}
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};

export default LoopControls;
