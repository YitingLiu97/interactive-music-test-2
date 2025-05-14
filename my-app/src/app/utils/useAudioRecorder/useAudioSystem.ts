"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { InitState } from "./types";

export function useAudioSystem() {
  // ===== Device/Media States =====
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // ===== Permission States =====
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
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
  
  // Add a ref to track initialization status to avoid timing issues
  const initializationRef = useRef({
    hasInitializedTone: false,
    currentDeviceId: null as string | null,
    initInProgress: false
  });

  // ========== INITIALIZATION HELPERS ==========
  
  // Simple helper to initialize Tone.js - no state updates here
  const initToneEngine = async () => {
    if (initializationRef.current.hasInitializedTone) {
      return true;
    }
    
    try {
      console.log("Initializing Tone.js engine");
      
      if (Tone.context.state !== "running") {
        await Tone.start();
        await Tone.context.resume();
      }
      
      initializationRef.current.hasInitializedTone = true;
      return true;
    } catch (err) {
      console.error("Error initializing Tone.js engine:", err);
      return false;
    }
  };
  
  // Helper for setting up the recorder without relying on React state
  const createRecorder = async (deviceIdToUse: string) => {
    try {
      console.log(`Creating recorder for device ID: ${deviceIdToUse}`);
      
      // Make sure Tone.js is initialized
      await initToneEngine();
      
      // Clean up previous instances
      if (micRef.current) {
        try {
          micRef.current.disconnect();
          micRef.current.close();
        } catch (e) {
          console.warn("Error cleaning up previous mic:", e);
        }
        micRef.current = null;
      }
      
      if (recorderRef.current) {
        try {
          recorderRef.current.dispose();
        } catch (e) {
          console.warn("Error cleaning up previous recorder:", e);
        }
        recorderRef.current = null;
      }
      
      // Create new instances
      const mic = new Tone.UserMedia();
      const recorder = new Tone.Recorder({ mimeType: "audio/webm" });
      
      // Open mic with device
      console.log(`Opening mic with device ID: ${deviceIdToUse}`);
      await mic.open(deviceIdToUse);
      
      // Connect mic to recorder
      mic.connect(recorder);
      
      // Store references
      micRef.current = mic;
      recorderRef.current = recorder;
      
      // Update ref with current device ID
      initializationRef.current.currentDeviceId = deviceIdToUse;
      
      return { success: true, mic, recorder };
    } catch (err) {
      console.error("Error creating recorder:", err);
      return { success: false, error: err };
    }
  };

  // ========== MAIN FUNCTIONS ==========

  // Initialize Tone.js - public function with state updates
  const initializeTone = useCallback(async () => {
    try {
      setInitState("tone");
      console.log("Initializing Tone.js");
      
      const success = await initToneEngine();
      
      if (success) {
        console.log("Tone.js initialized successfully, state:", Tone.context.state);
        setIsToneInitialized(true);
        return true;
      } else {
        throw new Error("Failed to initialize Tone.js");
      }
    } catch (error) {
      console.error("Error in initializeTone:", error);
      setError(`Failed to initialize audio system: ${error || "Unknown error"}`);
      setInitState("failed");
      return false;
    }
  }, []);

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

      // Now enumerate all devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(`Found ${devices.length} total devices`);

      // Filter to only audio input devices
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );

      audioInputs.forEach((device, index) => {
        console.log(
          `Audio device ${index}: ${device.label || "Unnamed device"} (ID: ${
            device.deviceId || "No ID"
          })`
        );
      });

      setAudioDevices(audioInputs);

      // Stop the initial stream
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

  // Set up recorder with selected device
  const setupRecorder = useCallback(async () => {
    // Use either the device ID from state or from our ref
    const deviceIdToUse = deviceId || initializationRef.current.currentDeviceId;
    
    try {
      setInitState("recorder");
      console.log("Setting up recorder");
      
      if (!deviceIdToUse) {
        console.error("No device ID available for setup");
        setError("No microphone selected");
        setInitState("failed");
        setIsRecorderReady(false);
        return false;
      }
      
      // Create recorder using our helper
      const result = await createRecorder(deviceIdToUse);
      
      if (result.success) {
        console.log("Recorder setup complete");
        setInitState("ready");
        setIsRecorderReady(true);
        setError(null);
        return true;
      } else {
        throw new Error(`Failed to create recorder: ${result.error}`);
      }
    } catch (error) {
      console.error("Error setting up recorder:", error);
      setError(`Failed to set up recorder: ${error || "Unknown error"}`);
      setInitState("failed");
      setIsRecorderReady(false);
      return false;
    }
  }, [deviceId]);

  // Select a specific audio device
  const selectAudioDevice = useCallback(
    async (index: number) => {
      try {
        console.log(`Selecting audio device at index ${index}`);

        // Make sure we have devices
        if (!audioDevices || audioDevices.length === 0) {
          console.log("No audio devices available, fetching devices");
          const devices = await getAudioDevices();
          if (!devices || devices.length === 0) {
            throw new Error("No microphones found");
          }
          return;
        }

        // Validate index
        const validIndex = Math.max(0, Math.min(index, audioDevices.length - 1));
        const selectedDevice = audioDevices[validIndex];

        if (!selectedDevice) {
          throw new Error(`No device found at index ${validIndex}`);
        }

        const currentDeviceId = selectedDevice.deviceId;
        console.log(`Selected device: ${selectedDevice.label || `Mic ${validIndex + 1}`}`);

        if (!currentDeviceId) {
          throw new Error("Selected device has no ID");
        }

        // Stop previous stream
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
        }

        // Create new stream with selected device
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: currentDeviceId } },
          });
        } catch (err) {
          console.warn("Failed with exact constraint, trying without 'exact'", err);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: currentDeviceId },
          });
        }

        if (!stream) {
          throw new Error("Failed to get media stream");
        }

        console.log("Successfully created media stream");
        
        // Update state
        setMediaStream(stream);
        setDeviceIndex(validIndex);
        setDeviceId(currentDeviceId);
        
        // Store the device ID in our ref for immediate access
        initializationRef.current.currentDeviceId = currentDeviceId;
        
        // Set up recorder with the new device (directly using the ID)
        const recorderResult = await createRecorder(currentDeviceId);
        
        if (recorderResult.success) {
          setIsRecorderReady(true);
          setInitState("ready");
        } else {
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

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isRecorderReady && !micRef.current) {
      console.error("Recorder not ready or mic missing");
      return false;
    }

    // Clear any previous recording
    if (recordedBlob?.url) {
      URL.revokeObjectURL(recordedBlob.url);
      setRecordedBlob(null);
    }

    try {
      // Create a fresh recorder for this session
      const currentDeviceId = deviceId || initializationRef.current.currentDeviceId;
      
      if (!currentDeviceId) {
        console.error("No device ID available for recording");
        return false;
      }
      
      // Reset recorder for clean recording
      if (recorderRef.current) {
        try {
          recorderRef.current.dispose();
        } catch (e) {
          console.warn("Error disposing previous recorder:", e);
        }
      }

      // Create fresh recorder
      console.log("Creating fresh recorder for recording");
      const freshRecorder = new Tone.Recorder({ mimeType: "audio/webm" });
      
      // Make sure mic is connected and open
      if (!micRef.current || micRef.current.state !== "started") {
        console.log("Mic not started, creating new one");
        const mic = new Tone.UserMedia();
        await mic.open(currentDeviceId);
        micRef.current = mic;
      }
      
      // Connect and start
      micRef.current.connect(freshRecorder);
      recorderRef.current = freshRecorder;
      
      // Make sure Tone.js is running
      if (Tone.context.state !== "running") {
        await Tone.start();
      }
      
      freshRecorder.start();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      setError(`Failed to start recording: ${error || "Unknown error"}`);
      return false;
    }
  }, [isRecorderReady, deviceId, recordedBlob]);

  // Stop recording (unchanged)
  const stopRecording = useCallback(async () => {
    if (!isRecording || !recorderRef.current) {
      console.error("Not recording or no recorder instance");
      return null;
    }

    try {
      // Check if minimum recording duration has elapsed
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      if (recordingDuration < 500) {
        console.log("Recording too short, waiting to ensure data capture");
        await new Promise((resolve) =>
          setTimeout(resolve, 500 - recordingDuration)
        );
      }

      console.log("Stopping recording after " + recordingDuration + "ms");

      // Stop recording and get blob
      const rawBlob = await recorderRef.current.stop();
      console.log(
        "Recording stopped, blob type:",
        rawBlob.type,
        "size:",
        rawBlob.size
      );

      // Verify valid recording
      if (!rawBlob || rawBlob.size === 0) {
        console.error("Empty recording blob! Audio not captured.");
        setError("Recording failed - no audio captured. Try again.");
        setIsRecording(false);
        return null;
      }

      // Create the blob URL
      const newUrl = URL.createObjectURL(rawBlob);

      const result = { blob: rawBlob, url: newUrl };
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

  // Complete initialization sequence with locking
  const initialize = useCallback(async () => {
    // Prevent multiple simultaneous initialization attempts
    if (initializationRef.current.initInProgress) {
      console.log("Initialization already in progress, skipping");
      return false;
    }
    
    initializationRef.current.initInProgress = true;
    
    try {
      setInitAttempts((prev) => prev + 1);
      setError(null);
      setInitState("idle");

      // Get devices and permission
      console.log("Starting initialization sequence");
      setInitState("permission");
      const devices = await getAudioDevices();

      if (!devices || devices.length === 0) {
        throw new Error("No microphones found");
      }

      // Initialize Tone.js directly using our helper
      setInitState("tone");
      const toneSuccess = await initToneEngine();
      if (!toneSuccess) {
        throw new Error("Failed to initialize audio system");
      }
      setIsToneInitialized(true);

      // Select default device
      setInitState("devices");
      console.log("Selecting default device");
      const deviceResult = await selectAudioDevice(0);

      if (!deviceResult) {
        throw new Error("Failed to select microphone");
      }

      setInitState("ready");
      console.log("Initialization complete");
      initializationRef.current.initInProgress = false;
      return true;
    } catch (error) {
      console.error("Initialization failed:", error);
      setError(`Initialization failed: ${error || "Unknown error"}`);
      setInitState("failed");
      initializationRef.current.initInProgress = false;
      return false;
    }
  }, [getAudioDevices, selectAudioDevice]);

  // ========== EFFECTS ==========

  // Initialize Tone.js after component mounts
  useEffect(() => {
    // Initialize Tone.js silently on mount, if needed
    if (!initializationRef.current.hasInitializedTone) {
      initToneEngine()
        .then(success => {
          if (success) {
            setIsToneInitialized(true);
          }
        })
        .catch(err => console.warn("Silent Tone.js init failed:", err));
    }
  }, []);

  // Set up recorder when device ID and Tone.js are ready
  useEffect(() => {
    if ((deviceId || initializationRef.current.currentDeviceId) && 
        (isToneInitialized || initializationRef.current.hasInitializedTone) && 
        !isRecorderReady) {
      console.log("Device and Tone ready, setting up recorder");
      setupRecorder().catch(err => console.error("Recorder setup error:", err));
    }
  }, [deviceId, isToneInitialized, isRecorderReady, setupRecorder]);

  // Cleanup effect (unchanged)
  useEffect(() => {
    return () => {
      console.log("Cleaning up audio system resources");

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

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
    audioSystemStatus: {
      initState,
      deviceCount: audioDevices.length,
      toneState: Tone.context ? Tone.context.state : 'unknown',
      selectedDevice: deviceId || initializationRef.current.currentDeviceId || "none",
      hasInitializedTone: initializationRef.current.hasInitializedTone
    },
  };
}