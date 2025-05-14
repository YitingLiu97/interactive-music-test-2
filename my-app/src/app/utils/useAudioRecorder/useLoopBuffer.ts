// Enhanced useLoopBuffer.ts with download capabilities (continued)
"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import * as Tone from "tone";

// Props passed from parent hook
interface UseLoopBufferProps {
  deviceId: string | null;
  isToneInitialized: boolean;
  isRecorderReady: boolean;
}

export function useLoopBuffer({
  deviceId,
  isToneInitialized,
  isRecorderReady,
}: UseLoopBufferProps) {
  // ===== Loop Buffer State =====
  const [loopBuffer, setLoopBuffer] = useState<AudioBuffer | null>(null);
  const [loopDuration, setLoopDuration] = useState<number>(4); // Default 4 seconds
  const [loopPosition, setLoopPosition] = useState<number>(0);
  const [isLoopPlaybackActive, setIsLoopPlaybackActive] =
    useState<boolean>(false);
  const [loopChannelData, setLoopChannelData] = useState<Float32Array[]>([]);
  
  // ===== Download State =====
  const [loopBlobUrl, setLoopBlobUrl] = useState<string | null>(null);
  const [isExportingLoop, setIsExportingLoop] = useState<boolean>(false);
  const [loopBlob, setLoopBlob] = useState<Blob | null>(null);

  // ===== Loop Recording State =====
  const [isLoopRecording, setIsLoopRecording] = useState<boolean>(false);
  const [loopRecordStartPosition, setLoopRecordStartPosition] =
    useState<number>(0);
  const [loopRecordEndPosition, setLoopRecordEndPosition] = useState<number>(0);
  const [loopRecordingError, setLoopRecordingError] = useState<string | null>(
    null
  );

  // ===== Refs =====
  const loopPlayerRef = useRef<Tone.Player | null>(null);
  const segmentRecorderRef = useRef<Tone.Recorder | null>(null);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const loopStartTimeRef = useRef<number>(0);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const positionAnimationRef = useRef<number | null>(null);
  
  // Clean up previous blob URL when creating a new one
  useEffect(() => {
    return () => {
      if (loopBlobUrl) {
        URL.revokeObjectURL(loopBlobUrl);
      }
    };
  }, [loopBlobUrl]);

  // ========== INITIALIZE LOOP BUFFER ==========

  // Create an empty loop buffer of the specified duration
  const initializeLoopBuffer = useCallback(
    async (duration: number = 4) => {
      try {
        if (!isToneInitialized) {
          console.error("Tone.js not initialized");
          return false;
        }

        console.log(`Initializing empty loop buffer (${duration}s)`);

        // Create empty buffer with silence
        const sampleRate = Tone.context.sampleRate;
        const channels = 2; // Stereo
        const frameCount = Math.ceil(sampleRate * duration);

        const newBuffer = Tone.context.createBuffer(
          channels,
          frameCount,
          sampleRate
        );

        // Store channel data for visualization
        const channelData: Float32Array[] = [];
        for (let channel = 0; channel < channels; channel++) {
          channelData.push(newBuffer.getChannelData(channel));
        }
        setLoopChannelData(channelData);

        // Set as current loop buffer
        setLoopBuffer(newBuffer);
        setLoopDuration(duration);

        // Cleanup and recreate player
        if (loopPlayerRef.current) {
          try {
            loopPlayerRef.current.stop();
            loopPlayerRef.current.dispose();
          } catch (e) {
            console.warn("Error disposing player:", e);
          }
        }

        // Create new player
        const player = new Tone.Player(newBuffer).toDestination();
        player.loop = true;
        loopPlayerRef.current = player;

        // Clear any existing blob URL
        if (loopBlobUrl) {
          URL.revokeObjectURL(loopBlobUrl);
          setLoopBlobUrl(null);
        }
        
        // Clear any existing blob
        setLoopBlob(null);

        console.log("Empty loop buffer created successfully");
        return true;
      } catch (error) {
        console.error("Error initializing empty loop:", error);
        setLoopRecordingError(
          `Failed to create empty loop: ${error || "Unknown error"}`
        );
        return false;
      }
    },
    [isToneInitialized, loopBlobUrl]
  );

  // ========== EXPORT LOOP BUFFER TO BLOB ==========
const exportLoopToBlob = useCallback(async (): Promise<{blob: Blob, url: string} | null> => {
  try {
    if (!loopBuffer) {
      console.error("No loop buffer available to export");
      return null;
    }
    
    setIsExportingLoop(true);
    console.log("Exporting loop buffer to blob...");
    
    // If there's a previous URL, revoke it
    if (loopBlobUrl) {
      URL.revokeObjectURL(loopBlobUrl);
    }
    
    // Convert the buffer to a WAV blob using the direct WAV conversion
    const blob = audioBufferToWav(loopBuffer);
    console.log(`Loop exported as ${blob.size} byte WAV blob`);
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Store the blob and URL
    setLoopBlob(blob);
    setLoopBlobUrl(url);
    setIsExportingLoop(false);
    
    return { blob, url };
  } catch (error) {
    console.error("Error exporting loop buffer:", error);
    setLoopRecordingError(`Failed to export loop: ${error || "Unknown error"}`);
    setIsExportingLoop(false);
    return null;
  }
}, [loopBuffer, loopBlobUrl]);

// Function to convert AudioBuffer to WAV Blob directly
const audioBufferToWav = (audioBuffer: AudioBuffer): Blob => {
  // WAV file header and data setup
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM format
  const bitDepth = 16; // 16-bit audio
  
  // Calculate sizes
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = audioBuffer.length * blockAlign;
  const headerSize = 44; // Standard WAV header size
  const totalSize = headerSize + dataSize;
  
  // Create buffer for the WAV file
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  // "RIFF" chunk descriptor
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true); // file size - 8
  writeString(view, 8, "WAVE");
  
  // "fmt " sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // subchunk1 size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample
  
  // "data" sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true); // subchunk2 size
  
  // Write audio data
  const dataStart = 44;
  let offset = dataStart;
  const channelData: Float32Array[] = [];
  
  // Extract channel data
  for (let channel = 0; channel < numChannels; channel++) {
    channelData.push(audioBuffer.getChannelData(channel));
  }
  
  // Interleave channel data and convert to 16-bit PCM
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      // Convert float to 16-bit int
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      const int16Sample = sample < 0 
        ? sample * 0x8000 
        : sample * 0x7FFF;
      
      view.setInt16(offset, int16Sample, true);
      offset += bytesPerSample;
    }
  }
  
  // Create a Blob from the buffer
  return new Blob([buffer], { type: "audio/wav" });
  
  // Helper function to write strings to DataView
  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
};
  // ========== SEGMENT RECORDING ==========

  // Create a recorder for segment recording
  const getSegmentRecorder = useCallback(() => {
    if (!isRecorderReady) {
      console.error("Recorder not ready");
      return null;
    }

    // Clean up previous recorder if it exists
    if (segmentRecorderRef.current) {
      try {
        segmentRecorderRef.current.dispose();
      } catch (e) {
        console.warn("Error disposing segment recorder:", e);
      }
      segmentRecorderRef.current = null;
    }

    // Clean up previous mic if it exists
    if (micRef.current) {
      try {
        micRef.current.disconnect();
        micRef.current.close();
      } catch (e) {
        console.warn("Error closing mic:", e);
      }
      micRef.current = null;
    }

    try {
      // Create a new recorder with explicit format
      console.log("Creating new segment recorder");
      const recorder = new Tone.Recorder({
        mimeType: "audio/webm", // Most widely supported format
      });
      segmentRecorderRef.current = recorder;

      // Create and connect user media if needed
      if (deviceId) {
        console.log(`Creating UserMedia for device ${deviceId}`);
        const mic = new Tone.UserMedia();
        micRef.current = mic;

        mic
          .open(deviceId)
          .then(() => {
            console.log("Mic opened, connecting to recorder");
            mic.connect(recorder);
          })
          .catch((err) => {
            console.error("Error connecting mic to segment recorder:", err);
            setLoopRecordingError(
              `Microphone connection error: ${err.message}`
            );
          });
      } else {
        console.error("No device ID available for segment recorder");
      }

      return recorder;
    } catch (error) {
      console.error("Error creating segment recorder:", error);
      setLoopRecordingError(`Failed to create recorder: ${error}`);
      return null;
    }
  }, [isRecorderReady, deviceId]);

  // Start recording a segment at a specific position
  const startLoopRecordingAt = useCallback(
    async (startPosition: number = 0, duration: number = 1) => {
      try {
        if (!loopBuffer) {
          console.error("No loop buffer available");
          return false;
        }

        // Get or create segment recorder
        const recorder = getSegmentRecorder();
        if (!recorder) {
          throw new Error("Could not create recorder for segment");
        }

        // Calculate end position, clamping to loop length
        const endPosition = Math.min(startPosition + duration, loopDuration);
        const actualDuration = endPosition - startPosition;

        // Validate positions
        if (startPosition < 0 || startPosition >= loopDuration) {
          throw new Error(`Invalid start position: ${startPosition}`);
        }

        if (actualDuration <= 0) {
          throw new Error(`Invalid recording duration: ${actualDuration}`);
        }

        console.log(
          `Starting loop recording at position ${startPosition}s for ${actualDuration}s`
        );

        // Save the start and end positions for later use when merging
        setLoopRecordStartPosition(startPosition);
        setLoopRecordEndPosition(endPosition);

        // Ensure Tone.js is running
        if (Tone.context.state !== "running") {
          console.log("Tone context not running, starting it");
          await Tone.start();
        }

        // If loop playback is active, stop it
        if (isLoopPlaybackActive && loopPlayerRef.current) {
          loopPlayerRef.current.stop();
          setIsLoopPlaybackActive(false);

          // Clear interval updating position
          if (positionIntervalRef.current) {
            clearInterval(positionIntervalRef.current);
            positionIntervalRef.current = null;
          }

          // Small delay to ensure playback is fully stopped
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Start recording
        console.log("Starting segment recorder");
        recorder.start();
        setIsLoopRecording(true);
        loopStartTimeRef.current = Date.now();

        // Set a timeout to stop recording after duration
        setTimeout(() => {
          if (isLoopRecording) {
            console.log("Auto-stopping loop recording after timeout");
            stopLoopRecordingAndMerge();
          }
        }, actualDuration * 1000);

        return true;
      } catch (error) {
        console.error("Error starting loop recording at position:", error);
        setLoopRecordingError(
          `Failed to start recording: ${error || "Unknown error"}`
        );
        return false;
      }
    },
    [
      isRecorderReady,
      loopBuffer,
      loopDuration,
      isLoopPlaybackActive,
      getSegmentRecorder,
    ]
  );

  // Stop recording and merge with existing loop
  const stopLoopRecordingAndMerge = useCallback(async () => {
    if (!isLoopRecording) {
      console.error("Not recording");
      return false;
    }

    try {
      // Get the recorder
      const recorder = segmentRecorderRef.current;
      if (!recorder) {
        throw new Error("No recorder instance");
      }

      // Calculate actual duration
      const actualDuration = (Date.now() - loopStartTimeRef.current) / 1000;
      console.log(
        `Stopping loop recording (actual duration: ${actualDuration.toFixed(
          2
        )}s)`
      );

      // Stop recording and get blob
      const recording = await recorder.stop();
      console.log(
        "Recording stopped, blob type:",
        recording.type,
        "size:",
        recording.size
      );

      // Validate recording
      if (!recording || recording.size === 0) {
        console.error("Empty recording blob");
        setLoopRecordingError("Recording failed - no audio captured");
        setIsLoopRecording(false);
        return false;
      }

      // Process and merge recording into loop
      const success = await mergeRecordingIntoLoop(recording);

      setIsLoopRecording(false);

      // If successful, clear any existing loop blob URL since the loop has been modified
      if (success && loopBlobUrl) {
        URL.revokeObjectURL(loopBlobUrl);
        setLoopBlobUrl(null);
        setLoopBlob(null);
      }

      return success;
    } catch (error) {
      console.error("Error stopping loop recording:", error);
      setLoopRecordingError(
        `Failed to stop loop recording: ${error || "Unknown error"}`
      );
      setIsLoopRecording(false);
      return false;
    }
  }, [isLoopRecording, loopBlobUrl]);
  
  // Enhanced position tracking for smooth visualization
  const trackPosition = useCallback(() => {
    if (!isLoopPlaybackActive || !loopBuffer) return;

    // Use precise timing with Tone.js transport
    const elapsed = Tone.Transport.seconds % loopDuration;
    setLoopPosition(elapsed);

    // Request animation frame for smooth updates
    positionAnimationRef.current = requestAnimationFrame(trackPosition);
  }, [isLoopPlaybackActive, loopBuffer, loopDuration]);

  // Record at current position while loop is playing
  const startRecordingAtCurrentPosition = useCallback(async () => {
    if (!loopBuffer || !isLoopPlaybackActive) return false;

    // Get current position in the loop
    const currentPos = loopPosition;

    // Start recording at current position
    return startLoopRecordingAt(currentPos);
  }, [loopBuffer, isLoopPlaybackActive, loopPosition, startLoopRecordingAt]);

  // Merge new recording into the existing loop buffer
  const mergeRecordingIntoLoop = useCallback(
    async (blob: Blob) => {
      try {
        console.log(
          `Merging recording into loop at position ${loopRecordStartPosition}s`
        );

        // We need an existing loop buffer
        if (!loopBuffer) {
          throw new Error("No loop buffer to merge into");
        }

        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();

        // Decode the audio data
        const newRecordingBuffer = await Tone.context.decodeAudioData(
          arrayBuffer
        );
        console.log(
          `Decoded recording: ${newRecordingBuffer.duration.toFixed(2)}s, ${
            newRecordingBuffer.numberOfChannels
          } channels`
        );

        // Create a new buffer for the merged result
        const mergedBuffer = Tone.context.createBuffer(
          loopBuffer.numberOfChannels,
          loopBuffer.length,
          loopBuffer.sampleRate
        );

        // Calculate sample positions
        const startSample = Math.floor(
          loopRecordStartPosition * loopBuffer.sampleRate
        );
        const endSample = Math.min(
          Math.floor(loopRecordEndPosition * loopBuffer.sampleRate),
          loopBuffer.length
        );

        console.log(
          `Merging from sample ${startSample} to ${endSample} (out of ${loopBuffer.length} total samples)`
        );

        // For each channel, copy data appropriately
        for (
          let channel = 0;
          channel < loopBuffer.numberOfChannels;
          channel++
        ) {
          const originalData = loopBuffer.getChannelData(channel);

          // Handle case where recording might have fewer channels
          const newData =
            channel < newRecordingBuffer.numberOfChannels
              ? newRecordingBuffer.getChannelData(channel)
              : new Float32Array(newRecordingBuffer.length).fill(0);

          const mergedData = mergedBuffer.getChannelData(channel);

          // Copy original data as the base layer
          for (let i = 0; i < loopBuffer.length; i++) {
            mergedData[i] = originalData[i];
          }

          // Calculate how many samples to copy from the new recording
          const recordingSampleCount = Math.min(
            newRecordingBuffer.length,
            endSample - startSample
          );

          console.log(
            `Overlaying ${recordingSampleCount} samples from recording at position ${startSample} for channel ${channel}`
          );

          // Replace specific segment with recording data
          // Smart mixing - fade in/out at boundaries for smoother transitions
          for (let i = 0; i < recordingSampleCount; i++) {
            if (startSample + i < mergedData.length) {
              // Crossfade at boundaries (first and last 100ms)
              const fadeLength = Math.min(4410, recordingSampleCount / 10); // ~100ms at 44.1kHz

              if (i < fadeLength) {
                // Fade in - gradually increase new recording, decrease original
                const fadeRatio = i / fadeLength;
                mergedData[startSample + i] =
                  newData[i] * fadeRatio +
                  originalData[startSample + i] * (1 - fadeRatio);
              } else if (i > recordingSampleCount - fadeLength) {
                // Fade out - gradually decrease new recording, increase original
                const fadeRatio = (recordingSampleCount - i) / fadeLength;
                mergedData[startSample + i] =
                  newData[i] * fadeRatio +
                  originalData[startSample + i] * (1 - fadeRatio);
              } else {
                // Middle - replace completely
                mergedData[startSample + i] = newData[i];
              }
            }
          }
        }

        // Update loop buffer
        setLoopBuffer(mergedBuffer);

        // Extract channel data for visualization
        const channelData: Float32Array[] = [];
        for (
          let channel = 0;
          channel < mergedBuffer.numberOfChannels;
          channel++
        ) {
          channelData.push(mergedBuffer.getChannelData(channel));
        }
        setLoopChannelData(channelData);

        // Update player with new buffer
        if (loopPlayerRef.current) {
          // Need to stop player first if active
          const wasPlaying = isLoopPlaybackActive;
          if (wasPlaying) {
            loopPlayerRef.current.stop();
          }

          // Set new buffer
          loopPlayerRef.current.buffer.set(mergedBuffer);

          // Restart if it was playing
          if (wasPlaying) {
            setTimeout(() => {
              if (loopPlayerRef.current) {
                loopPlayerRef.current.start();
              }
            }, 100);
          }
        }

        console.log("Successfully merged recording into loop");
        return true;
      } catch (error) {
        console.error("Error merging recording into loop:", error);
        setLoopRecordingError(
          `Failed to merge recording: ${error || "Unknown error"}`
        );
        return false;
      }
    },
    [
      loopBuffer,
      loopRecordStartPosition,
      loopRecordEndPosition,
      isLoopPlaybackActive,
    ]
  );

  // ========== PLAYBACK WITH POSITION TRACKING ==========
  // Play the loop with position tracking
const playLoopWithTracking = async (startPosition = 0) => {
  if (!loopBuffer || !loopPlayerRef.current) {
    console.log("Cannot play: No loop buffer or player");
    return false;
  }

  try {
    // Ensure Tone.js context is running
    if (Tone.context.state !== "running") {
      await Tone.start();
    }
    
    console.log(`Playing from position: ${startPosition}s`);
    
    // Make sure player is stopped
    if (loopPlayerRef.current.state === "started") {
      loopPlayerRef.current.stop();
    }
    
    // Start with the specified offset
    loopPlayerRef.current.start(0, startPosition);
    
    // Update state
    setIsLoopPlaybackActive(true);
    setLoopPosition(startPosition);
    
    return true;
  } catch (error) {
    console.error("Error playing with position:", error);
    return false;
  }
};
  // Stop loop playback and tracking
  const stopLoopPlayback = useCallback(() => {
    try {
      if (!loopPlayerRef.current) {
        console.error("No loop player available");
        return false;
      }

      console.log("Stopping loop playback and tracking");
      loopPlayerRef.current.stop();
      setIsLoopPlaybackActive(false);

      // Clear animation frame for position tracking
      if (positionAnimationRef.current) {
        cancelAnimationFrame(positionAnimationRef.current);
        positionAnimationRef.current = null;
      }

      return true;
    } catch (error) {
      console.error("Error stopping loop playback:", error);
      setLoopRecordingError(`Failed to stop loop: ${error || "Unknown error"}`);
      return false;
    }
  }, []);

  // ========== VISUALIZATION DATA ==========

  // Generate waveform data for visualization
  const getWaveformData = useCallback(
    (resolution: number = 100) => {
      if (!loopChannelData || loopChannelData.length === 0) {
        return new Array(resolution).fill(0);
      }

      // Use first channel for visualization
      const data = loopChannelData[0];
      const samplesPerPoint = Math.floor(data.length / resolution);
      const points = [];

      // For each point, calculate the max amplitude of the samples it represents
      for (let i = 0; i < resolution; i++) {
        const startSample = i * samplesPerPoint;
        const endSample = Math.min(startSample + samplesPerPoint, data.length);

        let maxAmplitude = 0;
        for (let j = startSample; j < endSample; j++) {
          const amplitude = Math.abs(data[j]);
          if (amplitude > maxAmplitude) {
            maxAmplitude = amplitude;
          }
        }

        points.push(maxAmplitude);
      }

      return points;
    },
    [loopChannelData]
  );

  // Calculate current visual position for timeline (0-1 range)
  const getLoopPositionRatio = useCallback(() => {
    return loopPosition / loopDuration;
  }, [loopPosition, loopDuration]);

  // ========== CLEANUP ==========

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      console.log("Cleaning up loop resources");

      // Clean up animation frame
      if (positionAnimationRef.current) {
        cancelAnimationFrame(positionAnimationRef.current);
      }

      // Clean up interval
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }

      // Clean up blob URL
      if (loopBlobUrl) {
        URL.revokeObjectURL(loopBlobUrl);
      }

      // Stop and dispose player
      if (loopPlayerRef.current) {
        try {
          loopPlayerRef.current.stop();
          loopPlayerRef.current.dispose();
        } catch (e) {
          console.warn("Error disposing player:", e);
        }
      }

      // Dispose recorder
      if (segmentRecorderRef.current) {
        try {
          segmentRecorderRef.current.dispose();
        } catch (e) {
          console.warn("Error disposing recorder:", e);
        }
      }

      // Close mic
      if (micRef.current) {
        try {
          micRef.current.disconnect();
          micRef.current.close();
        } catch (e) {
          console.warn("Error closing mic:", e);
        }
      }
    };
  }, [loopBlobUrl]);

  // ========== RETURN VALUES ==========

  return {
    // State
    loopBuffer,
    loopDuration,
    loopPosition,
    isLoopPlaybackActive,
    isLoopRecording,
    loopRecordingError,
    
    // Download state
    loopBlob,
    loopBlobUrl,
    isExportingLoop,
    exportLoopToBlob,

    // Functions
    initializeLoopBuffer,
    startLoopRecordingAt,
    stopLoopRecordingAndMerge,
    playLoopWithTracking,
    stopLoopPlayback,
    startRecordingAtCurrentPosition,
    // Visualization
    getWaveformData,
    getLoopPositionRatio,
  };
}