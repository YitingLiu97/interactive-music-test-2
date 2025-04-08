'use client'
import React from "react"
import AudioCircle from "./AudioCircle";
import { useRef, useEffect, useState } from "react"
import AudioInterface from "./AudioInterface";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
interface AudioInfo {
    audioUrl: string;
    circleColor?: string;
}

export default function BoundingBox() {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ x: 100, y: 100 });
    const [mounted, setMounted] = useState<boolean>(false);
    const [resize, setResize] = useState<number>(50);
    const [alltracks, setAllTracks] = useState<string[]>();
    const [singleTrack, setSingleTrack] = useState<string>();

     const audioInfos: AudioInfo[] = [
        {
            audioUrl: "/resources/piano.mp3",
            circleColor: "red"

        },
        {
            audioUrl: "/resources/bass.mp3",
            circleColor: "purple"

        },
        {
            audioUrl: "/resources/druims.mp3",
            circleColor: "gray"

        }
    ];

    useEffect(() => setMounted(true), []);

    // in this case, should i add a ref for the tracks instead 
    // and how can i push the array when i hav ethe use state? 
    function initPlayerforAll(){
        audioInfos.forEach(track=>{
            useAudioCircle(track.audioUrl).play;
            alltracks?.push(track.audioUrl);
        })
    }

    // audio logic 
    function playAll() {
        audioInfos.forEach(track=>{
            useAudioCircle(track.audioUrl).play;
        })
    }

    function pauseAll(){
        audioInfos.forEach(track=>{
            useAudioCircle(track.audioUrl).pause;
        })
    }

    function toggleAll(){
        // for looping 
        audioInfos.forEach(track=>{
            useAudioCircle(track.audioUrl).toggleLoop;
        })
    }


    useEffect(() => {
        function updateSize() {
            if (boxRef.current) {
                const rect = boxRef.current.getBoundingClientRect();
                setSize({ x: rect.width, y: rect.height });
                console.log("Size updated:", rect.width, rect.height);

            }
        }
        updateSize();
        window.addEventListener("resize", updateSize);

        return () => {
            window.removeEventListener("resize", updateSize);
        };

    }, [mounted]);

    if (!mounted) return null;

    return (
        <div
            ref={boxRef}
            style={{
                width: "100vw",
                height: "100vh",
                position: "relative",
                overflow: "hidden",
                backgroundColor: "#f0f0f0"

            }}>
            <AudioCircle boundingBox={size} audioUrl="/resources/piano.mp3" color="red" />
            <AudioInterface trackListName="air traffic noise" authorName="alex ruthmann" onPlayAll={playAll} onPauseAll={pauseAll} onToggleAll={toggleAll} />
        </div>
    )
}