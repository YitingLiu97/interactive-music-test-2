'use client'
import React, { useEffect, useState, useRef } from "react";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
import { mapRange } from "@/app/utils/math";
import CircleUI from "./CircleUI";

type BoundingBox = {
    x: number,
    y: number
}
type Props = {
    boundingBox: BoundingBox;
}
export default function AudioCircle({ boundingBox }: Props) {
    const audioUrl = "/resources/DeanTown.mp3";
    const { play, stop, setPan, setVolume, loaded } = useAudioCircle(audioUrl);
    const [dragging, setDragging] = useState<boolean>(false);
    const [position, setPosition] = useState<{ xPercent: number, yPercent: number }>(
        {
            xPercent: 0,
            yPercent: 0
        });

    const circleSize = 50;
    const marginPercent = 10;

    const playerRef = useRef(false);
    // useEffect(() => {
    //     if (!loaded || playerRef.current) return;
    //     // play();
    //     playerRef.current = true;
    //     console.log("audio should be playing");
    //     setPan(0);
    // }, [loaded]);



    function onMouseDown() {
        setDragging(true);
        if (!loaded || playerRef.current) return;
         play();
        playerRef.current = true;
        console.log("audio should be playing");
        setPan(0);
    }

    function stopAudio(){
        if(playerRef.current)
        {
            playerRef.current=false;
        }
        stop();
    }

    function onMouseUp() {
        setDragging(false);
    }
    function onMouseMove(e: MouseEvent) {
        if (!dragging) return;
        let xPercent = e.clientX / boundingBox.x * 100;
        let yPercent = e.clientY / boundingBox.y * 100;

        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;

        const boundedXPercent = Math.round(Math.min(Math.max(0, xPercent), maxXPercent) * 100) / 100;
        const boundedYPercent = Math.round(Math.min(Math.max(0, yPercent), maxYPercent) * 100) / 100;
        setPosition({
            xPercent: boundedXPercent,
            yPercent: boundedYPercent
        });

        setPan(mapRange(boundedXPercent, 0, 100, -1, 1));
        setVolume(mapRange(boundedYPercent, 0, 100, -30, 0));
    }

    useEffect(() => {
        window.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

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
        onMouseDown = {onMouseDown}
        isDragging = {dragging}
        boundingBox = {boundingBox}
        color= "yellow"
        />
        </>
    );
}