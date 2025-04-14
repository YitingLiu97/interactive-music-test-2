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
    color: string;
    audioRef?: React.RefObject<AudioControlRef>;
}
export default function AudioCircle({ startPoint, boundingBox, audioUrl, color, audioRef }: Props) {
    // const audioUrl = "/resources/DeanTown.mp3";
    const hasPlayedRef = useRef<boolean>(false);
    const { play, stop, pause, setPan, setVolume, loaded, toggleLoop } = useAudioCircle(audioUrl);
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
                },
                pause: () => {
                    pause(); // Using pause instead of stop for better UX
                    playerRef.current = false;
                },
                stop: () => {
                    stop();
                    playerRef.current = false;
                },
                toggle: () => {
                    toggleLoop();
                }
            };
        }
    }, [audioRef, play, pause, toggleLoop]);
    useEffect(() => {
        if (!loaded || playerRef.current === null || hasPlayedRef.current) return;
        console.log("React useEffect loaded changed:", loaded);
        console.log("About to play. loaded:", loaded, "playerRef:", playerRef.current);

        play();
        hasPlayedRef.current = true;
        console.log("playerRef.current is " + playerRef.current);

    }, [loaded]);

    function onMouseDown(e: MouseEvent) {
            // Prevent event from propagating to other circles
        e.stopPropagation(); if (!loaded) return;
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
        e.stopPropagation();
        if (!dragging) return;
        let xPercent = e.clientX / boundingBox.x * 100;
        let yPercent = e.clientY / boundingBox.y * 100;

        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;

        const boundedXPercent = Math.min(Math.max(0, xPercent), maxXPercent);
        const boundedYPercent = Math.min(Math.max(0, yPercent), maxYPercent);

        setPosition({
            xPercent: boundedXPercent,
            yPercent: boundedYPercent
        });

        setCircleSize(mapRange(boundedYPercent, 0, 100, 10, 100))
        const panValue = mapRange(boundedXPercent, 0, 100, -1, 1);
        const volumeValue = mapRange(boundedYPercent, 0, 100, -30, 0);
        
        console.log(`Setting pan for ${audioUrl} to ${panValue}`);
        console.log(`Setting volume for ${audioUrl} to ${volumeValue}`);
        
        setPan(panValue);
        setVolume(volumeValue);
    
    }

    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousedown", onMouseDown);
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);

        }
        return () => {
            window.removeEventListener("mousedown", onMouseDown);
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
            />
            {/* <Button onClick={initPlayer} style={{
                backgroundColor: "black",
                margin: "0 auto",
            }}>Start</Button>
            <Button onClick={stopAudio}>Stop</Button> */}
        </>
    );
}