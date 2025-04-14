'use client'
import React from "react"
import { BoundingBox } from "@/app/types/audioType";
import { SpeakerLoudIcon } from "@radix-ui/react-icons";

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
    isPlaying?: boolean;
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
    instrumentName,
    isPlaying = false
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
                transition: isDragging ? "none" : "all 0.1s ease",
                opacity: opacity,
                zIndex: isDragging ? 10 : 1,
                boxShadow: isDragging 
                    ? "0 0 15px rgba(255, 255, 255, 0.6)" 
                    : isPlaying 
                        ? `0 0 10px ${color}, 0 0 20px ${color}`
                        : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
                overflow: "visible"
            }}
        >
            {/* Animated waves when playing */}
            {isPlaying && (
                <div className="absolute inset-0 rounded-full" style={{
                    animation: "pulse 2s infinite",
                    border: `2px solid ${color}`,
                    opacity: 0.6,
                    transform: "scale(1.1)",
                }}>
                </div>
            )}
            
            {/* Instrument name */}
            {instrumentName && (
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px"
                }}>
                    <div style={{
                        fontSize: Math.max(10, circleSize * 0.25),
                        fontWeight: "bold",
                        color: "#000",
                        textShadow: "0 0 2px rgba(255,255,255,0.7)",
                        lineHeight: 1
                    }}>
                        {instrumentName}
                    </div>
                    
                    {isPlaying && (
                        <SpeakerLoudIcon style={{
                            width: Math.max(10, circleSize * 0.2),
                            height: Math.max(10, circleSize * 0.2),
                            color: "#000",
                            animation: "bounce 0.5s infinite alternate"
                        }} />
                    )}
                </div>
            )}
            
            {/* Add some CSS animations for the playing state */}
            <style jsx global>{`
                @keyframes pulse {
                    0% { opacity: 0.7; transform: scale(1); }
                    70% { opacity: 0; transform: scale(1.3); }
                    100% { opacity: 0; transform: scale(1.5); }
                }
                
                @keyframes bounce {
                    0% { transform: translateY(-1px); }
                    100% { transform: translateY(1px); }
                }
            `}</style>
        </div>
    );
}