'use client'
import React from "react"
import DraggableCircle from "./DraggableCircle"
import { useRef, useEffect, useState } from "react"
export default function BoundingBox() {
    const boxRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ x: 100, y: 100 });
    const [mounted, SetMounted] = useState(false);


    useEffect(() => SetMounted(true), []);


    useEffect(() => {
        if (boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            setSize({ x: rect.width, y: rect.height });
        }
    },[mounted])
    
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
            <DraggableCircle boundingBox={size} />
        </div>
    )
}