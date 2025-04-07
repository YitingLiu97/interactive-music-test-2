'use client'
import React from "react"
type BoundingBox = {
    x: number,
    y: number
}
type Props = {
    xPercent: number,
    yPercent: number;
    onMouseDown: () => void;
    isDragging: boolean;
    boundingBox: BoundingBox;
    color?: string;
}
export default function CircleUI({ xPercent,
    yPercent,
    onMouseDown,
    isDragging,
    boundingBox,
    color = "red", 
}: Props) {
    const circleSize = 50;
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
            }}
        />
    );
}