'use client'
import React from "react"
type BoundingBox = {
    x: number,
    y: number
}
type Props = {
    xPercent: number;
    yPercent: number;
    circleSize?: number;
    onMouseDown: () => void;
    isDragging: boolean;
    boundingBox: BoundingBox;
    color?: string;
    opacity: number;
}
// circle UI shuold also change the sizes 
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
                opacity:`${opacity}`,
            }}
        />
    );
}