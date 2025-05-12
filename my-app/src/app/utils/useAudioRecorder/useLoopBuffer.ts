// src/hooks/useAudioRecorder/useLoopBuffer.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

// Props passed from parent hook
interface UseLoopBufferProps {
  deviceId: string | null;
  isToneInitialized: boolean;
  isRecorderReady: boolean;
}

export function useLoopBuffer({ 
  deviceId, 
  isToneInitialized, 
  isRecorderReady 
}: UseLoopBufferProps) {
  // ===== Loop Buffer State =====
  const [loopBuffer, setLoopBuffer] = useState<AudioBuffer | null>(null);
  const [loopDuration, setLoopDuration] = useState<number>(4); // Default 4 seconds
  const [loopPosition, setLoopPosition] = useState<number>(0);
  const [isLoopPlaybackActive, setIsLoopPlaybackActive] = useState<boolean>(false);
  const [loopChannelData, setLoopChannelData] = useState<Float32Array[]>([]);
  
  // ===== Loop Recording State =====
  const [isLoopRecording, setIsLoopRecording] = useState<boolean>(false);
  const [loopRecordStartPosition, setLoopRecordStartPosition] = useState<number>(0);
  const [loopRecordEndPosition, setLoopRecordEndPosition] = useState<number>(0);
  const [loopRecordingError, setLoopRecordingError] = useState<string | null>(null);
  
  // ===== Refs =====
  const loopPlayerRef = useRef<Tone.Player | null>(null);
  const segmentRecorderRef = useRef<Tone.Recorder | null>(null);
  const loopStartTimeRef = useRef<number>(0);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ========== INITIALIZE LOOP BUFFER ==========
  
  // Create an empty loop buffer of the specified duration
  const initializeLoopBuffer = useCallback(async (duration: number = 4) => {
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
      
      // Create or update player
      if (loopPlayerRef.current) {
        loopPlayerRef.current.buffer.set(newBuffer);
      } else {
        const player = new Tone.Player(newBuffer).toDestination();
        player.loop = true;
        loopPlayerRef.current = player;
      }
      
      console.log("Empty loop buffer created successfully");
      return true;
    } catch (error) {
      console.error("Error initializing empty loop:", error);
      setLoopRecordingError(`Failed to create empty loop: ${error || "Unknown error"}`);
      return false;
    }
  }, [isToneInitialized]);
  
  // ========== SEGMENT RECORDING ==========
  
  // Create a recorder for segment recording
  const getSegmentRecorder = useCallback(() => {
    if (!isRecorderReady) {
      console.error("Recorder not ready");
      return null;
    }
    
    if (segmentRecorderRef.current) {
      return segmentRecorderRef.current;
    }
    
    try {
      // Create a new recorder
      const recorder = new Tone.Recorder();
      segmentRecorderRef.current = recorder;
      
      // Create and connect user media if needed
      if (deviceId) {
        const mic = new Tone.UserMedia();
        mic.open(deviceId).then(() => {
          mic.connect(recorder);
        }).catch(err => {
          console.error("Error connecting mic to segment recorder:", err);
          setLoopRecordingError(`Microphone connection error: ${err.message}`);
        });
      }
      
      return recorder;
    } catch (error) {
      console.error("Error creating segment recorder:", error);
      setLoopRecordingError(`Failed to create recorder: ${error}`);
      return null;
    }
  }, [isRecorderReady, deviceId]);
  
  // Start recording a segment at a specific position
  const startLoopRecordingAt = useCallback(async (startPosition: number, duration: number) => {
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
      
      console.log(`Starting loop recording at position ${startPosition}s for ${actualDuration}s`);
      
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
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Start recording
      recorder.start();
      setIsLoopRecording(true);
      loopStartTimeRef.current = Date.now();
      
      // Set a timeout to stop recording after duration
      setTimeout(() => {
        if (isLoopRecording) {
          stopLoopRecordingAndMerge();
        }
      }, actualDuration * 1000);
      
      return true;
    } catch (error) {
      console.error("Error starting loop recording at position:", error);
      setLoopRecordingError(`Failed to start recording: ${error || "Unknown error"}`);
      return false;
    }
  }, [isRecorderReady, loopBuffer, loopDuration, isLoopPlaybackActive, getSegmentRecorder]);
  
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
      console.log(`Stopping loop recording (actual duration: ${actualDuration.toFixed(2)}s)`);
      
      // Stop recording and get blob
      const recording = await recorder.stop();
      
      // Process and merge recording into loop
      const success = await mergeRecordingIntoLoop(recording);
      
      setIsLoopRecording(false);
      
      return success;
    } catch (error) {
      console.error("Error stopping loop recording:", error);
      setLoopRecordingError(`Failed to stop loop recording: ${error || "Unknown error"}`);
      setIsLoopRecording(false);
      return false;
    }
  }, [isLoopRecording]);
  
  // Merge new recording into the existing loop buffer
  const mergeRecordingIntoLoop = useCallback(async (blob: Blob) => {
    try {
      console.log(`Merging recording into loop at position ${loopRecordStartPosition}s`);
      
      // We need an existing loop buffer
      if (!loopBuffer) {
        throw new Error("No loop buffer to merge into");
      }
      
      // Convert blob to array buffer
      const arrayBuffer = await blob.arrayBuffer();
      
      // Decode the audio data
      const newRecordingBuffer = await Tone.context.decodeAudioData(arrayBuffer);
      
      // Create a new buffer for the merged result
      const mergedBuffer = Tone.context.createBuffer(
        loopBuffer.numberOfChannels,
        loopBuffer.length,
        loopBuffer.sampleRate
      );
      
      // Calculate sample positions
      const startSample = Math.floor(loopRecordStartPosition * loopBuffer.sampleRate);
      const endSample = Math.min(
        Math.floor(loopRecordEndPosition * loopBuffer.sampleRate),
        loopBuffer.length
      );
      
      // For each channel, copy data appropriately
      for (let channel = 0; channel < loopBuffer.numberOfChannels; channel++) {
        const originalData = loopBuffer.getChannelData(channel);
        const newData = newRecordingBuffer.getChannelData(channel);
        const mergedData = mergedBuffer.getChannelData(channel);
        
        // Copy part before recording (preserve original)
        for (let i = 0; i < startSample; i++) {
          mergedData[i] = originalData[i];
        }
        
        // Copy the new recording (overwrite in the middle section)
        const recordingSampleCount = Math.min(
          newRecordingBuffer.length,
          endSample - startSample
        );
        
        for (let i = 0; i < recordingSampleCount; i++) {
          if (startSample + i < mergedData.length) {
            mergedData[startSample + i] = newData[i];
          }
        }
        
        // Copy part after recording (preserve original)
        for (let i = startSample + recordingSampleCount; i < loopBuffer.length; i++) {
          mergedData[i] = originalData[i];
        }
      }
      
      // Update loop buffer
      setLoopBuffer(mergedBuffer);
      
      // Extract channel data for visualization
      const channelData: Float32Array[] = [];
      for (let channel = 0; channel < mergedBuffer.numberOfChannels; channel++) {
        channelData.push(mergedBuffer.getChannelData(channel));
      }
      setLoopChannelData(channelData);
      
      // Update player
      if (loopPlayerRef.current) {
        loopPlayerRef.current.buffer.set(mergedBuffer);
      }
      
      console.log("Successfully merged recording into loop");
      return true;
    } catch (error) {
      console.error("Error merging recording into loop:", error);
      setLoopRecordingError(`Failed to merge recording: ${error || "Unknown error"}`);
      return false;
    }
  }, [loopBuffer, loopRecordStartPosition, loopRecordEndPosition]);
  
  // ========== PLAYBACK WITH POSITION TRACKING ==========
  
  // Play the loop with position tracking
  const playLoopWithTracking = useCallback(async () => {
    try {
      if (!loopBuffer || !loopPlayerRef.current) {
        console.error("No loop buffer available");
        return false;
      }
      
      // Ensure Tone.js is running
      if (Tone.context.state !== "running") {
        console.log("Tone context not running, starting it");
        await Tone.start();
      }
      
      console.log("Starting loop playback with position tracking");
      
      // Start loop playback
      loopPlayerRef.current.start();
      setIsLoopPlaybackActive(true);
      
      // Position tracking
      setLoopPosition(0);
      const startTime = Date.now();
      
      // Set up interval to update position
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
      
      positionIntervalRef.current = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        // Calculate position within the loop (looping around when needed)
        const position = elapsedTime % loopDuration;
        setLoopPosition(position);
      }, 16.67); // ~60fps
      
      return true;
    } catch (error) {
      console.error("Error playing loop with tracking:", error);
      setLoopRecordingError(`Failed to play loop: ${error || "Unknown error"}`);
      return false;
    }
  }, [loopBuffer, loopDuration]);
  
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
      
      // Clear position tracking interval
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
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
  const getWaveformData = useCallback((resolution: number = 100) => {
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
  }, [loopChannelData]);
  
  // Calculate current visual position for timeline (0-1 range)
  const getLoopPositionRatio = useCallback(() => {
    return loopPosition / loopDuration;
  }, [loopPosition, loopDuration]);
  
  // ========== CLEANUP ==========
  
  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      console.log("Cleaning up loop resources");
      
      // Stop interval
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
      
      // Stop and dispose player
      if (loopPlayerRef.current) {
        loopPlayerRef.current.stop();
        loopPlayerRef.current.dispose();
      }
      
      // Dispose recorder
      if (segmentRecorderRef.current) {
        segmentRecorderRef.current.dispose();
      }
    };
  }, []);
  
  // ========== RETURN VALUES ==========
  
  return {
    // State
    loopBuffer,
    loopDuration,
    loopPosition,
    isLoopPlaybackActive,
    isLoopRecording,
    loopRecordingError,
    
    // Functions
    initializeLoopBuffer,
    startLoopRecordingAt,
    stopLoopRecordingAndMerge,
    playLoopWithTracking,
    stopLoopPlayback,
    
    // Visualization
    getWaveformData,
    getLoopPositionRatio
  };
}