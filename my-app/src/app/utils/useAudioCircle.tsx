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

  const volumeThreshold = -15;
  // Use refs to keep track of player instances to prevent multiple instances
  const playerRef = useRef<Tone.Player | null>(null);
  const pannerRef = useRef<Tone.Panner | null>(null);
  const volumeRef = useRef<Tone.Volume | null>(null);

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

    // Create new audio components
    try {
      // Create a volume node
      const volumeNode = new Tone.Volume(0).toDestination();
      volumeRef.current = volumeNode;

      // Create a panner node
      const pannerNode = new Tone.Panner(0).connect(volumeNode);
      pannerRef.current = pannerNode;

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
    };
  }, [audioUrl]); // Only recreate when audioUrl changes

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

  // Set pan function
  const setPan = (value: number) => {
    if (!pannerRef.current) return;
    
    // Ensure value is between -1 and 1
    const clampedValue = Math.max(-1, Math.min(value, 1));
    
    try {
      pannerRef.current.pan.value = clampedValue;
      setCurrentPan(clampedValue);
    } catch (error) {
      console.error("Error setting pan:", error);
    }
  };

  // Set volume function
  const setVolume = (value: number) => {
    if (!volumeRef.current) return;
    const clampedValue = Math.max(-60, Math.min(value, 0));
    setCurrentVolume(clampedValue);
    try {
      if (value <= volumeThreshold) {
        if (!isMuted) {
          console.log(`Volume (${value} dB) exceeded threshold (${volumeThreshold} dB), muting`);
          volumeRef.current.mute = true;
          setIsMuted(true);
        }
      } else {
        if (isMuted) {
          console.log(`Volume (${value} dB) below threshold (-10 dB), unmuting`);
          volumeRef.current.mute = false;
          setIsMuted(false);
        }
        
        // Apply actual volume to the volume node
        volumeRef.current.volume.value = clampedValue;
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
    isMuted
  };
}