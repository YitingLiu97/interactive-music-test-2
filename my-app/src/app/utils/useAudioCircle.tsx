'use client'
import * as Tone from "tone";
import { useEffect, useRef, useState } from "react";

export function useAudioCircle(audioUrl: string) {
    const playerRef = useRef<Tone.Player | null>(null);
    const volumeRef = useRef<Tone.Volume | null>(null);
    const panRef = useRef<Tone.Panner | null>(null);
    const [loaded, setLoaded] = useState<boolean>(false);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLooping, setIsLooping] = useState<boolean>(false);

    function play() {
        if (loaded && playerRef.current) {
            playerRef.current.start();
            setIsPlaying(true);
        } else {
            console.warn("Tried to play before audio was loaded.");
        }

        console.log("loaded", loaded);
    }

    function pause() {
        if(isPlaying){
            playerRef.current?.stop();
        }
        setIsPlaying(false);
    }
    function toggleLoop() {
        if (playerRef.current) {
            playerRef.current.loop = !playerRef.current.loop;
            setIsLooping(playerRef.current.loop);
        }
    }

    function stop() {
        playerRef.current?.stop();
        setIsPlaying(false);

    }

    function setPan(value: number) {
        if (panRef.current) panRef.current.pan.value = value; // value from -1 to 1
        console.log("set panning is " + value);
    }

    function setVolume(value: number) {
        if (volumeRef.current) volumeRef.current.volume.value = value; // value from -1 to 1
    }

    function reload() {
        playerRef.current?.dispose();
        setLoaded(false);
        setIsPlaying(false);
        setIsLooping(false);
    }
  
    useEffect(() => {
        async function setupPlayer() {
            await Tone.start();
            console.log("setup player with audio " + audioUrl);
            let player = new Tone.Player(
                {
                    url: audioUrl,
                    autostart: false,
                    onload: () =>{  console.log("player loaded");
                        setLoaded(true); }
                });
            let volume = new Tone.Volume(0);
            let panner = new Tone.Panner(0);
            playerRef.current = player;
            volumeRef.current = volume;
            panRef.current = panner;

            player.connect(panner);
            panner.connect(volume);
            volume.toDestination();
            player.autostart = false;
        }

        setupPlayer();
        return () => {
            playerRef.current?.dispose();
            volumeRef.current?.dispose();
            panRef.current?.dispose();
        }
    }, [audioUrl])

    return {
        loaded,
        play,
        pause,
        stop,
        reload,
        toggleLoop,
        setPan,
        setVolume,
    }
}