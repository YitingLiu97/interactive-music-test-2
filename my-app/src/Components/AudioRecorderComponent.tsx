"use client";
import React, { useState, useEffect, useRef } from "react";
import { Button, Flex, Text, Card, Badge } from "@radix-ui/themes";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  DotFilledIcon,
  ReloadIcon,
  LoopIcon,
} from "@radix-ui/react-icons";
import LoopVisualizer from "./LoopVisualizer"; // Import the LoopVisualizer component
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

const AudioRecorderComponent = () => {
  // Use our unified audio recorder hook
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
    setupRecorder,

    // Loop-related state
    loopPosition,
    loopBuffer,
    loopDuration,
    isLoopPlaybackActive,
    isLoopRecording,
    loopRecordingError,

    // Loop-related functions
    initializeLoopBuffer,
    startLoopRecordingAt,
    stopLoopRecordingAndMerge,
    playLoopWithTracking,
    stopLoopPlayback,
    loopBlob,
    loopBlobUrl,
    exportLoopToBlob,

    startRecordingAtCurrentPosition,

    // Visualization data
    getWaveformData,
    getLoopPositionRatio,
  } = useAudioRecorder();

  // Local component state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "Please initialize audio system"
  );
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [visualizationActive, setVisualizationActive] = useState(false);
  const [isLoopPlaying, setIsLoopPlaying] = useState(false);
  const [loopDurationInput, setLoopDurationInput] = useState("5");
  const [loopMode, setLoopMode] = useState(false);
  const [showLoopUI, setShowLoopUI] = useState(true);
  const [recordingSegments, setRecordingSegments] = useState<
    { start: number; end: number | null }[]
  >([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isDownloadingLoop, setIsDownloadingLoop] = useState<boolean>();
  // Check for browser support of key features
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
          setStatusMessage(
            "Warning: Your browser doesn't support AudioContext"
          );
        }

        if (!checks.mediaDevices || !checks.getUserMedia) {
          setStatusMessage(
            "Warning: Your browser doesn't support media devices"
          );
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
        setStatusMessage(null);
      } else {
        setStatusMessage("Initialization failed. Please try again.");
      }
    } catch (err) {
      console.error("Initialization error:", err);
      setStatusMessage(`Failed to initialize: ${err || "Unknown error"}`);
    }
  };

  // Handle device selection
  const handleDeviceChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndex = parseInt(e.target.value, 10);

    try {
      setStatusMessage(`Changing to microphone ${newIndex + 1}...`);
      await selectAudioDevice(newIndex);
      setStatusMessage(null);
    } catch (err) {
      console.error("Device change error:", err);
      setStatusMessage(
        `Failed to change microphone: ${err || "Unknown error"}`
      );
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

  // Reinitialize recorder
  const handleStartRecorder = async () => {
    try {
      if (!isRecorderReady) {
        setStatusMessage("Recorder not ready. Please initialize first.");
        return;
      }

      setStatusMessage("Setting up recorder...");
      const success = await setupRecorder();
      if (success) {
        setStatusMessage(null);
      } else {
        setStatusMessage("Failed to setup recorder. Please try again.");
      }
    } catch (err) {
      console.error("Setting up recorder error:", err);
      setStatusMessage(`Setting up recorder error: ${err || "Unknown error"}`);
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

  // Handle loop duration input
  const handleLoopDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow positive numbers
    const value = e.target.value.replace(/[^0-9]/g, "");
    setLoopDurationInput(value);

    // Update the actual duration in the hook
    const duration = parseInt(value, 10);
    if (!isNaN(duration) && duration >= 1 && duration <= 60) {
      initializeLoopBuffer(duration);
    }
  };

  // Toggle loop mode
  const handleToggleLoopMode = () => {
    setLoopMode((prev) => !prev);
  };

  // Start loop recording
  const handleStartLoopRecording = async () => {
    try {
      if (!isRecorderReady) {
        setStatusMessage("Recorder not ready. Please initialize first.");
        return;
      }

      setStatusMessage(`Starting ${loopDuration} second loop recording...`);

      // Add a new recording segment that starts now
      const newSegment = {
        start: loopPosition,
        end: null, // Will be set when recording stops
      };
      setRecordingSegments((prev) => [...prev, newSegment]);

      const success = await startLoopRecordingAt(loopPosition, loopDuration); // Pass the full loop duration

      if (success) {
        setStatusMessage(
          `Recording ${loopDuration} second loop at position ${loopPosition.toFixed(
            2
          )}s...`
        );
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
        setStatusMessage("Stopping loop recording...");
        const result = await stopLoopRecordingAndMerge();

        // Update the last recording segment with its end position
        setRecordingSegments((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1].end = loopPosition;
          return updated;
        });

        if (result) {
          setStatusMessage("Loop recording complete. Ready to play.");
        } else {
          setStatusMessage("Failed to create loop.");
        }
      } else {
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
    }
  };
  const handleDownloadLoop = async () => {
    try {
      setIsDownloadingLoop(true);
      setStatusMessage("Preparing loop for download...");

      // Check if we already have a blob URL
      if (loopBlobUrl) {
        triggerDownload(loopBlobUrl, "loop-recording.wav");
        setStatusMessage("Loop download started!");
        setIsDownloadingLoop(false);
        return;
      }

      // Otherwise, export the loop buffer to a blob
      const result = await exportLoopToBlob();

      if (result && result.url) {
        triggerDownload(result.url, "loop-recording.wav");
        setStatusMessage("Loop download started!");
      } else {
        setStatusMessage(
          "Failed to export loop for download. Please try again."
        );
      }

      setIsDownloadingLoop(false);
    } catch (err) {
      console.error("Error downloading loop:", err);
      setStatusMessage(`Error preparing download: ${err || "Unknown error"}`);
      setIsDownloadingLoop(false);
    }
  };

  // Helper function to trigger a download from a blob URL
  const triggerDownload = (url: string, filename: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
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
        setIsLoopPlaying(false);
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
  }, [isRecording]);

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
  }, [recordedBlob]);

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
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
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

  return (
    <Card className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-lg">
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

        {/* Debug info - remove in production */}
        <Card className="p-3 bg-gray-100 text-xs">
          <Text size="1">
            <strong>Status:</strong> {initState} |<strong> Tone:</strong>{" "}
            {isToneInitialized ? "Initialized" : "Not Initialized"} |
            <strong> Ready:</strong> {isRecorderReady ? "Yes" : "No"} |
            <strong> Devices:</strong> {audioDevices.length} |
            <strong> LoopMode:</strong> {loopMode ? "On" : "Off"}
          </Text>
        </Card>

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
                      isRecording || isLoopRecording
                        ? "bg-red-500"
                        : "bg-green-600"
                    }`}
                    style={{ width: `${audioLevel}%` }}
                  ></div>
                </div>
              </Flex>
            )}

            {loopMode ? (
              /* Loop Recording Mode UI */
              <Card className="p-4 bg-blue-50 rounded-lg">
                <Flex direction="column" gap="3">
                  <Text size="3" weight="medium">
                    Loop Recording Mode
                  </Text>

                  {/* Loop Duration Input */}
                  <Flex gap="2" align="center">
                    <Text size="2">Duration:</Text>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={loopDurationInput}
                      onChange={handleLoopDurationChange}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-md"
                      disabled={isLoopRecording || isLoopPlaybackActive}
                    />
                    <Text size="2">seconds</Text>

                    <Button
                      variant="soft"
                      size="1"
                      onClick={() =>
                        initializeLoopBuffer(parseInt(loopDurationInput))
                      }
                      disabled={isLoopRecording || isLoopPlaybackActive}
                    >
                      <ReloadIcon /> New Loop
                    </Button>
                  </Flex>

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
                    {/* If you have the audio preview for the loop, you can add it here */}
                    {loopMode && (
                      <div className="mt-2">
                        {/* loopblob is nul still whys that  */}
                        {loopBuffer && (
                          <>
                           <Text size="2" weight="medium">
                          Loop Preview:
                         </Text> <Button onClick={handleDownloadLoop}>
                              Download Loop
                            </Button>
                            <audio
                              src={loopBlobUrl!}
                              controls
                              className="w-full mt-1"
                            />
                          </>
                        )}
                      </div>
                    )}
                  </Flex>
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
                            anchor.href = recordedBlob.url;
                            anchor.click();
                          }}
                        >
                          Download
                        </Button>
                      </Flex>
                      <audio
                        src={recordedBlob.url}
                        controls
                        className="w-full mt-2"
                      />
                    </Flex>
                  </Card>
                )}
              </>
            )}

            <Flex justify="center" mt="2">
              <Button
                variant="soft"
                color={loopMode ? "blue" : "gray"}
                onClick={handleToggleLoopMode}
                disabled={isRecording}
              >
                <LoopIcon />{" "}
                {loopMode ? "Switch to Normal Mode" : "Switch to Loop Mode"}
              </Button>
            </Flex>

            <Text size="2" color="gray">
              {mediaStream ? (
                <>
                  Active microphone:{" "}
                  {audioDevices[deviceIndex]?.label ||
                    `Microphone ${deviceIndex + 1}`}
                </>
              ) : (
                <>No active microphone</>
              )}
            </Text>
          </>
        )}
      </Flex>
    </Card>
  );
};

export default AudioRecorderComponent;
