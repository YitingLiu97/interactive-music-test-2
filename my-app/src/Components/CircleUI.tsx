'use client'
import React from "react"
import { BoundingBox } from "@/app/types/audioTypes";

type Props = {
    xPercent: number;
    yPercent: number;
    circleSize?: number;
    onMouseDown: (e: MouseEvent) => void;
    isDragging: boolean;
    boundingBox: BoundingBox;
    color?: string;
    opacity: number;
}

export default function CircleUI({ 
    xPercent,
    yPercent,
    circleSize,
    onMouseDown,
    isDragging,
    boundingBox,
    color = "red", 
    opacity
}: Props) {
    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                backgroundColor: `${color}`,
                position: "absolute",
                transform: `translate(${(xPercent * boundingBox.x) / 100}px, ${(yPercent * boundingBox.y) / 100}px)`,
                cursor: isDragging ? "grabbing" : "grab",
                transition: isDragging ? "none" : "transform 0.1s ease",
                opacity: `${opacity}`,
                zIndex: isDragging ? 10 : 1, // Higher z-index when dragging
                boxShadow: isDragging ? "0 0 10px rgba(255, 255, 255, 0.5)" : "none", // Visual feedback when dragging
            }}
        />
    );
}