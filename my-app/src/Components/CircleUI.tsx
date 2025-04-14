'use client'
import React from "react"
import { BoundingBox } from "@/app/types/audioType";

type Props = {
    xPercent: number;
    yPercent: number;
    circleSize?: number;
    onMouseDown: (e: React.MouseEvent) => void;
    isDragging: boolean;
    boundingBox: BoundingBox;
    color?: string;
    opacity: number;
    instrumentName?: string;
}

export default function CircleUI({ 
    xPercent,
    yPercent,
    circleSize = 50,
    onMouseDown,
    isDragging,
    boundingBox,
    color = "red", 
    opacity,
    instrumentName
}: Props) {
    // Calculate the actual position in pixels
    const xPos = (xPercent * boundingBox.x) / 100;
    const yPos = (yPercent * boundingBox.y) / 100;
    
    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                backgroundColor: color,
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${xPos}px, ${yPos}px)`,
                cursor: isDragging ? "grabbing" : "grab",
                transition: isDragging ? "none" : "transform 0.1s ease",
                opacity: opacity,
                zIndex: isDragging ? 10 : 1,
                boxShadow: isDragging ? "0 0 10px rgba(0, 0, 0, 0.3)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none"
            }}
        >
            {instrumentName && (
                <p style={{
                    margin: 0,
                    padding: 0,
                    color: "black",
                    fontSize: "12px",
                    fontWeight: "bold",
                    textAlign: "center",
                    lineHeight: 1
                }}>
                    {instrumentName}
                </p>
            )}
        </div>
    );
}