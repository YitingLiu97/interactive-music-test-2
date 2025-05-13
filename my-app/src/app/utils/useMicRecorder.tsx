import { useRef, useState, useEffect, useCallback } from "react";
import * as Tone from "tone";
import { useMicInput } from "./useMicInput";

export function useMicRecorder() {
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Get mic input properties from the hook
  const micInput = useMicInput();
  const { deviceId } = micInput;

  // Add explicit initialization flag
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to initialize audio with current device
  const setupAudio = useCallback(async () => {
    // Don't require deviceId to be available immediately
    // Just log warning if not available
    if (!deviceId) {
      console.log(
        "Warning: deviceId not available yet, will initialize when available"
      );
      return false;
    }

    try {
      console.log(`Setting up audio with device ID: ${deviceId}`);

      // Ensure Tone.js is started
      if (Tone.context.state !== "running") {
        try {
          console.log("Starting Tone.js...");
          await Tone.start();
          console.log("Tone.js started successfully");
        } catch (toneErr) {
          console.error("Failed to start Tone.js:", toneErr);
          return false;
        }
      }

      // Clean up previous instances
      if (micRef.current) {
        micRef.current.close();
        micRef.current = null;
      }

      if (recorderRef.current) {
        recorderRef.current.dispose();
        recorderRef.current = null;
      }

      // Create new instances
      const mic = new Tone.UserMedia();
      const recorder = new Tone.Recorder();

      // Store references
      micRef.current = mic;
      recorderRef.current = recorder;

      // Connect them
      mic.connect(recorder);

      // Try to open with the specific device ID
      console.log(`Opening mic with device ID: ${deviceId}`);
      await mic.open(deviceId);

      setIsReady(true);
      setIsInitialized(true); // Mark as initialized
      console.log("Audio setup complete with device:", deviceId);
      return true;
    } catch (error) {
      console.error("Error setting up audio:", error);
      setIsReady(false);
      return false;
    }
  }, [deviceId]);

  // Effect to reconnect when the device changes
  useEffect(() => {
    // Only try to set up if we have a valid deviceId
    if (deviceId) {
      console.log("Device ID available, setting up audio...");
      setupAudio();
    } else {
      console.log("Waiting for device ID to become available...");
    }

    // Cleanup function
    return () => {
      if (micRef.current) {
        micRef.current.close();
      }

      if (recorderRef.current) {
        recorderRef.current.dispose();
      }

      setIsReady(false);
    };
  }, [deviceId, setupAudio]);

  const startRecording = useCallback(async () => {
    // First check if we're ready
    if (!isReady || !recorderRef.current) {
      console.error("Recorder not ready");

      // Try to initialize if we have deviceId but aren't ready
      if (deviceId && !isInitialized) {
        console.log("Trying to initialize before recording...");
        const success = await setupAudio();
        if (!success) {
          console.error("Failed to initialize recorder");
          return false;
        }
      } else {
        return false;
      }
    }

    try {
      // Make sure Tone.js context is running
      if (Tone.context.state !== "running") {
        await Tone.start();
      }

      recorderRef.current?.start();
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      return false;
    }
  }, [isReady, deviceId, isInitialized, setupAudio]);

  const stopRecording = useCallback(async () => {
    if (!isRecording || !recorderRef.current) {
      return null;
    }

    try {
      const recording = await recorderRef.current.stop();
      const url = URL.createObjectURL(recording);

      const result = { blob: recording, url };
      setRecordedBlob(result);
      setIsRecording(false);

      return result;
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  // Add a function to check device status
  const checkDeviceStatus = useCallback(() => {
    return {
      hasDeviceId: !!deviceId,
      isReady: isReady,
      toneStatus: Tone.context.state,
    };
  }, [deviceId, isReady]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isReady,
    recordedBlob,
    setupAudio,
    checkDeviceStatus, // Add this to help debug
    micInput, // Return the entire mic input for debugging
  };
}
