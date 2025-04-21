'use client'
import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

export function useAudioCircle(audioUrl: string) {
  const [loaded, setLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentPan, setCurrentPan] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
 // Audio analysis state
 const [audioData, setAudioData] = useState<{
  fftData: Float32Array | null;
  waveformData: Float32Array | null;
  amplitude: number;
  isQuiet: boolean;
}>({
  fftData: null,
  waveformData: null,
  amplitude: 0,
  isQuiet: true
});

  const volumeThreshold = -15;
  const quietThreshold = -30; // dB threshold to determine if audio is "quiet"
    // Use refs to keep track of player instances to prevent multiple instances


  const playerRef = useRef<Tone.Player | null>(null);
  const pannerRef = useRef<Tone.Panner | null>(null);
  const volumeRef = useRef<Tone.Volume | null>(null);
  
    // Add audio analysis refs
    const analyzerRef = useRef<Tone.FFT | null>(null);
    const waveformRef = useRef<Tone.Waveform | null>(null);
    const meterRef = useRef<Tone.Meter | null>(null);
    const analysisFrameRef = useRef<number | null>(null);
    

  // Add refs to track current values without triggering re-renders
  const currentVolumeRef = useRef<number>(currentVolume);
  const currentPanRef = useRef<number>(currentPan);
  const isMutedRef = useRef<boolean>(isMuted);

  // Initialize audio components
  useEffect(() => {
    // Clean up any existing players first
    if (playerRef.current) {
      playerRef.current.dispose();
    }
    if (pannerRef.current) {
      pannerRef.current.dispose();
    }
    if (volumeRef.current) {
      volumeRef.current.dispose();
    }
    if (analyzerRef.current) {
      analyzerRef.current.dispose();
    }
    if (waveformRef.current) {
      waveformRef.current.dispose();
    }
    if (meterRef.current) {
      meterRef.current.dispose();
    }
    
    // Cancel any ongoing animation frame
    if (analysisFrameRef.current) {
      cancelAnimationFrame(analysisFrameRef.current);
    }

    // Create new audio components
    try {
      // Create a volume node
      const volumeNode = new Tone.Volume(0).toDestination();
      volumeRef.current = volumeNode;

      // Create a panner node
      const pannerNode = new Tone.Panner(0).connect(volumeNode);
      pannerRef.current = pannerNode;
      
      // Create analysis nodes
      // FFT for frequency analysis - 512 size is a good balance between detail and performance
      const fftAnalyzer = new Tone.FFT(512);
      analyzerRef.current = fftAnalyzer;
      
      // Waveform for time-domain analysis
      const waveformAnalyzer = new Tone.Waveform(1024);
      waveformRef.current = waveformAnalyzer;
      
      // Meter for amplitude/volume detection
      const meter = new Tone.Meter();
      meterRef.current = meter;
      
      // Connect analysis nodes
      pannerNode.fan(fftAnalyzer, waveformAnalyzer, meter);

      // Create player with fixed settings
      const player = new Tone.Player({
        url: audioUrl,
        loop: false,
        autostart: false,
        playbackRate: 1.0, // Ensure normal playback rate
        onload: () => {
          console.log(`Audio loaded: ${audioUrl}`);
          setLoaded(true);
        }
      }).connect(pannerNode);
      
      playerRef.current = player;
    } catch (error) {
      console.error("Error initializing audio:", error);
    }

    // Cleanup function
    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current.dispose();
      }
      if (pannerRef.current) {
        pannerRef.current.dispose();
      }
      if (volumeRef.current) {
        volumeRef.current.dispose();
      }
      if (analyzerRef.current) {
        analyzerRef.current.dispose();
      }
      if (waveformRef.current) {
        waveformRef.current.dispose();
      }
      if (meterRef.current) {
        meterRef.current.dispose();
      }
      if (analysisFrameRef.current) {
        cancelAnimationFrame(analysisFrameRef.current);
      }
    };
  }, [audioUrl]); // Only recreate when audioUrl changes

  
  // Function to analyze audio data
  const analyzeAudio = () => {
    if (!isPlaying || 
        !analyzerRef.current || 
        !waveformRef.current || 
        !meterRef.current) {
      return;
    }
    
    try {
      // Get FFT data (frequency domain)
      const fftData = analyzerRef.current.getValue();
      
      // Get waveform data (time domain)
      const waveformData = waveformRef.current.getValue();
      
      // Get current amplitude in dB
      const amplitude = meterRef.current.getValue();
      
      // Determine if audio is quiet based on amplitude
      const isQuiet = Array.isArray(amplitude) 
        ? Math.max(...amplitude) < quietThreshold 
        : amplitude < quietThreshold;
      
      // Update audio data state
      setAudioData({
        fftData,
        waveformData,
        amplitude: Array.isArray(amplitude) ? Math.max(...amplitude) : amplitude,
        isQuiet
      });
      
      // Schedule next analysis frame
      analysisFrameRef.current = requestAnimationFrame(analyzeAudio);
    } catch (error) {
      console.error("Error analyzing audio:", error);
    }
  };

  // Start/stop audio analysis based on playback state
  useEffect(() => {
    if (isPlaying) {
      // Start analysis loop
      analyzeAudio();
    } else {
      // Stop analysis loop
      if (analysisFrameRef.current) {
        cancelAnimationFrame(analysisFrameRef.current);
      }
      
      // Reset audio data when stopped
      setAudioData({
        fftData: null,
        waveformData: null,
        amplitude: 0,
        isQuiet: true
      });
    }
    
    return () => {
      if (analysisFrameRef.current) {
        cancelAnimationFrame(analysisFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Play function
  const play = () => {
    if (!playerRef.current || !loaded) return;
    
    // Make sure Tone.js is started
    if (Tone.context.state !== "running") {
      Tone.start();
    }
    
    // Only start if not already playing
    if (!isPlaying) {
      try {
        playerRef.current.start();
        setIsPlaying(true);
      } catch (error) {
        console.error("Error playing audio:", error);
        
        // If there was an error (like already started), try restarting
        try {
          playerRef.current.stop();
          playerRef.current.start();
          setIsPlaying(true);
        } catch (innerError) {
          console.error("Could not restart audio:", innerError);
        }
      }
    }
  };

  // Stop function
  const stop = () => {
    if (!playerRef.current || !loaded) return;
    
    try {
      playerRef.current.stop();
      setIsPlaying(false);
    } catch (error) {
      console.error("Error stopping audio:", error);
    }
  };

  // Pause function (Tone.js doesn't have native pause, so we implement it)
  const pause = () => {
    if (!playerRef.current || !loaded) return;
    
    try {
      playerRef.current.stop();
      setIsPlaying(false);
    } catch (error) {
      console.error("Error pausing audio:", error);
    }
  };

  // Set pan function - FIXED to avoid infinite update loops
  const setPan = (value: number) => {
    if (!pannerRef.current) return;
    
    // Ensure value is between -1 and 1
    const clampedValue = Math.max(-1, Math.min(value, 1));
    
    try {
      // Only update the DOM node
      pannerRef.current.pan.value = clampedValue;
      
      // Only update React state if the value has actually changed
      if (currentPanRef.current !== clampedValue) {
        currentPanRef.current = clampedValue;
        setCurrentPan(clampedValue);
      }
    } catch (error) {
      console.error("Error setting pan:", error);
    }
  };

  
  // Set volume function with CORRECTED muting logic - FIXED to avoid infinite update loops
  const setVolume = (value: number) => {
    if (!volumeRef.current) return;
    
    // Ensure value is within range
    const clampedValue = Math.max(-60, Math.min(value, 0));
    
    try {
      // CORRECT LOGIC FOR MUTING:
      // In dB, MORE negative means QUIETER
      // So value <= threshold means QUIETER than threshold (should mute)
      // And value > threshold means LOUDER than threshold (should play)
      
      const shouldBeMuted = clampedValue <= volumeThreshold;
      
      // Update node values first
      if (shouldBeMuted) {
        // Volume is QUIETER than threshold, should mute
        if (!isMutedRef.current) {
          console.log(`Volume (${value.toFixed(1)} dB) is quieter than threshold (${volumeThreshold} dB), muting`);
          volumeRef.current.mute = true;
          isMutedRef.current = true;
          setIsMuted(true);
        }
      } else {
        // Volume is LOUDER than threshold, should unmute
        if (isMutedRef.current) {
          console.log(`Volume (${value.toFixed(1)} dB) is louder than threshold (${volumeThreshold} dB), unmuting`);
          volumeRef.current.mute = false;
          isMutedRef.current = false;
          setIsMuted(false);
        }
        
        // Only set volume when not muted
        volumeRef.current.volume.value = clampedValue;
      }
      
      // Only update React state if the value has actually changed
      if (currentVolumeRef.current !== clampedValue) {
        currentVolumeRef.current = clampedValue;
        setCurrentVolume(clampedValue);
      }
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  };

  // Toggle loop function
  const toggleLoop = () => {
    if (!playerRef.current) return;
    
    try {
      const newLoopState = !isLooping;
      playerRef.current.loop = newLoopState;
      setIsLooping(newLoopState);
    } catch (error) {
      console.error("Error toggling loop:", error);
    }
  };

  // Sync refs with state when state changes
  useEffect(() => {
    currentVolumeRef.current = currentVolume;
  }, [currentVolume]);
  
  useEffect(() => {
    currentPanRef.current = currentPan;
  }, [currentPan]);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  return {
    play,
    stop,
    pause,
    setPan,
    setVolume,
    toggleLoop,
    loaded,
    isPlaying,
    isLooping,
    currentVolume,
    currentPan,
    isMuted,
    audioData
  };
}