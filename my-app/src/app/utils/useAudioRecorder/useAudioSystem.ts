"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { InitState } from "./types";

// Handle device selection
// Manage Tone.js initialization
// Set up the basic Tone.UserMedia and Recorder

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
        micRef.current.close();
        micRef.current = null;
      }

      if (recorderRef.current) {
        console.log("Disposing previous recorder instance");
        recorderRef.current.dispose();
        recorderRef.current = null;
      }

      // Create new instances
      console.log("Creating new Tone.UserMedia and Recorder instances");
      const mic = new Tone.UserMedia();
      const recorder = new Tone.Recorder();

      // Store references
      micRef.current = mic;
      recorderRef.current = recorder;

      // Connect them
      mic.connect(recorder);

      // Open mic with device ID
      console.log(`Opening mic with device ID: ${deviceId}`);
      await mic.open(deviceId);

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
    try {
      if (!isRecorderReady) {
        console.error("Recorder not ready");
        return false;
      }

      if (!recorderRef.current) {
        console.error("No recorder instance");
        return false;
      }

      // Ensure Tone.js is running
      if (Tone.context.state !== "running") {
        console.log("Tone context not running, starting it");
        await Tone.start();
      }

      console.log("Starting recording");
      recorderRef.current.start();
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      setError(`Failed to start recording: ${error || "Unknown error"}`);
      return false;
    }
  }, [isRecorderReady]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      if (!isRecording || !recorderRef.current) {
        console.error("Not recording or no recorder instance");
        return null;
      }

      console.log("Stopping recording");
      const recording = await recorderRef.current.stop();
      console.log("Recording stopped, creating URL");

      const url = URL.createObjectURL(recording);
      const result = { blob: recording, url };

      setRecordedBlob(result);
      setIsRecording(false);

      return result;
    } catch (error) {
      console.error("Error stopping recording:", error);
      setError(`Failed to stop recording: ${error || "Unknown error"}`);
      setIsRecording(false);
      return null;
    }
  }, [isRecording]);

  // ========== INITIALIZATION SEQUENCE ==========

  // Complete initialization sequence
  const initialize = useCallback(async () => {
    try {
      setInitAttempts((prev) => prev + 1);
      setError(null);

      // Step 1: Get devices and permission
      console.log("Starting initialization sequence");
      const devices = await getAudioDevices();

      if (!devices || devices.length === 0) {
        throw new Error("No microphones found");
      }

      // Step 2: Initialize Tone.js
      const toneInitialized = await initializeTone();
      if (!toneInitialized) {
        throw new Error("Failed to initialize audio system");
      }

      // Step 3: Select default device (first one)
      console.log("Selecting default device");
      const deviceResult = await selectAudioDevice(0);

      if (!deviceResult) {
        throw new Error("Failed to select microphone");
      }

      // Step 4: Set up recorder
      console.log("Setting up recorder");
      const recorderReady = await setupRecorder();

      if (!recorderReady) {
        throw new Error("Failed to set up recorder");
      }

      console.log("Initialization complete");
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
      // Stop any active media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      // Clean up Tone.js resources
      if (micRef.current) {
        micRef.current.close();
      }

      if (recorderRef.current) {
        recorderRef.current.dispose();
      }

      // Clean up any blob URLs
      if (recordedBlob?.url) {
        URL.revokeObjectURL(recordedBlob.url);
      }
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
    audioSystemStatus: () => ({
      initState,
      deviceId,
      toneState: Tone.context.state,
      isRecorderReady,
      mediaStreamActive: mediaStream ? mediaStream.active : false,
    }),
  };
}
