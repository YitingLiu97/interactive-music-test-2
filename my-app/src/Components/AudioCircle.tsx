'use client'
import React, { useEffect, useState, useRef, useCallback} from "react";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
import { mapRange } from "@/app/utils/math";
import CircleUI from "./CircleUI";
import { BoundingBox, AudioControlRef, StartPoint } from "@/app/types/audioType";

type Props = {
    startPoint: StartPoint;
    boundingBox: BoundingBox;
    audioUrl: string;
    instrumentName?: string;
    color: string;
    audioRef?: React.RefObject<AudioControlRef | null>;
    masterIsPlaying?: boolean;  // Control from parent
    onTrackSelect?: () => void; // Callback when circle is clicked
}

export default function AudioCircle({
    startPoint,
    boundingBox,
    audioUrl,
    color,
    audioRef,
    instrumentName,
    masterIsPlaying = false,
    onTrackSelect
}: Props) {
    const {
        play,
        stop,
        pause,
        seekTo,
        setPan,
        setVolume,
        toggleLoop,
        setLooping,
        getDuration,
        loaded,
        isPlaying,
        currentVolume,
        currentPan,
        isMuted,
        audioData
    } = useAudioCircle(audioUrl);

    const [dragging, setDragging] = useState<boolean>(false);
    const [position, setPosition] = useState<{ xPercent: number, yPercent: number }>({
        xPercent: startPoint.x * 100,
        yPercent: startPoint.y * 100
    });

    const [circleSize, setCircleSize] = useState<number>(50);
    const marginPercent = 10;
    const silentVolume = -60;
    
    const initializedRef = useRef(false);
    const lastPlayingState = useRef(masterIsPlaying);

    // Respond to parent play/pause state changes
    useEffect(() => {
        if (loaded && masterIsPlaying !== lastPlayingState.current) {
            lastPlayingState.current = masterIsPlaying;
            
            if (masterIsPlaying && !isPlaying) {
                play();
            } else if (!masterIsPlaying && isPlaying) {
                pause();
            }
        }
    }, [masterIsPlaying, isPlaying, loaded, play, pause]);

    // Fix for hydration issue
    useEffect(() => {
        if (!initializedRef.current) {
            setPosition({
                xPercent: startPoint.x * 100,
                yPercent: startPoint.y * 100
            });
            initializedRef.current = true;
        }
    }, [startPoint.x, startPoint.y]);

    // Expose methods to the parent component via ref
    useEffect(() => {
        if (audioRef && audioRef.current === null) {
            audioRef.current = {
                play: (startTime?: number) => {
                    if (loaded) {
                        console.log("AUDIO CIRCLE audio ref play at "+startTime);
                        return play(startTime);
                    }
                    return false;
                },
                stop: () => {
                    return stop();
                },
                pause: () => {
                    return pause();
                },
                toggle: () => {
                    toggleLoop();
                },
                seekTo: (timeInSeconds: number) => {
                    if (seekTo) {
                        console.log("seek to "+timeInSeconds);
                        return seekTo(timeInSeconds);
                    }
                    return false;
                },
                setLooping: (loopState: boolean) => {
                    if (setLooping) {
                        setLooping(loopState);
                    }
                },
                getDuration: () => {
                    if (getDuration) {
                        return getDuration();
                    }
                    return 180; // Default duration
                },
                applyPositionMuting: () => {
                    if (loaded) {
                        const minXPercent = marginPercent;
                        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
                        const minYPercent = marginPercent;
                        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;
                        
                        const panValue = mapRange(position.xPercent, minXPercent, maxXPercent, -1, 1);
                        const volumeValue = mapRange(position.yPercent, minYPercent, maxYPercent, -30, 0);
                        
                        setPan(panValue);
                        setVolume(volumeValue);
                    }
                }
            };
        }
    }, [audioRef, play, stop, pause, seekTo, toggleLoop, setLooping, getDuration, loaded, setPan, setVolume, position, boundingBox, circleSize, marginPercent]);

    // Update audio parameters when position or loaded state changes
    useEffect(() => {
        if (loaded) {
            const panValue = mapRange(position.xPercent, 0, 100, -1, 1);
            const volumeValue = mapRange(position.yPercent, 0, 100, silentVolume, 0);

            setPan(panValue);
            setVolume(volumeValue);
        }
    }, [loaded, position.xPercent, position.yPercent, setPan, setVolume, silentVolume]);

    function onMouseDown(e: React.MouseEvent) {
        e.stopPropagation();
        if (!loaded) return;

        setDragging(true);
        
        // Notify parent of track selection
        if (onTrackSelect) {
            onTrackSelect();
        }
    }

    function onMouseUp() {
        setDragging(false);
    }

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging || !boundingBox) return;
    
        // Calculate new position based on mouse coordinates
        const container = document.querySelector('div[ref="boxRef"]')?.getBoundingClientRect() ||
            { left: 0, top: 0, width: boundingBox.x, height: boundingBox.y };
    
        // Calculate position as percentage of container
        const newXPercent = ((e.clientX - container.left) / container.width) * 100;
        const newYPercent = ((e.clientY - container.top) / container.height) * 100;
    
        // Apply boundaries to prevent going outside the bounding box
        const minXPercent = marginPercent;
        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - marginPercent;
        
        const minYPercent = marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;
    
        const boundedXPercent = Math.max(minXPercent, Math.min(newXPercent, maxXPercent));
        const boundedYPercent = Math.max(minYPercent, Math.min(newYPercent, maxYPercent));
    
        // Update the circle size based on vertical position
        const newCircleSize = mapRange(boundedYPercent, 0, 100, 20, 80);
        setCircleSize(newCircleSize);
    
        // Map position to audio parameters
        const panValue = mapRange(boundedXPercent, minXPercent, maxXPercent, -1, 1);
        const mappedVolume = mapRange(boundedYPercent, minYPercent, maxYPercent, -30, 0);
    
        setPosition({
            xPercent: boundedXPercent,
            yPercent: boundedYPercent
        });
      
        setPan(panValue);
        setVolume(mappedVolume);
    }, [dragging, boundingBox, marginPercent, circleSize, setPan, setVolume]);

    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging, onMouseMove]); 

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
                isPlaying={masterIsPlaying}  // Use master playing state
                isMuted={isMuted}
                audioData={audioData}
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
                    pointerEvents: 'none', 
                    display: dragging ? 'block' : 'none'
                }}
            >
                Vol: {currentVolume.toFixed(1)}dB | Pan: {currentPan.toFixed(2)}
            </div>
        </>
    );
}