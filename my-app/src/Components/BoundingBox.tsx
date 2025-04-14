'use client'
import React from "react"
import AudioCircle from "./AudioCircle";
import { useRef, useEffect, useState } from "react"
import AudioInterface from "./AudioInterface";
import { AudioControlRef, BoundingBox as BoundingBoxType } from "@/app/types/audioTypes";

interface AudioInfo {
    audioUrl: string;
    circleColor: string;
}

export default function BoundingBox() {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ x: 100, y: 100 });
    const [mounted, setMounted] = useState<boolean>(false);
  
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
            audioUrl: "/resources/drums.mp3",
            circleColor: "gray"

        }
    ];

    const audioRefs = useRef<React.RefObject<AudioControlRef>[]>([]);
    useEffect(() => {
        // Create a ref for each audio track
        if( audioRefs.current){
            audioInfos.forEach(() => {
                audioRefs.current.push(React.createRef<AudioControlRef>());
            });            console.log("Created refs for", audioInfos.length, "audio tracks");
       
        }
         }, []);

    useEffect(() => setMounted(true), []);
    // audio logic 
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

    function pauseAll(){
        console.log("Pause all triggered");
        audioRefs.current.forEach((ref, index) => {
            if (ref.current && ref.current.stop) {
                console.log(`Stopping track ${index}`);
                ref.current.stop();
            }
        });
    }

    function toggleAll(){
        console.log("Toggle loop triggered");
        audioRefs.current.forEach((ref, index) => {
            if (ref.current && ref.current.toggle) {
                console.log(`Toggling loop for track ${index}`);
                ref.current.toggle();
            }
        });
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
            {/* For now, just render one AudioCircle with its ref */}
            {/* <AudioCircle 
                boundingBox={size} 
                audioUrl="/resources/piano.mp3" 
                color="red"
                audioRef={audioRefs.current[0]}
            /> */}
            
            {/* When you're ready to add more circles, you can use this */} */}
         
            {audioInfos.map((info, index) => (
                <AudioCircle 
                    key={index}
                    startPoint={{x: 0.3, y: 0.3*index+0.2}}
                    boundingBox={size} 
                    audioUrl={info.audioUrl} 
                    color={info.circleColor}
                    audioRef={audioRefs.current[index]}
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
    )
}