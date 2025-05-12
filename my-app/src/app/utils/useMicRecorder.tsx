import { useRef, useState, useEffect, useCallback } from "react";
import * as Tone from "tone";
import { useMicInput } from "./useMicInput";

export function useMicRecorder() {
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob, url: string } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Get the mic input hook
  const { mediaStream } = useMicInput();

  // Initialize Tone.js - must be called on user interaction
  const initializeTone = useCallback(async () => {
    try {
      // Start Tone.js context
      await Tone.start();
      setIsInitialized(true);
      console.log("Tone.js initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize Tone.js:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    // Only proceed if we have both a mediaStream and Tone.js is initialized
    if (!mediaStream || !isInitialized) {
      console.log("Not ready: media stream or Tone not initialized");
      setIsReady(false);
      return;
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
    
    // Setup audio flow
    const setupAudio = async () => {
      console.log("Setting up audio");
      try {
        await mic.open(); // This will use the default microphone
        mic.connect(recorder);
        setIsReady(true);
        console.log("Audio setup complete");
      } catch (error) {
        console.error("Error setting up audio:", error);
        setIsReady(false);
      }
    };
    
    setupAudio();
    
    // Cleanup function
    return () => {
      if (micRef.current) {
        micRef.current.close();
        micRef.current = null;
      }
      
      if (recorderRef.current) {
        recorderRef.current.dispose();
        recorderRef.current = null;
      }
      
      setIsReady(false);
    };
  }, [mediaStream, isInitialized]);

  const startRecording = useCallback(async () => {
    // First make sure Tone.js is initialized
    if (!isInitialized) {
      const success = await initializeTone();
      if (!success) return false;
    }
    
    // Now try to use the recorder
    if (!isReady || !recorderRef.current) {
      console.error("Recorder not ready");
      return false;
    }
    
    try {
      recorderRef.current.start();
      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      return false;
    }
  }, [isReady, isInitialized, initializeTone]);

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
    initializeTone  // Export this so the component can call it on user interaction
  };
}