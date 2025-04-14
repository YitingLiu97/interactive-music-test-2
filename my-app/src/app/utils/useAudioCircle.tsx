'use client'
import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

export function useAudioCircle(url: string) {
    const [loaded, setLoaded] = useState<boolean>(false);
    const [isLooping, setIsLooping] = useState<boolean>(false);
    const playerRef = useRef<Tone.Player | null>(null);
    const pannerRef = useRef<Tone.Panner | null>(null);
    const volumeRef = useRef<Tone.Volume | null>(null);
    const isPlayingRef = useRef<boolean>(false);
    
    // Debug state to see volume in UI
    const [currentVolume, setCurrentVolume] = useState<number>(-15);
    const [currentPan, setCurrentPan] = useState<number>(0);

    useEffect(() => {
        // Create audio nodes only once
        if (!playerRef.current) {
            console.log("Creating new player for:", url);
            
            // Create the player
            const player = new Tone.Player({
                url,
                loop: isLooping,
                onload: () => {
                    console.log("Audio loaded successfully:", url);
                    setLoaded(true);
                },
                onerror: (e) => {
                    console.error("Error loading audio:", e);
                }
            });

            // Make sure we're using the correct version of Tone.js
            console.log("Tone.js version:", Tone.version);

            // Create the effect nodes BEFORE connecting anything
            const volume = new Tone.Volume(-15);
            const panner = new Tone.Panner(0);
            
            // Log what we have
            console.log("Created nodes:", {
                player: player !== null,
                panner: panner !== null,
                volume: volume !== null
            });
            
            // IMPORTANT: Disconnect first in case there are existing connections
            player.disconnect();
            
            // Build the audio chain step by step with logging
            console.log("Connecting player → panner");
            player.connect(panner);
            
            console.log("Connecting panner → volume");
            panner.connect(volume);
            
            console.log("Connecting volume → destination");
            volume.toDestination();
            
            // Store refs
            playerRef.current = player;
            pannerRef.current = panner;
            volumeRef.current = volume;
            
            // Initial state
            setCurrentVolume(-15);
            setCurrentPan(0);
            
            console.log(`Audio chain created for ${url}`);
        }

        // Cleanup function
        return () => {
            if (playerRef.current) {
                try {
                    if (isPlayingRef.current) {
                        playerRef.current.stop();
                    }
                    playerRef.current.dispose();
                } catch (e) {
                    console.error("Error cleaning up player:", e);
                }
                playerRef.current = null;
            }
            if (pannerRef.current) {
                pannerRef.current.dispose();
                pannerRef.current = null;
            }
            if (volumeRef.current) {
                volumeRef.current.dispose();
                volumeRef.current = null;
            }
        };
    }, [url, isLooping]);

    // Set loop state when it changes
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.loop = isLooping;
            console.log(`Loop state for ${url} set to:`, isLooping);
        }
    }, [isLooping, url]);

    const play = () => {
        if (!playerRef.current || !loaded) {
            console.log(`Cannot play ${url}, player not ready or loaded:`, loaded);
            return;
        }

        try {
            // Initialize volume and pan before playing
            if (volumeRef.current) {
                volumeRef.current.volume.value = currentVolume;
                console.log(`Initial volume set to ${currentVolume}dB`);
            }
            
            if (pannerRef.current) {
                pannerRef.current.pan.value = currentPan;
                console.log(`Initial pan set to ${currentPan}`);
            }
            
            // Ensure the audio context is running
            Tone.start();
            
            // Check current context state
            console.log("Audio context state:", Tone.context.state);
            
            // Check the player state before playing
            const state = playerRef.current.state;
            console.log(`Current player state for ${url}:`, state);
            
            if (state === "started") {
                console.log(`Player for ${url} is already playing`);
                return;
            }
            
            // Start the player
            console.log(`Starting player for ${url}, loop:`, isLooping);
            playerRef.current.start();
            isPlayingRef.current = true;
        } catch (e) {
            console.error("Error playing:", e);
        }
    };

    const pause = () => {
        if (!playerRef.current) return;
        
        try {
            // Only stop if we're actually playing
            if (playerRef.current.state === "started") {
                console.log(`Pausing player for ${url}`);
                playerRef.current.stop();
                isPlayingRef.current = false;
            } else {
                console.log(`Cannot pause ${url}, not playing:`, playerRef.current.state);
            }
        } catch (e) {
            console.error("Error pausing:", e);
        }
    };

    const stop = () => {
        if (!playerRef.current) return;
        
        try {
            // Only stop if we're actually playing
            if (playerRef.current.state === "started") {
                console.log(`Stopping player for ${url}`);
                playerRef.current.stop();
                isPlayingRef.current = false;
            } else {
                console.log(`Cannot stop ${url}, not playing:`, playerRef.current.state);
            }
        } catch (e) {
            console.error("Error stopping:", e);
        }
    };

    const toggleLoop = () => {
        setIsLooping(!isLooping);
        console.log(`Toggling loop for ${url} to:`, !isLooping);
    };

    const setPan = (value: number) => {
        if (pannerRef.current) {
            // Try setting with different methods
            try {
                // Method 1: Using the value property
                pannerRef.current.pan.value = value;
                
            
                // Log success
                console.log(`Pan set for ${url}: requested=${value}, actual=${pannerRef.current.pan.value}`);
                
                // Update our state for debugging
                setCurrentPan(value);
            } catch (e) {
                console.error("Error setting pan:", e);
            }
        } else {
            console.log(`Pan node not available for ${url}`);
        }
    };

    const setVolume = (value: number) => {
        if (volumeRef.current) {
            try {
                // Method 1: Using the value property
                volumeRef.current.volume.value = value;
                
                console.log(`Volume set for ${url}: requested=${value}dB, actual=${volumeRef.current.volume.value}dB`);
                
                // Update our state
                setCurrentVolume(value);
            } catch (e) {
                console.error("Error setting volume:", e);
            }
        } else {
            console.log(`Volume node not available for ${url}`);
        }
    };

    return {
        play,
        pause,
        stop,
        toggleLoop,
        setPan,
        setVolume,
        loaded,
        isLooping,
        // Expose current values for debugging
        currentVolume,
        currentPan
    };
}