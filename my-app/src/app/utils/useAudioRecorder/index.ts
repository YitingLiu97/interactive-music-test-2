// src/hooks/useAudioRecorder/index.ts
'use '
import { useAudioSystem } from './useAudioSystem';
import { useLoopBuffer } from './useLoopBuffer';
import { useEffect, useState, useCallback } from 'react';

export function useAudioRecorder() {
  // Import the audio system hook - handles devices, permissions, and Tone.js
  const {
    // Device state
    mediaStream,
    audioDevices,
    deviceIndex,
    deviceId,
    
    // Permission state
    isPermissionGranted,
    
    // Tone.js state
    isToneInitialized,
    isRecorderReady,
    
    // Recording state
    isRecording,
    recordedBlob,
    
    // Errors
    error: audioSystemError,
    initState,
    initAttempts,
    
    // Functions
    initialize: initializeAudioSystem,
    selectAudioDevice,
    startRecording,
    stopRecording,
    setupRecorder,
    
    // Status
    audioSystemStatus
  } = useAudioSystem();
  
  // Import the loop buffer hook - handles loop recording and playback
  const {
    // Loop state
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
    
    // Functions
    initializeLoopBuffer,
    startLoopRecordingAt,
    stopLoopRecordingAndMerge,
    playLoopWithTracking,
    stopLoopPlayback,
    startRecordingAtCurrentPosition,
    exportLoopToBlob,
    
    // Visualization data
    getWaveformData,
    getLoopPositionRatio
  } = useLoopBuffer({
    // Pass dependencies from audioSystem
    deviceId,
    isToneInitialized,
    isRecorderReady
  });
  
  // Combined error state
  const [error, setError] = useState<string | null>(null);
  
  // Update error when either source has an error
  useEffect(() => {
    if (audioSystemError) {
      setError(audioSystemError);
    } else if (loopRecordingError) {
      setError(loopRecordingError);
    } else {
      setError(null);
    }
  }, [audioSystemError, loopRecordingError]);
  
  // Coordinate initialization between hooks
  useEffect(() => {
    // When audio system is ready, initialize the loop buffer if not already done
    if (isToneInitialized && isRecorderReady && !loopBuffer) {
      console.log("Audio system ready, initializing loop buffer");
      initializeLoopBuffer(4); // Default 4 second loop
    }
  }, [isToneInitialized, isRecorderReady, loopBuffer, initializeLoopBuffer]);
  
  // Unified initialize function
  const initialize = useCallback(async () => {
    console.log("Initializing audio recorder");
    try {
      // First initialize the audio system
      const audioSystemInitialized = await initializeAudioSystem();
      
      if (!audioSystemInitialized) {
        throw new Error("Failed to initialize audio system");
      }
      
      // The loop buffer will be initialized automatically via the useEffect
      return audioSystemInitialized;
    } catch (err) {
      console.error("Error in unified initialization:", err);
      setError(`Initialization failed: ${err}`);
      return false;
    }
  }, [initializeAudioSystem]);
  
  // Return a unified API
  return {
    // State
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    isToneInitialized,
    isRecorderReady,
    isRecording,
    recordedBlob,
    error,
    initState,
    initAttempts,
    
    // Functions
    initialize,
    selectAudioDevice,
    startRecording,
    stopRecording,
    setupRecorder,
    
    // Loop state
    loopBuffer,
    loopDuration,
    loopPosition,
    isLoopPlaybackActive,
    isLoopRecording,
    
    // Loop download state
    loopBlob,
    loopBlobUrl,
    isExportingLoop,
    
    // Loop functions
    initializeLoopBuffer,
    startLoopRecordingAt,
    stopLoopRecordingAndMerge,
    playLoopWithTracking,
    stopLoopPlayback,
    startRecordingAtCurrentPosition,
    exportLoopToBlob,
    
    // Visualization
    getWaveformData,
    getLoopPositionRatio,
    
    // Status
    status: {
      ...audioSystemStatus,
      hasLoopBuffer: !!loopBuffer,
      loopDuration: loopDuration,
      hasLoopRecording: !!loopBlob
    }
  };
}