'use client'
import React from "react"
import AudioCircle from "./AudioCircle";
import { useRef, useEffect, useState } from "react"
import AudioInterface from "./AudioInterface";
import { AudioControlRef } from "@/app/types/audioType";

interface AudioInfo {
    audioUrl: string;
    circleColor: string;
    instrumentName?: string;
}

export default function BoundingBox() {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ x: 100, y: 100 });
    const [mounted, setMounted] = useState<boolean>(false);
    const [audioRefsCreated, setAudioRefsCreated] = useState(false);

    const audioInfos: AudioInfo[] = [
        {
            audioUrl: "/resources/piano.mp3",
            circleColor: "red",
            instrumentName: "piano"
        },
        {
            audioUrl: "/resources/bass.mp3",
            circleColor: "purple",
            instrumentName: "bass"
        },
        {
            audioUrl: "/resources/drums.mp3",
            circleColor: "gray",
            instrumentName: "drums"
        },
        {
            audioUrl: "/resources/timp.mp3",
            circleColor: "brown",
            instrumentName: "timp"
        },
        {
            audioUrl: "/resources/pedal-steel.mp3",
            circleColor: "blue",
            instrumentName: "pedal-steel"
        }
    ];

    // Initialize the refs array with the correct length first
    const audioRefs = useRef<React.RefObject<AudioControlRef | null>[]>(
        Array(audioInfos.length).fill(null).map(() => React.createRef<AudioControlRef>())
    );

    // This useEffect will run only once after component mounts
    useEffect(() => {
        setMounted(true);
        setAudioRefsCreated(true);
    }, []);

    // Update size when mounted or on resize
    useEffect(() => {
        function updateSize() {
            if (boxRef.current) {
                const rect = boxRef.current.getBoundingClientRect();
                setSize({ x: rect.width, y: rect.height });
                console.log("Size updated:", rect.width, rect.height);
            }
        }
        
        if (mounted) {
            updateSize();
            window.addEventListener("resize", updateSize);
            
            return () => {
                window.removeEventListener("resize", updateSize);
            };
        }
    }, [mounted]);

    // Audio control functions
    function playAll() {
        console.log("Play all triggered, refs:", audioRefs.current.length);
        audioRefs.current.forEach((ref, index) => {
            if (ref.current && ref.current.play) {
                console.log(`Playing track ${index}`);
                ref.current.play();
            } else {
                console.log(`Ref ${index} is not ready`);
            }
        });
    }

    function pauseAll() {
        console.log("Pause all triggered");
        audioRefs.current.forEach((ref, index) => {
            if (ref.current && ref.current.stop) {
                console.log(`Stopping track ${index}`);
                ref.current.stop();
            }
        });
    }

    function toggleAll() {
        console.log("Toggle loop triggered");
        audioRefs.current.forEach((ref, index) => {
            if (ref.current && ref.current.toggle) {
                console.log(`Toggling loop for track ${index}`);
                ref.current.toggle();
            }
        });
    }

    // Don't render anything on the server, only render on client
    // This avoids hydration errors completely
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
            }}
        >
            {audioRefsCreated && audioInfos.map((info, index) => (
                <AudioCircle
                    key={index}
                    startPoint={{ x: 0.3, y: 0.3 }}
                    boundingBox={size}
                    audioUrl={info.audioUrl}
                    color={info.circleColor}
                    audioRef={audioRefs.current[index]}
                    instrumentName={info.instrumentName}
                />
            ))}

            <AudioInterface
                trackListName="air traffic noise"
                authorName="alex ruthmann"
                onPlayAll={playAll}
                onPauseAll={pauseAll}
                onToggleAll={toggleAll}
            />
        </div>
    );
}