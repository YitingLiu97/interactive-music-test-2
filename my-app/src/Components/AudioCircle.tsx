'use client'
import React, { useEffect, useState, useRef } from "react";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
import { mapRange } from "@/app/utils/math";
import CircleUI from "./CircleUI";
import * as Tone from "tone";
import { Button } from "@radix-ui/themes";
import { BoundingBox, AudioControlRef, StartPoint } from "@/app/types/audioType";
type Props = {
    startPoint: StartPoint;
    boundingBox: BoundingBox;
    audioUrl: string;
    instrumentName?: string;
    color: string;
    audioRef?: React.RefObject<AudioControlRef | null>;

}
export default function AudioCircle({ startPoint, boundingBox, audioUrl, color, audioRef,instrumentName }: Props) {
    // const audioUrl = "/resources/DeanTown.mp3";
    const hasPlayedRef = useRef<boolean>(false);
    const { play, stop, pause, setPan, setVolume, loaded, toggleLoop, currentVolume, currentPan } = useAudioCircle(audioUrl);
    const [dragging, setDragging] = useState<boolean>(false);
    const [position, setPosition] = useState<{ xPercent: number, yPercent: number }>(
        {
            xPercent: startPoint.x,
            yPercent: startPoint.y
        });

    const [circleSize, setCircleSize] = useState<number>(50);
    const marginPercent = 10;

    const playerRef = useRef(false);
    useEffect(() => {
        if (audioRef && 'current' in audioRef) {
            audioRef.current = {
                play: () => {
                    Tone.start();
                    play();
                    playerRef.current = true;

                    // Set volume and pan again when playing starts
                    const panValue = mapRange(position.xPercent, 0, 100, -1, 1);
                    const volumeValue = mapRange(position.yPercent, 0, 100, -30, 0);
                    setPan(panValue);
                    setVolume(volumeValue);
                },
                stop: () => {
                    stop(); // Using pause instead of stop for better UX
                    playerRef.current = false;
                }, 
                pause: () => {
                    pause(); // Using pause instead of stop for better UX
                    playerRef.current = false;
                },
                toggle: () => {
                    toggleLoop();
                }
            };
        }
    }, [audioRef, play, pause, toggleLoop]);

    useEffect(() => {
        if (loaded) {
            const panValue = mapRange(position.xPercent, 0, 100, -1, 1);
            const volumeValue = mapRange(position.yPercent, 0, 100, -30, 0);
            
            console.log(`Setting initial volume/pan for ${audioUrl}`);
            console.log(`Position: x=${position.xPercent}%, y=${position.yPercent}%`);
            console.log(`Calculated: vol=${volumeValue}dB, pan=${panValue}`);
            
            setPan(panValue);
            setVolume(volumeValue);
        }
    }, [loaded, audioUrl, position.xPercent, position.yPercent, setPan, setVolume]);

    function onMouseDown(e: React.MouseEvent) {
        // Prevent event from propagating to other circles
        e.stopPropagation(); 
        if (!loaded) return;
        Tone.start();
        setDragging(true);
        if (!loaded || playerRef.current) return;
        play();
        playerRef.current = true;
        console.log("audio should be playing");
        setPan(0);
    }


    function onMouseUp() {
        setDragging(false);
    }

    function onMouseMove(e: MouseEvent) {
        e.stopPropagation(  );
        if (!dragging) return;
        console.log("on mouse move");

        let xPercent = e.clientX / boundingBox.x * 100;
        let yPercent = e.clientY / boundingBox.y * 100;

        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;

      const boundedXPercent = Math.round(Math.min(Math.max(0, xPercent), maxXPercent) * 100) / 100;
        const boundedYPercent = Math.round(Math.min(Math.max(0, yPercent), maxYPercent) * 100) / 100;

       // Update the circle size based on vertical position
       setCircleSize(mapRange(boundedYPercent, 0, 100, 10, 100));
        
       // Set pan and volume for THIS specific audio only
       const panValue = mapRange(boundedXPercent, 0, 100, -1, 1);
       const volumeValue = mapRange(boundedYPercent, 0, 100, -30, 0);
       
       // Log the values
       console.log(`${audioUrl} - Position: x=${boundedXPercent.toFixed(1)}%, y=${boundedYPercent.toFixed(1)}%`);
       console.log(`${audioUrl} - Setting: vol=${volumeValue.toFixed(1)}dB, pan=${panValue.toFixed(2)}`);
       
       setPosition({
        xPercent: boundedXPercent,
        yPercent: boundedYPercent
       })
       // Set the values
       setPan(panValue);
       setVolume(volumeValue);
    }

    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

        }
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }

    }, [dragging])

    return (
        <>
            <CircleUI
                xPercent={position.xPercent}
                yPercent={position.yPercent}
                circleSize={circleSize}
                onMouseDown={onMouseDown}
                isDragging={dragging}
                boundingBox={boundingBox}
                color={color}
                opacity={position.yPercent / 100 + 0.2}
                instrumentName={instrumentName}            />


               {/* Debug overlay to show current volume and pan */}
               <div
                style={{
                    position: 'absolute',
                    top: `${(position.yPercent * boundingBox.y) / 100 - 20}px`,
                    left: `${(position.xPercent * boundingBox.x) / 100 + circleSize}px`,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    pointerEvents: 'none', // Don't interfere with mouse events
                    display: dragging ? 'block' : 'none' // Only show when dragging
                }}
            >
                Vol: {currentVolume.toFixed(1)}dB | Pan: {currentPan.toFixed(2)}
            </div>
        </>
    );
}