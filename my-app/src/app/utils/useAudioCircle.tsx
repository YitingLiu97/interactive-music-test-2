'use client'
import * as Tone from "tone";
import { useEffect, useRef, useState } from "react";

export function useAudioCircle(audioUrl: string) {
    const playerRef = useRef<Tone.Player | null>(null);
    const volumeRef = useRef<Tone.Volume | null>(null);
    const panRef = useRef<Tone.Panner | null>(null);
    const [loaded, setLoaded] = useState<boolean>(false);

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
    }

}