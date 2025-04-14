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


    useEffect(() => {
        // Create audio nodes only once
        if (!playerRef.current) {
            const player = new Tone.Player({
                url,
                loop: isLooping,
                autostart: false,
                onload: () => {
                    console.log("Audio loaded:", url);
                    setLoaded(true);
                },
                onerror: (e) => {
                    console.error("Error loading audio:", e);
                }
            }).toDestination();

            const panner = new Tone.Panner(0).toDestination();
            const volume = new Tone.Volume(0).toDestination();

            // Connect the nodes: player -> panner -> volume -> destination
            player.disconnect();

            player.chain(panner, volume, Tone.Destination);

            playerRef.current = player;
            pannerRef.current = panner;
            volumeRef.current = volume;
        }

        // Cleanup function
        return () => {
            if (playerRef.current) {
                try{
                    if(isPlayingRef.current){
                        playerRef.current.stop();
                        playerRef.current.dispose();
                    }                    

                } catch (e){
                    console.error("Error stopping player:", e);

                }
                playerRef.current.dispose();
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
    }, [url]);

    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.loop = isLooping;
            console.log(`Loop state for ${url} set to: ${isLooping}`);
        }
    }, [isLooping, url]);

    const play = () => {
        if (!playerRef.current || !loaded) {
            console.log(`Cannot play ${url}, player not ready or loaded:`, loaded);
            return;
        }
        
        try {
               
                    Tone.start();
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
        console.log(`Toggling loop for ${url} from ${isLooping} to ${!isLooping}`);
        setIsLooping(!isLooping);
    };

    const setPan = (value: number) => {
        if (pannerRef.current) {
            pannerRef.current.pan.value = value;
        }
    };

    const setVolume = (value: number) => {
        if (volumeRef.current) {
            volumeRef.current.volume.value = value;
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
        isLooping
    };
}