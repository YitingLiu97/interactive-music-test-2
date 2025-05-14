// Complete updated LoopControls component with fixed LoopVisualizer usage

import React, { useState, useEffect } from "react";
import { Button, Flex, Text, Card } from "@radix-ui/themes";
import { ReloadIcon, PlayIcon, StopIcon } from "@radix-ui/react-icons";
import LoopVisualizer from "./LoopVisualizer"; // Make sure this import is correct

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
  loopBuffer: AudioBuffer | null; // Added for the visualizer
  audioLevel?: number; // Optional audio level for visualization
  initializeLoopBuffer: (duration: number) => Promise<boolean>;
  startLoopRecordingAt: (
    startPosition: number,
    duration?: number
  ) => Promise<boolean>;
  playLoopWithTracking: (startPosition?: number) => Promise<boolean>;
  stopLoopPlayback: () => boolean;
  stopLoopRecordingAndMerge: () => Promise<boolean>;
  onPositionChange?: (position: number) => void; // Optional callback
  loopBlobUrl: string | null;
  isExportingLoop: boolean;
  exportLoopToBlob: () => Promise<{ blob: Blob; url: string } | null>;
  loopRecordingError?: string | null;
  waveformData?: number[]; // For visualization | Float32Array[]
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
  // const [recordSegmentStart, setRecordSegmentStart] = useState(0);
  // const [recordSegmentDuration, setRecordSegmentDuration] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [recordingSegments, setRecordingSegments] = useState<
    { start: number; end: number | null }[]
  >([]);
  const [canDownload, setCanDownload] = useState(false);

  // Effect to update recording segments when recording state changes
useEffect(()=>{
  if (!isLoopRecording && recordingSegments.length > 0 && 
       recordingSegments[recordingSegments.length - 1].end !== null) {
    // Recording stopped
    setRecordingSegments(prev => {
      const updated = [...prev];
      updated[updated.length - 1].end = loopPosition;
      return updated;
    });
    
    // Enable download
    setCanDownload(true);
  }
}, [isLoopRecording, loopPosition, recordingSegments]);

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

      // Reset recording segments
      setRecordingSegments([]);

      const success = await initializeLoopBuffer(duration);
      if (success) {
        setStatusMessage("New loop created");
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
        // Start recording
        setStatusMessage("Starting recording...");

        // Make sure to pass the full loop duration to ensure it records for the entire time
        const success = await startLoopRecordingAt(loopPosition, loopDuration);

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
    if (isLoopRecording) {
      stopLoopRecordingAndMerge();
    }
    if (isLoopPlaybackActive) {
      stopLoopPlayback();
    }
    setStatusMessage("All operations stopped");
  };

  const handlePositionChange = async (newPosition: number) => {
  console.log("Position change requested:", newPosition);
  
  // This assumes you have access to setLoopPosition from props or context
  if (typeof onPositionChange === 'function') {
    onPositionChange(newPosition);
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

      {/* Loop Visualizer */}
      <Text size="2" weight="medium" mb="2">
        Loop Visualizer
      </Text>
      <LoopVisualizer
        loopBuffer={loopBuffer} // Add this prop
        waveformData={waveformData}
        loopDuration={loopDuration}
        loopPosition={loopPosition}
        isLoopRecording={isLoopRecording}
        isLoopPlaybackActive={isLoopPlaybackActive}
        recordingSegments={recordingSegments || []}
        onPlayPause={handleToggleLoopPlayback} // Add these handler functions
        onRecord={handleToggleRecording}
        onStop={handleStop}
        onPositionChange={handlePositionChange}
        audioLevel={audioLevel} // Optional - add if you have audio level data
      />
<Text size="2" color="red">
  Current Position: {loopPosition.toFixed(2)}s
  {isLoopPlaybackActive ? " (Playing)" : " (Stopped)"}
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

        <Button>Can download is {canDownload}</Button>
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
      {/* Recording Position */}
      <Flex direction="column" gap="3" className="mt-4">
        <Text size="2" weight="medium">
          Recording Position
        </Text>
        <Text size="2">
          Current: {loopPosition.toFixed(2)}s / {loopDuration}s
        </Text>
        <Flex gap="3">
          <Button
            size="2"
            color={isLoopPlaybackActive ? "amber" : "blue"}
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
        </Flex>
      </Flex>
    </Card>
  );
};

export default LoopControls;
