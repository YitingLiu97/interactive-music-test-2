'use client'
import React, { useEffect, useState, useRef, useCallback} from "react";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
import { mapRange } from "@/app/utils/math";
import CircleUI from "./CircleUI";
import * as Tone from "tone";
import { BoundingBox, AudioControlRef, StartPoint } from "@/app/types/audioType";

type Props = {
    startPoint: StartPoint;
    boundingBox: BoundingBox;
    audioUrl: string;
    instrumentName?: string;
    color: string;
    audioRef?: React.RefObject<AudioControlRef | null>;
    onPlay?: () => void;
    onStop?: () => void;
}

export default function AudioCircle({
    startPoint,
    boundingBox,
    audioUrl,
    color,
    audioRef,
    instrumentName,
    onPlay,
    onStop,
}: Props) {
    const {
        play,
        stop,
        pause,
        setPan,
        setVolume,
        loaded,
        toggleLoop,
        currentVolume,
        currentPan,
        isPlaying,
        isMuted
    } = useAudioCircle(audioUrl);

    const [dragging, setDragging] = useState<boolean>(false);
    const [position, setPosition] = useState<{ xPercent: number, yPercent: number }>({
        xPercent: startPoint.x * 100,
        yPercent: startPoint.y * 100
    });

    const [circleSize, setCircleSize] = useState<number>(50);
    const marginPercent = 10;
    const silentVolume = -60;

    const playerRef = useRef(false);
    const initializedRef = useRef(false);

    // Update position reference when playing state changes and notify parent
    useEffect(() => {
        playerRef.current = isPlaying;
        
        if (isPlaying && onPlay) {
            onPlay();
        } else if (!isPlaying && onStop) {
            onStop();
        }
    }, [isPlaying, onPlay, onStop]);

    // Fix for hydration issue - move dynamic updates to useEffect
    useEffect(() => {
        if (!initializedRef.current) {
            // Only set position once on initial render
            setPosition({
                xPercent: startPoint.x * 100,
                yPercent: startPoint.y * 100
            });
            initializedRef.current = true;
        }
    }, [startPoint.x, startPoint.y]);

    // Make sure Tone.js is properly initialized
    useEffect(() => {
        // Ensure Tone.js is started only once
        if (!Tone.context.state || Tone.context.state !== "running") {
            // Start Tone.js with user interaction to avoid autoplay restrictions
            const handleFirstInteraction = () => {
                Tone.start();
                window.removeEventListener('click', handleFirstInteraction);
            };
            window.addEventListener('click', handleFirstInteraction);
        }

        // Set playback rate to normal (1.0)
        if (Tone.Transport.bpm.value !== 120) {
            Tone.Transport.bpm.value = 120;
        }

        return () => {
            // Clean up event listeners and audio when component unmounts
            window.removeEventListener('click', () => Tone.start());
        };
    }, []);




// And in AudioCircle.tsx, update the useEffect for audioRef:
useEffect(() => {
    if (audioRef && 'current' in audioRef) {
        audioRef.current = {
            play: () => {
                // Make sure we don't call play multiple times
                if (!playerRef.current) {
                    Tone.start();
                    play();
                    playerRef.current = true;
                }
            },
            stop: () => {
                stop();
                playerRef.current = false;
            },
            pause: () => {
                pause();
                playerRef.current = false;
            },
            toggle: () => {
                toggleLoop();
            },
            // Apply muting based on current position
            applyPositionMuting: () => {
                const minXPercent = marginPercent;
                const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
                const minYPercent = marginPercent;
                const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;
                
                const panValue = mapRange(position.xPercent, minXPercent, maxXPercent, -1, 1);
                const volumeValue = mapRange(position.yPercent, minYPercent, maxYPercent, -30, 0);
                
                // Set pan value
                setPan(panValue);
                
                // Apply volume and enforce muting based on threshold
                setVolume(volumeValue);
            }
        };
    }
}, [audioRef, play, stop, pause, toggleLoop, position, boundingBox, circleSize, marginPercent, setPan, setVolume]); useEffect(() => {
        if (loaded) {
            const panValue = mapRange(position.xPercent, 0, 100, -1, 1);
            const volumeValue = mapRange(position.yPercent, 0, 100, silentVolume, 0);

            setPan(panValue);
            setVolume(volumeValue);
        }
    }, [loaded, position.xPercent, position.yPercent, setPan, setVolume]);

    function onMouseDown(e: React.MouseEvent) {
        e.stopPropagation();
        if (!loaded) return;

        setDragging(true);

        // Only start playing if not already playing
        if (!playerRef.current) {
            Tone.start();
            play();
            playerRef.current = true;
        }
    }

    function onMouseUp() {
        setDragging(false);
    }

    function onMouseMove(e: MouseEvent) {
        if (!dragging || !boundingBox) return;
    
        // Calculate new position based on mouse coordinates
        const container = document.querySelector('div[ref="boxRef"]')?.getBoundingClientRect() ||
            { left: 0, top: 0, width: boundingBox.x, height: boundingBox.y };
    
        // Calculate position as percentage of container
        const newXPercent = ((e.clientX - container.left) / container.width) * 100;
        const newYPercent = ((e.clientY - container.top) / container.height) * 100;
    
        // Apply boundaries to prevent going outside the bounding box
        // or into the audio interface area
        const minXPercent = marginPercent;
        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
        
        const minYPercent = marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;
    
        const boundedXPercent = Math.max(minXPercent, Math.min(newXPercent, maxXPercent));
        const boundedYPercent = Math.max(minYPercent, Math.min(newYPercent, maxYPercent));
    
        // Update the circle size based on vertical position (smaller as it goes up)
        const newCircleSize = mapRange(boundedYPercent, 0, 100, 20, 80);
        setCircleSize(newCircleSize);
    
        // FIXED MAPPING: Map from the actual available range to full -1 to 1 range
        // This ensures the full pan range is utilized within the constrained area
        const panValue = mapRange(boundedXPercent, minXPercent, maxXPercent, -1, 1);
        
        // Volume mapping (similarly adjusted to use full range)
        const mappedVolume = mapRange(boundedYPercent, minYPercent, maxYPercent, -30, 0);
        
        console.log("mappedVolume value is " + mappedVolume);
        console.log("panValue is " + panValue + " (position: " + boundedXPercent.toFixed(1) + "%)");
    
        setPosition({
            xPercent: boundedXPercent,
            yPercent: boundedYPercent
        });
      
        setPan(panValue);
        setVolume(mappedVolume);
    }


    const mapAudioParams = useCallback(() => {
        if (!boundingBox) return { panValue: 0, volumeValue: 0 };
        
        // Calculate the constrained movement area
        const minXPercent = marginPercent;
        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
        
        const minYPercent = marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;
        
        // Map current position to full parameter ranges
        const panValue = mapRange(position.xPercent, minXPercent, maxXPercent, -1, 1);
        const volumeValue = mapRange(position.yPercent, minYPercent, maxYPercent, -30, 0);
        
        return { panValue, volumeValue };
    }, [position, boundingBox, circleSize, marginPercent]);
    
    // Function to update audio parameters
    const updateAudioParams = useCallback(() => {
        if (!loaded || !boundingBox) return;
        
        const { panValue, volumeValue } = mapAudioParams();
        
        console.log(`Updating after resize - Pan: ${panValue.toFixed(2)}, Volume: ${volumeValue.toFixed(1)} dB`);
        
        setPan(panValue);
        setVolume(volumeValue);
    }, [loaded, mapAudioParams, setPan, setVolume]);
    
    // Effect to handle boundary box changes (including resize)
    useEffect(() => {
        if (loaded && boundingBox) {
            console.log("Bounding box changed:", boundingBox);
            updateAudioParams();
        }
    }, [loaded, boundingBox, updateAudioParams]);
    
    // Optional: Also add this to your existing effect that initializes parameters after loading
    useEffect(() => {
        if (loaded) {
            updateAudioParams();
        }
    }, [loaded, updateAudioParams]);

    // Reference to the bounding box element
    const boxRef = useRef<HTMLDivElement | null>(null);

    // Find and store reference to the bounding box after mount
    useEffect(() => {
        boxRef.current = document.querySelector('[ref="boxRef"]');
    }, []);

    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging, onMouseMove]); // Add dragging as a dependency to re-attach listeners when it changes

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
                instrumentName={instrumentName}
                isPlaying={isPlaying}
                isMuted={isMuted}
            />

            <div
                style={{
                    position: 'absolute',
                    top: `${(position.yPercent * boundingBox.y) / 100 - 20}px`,
                    left: `${(position.xPercent * boundingBox.x) / 100 + circleSize}px`,
                    backgroundColor: 'rgb(0,0,0)',
                    color: 'white',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    pointerEvents: 'none', // Don't interfere with mouse events
                    display: dragging ? 'block' : 'none' // Only show when dragging
                }}
            >
                Vol: {currentVolume.toFixed(1)}dB | Pan: {currentPan.toFixed(2)}
            </div>
        </>
    );
}