import { useRef, useState, useEffect, useCallback } from "react";
import * as Tone from "tone";
import { useMicInput } from "./useMicInput";

// Change: Now expecting a deviceId string parameter that's optional
export function useMicRecorder() {
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob, url: string } | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  // Change: Get the full mic input hook with all its properties
  const { mediaStream, deviceId } = useMicInput();

  // Function to initialize audio with current device
  const setupAudio = useCallback(async () => {
    // We need a valid deviceId
    if (!deviceId) {
      console.log("Missing deviceId, cannot setup audio");
      setIsReady(false);
      return;
    }

    try {
      console.log(`Setting up audio with device ID: ${deviceId}`);
      
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
      
      // Open with the specific device ID string directly
      await mic.open(deviceId);
      
      setIsReady(true);
      console.log("Audio setup complete with device:", deviceId);
    } catch (error) {
      console.error("Error setting up audio:", error);
      setIsReady(false);
    }
  }, [deviceId]);

  // Effect to reconnect when the device changes
  useEffect(() => {
    if (Tone.context.state === "running") {
      console.log("Device changed, setting up audio again");
      setupAudio();
    } else {
      console.log("Tone context not running, waiting for user interaction");
      setIsReady(false);
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
    if (!isReady || !recorderRef.current) {
      console.error("Recorder not ready");
      return false;
    }
    
    try {
      // Make sure Tone.js context is running
      if (Tone.context.state !== "running") {
        await Tone.start();
      }
      
      recorderRef.current.start();
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      return false;
    }
  }, [isReady]);

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

  return {
    startRecording,
    stopRecording,
    isRecording,
    isReady,
    recordedBlob,
    setupAudio
  };
}