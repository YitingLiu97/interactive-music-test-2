"use client";
import React, { useState, useEffect } from "react";
import { Button, Flex, Text, Card, Badge, Box } from "@radix-ui/themes";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  DotFilledIcon,
  ReloadIcon,
  // LoopIcon,
} from "@radix-ui/react-icons";
import LoopVisualizer from "./LoopVisualizer";
import { useAudioRecorder } from "../app/utils/useAudioRecorder";

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

// TypeScript-friendly AudioContext
interface WindowWithAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface RecorderForAudioCircleComponentsProp {
  width: number;
  height: number;
  loopDurationFromStem: number;
  onRecordingComplete?: (blobUrl: string) => void; // Creates the audio circle (first time only)
  onRecordingUpdated?: (blobUrl: string) => void; // Updates existing audio circle 
  onRecordingStart?: () => void;
}

const RecorderForAudioCircle: React.FC<RecorderForAudioCircleComponentsProp> = ({
  width,
  height,
  loopDurationFromStem,
  onRecordingComplete, // Creates audio circle (first time)
  onRecordingUpdated, // Updates audio circle (subsequent times)
  onRecordingStart,
}) => {
  const {
    // State
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error,
    isRecorderReady,
    isRecording,
    isToneInitialized,
    recordedBlob,
    initState,

    // Functions
    initialize,
    selectAudioDevice,
    startRecording,
    stopRecording,

    // Loop-related state
    loopPosition,
    loopBuffer,
    loopDuration,
    isLoopPlaybackActive,
    isLoopRecording,

    // Loop-related functions
    initializeLoopBuffer,
    startLoopRecordingAt,
    stopLoopRecordingAndMerge,
    playLoopWithTracking,
    stopLoopPlayback,
    loopBlobUrl,
    exportLoopToBlob,
    getWaveformData,
  } = useAudioRecorder();

  // Local component state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>("Please initialize audio system");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [visualizationActive, setVisualizationActive] = useState(false);
  const [isLoopPlaying, setIsLoopPlaying] = useState(false);
  const [loopDurationInput, setLoopDurationInput] = useState<number>(10);
  // const [loopMode, setLoopMode] = useState(true);
  const [recordingSegments, setRecordingSegments] = useState<{ start: number; end: number | null }[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  // New state to track our own blob URL and updates
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const [hasCompletedRecording, setHasCompletedRecording] = useState(false);
  const [isFirstRecording, setIsFirstRecording] = useState(true); // Track if this is the first recording

  // Debug logging for blob URL changes
  useEffect(() => {
    console.log("🔄 Blob URL states changed:", {
      loopBlobUrl,
      localBlobUrl,
      hasCompletedRecording,
      isFirstRecording,
      isLoopRecording
    });
  }, [loopBlobUrl, localBlobUrl, hasCompletedRecording, isFirstRecording, isLoopRecording]);

  // Enhanced effect to handle recording completion and blob updates
  useEffect(() => {
    let isMounted = true;

    const handleRecordingCompletion = async () => {
      console.log("🎯 Recording completion detected", { isFirstRecording });
      
      try {
        // Add a small delay to ensure the recording has fully stopped
        await new Promise(resolve => setTimeout(resolve, 100));

        let blobUrlToUse: string | null = null;

        // First, try to use the existing loopBlobUrl
        if (loopBlobUrl) {
          console.log("✅ Using existing loopBlobUrl:", loopBlobUrl);
          blobUrlToUse = loopBlobUrl;
        } 
        // If no existing blob URL, try to export the loop
        else if (loopBuffer && typeof exportLoopToBlob === 'function') {
          console.log("🔄 Exporting loop to blob...");
          setStatusMessage("Preparing recording...");
          
          const result = await exportLoopToBlob();
          
          if (!isMounted) return; // Component unmounted during async operation
          
          if (result && result.url) {
            console.log("✅ Successfully exported loop:", result.url);
            blobUrlToUse = result.url;
            setStatusMessage("Recording ready!");
          } else {
            console.error("❌ Failed to export loop - no result");
            setStatusMessage("Failed to prepare recording");
            return;
          }
        } else {
          console.error("❌ Cannot export loop - missing buffer or function");
          setStatusMessage("Recording not available");
          return;
        }

        // Update local state
        setLocalBlobUrl(blobUrlToUse);
        setHasCompletedRecording(true);

        // Call the appropriate callback based on whether this is first recording or update
        if (blobUrlToUse) {
          if (isFirstRecording) {
            // First recording - create the audio circle
            if (onRecordingComplete) {
              console.log("🆕 FIRST RECORDING - calling onRecordingComplete to CREATE audio circle");
              onRecordingComplete(blobUrlToUse);
              setIsFirstRecording(false); // Mark that we've created the circle
            } else {
              console.error("❌ No onRecordingComplete callback for first recording!");
            }
          } else {
            // Subsequent recordings - update the existing audio circle
            if (onRecordingUpdated) {
              console.log("🔄 SUBSEQUENT RECORDING - calling onRecordingUpdated to UPDATE same audio circle");
              onRecordingUpdated(blobUrlToUse);
            } else {
              console.error("❌ No onRecordingUpdated callback for subsequent recording!");
            }
          }
        }

      } catch (error) {
        console.error("❌ Error handling recording completion:", error);
        setStatusMessage(`Error: ${error}`);
      }
    };

    // Check if recording just completed
    if (!isLoopRecording && loopBuffer && !hasCompletedRecording) {
      console.log("🎬 Recording completion condition met");
      handleRecordingCompletion();
    }

    return () => {
      isMounted = false;
    };
  }, [isLoopRecording, loopBuffer, loopBlobUrl, hasCompletedRecording, isFirstRecording, exportLoopToBlob, onRecordingComplete, onRecordingUpdated]);

  // Reset completion flag when starting new recording (but keep the same audio circle)
  useEffect(() => {
    if (isLoopRecording) {
      console.log("🎙️ Starting new recording - resetting for update");
      setHasCompletedRecording(false);
      // Note: We don't clear localBlobUrl here because we want to keep the visual indicator
      
      if (onRecordingStart) {
        console.log("📞 Calling onRecordingStart");
        onRecordingStart();
      }
    }
  }, [isLoopRecording, onRecordingStart]);

  useEffect(() => {
    const checkBrowserSupport = () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as WindowWithAudioContext).webkitAudioContext;

        const checks = {
          audioContext: typeof AudioContextClass !== "undefined",
          mediaDevices: !!navigator.mediaDevices,
          getUserMedia: !!navigator.mediaDevices?.getUserMedia,
          enumerateDevices: !!navigator.mediaDevices?.enumerateDevices,
        };

        console.log("Browser support checks:", checks);

        if (!checks.audioContext) {
          setStatusMessage("Warning: Your browser doesn't support AudioContext");
        }

        if (!checks.mediaDevices || !checks.getUserMedia) {
          setStatusMessage("Warning: Your browser doesn't support media devices");
        }
      } catch (e) {
        console.error("Error checking browser support:", e);
        setStatusMessage("Warning: Error checking browser compatibility");
      }
    };

    checkBrowserSupport();
  }, []);

  // Initialize on component mount
  useEffect(() => {
    console.log("Component mounted");
  }, []);

  // Handle initialization
  const handleInitialize = async () => {
    try {
      setStatusMessage("Initializing audio system...");
      const success = await initialize();

      if (success) {
        // Initialize the loop buffer right after successful initialization
        await handlLoopDurationChangeFromSTEMAudio(loopDurationFromStem);
        setStatusMessage("Audio system ready!");
        
        // Clear the message after a short delay
        setTimeout(() => setStatusMessage(null), 2000);
      } else {
        setStatusMessage("Initialization failed. Please try again.");
      }
    } catch (err) {
      console.error("Initialization error:", err);
      setStatusMessage(`Failed to initialize: ${err || "Unknown error"}`);
    }
  };

  // Handle device selection
  const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = parseInt(e.target.value, 10);

    try {
      setStatusMessage(`Changing to microphone ${newIndex + 1}...`);
      await selectAudioDevice(newIndex);
      setStatusMessage(null);
    } catch (err) {
      console.error("Device change error:", err);
      setStatusMessage(`Failed to change microphone: ${err || "Unknown error"}`);
    }
  };

  // Handle position change from visualizer
  const handlePositionChange = (newPosition: number) => {
    // Only allow position changes when not recording
    if (!isLoopRecording) {
      // If playing, restart from new position
      if (isLoopPlaybackActive) {
        stopLoopPlayback();
        setTimeout(() => {
          playLoopWithTracking(newPosition);
        }, 100);
      }
    }
  };

  // Handle recording start
  const handleStartRecording = async () => {
    try {
      if (!isRecorderReady) {
        setStatusMessage("Recorder not ready. Please initialize first.");
        return;
      }

      setStatusMessage("Starting recording...");
      const success = await startRecording();

      if (success) {
        setStatusMessage(null);
      } else {
        setStatusMessage("Failed to start recording. Please try again.");
      }
    } catch (err) {
      console.error("Recording start error:", err);
      setStatusMessage(`Recording error: ${err || "Unknown error"}`);
    }
  };

  // Handle recording stop
  const handleStopRecording = async () => {
    try {
      setStatusMessage("Stopping recording...");
      const result = await stopRecording();

      if (result) {
        setStatusMessage(null);
      } else {
        setStatusMessage("Failed to stop recording.");
      }
    } catch (err) {
      console.error("Recording stop error:", err);
      setStatusMessage(`Error stopping recording: ${err || "Unknown error"}`);
    }
  };

  const handlLoopDurationChangeFromSTEMAudio = async (duration: number) => {
    console.log("🔧 Setting loop duration from STEM audio:", duration);
    setLoopDurationInput(duration);
    if (!isNaN(duration) && duration >= 1 && duration <= 60) {
      console.log("🔄 Initializing loop buffer with duration:", duration);
      try {
        const success = await initializeLoopBuffer(duration);
        if (success) {
          console.log("✅ Loop buffer initialized successfully");
        } else {
          console.error("❌ Failed to initialize loop buffer");
          setStatusMessage("Failed to initialize loop buffer");
        }
      } catch (error) {
        console.error("❌ Error initializing loop buffer:", error);
        setStatusMessage(`Loop buffer error: ${error}`);
      }
    }
  };

  // Toggle loop mode
  // const handleToggleLoopMode = () => {
  //   setLoopMode((prev) => !prev);
  // };

  // Start loop recording
  const handleStartLoopRecording = async () => {
    try {
      if (!isRecorderReady) {
        setStatusMessage("Recorder not ready. Please initialize first.");
        return;
      }

      console.log("🎙️ Starting loop recording...");
      setStatusMessage(`Starting ${loopDuration} second loop recording...`);

      // Reset completion state when starting new recording
      setHasCompletedRecording(false);
      setLocalBlobUrl(null);

      // Add a new recording segment that starts now
      const newSegment = {
        start: loopPosition,
        end: null, // Will be set when recording stops
      };
      setRecordingSegments((prev) => [...prev, newSegment]);

      // Use the actual current loop position for better synchronization
      const currentPos = loopPosition;
      const success = await startLoopRecordingAt(currentPos, loopDuration);

      if (success) {
        setStatusMessage(`Recording ${loopDuration} second loop at position ${currentPos.toFixed(3)}s...`);
      } else {
        // Remove the segment if recording failed to start
        setRecordingSegments((prev) => prev.slice(0, -1));
        setStatusMessage("Failed to start loop recording. Please try again.");
      }
    } catch (err) {
      console.error("Loop recording start error:", err);
      setStatusMessage(`Loop recording error: ${err || "Unknown error"}`);
    }
  };

  // Stop loop recording or start recording at current position
  const handleLoopRecordToggle = async () => {
    try {
      if (isLoopRecording) {
        // If currently recording, stop it
        console.log("🛑 Stopping loop recording...");
        setStatusMessage("Stopping loop recording...");
        
        // Add a small delay to ensure proper cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const result = await stopLoopRecordingAndMerge();

        // Update the last recording segment with its end position
        setRecordingSegments((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1].end = loopPosition;
          return updated;
        });

        if (result) {
          console.log("✅ Loop recording completed successfully");
          setStatusMessage("Loop recording complete. Processing...");
          // Note: The blob creation will be handled by the useEffect above
        } else {
          console.error("❌ Failed to complete loop recording");
          setStatusMessage("Failed to create loop.");
        }
      } else {
        setRecordingSegments([]);
        // If not recording, start recording at current position
        if (isLoopPlaybackActive) {
          // If loop is playing, record at current position
          await handleStartLoopRecording();
        } else {
          // If loop is not playing, start it and then record
          setStatusMessage("Starting loop playback and recording...");
          await playLoopWithTracking();
          setTimeout(() => {
            handleStartLoopRecording();
          }, 300); // Small delay to ensure playback has started
        }
      }
    } catch (err) {
      console.error("Loop recording toggle error:", err);
      setStatusMessage(`Error with loop recording: ${err || "Unknown error"}`);
      
      // Reset states on error
      setRecordingSegments([]);
      setHasCompletedRecording(false);
      // Note: We don't reset isFirstRecording here to maintain audio circle consistency
    }
  };

  // Stop all loop activity
  const handleStopAll = () => {
    if (isLoopRecording) {
      stopLoopRecordingAndMerge();
    }
    if (isLoopPlaybackActive) {
      stopLoopPlayback();
      setIsLoopPlaying(false);
    }
    setStatusMessage("All loop operations stopped.");
  };

  // Toggle loop playback
  const handleToggleLoopPlayback = async () => {
    try {
      if (isLoopPlaybackActive) {
        await stopLoopPlayback();
        setStatusMessage("Loop playback stopped.");
      } else {
        setStatusMessage("Starting loop playback...");
        const success = await playLoopWithTracking();

        if (success) {
          setIsLoopPlaying(true);
          setStatusMessage(null);
        } else {
          setStatusMessage("Failed to play loop.");
        }
      }
    } catch (err) {
      console.error("Loop playback error:", err);
      setStatusMessage(`Loop playback error: ${err || "Unknown error"}`);
    }
  };

  // Audio visualization
  useEffect(() => {
    if (!mediaStream) {
      setVisualizationActive(false);
      setAudioLevel(0); // Reset level when no stream
      return;
    }

    setVisualizationActive(true);

    const AudioContextClass =
      window.AudioContext ||
      (window as WindowWithAudioContext).webkitAudioContext;

    if (!AudioContextClass) {
      console.error("AudioContext not supported in this browser");
      return;
    }

    const audioContext = new AudioContextClass();
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;

    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyzer);

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    console.log("Visualization active with mediaStream:", mediaStream.id);

    let animationFrame: number;

    const updateAudioLevel = () => {
      analyzer.getByteFrequencyData(dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      // Normalize to 0-100 range
      setAudioLevel(Math.min(100, Math.round((avg / 255) * 150)));

      // Continue animation loop
      animationFrame = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrame);
      source.disconnect();
      audioContext.close();
      setVisualizationActive(false);

      if (isLoopPlaying) {
        stopLoopPlayback();
      }
    };
  }, [mediaStream, isLoopPlaying, stopLoopPlayback]);

  // Handle recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      const timer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
    } else if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }

    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [isRecording, recordingTimer]);

  // Set up audio element for playback when recording is available
  useEffect(() => {
    if (!recordedBlob?.url) return;

    // Clean up previous audio element
    if (audioElement) {
      audioElement.pause();
      audioElement.src = "";
    }

    const audio = new Audio(recordedBlob.url);

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
    });

    audio.addEventListener("error", (e) => {
      console.error("Audio element error:", e);
      setStatusMessage("Error with audio playback");
      setIsPlaying(false);
    });

    setAudioElement(audio);

    return () => {
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    };
  }, [recordedBlob, audioElement]);

  // Update waveform data when loop buffer changes
  useEffect(() => {
    if (typeof getWaveformData === "function") {
      const data = getWaveformData(200);
      setWaveformData(data);
    }
  }, [loopBuffer, getWaveformData]);

  // Toggle audio playback
  const togglePlayback = () => {
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.currentTime = 0;
      audioElement.play().catch((error) => {
        console.error("Error playing audio:", error);
        setStatusMessage("Failed to play recording");
      });
      setIsPlaying(true);
    }
  };

  // Format seconds as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!isPermissionGranted) {
      return <Badge color="red">Permission Denied</Badge>;
    }

    if (isRecording) {
      return <Badge color="red">Recording</Badge>;
    }

    if (isLoopRecording) {
      return <Badge color="red">Loop Recording</Badge>;
    }

    if (isRecorderReady) {
      return <Badge color="green">Ready</Badge>;
    }

    if (isToneInitialized) {
      return <Badge color="amber">Initializing...</Badge>;
    }

    if (initState === "failed") {
      return <Badge color="red">Failed</Badge>;
    }

    return <Badge color="amber">Not Initialized</Badge>;
  };

  // Add this useEffect to debug position updates:
  useEffect(() => {
    console.log("AudioRecorder received position update:", {
      loopPosition,
      isLoopPlaybackActive,
      isLoopRecording,
      timestamp: Date.now(),
    });
  }, [loopPosition, isLoopPlaybackActive, isLoopRecording]);

  // Get the current blob URL to use (prefer local, fallback to hook)
  const currentBlobUrl = localBlobUrl || loopBlobUrl;

  return (
    <Box maxWidth={`${width}px`} maxHeight={`${height}px`}>
      <Card className="p-6 mx-auto bg-white rounded-xl shadow-lg">
        <Flex direction="column" gap="4">
          <Flex justify="between" align="center">
            <Text size="5" weight="bold">
              Audio Recorder
            </Text>
            {getStatusBadge()}
          </Flex>

          {(error || statusMessage) && (
            <Card className="p-3 bg-amber-100">
              <Text size="2">{statusMessage || error}</Text>
            </Card>
          )}

          {/* Debug info */}
          <Card className="p-3 bg-gray-100 text-xs">
            <Text size="1">
              <strong>Status:</strong> {initState} |<strong> Tone:</strong>{" "}
              {isToneInitialized ? "Initialized" : "Not Initialized"} |
              <strong> Ready:</strong> {isRecorderReady ? "Yes" : "No"} |
              <strong> Devices:</strong> {audioDevices.length} |
              {/* <strong> LoopMode:</strong> {loopMode ? "On" : "Off"} | */}
              <strong> BlobURL:</strong> {currentBlobUrl ? "Available" : "None"} |
              <strong> Completed:</strong> {hasCompletedRecording ? "Yes" : "No"} |
              <strong> FirstRec:</strong> {isFirstRecording ? "Yes" : "No"} |
              <strong> LoopBuffer:</strong> {loopBuffer ? "Yes" : "No"} |
              <strong> MediaStream:</strong> {mediaStream ? "Active" : "None"}
            </Text>
          </Card>

          {!isRecorderReady && (
            <Flex justify="center" my="2">
              <Button onClick={handleInitialize} color="green">
                {initState === "failed" ? (
                  <>
                    <ReloadIcon /> Retry Initialization
                  </>
                ) : (
                  "Initialize Audio System"
                )}
              </Button>
            </Flex>
          )}

          {isPermissionGranted && (
            <>
              <Flex direction="column" gap="2">
                <Text size="2" weight="medium">
                  Select Microphone:
                </Text>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={deviceIndex}
                  onChange={handleDeviceChange}
                  disabled={isRecording || !isRecorderReady}
                >
                  {audioDevices.map((device, index) => (
                    <option key={device.deviceId} value={index}>
                      {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </select>
              </Flex>

              {visualizationActive && (
                <Flex direction="column" gap="1">
                  <Text size="2" weight="medium">
                    Audio Level:
                  </Text>
                  <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-100 ease-out ${
                        isRecording || isLoopRecording ? "bg-red-500" : "bg-green-600"
                      }`}
                      style={{ width: `${audioLevel}%` }}
                    ></div>
                  </div>
                </Flex>
              )}

{/* used to be loopmode */}
              {true ? (
                /* Loop Recording Mode UI */
                <Card className="p-4 bg-blue-50 rounded-lg">
                  <Flex direction="column" gap="3">
                    <Text size="3" weight="medium">
                      Loop Recording Mode
                    </Text>

                    {/* Loop Duration Input */}
                    <Flex gap="2" align="center">
                      <Text size="2">Duration:</Text> {loopDurationInput}
                      <Text size="2">seconds</Text>
                      <Button
                        variant="soft"
                        size="1"
                        onClick={() => initializeLoopBuffer(loopDurationInput)}
                        disabled={isLoopRecording || isLoopPlaybackActive}
                      >
                        <ReloadIcon /> Current Audio Length
                      </Button>
                    </Flex>

                    {/* Show message when loop buffer is not available */}
                    {!loopBuffer && (
                      <Card className="p-3 bg-yellow-50">
                        <Text size="2" color="orange">
                          ⚠️ Loop buffer not initialized. 
                          {!isRecorderReady && " Please initialize audio system first."}
                          {isRecorderReady && " Creating loop buffer..."}
                        </Text>
                      </Card>
                    )}

                    {/* Loop Visualizer */}
                    {loopBuffer && (
                      <div className="mt-2 mb-2">
                        <LoopVisualizer
                          loopBuffer={loopBuffer}
                          loopDuration={loopDuration}
                          loopPosition={loopPosition}
                          isLoopPlaybackActive={isLoopPlaybackActive}
                          isLoopRecording={isLoopRecording}
                          recordingSegments={recordingSegments}
                          onPlayPause={handleToggleLoopPlayback}
                          onRecord={handleLoopRecordToggle}
                          onStop={handleStopAll}
                          onPositionChange={handlePositionChange}
                          waveformData={waveformData}
                          audioLevel={audioLevel}
                        />
                      </div>
                    )}

                    {/* Loop Transport Controls */}
                    <Flex gap="2" justify="center">
                      <Button
                        color={isLoopPlaybackActive ? "amber" : "green"}
                        onClick={handleToggleLoopPlayback}
                      >
                        {isLoopPlaybackActive ? <StopIcon /> : <PlayIcon />}
                        {isLoopPlaybackActive ? "Stop Loop" : "Play Loop"}
                      </Button>

                      <Button
                        color={isLoopRecording ? "red" : "blue"}
                        onClick={handleLoopRecordToggle}
                        disabled={!loopBuffer}
                      >
                        {isLoopRecording ? <StopIcon /> : <RecordButtonIcon />}
                        {isLoopRecording ? "Stop Recording" : "Record"}
                      </Button>
                    </Flex>

                    {/* Show recording preview when available */}
                    {currentBlobUrl && hasCompletedRecording && (
                      <Card className="p-3 bg-green-50">
                        <Flex direction="column" gap="2">
                          <Text size="2" weight="medium" color="green">
                            ✅ {isFirstRecording ? "Recording Complete!" : "Recording Updated!"}
                          </Text>
                          <Text size="2" color="gray">
                            Audio circle {isFirstRecording ? "created" : "updated"} with new recording
                          </Text>
                          <audio src={currentBlobUrl} controls className="w-full mt-2" />
                        </Flex>
                      </Card>
                    )}
                  </Flex>
                </Card>
              ) : (
                /* Normal Recording Mode UI */
                <>
                  {isRecording && (
                    <Flex align="center" gap="2">
                      <DotFilledIcon className="text-red-500 animate-pulse" />
                      <Text size="2" color="red">
                        Recording: {formatDuration(recordingDuration)}
                      </Text>
                    </Flex>
                  )}

                  <Flex gap="2" justify="center">
                    {isRecording ? (
                      <Button color="red" onClick={handleStopRecording}>
                        <StopIcon /> Stop Recording
                      </Button>
                    ) : (
                      <Button
                        color="red"
                        onClick={handleStartRecording}
                        disabled={!isRecorderReady}
                      >
                        <RecordButtonIcon /> Start Recording
                      </Button>
                    )}
                  </Flex>

                  {recordedBlob && (
                    <Card className="p-3 bg-gray-50">
                      <Flex direction="column" gap="2">
                        <Text size="2" weight="medium">
                          Recording:
                        </Text>
                        <Flex gap="2">
                          <Button
                            variant="soft"
                            color={isPlaying ? "amber" : "green"}
                            onClick={togglePlayback}
                          >
                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                            {isPlaying ? "Pause" : "Play"}
                          </Button>
                          <Button
                            variant="soft"
                            onClick={() => {
                              const anchor = document.createElement("a");
                              anchor.download = "recording.webm";
                              anchor.href = recordedBlob!.url;
                              anchor.click();
                            }}
                          >
                            Download
                          </Button>
                        </Flex>
                        <audio src={recordedBlob!.url} controls className="w-full mt-2" />
                      </Flex>
                    </Card>
                  )}
                </>
              )}

              {/* <Flex justify="center" mt="2">
                <Button
                  variant="soft"
                  color={loopMode ? "blue" : "gray"}
                  onClick={handleToggleLoopMode}
                  disabled={isRecording}
                >
                  <LoopIcon />{" "}
                  {loopMode ? "Switch to Normal Mode" : "Switch to Loop Mode"}
                </Button>
              </Flex> */}

              <Text size="2" color="gray">
                {mediaStream ? (
                  <>
                    Active microphone:{" "}
                    {audioDevices[deviceIndex]?.label || `Microphone ${deviceIndex + 1}`}
                  </>
                ) : (
                  <>No active microphone</>
                )}
              </Text>
            </>
          )}
        </Flex>
      </Card>
    </Box>
  );
};

export default RecorderForAudioCircle;