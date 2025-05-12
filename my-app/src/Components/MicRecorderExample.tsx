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
  // Use the existing mic input hook
  const {
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error,
    setDeviceIndex,
  } = useMicInput();

  // State for audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // State for tracking if Tone.js is initialized
  const [isToneInitialized, setIsToneInitialized] = useState(false);

  // Use the improved mic recorder hook - no longer passing deviceIndex as it gets the deviceId from useMicInput
  const { startRecording, stopRecording, isRecording, isReady, recordedBlob, setupAudio } =
    useMicRecorder();

  // Visualization state
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [analyzerNode, setAnalyzerNode] = useState<AnalyserNode | null>(null);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Updated device change handler
  const handleDeviceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newIndex = parseInt(event.target.value, 10);

    try {
      // When changing device, ensure Tone.js is started first
      if (!isToneInitialized) {
        await initializeTone();
      }

      // Change the device - this will update the mediaStream in useMicInput
      await setDeviceIndex(newIndex);
      console.log(`Changed to device index ${newIndex}`);
      
      // After device change, explicitly set up audio again
      if (isToneInitialized) {
        await setupAudio();
      }
    } catch (error) {
      console.error("Error changing device:", error);
      alert("Failed to change microphone. Please try again.");
    }
  };

  // Initialize Tone.js on user interaction (button click)
  async function initializeTone() {
    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
        console.log("Tone.js successfully initialized.");
        setIsToneInitialized(true);
        
        // After Tone is initialized, set up the recorder
        await setupAudio();
      } else {
        console.log("Tone.js already running.");
        setIsToneInitialized(true);
      }
    } catch (err) {
      console.error("Failed to initialize Tone.js:", err);
      alert("Audio system initialization failed. Please try again.");
    }
  }

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

  // Start recording handler
  const handleStartRecording = async () => {
    try {
      // Ensure Tone.js is initialized
      if (!isToneInitialized) {
        await initializeTone();
      }
      
      if (!isReady) {
        alert("Recorder not ready yet. Please initialize the audio system first.");
        return;
      }
      
      const success = await startRecording();
      if (!success) {
        alert("Failed to start recording. Please try again or check microphone permissions.");
      }
    } catch (err) {
      console.error("Unexpected error during recording start:", err);
      alert("Recording failed to start due to an internal error.");
    }
  };

  // Stop recording handler
  const handleStopRecording = async () => {
    const result = await stopRecording();
    if (!result) {
      alert("Failed to stop recording. Please try again.");
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
        alert("Failed to play recording");
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

  return (
    <Card className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-lg">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Text size="5" weight="bold">
            Voice Recorder
          </Text>
          {isReady ? (
            <Badge color="green">Ready</Badge>
          ) : isToneInitialized ? (
            <Badge color="amber">Initializing...</Badge>
          ) : (
            <Badge color="amber">Not Initialized</Badge>
          )}
        </Flex>

        {error && (
          <Card className="p-3 bg-red-400">
            <Text size="2">{error}</Text>
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
                  disabled={!isToneInitialized}
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