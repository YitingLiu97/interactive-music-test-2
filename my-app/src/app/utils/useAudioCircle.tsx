'use client'
import * as Tone from "tone";
import { useEffect, useRef, useState } from "react";

export function useAudioCircle(audioUrl: string) {
    const playerRef = useRef<Tone.Player | null>(null);
    const volumeRef = useRef<Tone.Volume | null>(null);
    const panRef = useRef<Tone.Panner | null>(null);
    const [loaded, setLoaded] = useState<boolean>(false);

    function play(){
        playerRef.current?.start();
    }

    function stop(){
        playerRef.current?.stop();
    }

    function setPan(value: number){
        if (panRef.current) panRef.current.pan.value = value; // value from -1 to 1
    }

    function setVolume(value: number)
    {
        if (volumeRef.current) volumeRef.current.volume.value = value; // value from -1 to 1
    } 
    
    useEffect(() => {
        async function setupPlayer() {
            await Tone.start();
            let player = new Tone.Player(
                {
                    url: audioUrl,
                    autostart: false,
                    onload: () => setLoaded(true)
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
        stop,
        setPan,
        setVolume
    }
}