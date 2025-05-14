"use client";
import React, { useState, useEffect } from "react";
import { useMicInput } from "@/app/utils/useMicInput";
import { useMicRecorder } from "@/app/utils/useMicRecorder";
import { Button, Flex, Text, Card, Badge } from "@radix-ui/themes";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  DotFilledIcon,
} from "@radix-ui/react-icons";
import * as Tone from "tone";

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

const MicRecorderExample = () => {
  // State for component
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isToneInitialized, setIsToneInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "Initializing..."
  );
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  // Use the hooks - note we're using them directly
  const micInput = useMicInput();
  const {
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error: micError,
    setDeviceIndex,
  } = micInput;

  // Use the recorder hook
  const {
    startRecording,
    stopRecording,
    isRecording,
    isReady,
    recordedBlob,
    setupAudio,
    checkDeviceStatus,
    micInput: recorderMicInput, // This is just for debugging
  } = useMicRecorder();

  // Visualization state
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [analyzerNode, setAnalyzerNode] = useState<AnalyserNode | null>(null);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // CHECK if we're getting different micInput instances (debugging only)
  useEffect(() => {
    if (recorderMicInput !== micInput) {
      console.warn(
        "WARNING: Different instances of micInput detected between component and recorder!"
      );
      console.log("Component micInput:", micInput);
      console.log("Recorder micInput:", recorderMicInput);
    } else {
      console.log("Using same micInput instance - good!");
    }
  }, [micInput, recorderMicInput]);

  // Initialize Tone.js on component mount and on button click
  async function initializeTone() {
    try {
      setStatusMessage("Initializing audio system...");
      setInitializationAttempts((prev) => prev + 1);

      console.log("Starting Tone.js initialization");
      if (Tone.context.state !== "running") {
        console.log("Tone context not running, starting it now");
        await Tone.start();
        console.log("Tone.js successfully started");
      } else {
        console.log("Tone.js already running");
      }

      setIsToneInitialized(true);

      // After Tone is initialized, check device status and try setup
      const status = checkDeviceStatus();
      console.log("Device status after Tone init:", status);

      if (status.hasDeviceId) {
        console.log("Device ID available, setting up audio");
        await setupAudio();
        setStatusMessage(null);
      } else {
        console.log("No device ID available yet, waiting...");
        setStatusMessage("Waiting for microphone device...");

        // Try to force select a device if we have some available
        if (audioDevices.length > 0) {
          console.log("Devices available, selecting first one");
          await setDeviceIndex(0);
        }
      }
    } catch (err) {
      console.error("Failed to initialize Tone.js:", err);
      setStatusMessage(
        `Audio initialization failed: ${err || "Unknown error"}`
      );
      setIsToneInitialized(false);
    }
  }

  // This effect runs once after the component mounts
  useEffect(() => {
    // Initial setup
    const initialize = async () => {
      // First we need permission and device list
      if (audioDevices.length === 0) {
        console.log("No audio devices found yet, waiting for list to populate");
      }

      // Auto-initialize tone on mount
      try {
        await initializeTone();
      } catch (err) {
        console.error("Auto-initialization failed:", err);
      }
    };

    initialize();
  }, []);

  // When device ID or devices change, try to set up again
  useEffect(() => {
    // If we have a device ID and Tone is initialized, try to set up audio
    if (micInput.deviceId && isToneInitialized) {
      console.log("Device ID changed, setting up audio again");
      setupAudio();
    }
  }, [micInput.deviceId, isToneInitialized, setupAudio]);

  // Updated device change handler
  const handleDeviceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndex = parseInt(event.target.value, 10);
    setStatusMessage(`Switching to microphone ${newIndex + 1}...`);

    try {
      // When changing device, ensure Tone.js is started first
      if (!isToneInitialized) {
        await initializeTone();
      }

      // Change the device
      await setDeviceIndex(newIndex);
      console.log(`Changed to device index ${newIndex}`);

      // Check if the device ID is now available
      setTimeout(async () => {
        const status = checkDeviceStatus();
        console.log("Device status after change:", status);

        if (status.hasDeviceId) {
          // We should have a device ID now, so set up the audio again
          await setupAudio();
          setStatusMessage(null);
        } else {
          setStatusMessage("Failed to get device ID after selection.");
        }
      }, 500); // Small delay to let state update
    } catch (error) {
      console.error("Error changing device:", error);
      setStatusMessage(
        `Failed to change microphone: ${error || "Unknown error"}`
      );
    }
  };

  // Create audio visualization when stream changes
  useEffect(() => {
    if (!mediaStream) return;

    // Clean up previous analyzer
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    // TypeScript-friendly AudioContext creation
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

    // Connect media stream to analyzer
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyzer);

    setAnalyzerNode(analyzer);

    // Start analyzing audio levels
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const updateAudioLevel = () => {
      analyzer.getByteFrequencyData(dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      // Normalize to a higher range to make visualization more dramatic
      setAudioLevel(Math.min(100, Math.round((avg / 255) * 150)));

      // Continue animation loop
      const frame = requestAnimationFrame(updateAudioLevel);
      setAnimationFrame(frame);
    };

    updateAudioLevel();

    // Cleanup
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      source.disconnect();
      audioContext.close();
    };
  }, [mediaStream]);

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

  // Handle audio element creation when recording is available
  useEffect(() => {
    if (recordedBlob?.url) {
      const audio = new Audio(recordedBlob.url);
      audio.addEventListener("ended", () => setIsPlaying(false));
      setAudioElement(audio);
    }

    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = "";
        setIsPlaying(false);
      }
    };
  }, [recordedBlob]);

  // Start recording handler with better error handling
  const handleStartRecording = async () => {
    try {
      // Always check Tone initialization first
      if (!isToneInitialized) {
        setStatusMessage("Initializing audio system for recording...");
        await initializeTone();
      }

      // Get the current status
      const status = checkDeviceStatus();
      console.log("Status before recording:", status);

      if (!status.hasDeviceId) {
        setStatusMessage(
          "No microphone device available. Please connect a microphone."
        );
        return;
      }

      if (!status.isReady) {
        setStatusMessage("Setting up microphone for recording...");
        const setupResult = await setupAudio();
        if (!setupResult) {
          setStatusMessage("Failed to set up microphone. Please try again.");
          return;
        }
      }

      // Finally try to start recording
      setStatusMessage("Starting recording...");
      const success = await startRecording();

      if (success) {
        setStatusMessage(null); // Clear message on success
      } else {
        setStatusMessage("Failed to start recording. Please try again.");
      }
    } catch (err) {
      console.error("Unexpected error during recording start:", err);
      setStatusMessage(`Recording error: ${err || "Unknown error"}`);
    }
  };

  // Stop recording handler
  const handleStopRecording = async () => {
    try {
      setStatusMessage("Stopping recording...");
      const result = await stopRecording();

      if (result) {
        setStatusMessage(null); // Clear on success
      } else {
        setStatusMessage("Failed to save recording. Please try again.");
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
      setStatusMessage(`Error saving recording: ${err || "Unknown error"}`);
    }
  };

  // Play/pause the recorded audio
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

  // Get current status for UI
  const getStatusBadge = () => {
    if (!isPermissionGranted) {
      return <Badge color="red">Permission Denied</Badge>;
    }

    if (isRecording) {
      return <Badge color="red">Recording</Badge>;
    }

    if (isReady) {
      return <Badge color="green">Ready</Badge>;
    }

    if (isToneInitialized) {
      return <Badge color="amber">Initializing...</Badge>;
    }

    return <Badge color="amber">Not Initialized</Badge>;
  };

  return (
    <Card className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-lg">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Text size="5" weight="bold">
            Voice Recorder
          </Text>
          {getStatusBadge()}
        </Flex>

        {(micError || statusMessage) && (
          <Card className="p-3 bg-amber-100">
            <Text size="2">{statusMessage || micError}</Text>
          </Card>
        )}

        {!isPermissionGranted ? (
          <Card className="p-3 bg-amber-400">
            <Text size="2">
              Please grant microphone access to use this feature.
            </Text>
          </Card>
        ) : (
          <>
            {!isToneInitialized && (
              <Flex justify="center" my="2">
                <Button onClick={() => initializeTone()} color="green">
                  Initialize Audio System
                </Button>
              </Flex>
            )}

            {/* Debug info - can be removed in production */}
            <Card className="p-3 bg-gray-100 text-xs">
              <Text size="1">
                <strong>Debug Info:</strong> Tone:{" "}
                {Tone.context?.state || "unknown"}, DeviceID:{" "}
                {micInput.deviceId ? "Available" : "Missing"}, Ready:{" "}
                {isReady ? "Yes" : "No"}, Init Attempts:{" "}
                {initializationAttempts}
              </Text>
            </Card>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Select Microphone:
              </Text>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={deviceIndex}
                onChange={handleDeviceChange}
                disabled={isRecording}
              >
                {audioDevices.map((device: MediaDeviceInfo, index: number) => (
                  <option key={device.deviceId} value={index}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </Flex>

            <Flex direction="column" gap="1">
              <Text size="2" weight="medium">
                Analyzer Node Fftsize: {analyzerNode?.fftSize}
                Audio Level:
              </Text>
              <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ease-out ${
                    isRecording ? "bg-red-500" : "bg-green-600"
                  }`}
                  style={{ width: `${audioLevel}%` }}
                ></div>
              </div>
            </Flex>

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
                  disabled={!isToneInitialized || !isPermissionGranted}
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

export default MicRecorderExample;
