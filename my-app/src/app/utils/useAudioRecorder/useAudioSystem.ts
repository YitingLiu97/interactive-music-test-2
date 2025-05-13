// Fixed useAudioSystem.ts with focus on empty blob issues
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { InitState } from "./types";
import { IFFT } from "@tensorflow/tfjs-core";

export function useAudioSystem() {
  // ===== Device/Media States =====
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // ===== Permission States =====
  const [isPermissionGranted, setIsPermissionGranted] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ===== Tone.js States =====
  const [isToneInitialized, setIsToneInitialized] = useState<boolean>(false);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);

  // ===== Recording States =====
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedBlob, setRecordedBlob] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);

  // ===== Initialization Tracking =====
  const [initState, setInitState] = useState<InitState>("idle");
  const [isRecorderReady, setIsRecorderReady] = useState<boolean>(false);
  const [initAttempts, setInitAttempts] = useState<number>(0);
  const recordingStartTimeRef = useRef<number>(0);

  // ========== DEVICE HANDLING ==========

  // Get available audio devices
  const getAudioDevices = useCallback(async () => {
    try {
      setInitState("permission");
      console.log("Requesting microphone permission...");

      // First get permission by accessing any audio device
      const initialStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      setIsPermissionGranted(true);
      setInitState("devices");
      console.log("Permission granted, enumerating devices");

      // Add a small delay to ensure permissions are processed
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Now enumerate all devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(`Found ${devices.length} total devices`);

      // Filter to only audio input devices
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );

      // Log each audio device for debugging
      audioInputs.forEach((device, index) => {
        console.log(
          `Audio device ${index}: ${device.label || "Unnamed device"} (ID: ${
            device.deviceId || "No ID"
          })`
        );
      });

      // Set in state
      setAudioDevices(audioInputs);

      // Stop the initial stream - we'll create a new one for the selected device
      initialStream.getTracks().forEach((track) => track.stop());

      return audioInputs;
    } catch (error) {
      console.error("Error getting audio devices:", error);
      setError(`Failed to get microphone access: ${error || "Unknown error"}`);
      setIsPermissionGranted(false);
      setInitState("failed");
      return [];
    }
  }, []);

  // Select a specific audio device
  const selectAudioDevice = useCallback(
    async (index: number) => {
      try {
        console.log(`Selecting audio device at index ${index}`);

        // Make sure we have devices available
        if (!audioDevices || audioDevices.length === 0) {
          console.log("No audio devices available, fetching devices");
          const devices = await getAudioDevices();
          if (!devices || devices.length === 0) {
            throw new Error(
              "No microphones found. Please connect a microphone and refresh."
            );
          }
        }

        // Ensure index is within bounds
        const validIndex = Math.max(
          0,
          Math.min(index, audioDevices.length - 1)
        );
        const selectedDevice = audioDevices[validIndex];

        if (!selectedDevice) {
          throw new Error(`No device found at index ${validIndex}`);
        }

        const currentDeviceId = selectedDevice.deviceId;
        console.log(
          `Selected device: ${
            selectedDevice.label || `Microphone ${validIndex + 1}`
          } (ID: ${currentDeviceId})`
        );

        if (!currentDeviceId) {
          throw new Error("Selected device has no ID");
        }

        // Stop previous stream if it exists
        if (mediaStream) {
          console.log("Stopping previous media stream");
          mediaStream.getTracks().forEach((track) => track.stop());
        }

        // Create new stream with selected device
        console.log(`Getting media stream for device ID: ${currentDeviceId}`);
        let stream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: currentDeviceId } },
          });
        } catch (err) {
          console.warn(
            "Failed with exact device ID constraint, trying without 'exact'",
            err
          );
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: currentDeviceId },
          });
        }

        if (!stream) {
          throw new Error("Failed to get media stream");
        }

        console.log("Successfully created media stream");
        setMediaStream(stream);
        setDeviceIndex(validIndex);
        setDeviceId(currentDeviceId);

        // Clean up previous recorder before setting up a new one
        if (recorderRef.current) {
          try {
            recorderRef.current.dispose();
            recorderRef.current = null;
          } catch (e) {
            console.warn("Error disposing previous recorder:", e);
          }
        }

        // Clean up previous mic before setting up a new one
        if (micRef.current) {
          try {
            micRef.current.disconnect();
            micRef.current.close();
            micRef.current = null;
          } catch (e) {
            console.warn("Error closing previous mic:", e);
          }
        }

        // We need to re-setup the recorder with the new device
        const recorderSetupSuccess = await setupRecorder();

        if (!recorderSetupSuccess) {
          console.error("Failed to set up recorder after device change");
        }

        return { stream, deviceId: currentDeviceId };
      } catch (error) {
        console.error("Error selecting audio device:", error);
        setError(`Failed to select microphone: ${error || "Unknown error"}`);
        return null;
      }
    },
    [audioDevices, mediaStream, getAudioDevices]
  );

  // ========== TONE.JS MANAGEMENT ==========

  // Initialize Tone.js
  const initializeTone = useCallback(async () => {
    try {
      setInitState("tone");
      console.log("Initializing Tone.js");

      if (Tone.context.state !== "running") {
        console.log("Starting Tone.js context");
        await Tone.start();

        // Explicitly resume the context as well
        await Tone.context.resume();
      }

      console.log("Tone.js initialized, state:", Tone.context.state);
      setIsToneInitialized(true);
      return true;
    } catch (error) {
      console.error("Error initializing Tone.js:", error);
      setError(
        `Failed to initialize audio system: ${error || "Unknown error"}`
      );
      setInitState("failed");
      return false;
    }
  }, []);

  // Set up Tone recorder with selected device
  const setupRecorder = useCallback(async () => {
    try {
      setInitState("recorder");
      console.log("Setting up audio recorder");

      if (!deviceId) {
        console.error("No device ID available");
        throw new Error("No microphone selected");
      }

      if (!isToneInitialized) {
        console.log("Tone.js not initialized, initializing now");
        const success = await initializeTone();
        if (!success) {
          throw new Error("Failed to initialize Tone.js");
        }
      }

      // Clean up previous instances
      if (micRef.current) {
        console.log("Closing previous mic instance");
        try {
          micRef.current.disconnect();
          micRef.current.close();
        } catch (e) {
          console.warn("Error disconnecting previous mic:", e);
        }
        micRef.current = null;
      }

      if (recorderRef.current) {
        console.log("Disposing previous recorder instance");
        try {
          recorderRef.current.dispose();
        } catch (e) {
          console.warn("Error disposing previous recorder:", e);
        }
        recorderRef.current = null;
      }

      // Create new instances with explicit format
      console.log("Creating new Tone.UserMedia and Recorder instances");
      const mic = new Tone.UserMedia();

      // Create recorder with explicit format for better compatibility
      const recorder = new Tone.Recorder({
        mimeType: "audio/webm", // Most widely supported format
      });

      // Store references
      micRef.current = mic;
      recorderRef.current = recorder;

      // Open mic first, then connect
      console.log(`Opening mic with device ID: ${deviceId}`);
      await mic.open(deviceId);

      // Now connect mic to recorder
      console.log("Connecting mic to recorder");
      mic.connect(recorder);

      // Test the connection
      console.log(
        "Testing connection:",
        "Mic connected:",
        mic.state === "started",
        "Recorder ready:",
        recorder !== null
      );

      console.log("Recorder setup complete");
      setInitState("ready");
      setIsRecorderReady(true);
      setError(null);

      return true;
    } catch (error) {
      console.error("Error setting up recorder:", error);
      setError(`Failed to set up recorder: ${error || "Unknown error"}`);
      setInitState("failed");
      setIsRecorderReady(false);
      return false;
    }
  }, [deviceId, isToneInitialized, initializeTone]);

  // ========== RECORDING FUNCTIONS ==========

  // Start recording
const startRecording = useCallback(async () => {
  if (!isRecorderReady || !micRef.current) {
    console.error("Recorder not ready or mic missing");
      return false;
  }

  await  setupRecorder();

  // 1) dispose any previous recorder
  if (recorderRef.current) {
    try { recorderRef.current.dispose(); } catch (e) {}
  }

  // 2) create & hook up a brand-new recorder
  const freshRecorder = new Tone.Recorder({ mimeType: "audio/webm" });
  micRef.current.connect(freshRecorder);
  recorderRef.current = freshRecorder;

  // 3) start
  await Tone.start();
  freshRecorder.start();
  recordingStartTimeRef.current = Date.now();
  setIsRecording(true);

  return true;
}, [isRecorderReady]);

  // Stop recording
const stopRecording = useCallback(async () => {
  if (!isRecording || !recorderRef.current) return null;

  const rawBlob = await recorderRef.current.stop();
  const newUrl = URL.createObjectURL(rawBlob);

  // *now* it’s safe to clear the old URL:
  if (recordedBlob?.url) {
    URL.revokeObjectURL(recordedBlob.url);
  }

  setRecordedBlob({ blob: rawBlob, url: newUrl });
  setIsRecording(false);
  return { blob: rawBlob, url: newUrl };
}, [isRecording, recordedBlob]);


  // ========== INITIALIZATION SEQUENCE ==========

  // Complete initialization sequence
  const initialize = useCallback(async () => {
    try {
      setInitAttempts((prev) => prev + 1);
      setError(null);
      setInitState("idle");

      // Step 1: Get devices and permission
      console.log("Starting initialization sequence");
      setInitState("permission");
      const devices = await getAudioDevices();

      if (!devices || devices.length === 0) {
        throw new Error("No microphones found");
      }

      // Step 2: Initialize Tone.js
      setInitState("tone");
      const toneInitialized = await initializeTone();
      if (!toneInitialized) {
        throw new Error("Failed to initialize audio system");
      }

      // Wait for Tone.js to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Step 3: Select default device (first one)
      setInitState("devices");
      console.log("Selecting default device");
      const deviceResult = await selectAudioDevice(0);

      if (!deviceResult) {
        throw new Error("Failed to select microphone");
      }

      // Wait for device to be ready
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 4: Set up recorder
      setInitState("recorder");
      console.log("Setting up recorder");
      const recorderReady = await setupRecorder();

      if (!recorderReady) {
        throw new Error("Failed to set up recorder");
      }

      setInitState("ready");
      console.log("Initialization complete - recorder ready");
      return true;
    } catch (error) {
      console.error("Initialization failed:", error);
      setError(`Initialization failed: ${error || "Unknown error"}`);
      setInitState("failed");
      return false;
    }
  }, [getAudioDevices, initializeTone, selectAudioDevice, setupRecorder]);

  // ========== EFFECTS ==========

  // Effect to handle device changes
  useEffect(() => {
    if (deviceId && isToneInitialized && !isRecorderReady) {
      console.log("Device ID and Tone.js ready, setting up recorder");
      setupRecorder();
    }
  }, [deviceId, isToneInitialized, isRecorderReady, setupRecorder]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log("Cleaning up audio system resources");

      // Stop any active media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      // Clean up Tone.js resources
      if (micRef.current) {
        try {
          micRef.current.disconnect();
          micRef.current.close();
        } catch (e) {
          console.warn("Error cleaning up mic:", e);
        }
      }

      if (recorderRef.current) {
        try {
          recorderRef.current.dispose();
        } catch (e) {
          console.warn("Error cleaning up recorder:", e);
        }
      }

      // Clean up any blob URLs
      // if (recordedBlob?.url) {
      //   URL.revokeObjectURL(recordedBlob.url);
      // }
    };
  }, [mediaStream, recordedBlob]);

  return {
    // State
    mediaStream,
    audioDevices,
    deviceIndex,
    deviceId,
    isPermissionGranted,
    error,
    isRecorderReady,
    isRecording,
    isToneInitialized,
    recordedBlob,
    initState,
    initAttempts,

    // Functions
    initialize,
    getAudioDevices,
    selectAudioDevice: (index: number) => selectAudioDevice(index),
    initializeTone,
    setupRecorder,
    startRecording,
    stopRecording,

    // Debug
    audioSystemStatus: {
      initState,
      deviceCount: audioDevices.length,
      toneState: Tone.context.state,
      selectedDevice: deviceId || "none",
    },
  };
}
