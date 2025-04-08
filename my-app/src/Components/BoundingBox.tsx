'use client'
import React from "react"
import AudioCircle from "./AudioCircle";
import { useRef, useEffect, useState } from "react"

export default function BoundingBox() {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ x: 100, y: 100 });
    const [mounted, setMounted] = useState(false);
    const [resize, setResize] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        function updateSize(){
        
        if (boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            setSize({ x: rect.width, y: rect.height });
            console.log("Size updated:", rect.width, rect.height);

        }}
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
            <AudioCircle boundingBox={size} audioUrl="/resources/piano.mp3" color="red"  />
            </div>
    )
}