// Fixed LoopControls component with improved position tracking and debugging
import React, { useState, useEffect, useRef } from "react";
import { Button, Flex, Text, Card } from "@radix-ui/themes";
import { ReloadIcon, PlayIcon, StopIcon } from "@radix-ui/react-icons";
import LoopVisualizer from "./LoopVisualizer"; 

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

interface LoopControlsProps {
  loopDuration: number;
  loopPosition: number;
  isLoopPlaybackActive: boolean;
  isLoopRecording: boolean;
  loopBuffer: AudioBuffer | null;
  audioLevel?: number;
  initializeLoopBuffer: (duration: number) => Promise<boolean>;
  startLoopRecordingAt: (
    startPosition: number,
    duration?: number
  ) => Promise<boolean>;
  playLoopWithTracking: (startPosition?: number) => Promise<boolean>;
  stopLoopPlayback: () => boolean;
  stopLoopRecordingAndMerge: () => Promise<boolean>;
  onPositionChange?: (position: number) => void;
  loopBlobUrl: string | null;
  isExportingLoop: boolean;
  exportLoopToBlob: () => Promise<{ blob: Blob; url: string } | null>;
  loopRecordingError?: string | null;
  waveformData?: number[];
}

interface RecordingSegment {
  start: number;
  end: number | null;
}

const LoopControls: React.FC<LoopControlsProps> = ({
  loopDuration,
  loopPosition,
  isLoopPlaybackActive,
  isLoopRecording,
  loopBuffer,
  audioLevel = 0,
  initializeLoopBuffer,
  startLoopRecordingAt,
  playLoopWithTracking,
  stopLoopPlayback,
  stopLoopRecordingAndMerge,
  onPositionChange,
  loopRecordingError,
  waveformData,
  exportLoopToBlob,
  isExportingLoop,
}) => {
  // Local state for this component only
  const [loopDurationInput, setLoopDurationInput] = useState("4");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recordingSegments, setRecordingSegments] = useState<RecordingSegment[]>([]);
  const [canDownload, setCanDownload] = useState(false);
  
  // Internal position tracking - this is our source of truth during recording
  const [internalPosition, setInternalPosition] = useState(0);
  
  // Refs for tracking state
  const previousPositionRef = useRef<number>(0);
  const recordingStartedRef = useRef<boolean>(false);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingStartPositionRef = useRef<number>(0);
  const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug: Log the values we're receiving
  console.log('LoopControls received:', {
    loopPosition,
    isLoopRecording,
    isLoopPlaybackActive,
    loopDuration,
    internalPosition
  });

  // Use internal position if recording, otherwise sync with parent position
  const currentDisplayPosition = isLoopRecording ? internalPosition : loopPosition;

  // Sync internal position with parent when not recording
  useEffect(() => {
    if (!isLoopRecording) {
      setInternalPosition(loopPosition);
    }
  }, [loopPosition, isLoopRecording]);

  // Effect to handle position updates during recording
  useEffect(() => {
    if (isLoopRecording && !recordingStartedRef.current) {
      // Recording just started
      console.log('Starting recording position tracking from:', loopPosition);
      
      recordingStartedRef.current = true;
      recordingStartTimeRef.current = Date.now();
      recordingStartPositionRef.current = loopPosition;
      setInternalPosition(loopPosition);
      
      // Start a new recording segment
      setRecordingSegments(prev => [...prev, { start: loopPosition, end: null }]);
      
      // Start position update interval
      positionUpdateIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        const newPosition = recordingStartPositionRef.current + elapsed;
        
        console.log('Recording position update:', {
          elapsed,
          startPosition: recordingStartPositionRef.current,
          newPosition,
          loopDuration
        });
        
        // Handle loop wraparound
        if (newPosition >= loopDuration) {
          const wrappedPosition = newPosition % loopDuration;
          setInternalPosition(wrappedPosition);
          
          console.log('Loop wrapped to:', wrappedPosition);
          
          // Notify parent if callback exists
          if (onPositionChange) {
            try {
              onPositionChange(wrappedPosition);
            } catch (error) {
              console.error('Error calling onPositionChange:', error);
            }
          }
          
          // Update recording segment and start a new one if still recording
          setRecordingSegments(prev => {
            if (prev.length === 0) return prev;
            
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            
            // Close the current segment at loop end
            if (updated[lastIndex].end === null) {
              updated[lastIndex] = {
                ...updated[lastIndex],
                end: loopDuration
              };
              
              // Start a new segment at the beginning if still recording
              updated.push({ start: 0, end: null });
            }
            
            return updated;
          });
          
          // Reset timing for the new loop cycle
          recordingStartTimeRef.current = Date.now();
          recordingStartPositionRef.current = 0;
        } else {
          setInternalPosition(newPosition);
          
          // Notify parent if callback exists
          if (onPositionChange) {
            try {
              onPositionChange(newPosition);
            } catch (error) {
              console.error('Error calling onPositionChange:', error);
            }
          }
        }
      }, 50); // Update every 50ms for smooth movement
      
    } else if (!isLoopRecording && recordingStartedRef.current) {
      // Recording just stopped
      console.log('Stopping recording position tracking at:', internalPosition);
      
      recordingStartedRef.current = false;
      
      // Clear the position update interval
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
      
      // Update the last recording segment
      setRecordingSegments(prev => {
        if (prev.length === 0) return prev;
        
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        
        // Only update if the last segment is still active
        if (updated[lastIndex].end === null) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            end: internalPosition
          };
        }
        
        return updated;
      });
      
      setCanDownload(true);
    }
  }, [isLoopRecording, loopPosition, loopDuration, onPositionChange, internalPosition]);

  // Track position for resuming playback (when not recording)
  useEffect(() => {
    if (!isLoopRecording && !isLoopPlaybackActive) {
      previousPositionRef.current = currentDisplayPosition;
    }
  }, [currentDisplayPosition, isLoopRecording, isLoopPlaybackActive]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
    };
  }, []);

  // Add download handler
  const handleDownloadLoop = async () => {
    if (!canDownload) return;
    
    setStatusMessage("Preparing download...");
    try {
      const result = await exportLoopToBlob();
      if (result) {
        // Create a download link and trigger it
        const downloadLink = document.createElement('a');
        downloadLink.href = result.url;
        downloadLink.download = `loop-recording-${new Date().toISOString().slice(0,10)}.wav`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setStatusMessage("Download started!");
      } else {
        setStatusMessage("Error: Could not create download");
      }
    } catch (err) {
      console.error("Error exporting loop:", err);
      setStatusMessage(`Export error: ${err}`);
    }
  };

  // Handle creating a new loop
  const handleCreateNewLoop = async () => {
    try {
      const duration = parseInt(loopDurationInput, 10) || 4;
      setStatusMessage(`Creating new ${duration}s loop...`);

      // Clear any existing intervals
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }

      // Reset recording segments and position
      setRecordingSegments([]);
      setInternalPosition(0);
      if (onPositionChange) {
        onPositionChange(0);
      }
      previousPositionRef.current = 0;

      const success = await initializeLoopBuffer(duration);
      if (success) {
        setStatusMessage("New loop created");
        setCanDownload(false);
      } else {
        setStatusMessage("Failed to create new loop");
      }
    } catch (err) {
      console.error("Error creating loop:", err);
      setStatusMessage(`Loop creation error: ${err}`);
    }
  };

  // Handle playback controls
  const handleToggleLoopPlayback = async () => {
    try {
      if (isLoopPlaybackActive) {
        stopLoopPlayback();
        setStatusMessage("Playback stopped");
      } else {
        setStatusMessage("Starting playback...");
        
        // Resume from previous position or start from beginning
        const startPosition = previousPositionRef.current;
        console.log('Starting playback from position:', startPosition);
        
        const success = await playLoopWithTracking(startPosition);

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

  // Handle recording controls
  const handleToggleRecording = async () => {
    try {
      if (isLoopRecording) {
        // Stop recording
        setStatusMessage("Stopping recording...");
        const success = await stopLoopRecordingAndMerge();

        if (success) {
          setStatusMessage("Recording complete");
        } else {
          setStatusMessage("Failed to complete recording");
        }
      } else {
        // Start recording at the current position
        setStatusMessage("Starting recording...");
        const startPosition = previousPositionRef.current; 
        
        console.log('Starting recording from position:', startPosition);
        
        // Calculate remaining duration based on loop length
        const remainingDuration = loopDuration - startPosition;
        
        // Make sure we don't try to record negative duration
        if (remainingDuration <= 0) {
          setStatusMessage("Cannot record - at end of loop");
          return;
        }

        const success = await startLoopRecordingAt(startPosition, remainingDuration);

        if (success) {
          setStatusMessage("Recording in progress...");
        } else {
          setStatusMessage("Failed to start recording");
        }
      }
    } catch (err) {
      console.error("Error toggling recording:", err);
      setStatusMessage(`Recording error: ${err}`);
    }
  };

  // Handle stop all
  const handleStop = () => {
    // Clear any position update intervals
    if (positionUpdateIntervalRef.current) {
      clearInterval(positionUpdateIntervalRef.current);
      positionUpdateIntervalRef.current = null;
    }
    
    if (isLoopRecording) {
      stopLoopRecordingAndMerge();
    }
    if (isLoopPlaybackActive) {
      stopLoopPlayback();
    }
    setStatusMessage("All operations stopped");
  };

  // Handle position change from visualizer (scrubbing)
  const handlePositionChange = async (newPosition: number) => {
    console.log('Position change requested:', newPosition);
    
    // Update the previous position ref for next playback/recording
    previousPositionRef.current = newPosition;
    
    // Update the internal position immediately
    setInternalPosition(newPosition);
    
    // Update the actual position via callback
    if (typeof onPositionChange === 'function') {
      try {
        onPositionChange(newPosition);
      } catch (error) {
        console.error('Error calling onPositionChange:', error);
      }
    }
    
    // If recording, update the timing references
    if (isLoopRecording) {
      recordingStartTimeRef.current = Date.now();
      recordingStartPositionRef.current = newPosition;
      console.log('Updated recording timing for scrub:', {
        newPosition,
        timestamp: recordingStartTimeRef.current
      });
    }
    
    // If playing, restart at the new position
    if (isLoopPlaybackActive) {
      // Stop first
      stopLoopPlayback();
      
      // Brief delay to ensure playback stops
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Start at new position
      playLoopWithTracking(newPosition);
    }
  };

  return (
    <Card className="p-4 mt-4">
      {statusMessage && (
        <Text size="2" className="text-amber-500 mb-2">
          {statusMessage}
        </Text>
      )}

      {loopRecordingError && (
        <Text size="2" className="text-red-500 mb-2">
          {loopRecordingError}
        </Text>
      )}

      {/* Debug Information */}
      <Text size="1" className="text-gray-400 mb-2">
        Debug: Parent Position: {loopPosition.toFixed(3)}, 
        Internal Position: {internalPosition.toFixed(3)}, 
        Display Position: {currentDisplayPosition.toFixed(3)}
      </Text>

      {/* Loop Visualizer */}
      <Text size="2" weight="medium" mb="2">
        Loop Visualizer
      </Text>
      <LoopVisualizer
        loopBuffer={loopBuffer}
        waveformData={waveformData}
        loopDuration={loopDuration}
        loopPosition={currentDisplayPosition} // Use our calculated position
        isLoopRecording={isLoopRecording}
        isLoopPlaybackActive={isLoopPlaybackActive}
        recordingSegments={recordingSegments}
        onPlayPause={handleToggleLoopPlayback}
        onRecord={handleToggleRecording}
        onStop={handleStop}
        onPositionChange={handlePositionChange}
        audioLevel={audioLevel}
      />

      <Text size="2" color="blue">
        Current Position: {currentDisplayPosition.toFixed(2)}s
        {isLoopPlaybackActive ? " (Playing)" : isLoopRecording ? " (Recording)" : " (Stopped)"}
      </Text>

      {/* Loop Configuration */}
      <Flex direction="column" gap="3" className="mt-4">
        <Flex justify="between" align="center">
          <Text size="2" weight="medium">
            Loop Configuration
          </Text>
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

      {/* Download section */}
      {canDownload && (
        <Flex direction="column" gap="3" className="mt-4">
          <Text size="2" weight="medium">Export Loop</Text>
          <Button
            size="2"
            color="green"
            onClick={handleDownloadLoop}
            disabled={isExportingLoop}
          >
            {isExportingLoop ? "Preparing..." : "Download WAV"}
          </Button>
        </Flex>
      )}

      {/* Recording Controls */}
      <Flex direction="column" gap="3" className="mt-4">
        <Text size="2" weight="medium">
          Loop Controls
        </Text>
        <Text size="2">
          Current: {currentDisplayPosition.toFixed(2)}s / {loopDuration}s
        </Text>
        <Flex gap="3">
          <Button
            size="2"
            color={isLoopPlaybackActive ? "red" : "blue"}
            onClick={handleToggleLoopPlayback}
            disabled={isLoopRecording}
          >
            {isLoopPlaybackActive ? <StopIcon /> : <PlayIcon />}
            {isLoopPlaybackActive ? "Stop" : "Play"}
          </Button>

          <Button
            size="2"
            color={isLoopRecording ? "red" : "blue"}
            onClick={handleToggleRecording}
            disabled={!loopBuffer}
          >
            {isLoopRecording ? <StopIcon /> : <RecordButtonIcon />}
            {isLoopRecording ? "Stop Recording" : "Record"}
          </Button>

          <Button
            size="2"
            variant="soft"
            color="gray"
            onClick={handleStop}
            disabled={!isLoopPlaybackActive && !isLoopRecording}
          >
            <StopIcon /> Stop All
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};

export default LoopControls;