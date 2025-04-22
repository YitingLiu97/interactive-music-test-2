"use client";
import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

export function useAudioCircle(audioUrl: string) {
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentPan, setCurrentPan] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio analysis state for visualizations
  const [audioData, setAudioData] = useState<{
    fftData: Float32Array | null;
    waveformData: Float32Array | null;
    amplitude: number;
    isQuiet: boolean;
  }>({
    fftData: null,
    waveformData: null,
    amplitude: 0,
    isQuiet: true,
  });

  const volumeThreshold = -15;
  const quietThreshold = -30;
  
  // Audio objects
  const playerRef = useRef<Tone.Player | null>(null);
  const pannerRef = useRef<Tone.Panner | null>(null);
  const volumeRef = useRef<Tone.Volume | null>(null);
  const analyzerRef = useRef<Tone.FFT | null>(null);
  const waveformRef = useRef<Tone.Waveform | null>(null);
  const meterRef = useRef<Tone.Meter | null>(null);
  const analysisFrameRef = useRef<number | null>(null);
  
  // Track if mounted and playing state
  const isMountedRef = useRef(true);
  const isPlayingRef = useRef(false);
  const isAnalyzingRef = useRef(false); // Flag to prevent multiple analyze loops

  // Initialize audio
  useEffect(() => {
    isMountedRef.current = true;
    
    // Clean up function
    const cleanup = () => {
      if (analysisFrameRef.current) {
        cancelAnimationFrame(analysisFrameRef.current);
        analysisFrameRef.current = null;
      }
      
      if (playerRef.current) {
        try {
          playerRef.current.stop();
          playerRef.current.dispose();
          playerRef.current = null;
        } catch (e) {
          console.error("Error disposing player:", e);
        }
      }
  
      if (pannerRef.current) {
        try {
          pannerRef.current.dispose();
          pannerRef.current = null;
        } catch (e) {
          console.log("error: "+ e);
        }
      }
      
      if (volumeRef.current) {
        try {
          volumeRef.current.dispose();
          volumeRef.current = null;
        } catch (e) {
          console.log("error: "+ e);
        }
      }
      
      if (analyzerRef.current) {
        try {
          analyzerRef.current.dispose();
          analyzerRef.current = null;
        } catch (e) {
          console.log("error: "+ e);
        }
      }
      
      if (waveformRef.current) {
        try {
          waveformRef.current.dispose();
          waveformRef.current = null;
        } catch (e) {
          console.log("error: "+ e);
        }
      }
      
      if (meterRef.current) {
        try {
          meterRef.current.dispose();
          meterRef.current = null;
        } catch (e) {
          console.log("error: "+ e);
        }
      }
    };
    
    // Clean up previous instances
    cleanup();
    
    // Create new audio components
    try {
      // Create volume node
      const volumeNode = new Tone.Volume(0).toDestination();
      volumeRef.current = volumeNode;

      // Create panner node
      const pannerNode = new Tone.Panner(0).connect(volumeNode);
      pannerRef.current = pannerNode;

      // Create analysis nodes
      const fftAnalyzer = new Tone.FFT(512);
      analyzerRef.current = fftAnalyzer;
      const waveformAnalyzer = new Tone.Waveform(1024);
      waveformRef.current = waveformAnalyzer;
      const meter = new Tone.Meter();
      meterRef.current = meter;

      // Connect analysis nodes
      pannerNode.fan(fftAnalyzer, waveformAnalyzer, meter);

      // Create player
      const player = new Tone.Player({
        url: audioUrl,
        loop: false,
        autostart: false,
        onload: () => {
          if (isMountedRef.current) {
            setLoaded(true);
          }
        },
      }).connect(pannerNode);

      playerRef.current = player;
      
    } catch (error) {
      console.error("Error initializing audio:", error);
    }

    // Clean up on unmount
    return () => {
      isMountedRef.current = false;
      isAnalyzingRef.current = false;
      cleanup();
    };
  }, [audioUrl]);

  // Sync isPlayingRef with isPlaying state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Analyze audio data for visualizations
  const analyzeAudio = () => {
    // Cancel if already analyzing to prevent multiple loops
    if (!isPlayingRef.current || isAnalyzingRef.current || 
        !analyzerRef.current || !waveformRef.current || !meterRef.current) {
      return;
    }
  
    try {
      // Set flag to prevent multiple analysis loops
      isAnalyzingRef.current = true;
      
      const fftData = analyzerRef.current.getValue();
      const waveformData = waveformRef.current.getValue();
      const rawAmp = meterRef.current.getValue();
      const amplitudeValue = Array.isArray(rawAmp) ? Math.max(...rawAmp) : rawAmp;
      const isQuietValue = amplitudeValue < quietThreshold;
    
      if (isMountedRef.current) {
        // Use functional update to avoid closure issues
        setAudioData({
          fftData,
          waveformData,
          amplitude: amplitudeValue,
          isQuiet: isQuietValue
        });
      }
      
      // Only request next frame if still playing and mounted
      if (isMountedRef.current && isPlayingRef.current) {
        analysisFrameRef.current = requestAnimationFrame(() => {
          isAnalyzingRef.current = false; // Reset flag before next call
          analyzeAudio();
        });
      } else {
        isAnalyzingRef.current = false; // Reset flag if stopping
      }
    } catch (e) {
      console.error("Error analyzing audio:", e);
      isAnalyzingRef.current = false; // Reset flag on error
    }
  };

  // Play function with optional start time
  const play = (startTimeSeconds?: number) => {
    if (!playerRef.current || !loaded || !isMountedRef.current) return false;

    // Make sure Tone.js is started
    if (Tone.context.state !== "running") {
      Tone.start();
    }

    try {
      // If already playing, stop first
      if (playerRef.current.state === "started") {
        playerRef.current.stop();
      }
      
      // Start at specific time if provided
      if (startTimeSeconds !== undefined && isFinite(startTimeSeconds) && startTimeSeconds >= 0) {
        // Try to stay within valid bounds
        playerRef.current.start(undefined, startTimeSeconds);
      } else {
        // Otherwise start from beginning
        playerRef.current.start();
      }
      
      // Update state
      isPlayingRef.current = true;
      
      if (isMountedRef.current) {
        setIsPlaying(true);
        
        // Cancel any existing analysis loop
        if (analysisFrameRef.current) {
          cancelAnimationFrame(analysisFrameRef.current);
          analysisFrameRef.current = null;
        }
        
        // Reset analysis flag
        isAnalyzingRef.current = false;
        
        // Start new analysis loop
        analyzeAudio();
      }
      
      return true;
    } catch (error) {
      console.error("Error playing audio:", error);
      
      // Try again with a delay
      setTimeout(() => {
        if (!playerRef.current || !isMountedRef.current) return;
        
        try {
          playerRef.current.start();
          isPlayingRef.current = true;
          
          if (isMountedRef.current) {
            setIsPlaying(true);
            
            // Reset and restart analysis
            isAnalyzingRef.current = false;
            analyzeAudio();
          }
        } catch (err) {
          console.error("Failed to restart audio:", err);
        }
      }, 20);
      
      return false;
    }
  };

  // Stop function
  const stop = () => {
    if (!playerRef.current || !isMountedRef.current) return false;

    try {
      if (playerRef.current.state === "started") {
        playerRef.current.stop();
      }
      
      // Update state
      isPlayingRef.current = false;
      
      if (isMountedRef.current) {
        setIsPlaying(false);
      }
      
      // Cancel animation frame
      if (analysisFrameRef.current) {
        cancelAnimationFrame(analysisFrameRef.current);
        analysisFrameRef.current = null;
      }
      
      return true;
    } catch (error) {
      console.error("Error stopping audio:", error);
      
      // Update state anyway
      isPlayingRef.current = false;
      
      if (isMountedRef.current) {
        setIsPlaying(false);
      }
      
      return false;
    }
  };

  // Pause function (same as stop for Tone.js)
  const pause = () => {
    return stop();
  };

  // Improved seek function that preserves playing state
// Fixed seekTo function for useAudioCircle hook
const seekTo = (timeInSeconds: number) => {
  if (!playerRef.current || !isMountedRef.current) return false;
  
  console.log("Audio circle seeking to:", timeInSeconds);
  
  try {
    // Always stop first
    if (playerRef.current.state === "started") {
      playerRef.current.stop();
    }
    
    // Ensure time is valid
    const validTime = isFinite(timeInSeconds) && timeInSeconds >= 0 ? 
      Math.min(timeInSeconds, getDuration()) : 0;
    
    // Short delay to allow stopping to complete
    setTimeout(() => {
      if (!playerRef.current || !isMountedRef.current) return;
      
      try {
        // Start at the new position
        console.log("Starting audio at position:", validTime);
        playerRef.current.start(0, validTime);
        
        // Update state
        isPlayingRef.current = true;
        
        if (isMountedRef.current) {
          setIsPlaying(true);
        }
        
        // Start visualization
        analyzeAudio();
      } catch (e) {
        console.error("Error restarting at time position:", e);
      }
    }, 20);
    
    return true;
  } catch (error) {
    console.error("Error seeking:", error);
    return false;
  }
};
  // Set pan function
  const setPan = (value: number) => {
    if (!pannerRef.current || !isMountedRef.current) return;
    
    const clampedValue = Math.max(-1, Math.min(value, 1));
    
    try {
      pannerRef.current.pan.value = clampedValue;
      if (isMountedRef.current) {
        setCurrentPan(clampedValue);
      }
    } catch (error) {
      console.error("Error setting pan:", error);
    }
  };

  // Set volume function
  const setVolume = (value: number) => {
    if (!volumeRef.current || !isMountedRef.current) return;
    
    const clampedValue = Math.max(-60, Math.min(value, 0));
    
    try {
      const shouldBeMuted = clampedValue <= volumeThreshold;
      
      if (shouldBeMuted) {
        volumeRef.current.mute = true;
        if (isMountedRef.current) {
          setIsMuted(true);
        }
      } else {
        volumeRef.current.mute = false;
        if (isMountedRef.current) {
          setIsMuted(false);
        }
        volumeRef.current.volume.value = clampedValue;
      }
      
      if (isMountedRef.current) {
        setCurrentVolume(clampedValue);
      }
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  };

  // Toggle loop function
  const toggleLoop = () => {
    if (!playerRef.current || !isMountedRef.current) return;
    
    try {
      const newLoopState = !isLooping;
      playerRef.current.loop = newLoopState;
      if (isMountedRef.current) {
        setIsLooping(newLoopState);
      }
    } catch (error) {
      console.error("Error toggling loop:", error);
    }
  };
  
  // Set loop state
  const setLooping = (state: boolean) => {
    if (!playerRef.current || !isMountedRef.current) return;
    
    try {
      playerRef.current.loop = state;
      if (isMountedRef.current) {
        setIsLooping(state);
      }
    } catch (error) {
      console.error("Error setting loop state:", error);
    }
  };

  // Get duration of audio if available
  const getDuration = () => {
    if (playerRef.current && playerRef.current.buffer) {
      return playerRef.current.buffer.duration;
    }
    return 180; // Default duration
  };

  return {
    play,
    stop,
    pause,
    seekTo,
    setPan,
    setVolume,
    toggleLoop,
    setLooping,
    getDuration,
    loaded,
    isPlaying,
    isLooping,
    currentVolume,
    currentPan,
    isMuted,
    audioData,
  };
}