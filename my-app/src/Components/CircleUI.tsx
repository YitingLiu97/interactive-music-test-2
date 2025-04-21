'use client'
import React, { useMemo } from "react"
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
    isMuted?: boolean;
    audioData?: {
        fftData: Float32Array | null;
        waveformData: Float32Array | null;
        amplitude: number;
        isQuiet: boolean;
    };
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
    isPlaying = false,
    isMuted = true,
    audioData
}: Props) {
    // Calculate the actual position in pixels
    const xPos = (xPercent * boundingBox.x) / 100;
    const yPos = (yPercent * boundingBox.y) / 100;
    
    // Generate wave points for the reactive waveform when playing
    // This creates a dynamic, pulsating border based on the audio waveform
    const wavePoints = useMemo(() => {
        if (!audioData?.waveformData || !isPlaying || isMuted) {
            return null;
        }
        
        // Sample 16 points from the waveform data for the radial waves
        const points = [];
        const sampleSize = audioData.waveformData.length;
        const numPoints = 16; // Number of points to create around the circle
        
        for (let i = 0; i < numPoints; i++) {
            const idx = Math.floor((i / numPoints) * sampleSize);
            const value = audioData.waveformData[idx] || 0;
            
            // Calculate position on a circle with radius variations
            const angle = (i / numPoints) * 2 * Math.PI;
            const radiusVariation = value * 0.5; // Scale the variation effect
            const radius = 1 + Math.max(-0.4, Math.min(0.4, radiusVariation));
            
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return points;
    }, [audioData?.waveformData, isPlaying, isMuted]);
    
    // Calculate dynamic amplitude to use for pulse animation size
    const pulseAmplitude = useMemo(() => {
        if (!audioData || !isPlaying || isMuted || audioData.isQuiet) {
            return 1.1; // Default pulse size
        }
        
        // Map amplitude to a reasonable scale factor
        // Audio dB values are typically negative, where higher (less negative) means louder
        // Map from typical amplitude range (-60 to 0 dB) to scale factor (1.1 to 1.4)
        const minAmp = -60;
        const maxAmp = 0;
        const minScale = 1.1;
        const maxScale = 1.4;
        
        return minScale + ((audioData.amplitude - minAmp) / (maxAmp - minAmp)) * (maxScale - minScale);
    }, [audioData, isPlaying, isMuted]);
    
    // Helper function to parse color string into RGB components
    const parseColor = (colorStr: string) => {
        // For named colors, use a canvas to get RGB values
        if (!colorStr.startsWith('#') && !colorStr.startsWith('rgb')) {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if (!ctx) return { r: 0, g: 0, b: 0 };
            
            ctx.fillStyle = colorStr;
            ctx.fillRect(0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            return { r: data[0], g: data[1], b: data[2] };
        }
        
        // For hex colors
        if (colorStr.startsWith('#')) {
            const hex = colorStr.slice(1);
            const bigint = parseInt(hex, 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255
            };
        }
        
        // For rgb/rgba colors
        if (colorStr.startsWith('rgb')) {
            const values = colorStr.match(/\d+/g);
            if (!values || values.length < 3) return { r: 0, g: 0, b: 0 };
            return {
                r: parseInt(values[0]),
                g: parseInt(values[1]),
                b: parseInt(values[2])
            };
        }
        
        return { r: 0, g: 0, b: 0 }; // Default
    };
    
    // Convert RGB to HSL
    const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            
            h /= 6;
        }
        
        return { h: h * 360, s: s * 100, l: l * 100 };
    };
    
    // Convert HSL to RGB string
    const hslToColorString = (h: number, s: number, l: number, alpha = 1) => {
        return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${alpha})`;
    };

    // Dynamic color based on audio FFT data
    const dynamicColor = useMemo(() => {
        if (!audioData?.fftData || !isPlaying || isMuted) {
            return isMuted ? "gray" : color;
        }
        
        // Extract bass frequency information for color modulation
        // Low frequencies (bass) - First 1/5 of FFT data
        const bassEnd = Math.floor(audioData.fftData.length / 5);
        const bassAvg = Array.from(audioData.fftData.slice(0, bassEnd))
            .reduce((sum, val) => sum + val, 0) / bassEnd;
        
        // FFT data is in dB, typically negative values where higher (less negative) is louder
        // Scale to 0-1 range for color modulation
        const normalizeDb = (db: number) => Math.min(1, Math.max(0, (db + 60) / 60));
        
        // Use the base color but modulate its brightness or saturation based on frequencies
        if (isMuted) {
            return "gray";
        } else if (audioData.isQuiet) {
            return color; // Base color when quiet
        } else {
            // Parse the original color to get RGB values
            const rgb = parseColor(color);
            
            // Convert to HSL for easier manipulation
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            
            // Modify HSL values based on audio characteristics
            // Keep the original hue, but adjust saturation and lightness
            
            // Amplitude affects lightness - more amplitude = brighter
            const newLightness = Math.max(30, Math.min(70, 
                hsl.l + (audioData.amplitude + 60) / 60 * 20 - 10));
            
            // Bass affects saturation - more bass = more saturated
            const bassInfluence = normalizeDb(bassAvg);
            const newSaturation = Math.max(50, Math.min(100, 
                hsl.s + bassInfluence * 30));
            
            // Generate the new color as HSL
            return hslToColorString(hsl.h, newSaturation, newLightness);
        }
    }, [audioData, isPlaying, isMuted, color]);
    
    // Generate glow intensity based on audio amplitude
    const glowIntensity = useMemo(() => {
        if (!audioData || !isPlaying || isMuted) {
            return isDragging ? 15 : 10; // Default glow amounts
        }
        
        // Map amplitude to glow intensity
        // Higher (less negative) amplitude = stronger glow
        const baseGlow = isDragging ? 15 : 10;
        const amplitudeBoost = audioData.isQuiet ? 0 : Math.max(0, Math.min(20, (audioData.amplitude + 40) * 0.5));
        
        return baseGlow + amplitudeBoost;
    }, [audioData, isPlaying, isMuted, isDragging]);
    
    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                backgroundColor: dynamicColor,
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${xPos}px, ${yPos}px)`,
                cursor: isDragging ? "grabbing" : "grab",
                transition: isDragging ? "none" : "all 0.1s ease",
                opacity: opacity,
                zIndex: isDragging ? 10 : 1,
                boxShadow: isDragging 
                    ? `0 0 ${glowIntensity}px rgba(255, 255, 255, 0.6)` 
                    : (isPlaying && !isMuted) 
                        ? `0 0 ${glowIntensity}px ${color}, 0 0 ${glowIntensity * 2}px ${color}`
                        : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
                overflow: "visible",
                // Add a subtle internal gradient based on audio characteristics if available
                backgroundImage: (audioData && isPlaying && !isMuted && !audioData.isQuiet) 
                    ? `radial-gradient(circle at center, ${color} 0%, ${dynamicColor} 70%)`
                    : "none"
            }}
        >
            {/* Reactive waveform outline when playing */}
            {isPlaying && !isMuted && audioData && !audioData.isQuiet && wavePoints && (
                <div 
                    className="absolute inset-0"
                    style={{
                        overflow: "visible",
                    }}
                >
                    <svg 
                        width={circleSize * 1.6} 
                        height={circleSize * 1.6} 
                        viewBox="-0.8 -0.8 1.6 1.6"
                        style={{
                            position: "absolute",
                            top: `-${circleSize * 0.3}px`,
                            left: `-${circleSize * 0.3}px`,
                            pointerEvents: "none"
                        }}
                    >
                        <path
                            d={`M ${wavePoints[0].x},${wavePoints[0].y} ${
                                wavePoints.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
                            } Z`}
                            fill="none"
                            stroke={color}
                            strokeWidth="0.03"
                            strokeOpacity="0.8"
                            style={{
                                filter: "blur(2px)"
                            }}
                        />
                    </svg>
                </div>
            )}
            
            {/* Remove the CSS animated border and replace with waveform-driven animated border */}
            {isPlaying && !isMuted && (
                <>
                    {/* Replace the static animated border with dynamic waveform-driven borders */}
                    {audioData && !audioData.isQuiet && audioData.waveformData ? (
                        // Waveform-driven border when audio is active
                        <div className="absolute inset-0 overflow-visible">
                            <svg 
                                width={circleSize * 2.6} 
                                height={circleSize * 2.6} 
                                viewBox="-1.3 -1.3 2.6 2.6"
                                style={{
                                    position: "absolute",
                                    top: `-${circleSize * 0.8}px`,
                                    left: `-${circleSize * 0.8}px`,
                                    pointerEvents: "none"
                                }}
                            >
                                {/* Draw multiple waveform borders with different sizes and opacities */}
                                {[0.2, 0.4, 0.6].map((scale, index) => {
                                    // Sample points for this waveform ring
                                    const numPoints = 48;
                                    const waveformLength = audioData.waveformData!.length;
                                    const points = [];
                                    
                                    // Sample the waveform data at even intervals
                                    for (let i = 0; i < numPoints; i++) {
                                        const sampleIndex = Math.floor((i / numPoints) * waveformLength);
                                        const waveValue = audioData.waveformData![sampleIndex] || 0;
                                        
                                        // Scale the waveform to a reasonable range
                                        // Use different phase offsets for each ring to create more variation
                                        const phaseOffset = index * Math.PI / 3;
                                        const angle = (i / numPoints) * Math.PI * 2 + phaseOffset;
                                        
                                        // Base radius plus waveform variation
                                        // The multiplier controls how "wavy" the border is
                                        const waviness = 0.1 + (index * 0.05);
                                        const radius = 1 + scale + (waveValue * waviness);
                                        
                                        points.push({
                                            x: Math.cos(angle) * radius,
                                            y: Math.sin(angle) * radius
                                        });
                                    }
                                    
                                    // Create path from points
                                    const pathData = points.map((p, i) => 
                                        i === 0 
                                            ? `M ${p.x},${p.y}` 
                                            : `L ${p.x},${p.y}`
                                    ).join(" ") + " Z";
                                    
                                    return (
                                        <path
                                            key={index}
                                            d={pathData}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth="0.02"
                                            strokeOpacity={0.7 - (index * 0.2)}
                                            style={{
                                                filter: "blur(2px)"
                                            }}
                                        />
                                    );
                                })}
                            </svg>
                        </div>
                    ) : (
                        // Default pulsing border when no waveform data or audio is quiet
                        <div className="absolute inset-0 rounded-full" style={{
                            animation: isMuted ? "none" : `pulse 2s infinite`,
                            border: isMuted ? "none" : `2px solid ${color}`,
                            opacity: 0.6,
                            transform: `scale(${pulseAmplitude})`,
                        }}>
                        </div>
                    )}
                </>
            )}
            
            {/* FFT frequency visualizer (circular) */}
            {isPlaying && !isMuted && audioData?.fftData && !audioData.isQuiet && (
                <div 
                    className="absolute inset-0"
                    style={{
                        overflow: "visible",
                    }}
                >
                    <svg 
                        width={circleSize * 2} 
                        height={circleSize * 2} 
                        viewBox="-1 -1 2 2"
                        style={{
                            position: "absolute",
                            top: `-${circleSize * 0.5}px`,
                            left: `-${circleSize * 0.5}px`,
                            pointerEvents: "none",
                            transform: "rotate(-90deg)",
                            opacity: 0.7
                        }}
                    >
                        {/* Sample 32 points from the FFT data for visualization */}
                        {Array.from({ length: 32 }).map((_, i) => {
                            const angle = (i / 32) * Math.PI * 2;
                            const fftIndex = Math.floor((i / 32) * audioData.fftData!.length);
                            const value = audioData.fftData![fftIndex];
                            
                            // Normalize FFT data (typically in dB range like -100 to 0)
                            // where higher (less negative) values mean more energy at that frequency
                            const normalizedValue = Math.max(0, Math.min(1, (value + 100) / 100));
                            const barLength = 0.2 + normalizedValue * 0.5;
                            
                            // Calculate start and end points
                            const startX = Math.cos(angle) * 0.85;
                            const startY = Math.sin(angle) * 0.85;
                            const endX = Math.cos(angle) * (0.85 + barLength);
                            const endY = Math.sin(angle) * (0.85 + barLength);
                            
                            // Color based on frequency (hue rotation)
                            const hue = (i / 32) * 360;
                            
                            return (
                                <line
                                    key={i}
                                    x1={startX}
                                    y1={startY}
                                    x2={endX}
                                    y2={endY}
                                    stroke={`hsla(${hue}, 100%, 60%, 0.8)`}
                                    strokeWidth="0.02"
                                    style={{
                                        filter: "blur(1px)"
                                    }}
                                />
                            );
                        })}
                    </svg>
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
                    
                    {isPlaying && !isMuted && (
                        <SpeakerLoudIcon style={{
                            width: Math.max(10, circleSize * 0.2),
                            height: Math.max(10, circleSize * 0.2),
                            color: "#000",
                            // Fix the animation property conflict by using consistent properties
                            ...(audioData?.isQuiet
                                ? {
                                    animationName: "bounce",
                                    animationDuration: "1s",
                                    animationIterationCount: "infinite",
                                    animationDirection: "alternate",
                                    animationTimingFunction: "ease-in-out"
                                  }
                                : {
                                    animationName: "bounce",
                                    animationDuration: "0.3s",
                                    animationIterationCount: "infinite",
                                    animationDirection: "alternate",
                                    animationTimingFunction: "ease-in-out"
                                  }
                            )
                        }} />
                    )}
                </div>
            )}
            
            {/* Audio level meter (only visible when playing) */}
            {isPlaying && !isMuted && audioData && !audioData.isQuiet && (
                <div style={{
                    position: "absolute",
                    bottom: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    height: 3,
                    width: circleSize * 0.8,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    borderRadius: 2,
                    overflow: "hidden"
                }}>
                    <div style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, (audioData.amplitude + 60) / 60 * 100))}%`,
                        backgroundColor: color,
                        transition: "width 0.1s ease"
                    }} />
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