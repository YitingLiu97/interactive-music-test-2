'use client'
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
import { mapRange } from "@/app/utils/math";
import CircleUI from "./CircleUI";
import { BoundingBox, AudioControlRef, StartPoint, Trapezoid } from "@/app/types/audioType";

type Props = {
    startPoint: StartPoint;
    boundingBox: BoundingBox;
    trapezoid: Trapezoid;
    audioUrl: string;
    instrumentName?: string;
    color: string;
    audioRef?: React.RefObject<AudioControlRef | null>;
    masterIsPlaying?: boolean;  // Control from parent
    onTrackSelect?: () => void; // Callback when circle is clicked
    isHandControlled?: boolean; // Flag when this circle is being controlled by hand
    onPositionChange?: (xPercent: number, yPercent: number) => void; // Callback to notify position changes
}

export default function AudioCircle({
    startPoint,
    boundingBox,
    trapezoid,
    audioUrl,
    color,
    audioRef,
    instrumentName,
    masterIsPlaying = false,
    onTrackSelect,
    isHandControlled = false,
    onPositionChange
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
    const marginPercent = 5; // Reduced margin to allow more movement space
    const silentVolume = -20;
    
    const initializedRef = useRef(false);
    const lastPlayingState = useRef(masterIsPlaying);
    
    // Use refs to track the last audio parameter values to avoid redundant updates
    const lastPanValue = useRef(0);
    const lastVolumeValue = useRef(0);
    
    // Track touch points for multi-touch support
    const activeTouchesRef = useRef<Record<string, { x: number, y: number }>>({});
    
    // Throttling for parameter updates during dragging to prevent audio buzzing
    const throttleTimerRef = useRef<number | null>(null);
    const pendingParamUpdateRef = useRef<{pan: number, volume: number} | null>(null);

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

    // Cleanup function for timers
    useEffect(() => {
        return () => {
            if (throttleTimerRef.current) {
                window.clearTimeout(throttleTimerRef.current);
                throttleTimerRef.current = null;
            }
        };
    }, []);

    // Calculate the width at a specific y position within the trapezoid
    const getWidthAtYPosition = (yPercent: number): { width: number, leftOffset: number, rightBoundary: number } => {
        if (!trapezoid) {
            return { 
                width: boundingBox.x, 
                leftOffset: 0,
                rightBoundary: boundingBox.x
            };
        }

        const { topWidth, topLeftOffset } = trapezoid;
        const yRatio = yPercent / 100;

        // Linear interpolation between top width and bottom width
        const width = topWidth + (boundingBox.x - topWidth) * yRatio;
        const leftOffset = topLeftOffset * (1 - yRatio);
        
        // Calculate the right boundary (important for proper containment)
        const rightBoundary = leftOffset + width;

        return { width, leftOffset, rightBoundary };
    };

    // Check if a position is within the trapezoid boundaries accounting for circle radius
    // const isWithinTrapezoid = (xPos: number, yPercent: number, circleSizeValue: number): boolean => {
    //     if (!trapezoid) {
    //         return true; // Always true for rectangular bounds
    //     }

    //     // Get trapezoid dimensions at this y position
    //     const { leftOffset, rightBoundary } = getWidthAtYPosition(yPercent);
        
    //     // Account for circle radius
    //     const circleRadius = circleSizeValue / 2;
        
    //     // Check if the circle is fully contained within the trapezoid
    //     return (
    //         xPos - circleRadius >= leftOffset + marginPercent && 
    //         xPos + circleRadius <= rightBoundary - marginPercent
    //     );
    // };

    // Calculate position based on the trapezoid shape
    const calculateTrapezoidPosition = (clientX: number, clientY: number) => {
        const container = document.querySelector('div[ref="boxRef"]')?.getBoundingClientRect() ||
            { left: 0, top: 0, width: boundingBox.x, height: boundingBox.y };
        
        // Calculate raw y position first (as percentage)
        const yPercent = ((clientY - container.top) / container.height) * 100;
        const boundedYPercent = Math.max(marginPercent, Math.min(yPercent, 
            100 - marginPercent - (circleSize / boundingBox.y) * 100));
        
        // Get trapezoid dimensions at this y position
        const { leftOffset, rightBoundary } = getWidthAtYPosition(boundedYPercent);
        
        // Calculate x position in pixels relative to container
        const absoluteX = clientX - container.left;
        
        // Ensure the circle stays within the trapezoid boundaries
        const circleRadius = circleSize / 2;
        const minX = leftOffset + circleRadius;//leftOffset + marginPercent + circleRadius;
        const maxX = rightBoundary - circleSize - marginPercent;
        
        // Clamp x position to stay within trapezoid
        const clampedX = Math.max(minX, Math.min(absoluteX, maxX));
        
        // Convert back to percentage for consistent state management
        const xPercent = (clampedX / boundingBox.x) * 100;
        
        return { xPercent, yPercent: boundedYPercent };
    };

    // Throttled audio parameter update function to prevent buzzing
    const updateAudioParams = useCallback((panValue: number, volumeValue: number) => {
        // Store the pending values in the ref
        pendingParamUpdateRef.current = { pan: panValue, volume: volumeValue };
        
        // If there's no active timer, set one up to apply the parameters
        if (!throttleTimerRef.current) {
            throttleTimerRef.current = window.setTimeout(() => {
                // Apply the most recent values from the ref
                if (pendingParamUpdateRef.current && loaded) {
                    const { pan, volume } = pendingParamUpdateRef.current;
                    
                    // Only update if values have changed significantly to avoid unnecessary updates
                    if (Math.abs(lastPanValue.current - pan) > 0.01) {
                        setPan(pan);
                        lastPanValue.current = pan;
                    }
                    
                    if (Math.abs(lastVolumeValue.current - volume) > 0.5) {
                        lastVolumeValue.current = volume;
                        setVolume(lastVolumeValue.current);
                    }
                }
                
                // Clear the timer and pending values
                throttleTimerRef.current = null;
                pendingParamUpdateRef.current = null;
            }, 20); // Throttle to max 50 updates per second
        }
    }, [loaded, setPan, setVolume]);

    // Expose methods to the parent component via ref
    useEffect(() => {
        if (audioRef && audioRef.current === null) {
            audioRef.current = {
                play: (startTime?: number) => {
                    if (loaded) {
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
                        // Get trapezoid dimensions at current y position
                        const { leftOffset, width } = getWidthAtYPosition(position.yPercent);
                        
                        // Calculate the equivalent percentage within the trapezoid
                        const xPosInPx = (position.xPercent / 100) * boundingBox.x;
                        
                        // Calculate relative position within the current trapezoid slice
                        // This maps the position to a value between 0 and 1 for the current slice width
                        const relativePos = (xPosInPx - leftOffset) / width;
                        
                        // Map to pan value (-1 to 1)
                        const panValue = (relativePos * 2) - 1;
                        
                        // Map volume from top to bottom
                        const volumeValue = mapRange(
                            position.yPercent, 
                            marginPercent, 
                            100 - marginPercent - (circleSize / boundingBox.y) * 100, 
                            silentVolume, 
                            0
                        );
                        
                        // Use direct parameter setting for initialization
                        setPan(panValue);
                        setVolume(volumeValue);
                        
                        // Update stored values
                        lastPanValue.current = panValue;
                        lastVolumeValue.current = volumeValue;
                    }
                }
            };
        }
    }, [
        audioRef, play, stop, pause, seekTo, toggleLoop, setLooping, getDuration, 
        loaded, setPan, setVolume, position, boundingBox, circleSize, marginPercent, 
        silentVolume
    ]);

    // Initial parameter setting and updates from position changes
    useEffect(() => {
        if (loaded && !dragging) {
            // Get trapezoid dimensions at current y position
            const { leftOffset, width } = getWidthAtYPosition(position.yPercent);
            
            // Calculate the x position in pixels
            const xPosInPx = (position.xPercent / 100) * boundingBox.x;
            
            // Calculate relative position within the current trapezoid slice
            const relativePos = (xPosInPx - leftOffset) / width;
            
            // Map to pan value (-1 to 1)
            const panValue = (relativePos * 2) - 1;
            
            // Map volume from top to bottom
            const volumeValue = mapRange(
                position.yPercent, 
                marginPercent, 
                100 - marginPercent - (circleSize / boundingBox.y) * 100, 
                silentVolume, 
                0
            );

            // Update audio parameters
            setPan(panValue);
            setVolume(volumeValue);
            
            // Store the values
            lastPanValue.current = panValue;
            lastVolumeValue.current = volumeValue;
        }
    }, [
        loaded, position.xPercent, position.yPercent, setPan, setVolume, 
        silentVolume, dragging, boundingBox, circleSize, marginPercent
    ]);

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
        // When mouse up, apply the final parameters immediately
        if (pendingParamUpdateRef.current && loaded) {
            const { pan, volume } = pendingParamUpdateRef.current;
            
            // Apply the final parameters directly
            setPan(pan);
            setVolume(volume);
            
            // Store the values in refs
            lastPanValue.current = pan;
            lastVolumeValue.current = volume;
            
            // Clear the pending update
            pendingParamUpdateRef.current = null;
        } else if (loaded) {
            // Get trapezoid dimensions at current y position
            const { leftOffset, width } = getWidthAtYPosition(position.yPercent);
            
            // Calculate the x position in pixels
            const xPosInPx = (position.xPercent / 100) * boundingBox.x;
            
            // Calculate relative position within the current trapezoid slice
            const relativePos = (xPosInPx - leftOffset) / width;
            
            // Map to pan value (-1 to 1)
            const panValue = (relativePos * 2) - 1;
            
            // Map volume from top to bottom
            const volumeValue = mapRange(
                position.yPercent, 
                marginPercent, 
                100 - marginPercent - (circleSize / boundingBox.y) * 100, 
                silentVolume, 
                0
            );
            
            // Force-apply final parameters
            setPan(panValue);
            setVolume(volumeValue);
            
            // Update stored values
            lastPanValue.current = panValue;
            lastVolumeValue.current = volumeValue;
        }
        
        // Clear any pending throttled updates
        if (throttleTimerRef.current) {
            window.clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
        }
        
        setDragging(false);
    }

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging || !boundingBox) return;
      
        // Calculate new position based on mouse coordinates and trapezoid shape
        const newPosition = calculateTrapezoidPosition(e.clientX, e.clientY);
        
        // Update the circle size based on vertical position (larger at bottom)
        const newCircleSize = mapRange(newPosition.yPercent, 0, 100, 20, 80);
        setCircleSize(newCircleSize);
      
        // Update position state for UI
        setPosition(newPosition);
        if (onPositionChange) {
            onPositionChange(newPosition.xPercent,newPosition.yPercent);
          }
        // Get trapezoid dimensions at the new y position
        const { leftOffset, width } = getWidthAtYPosition(newPosition.yPercent);
        
        // Calculate the x position in pixels
        const xPosInPx = (newPosition.xPercent / 100) * boundingBox.x;
        
        // Calculate relative position within the current trapezoid slice
        const relativePos = (xPosInPx - leftOffset) / width;
        
        // Map to pan value (-1 to 1)
        const panValue = (relativePos * 2) - 1;
        
        // Map volume from top to bottom
        const volumeValue = mapRange(
            newPosition.yPercent, 
            marginPercent, 
            100 - marginPercent - (newCircleSize / boundingBox.y) * 100, 
            silentVolume, 
            0
        );
        
        // Use the throttled update function for audio parameters during dragging
        updateAudioParams(panValue, volumeValue);
    }, [dragging, boundingBox, updateAudioParams, silentVolume, marginPercent, onPositionChange]);

    // Touch event handlers for multi-touch support
    const onTouchStart = useCallback((e: React.TouchEvent) => {
        e.stopPropagation();
        if (!loaded) return;
        
        setDragging(true);
        
        // Store all active touch points
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            activeTouchesRef.current[touch.identifier] = {
                x: touch.clientX,
                y: touch.clientY
            };
        }
        
        // Notify parent of track selection
        if (onTrackSelect) {
            onTrackSelect();
        }
    }, [loaded, onTrackSelect]);

    const onTouchMove = useCallback((e: TouchEvent) => {
        e.preventDefault(); // Prevent scrolling
        if (!dragging || !boundingBox) return;
        
        // Update positions for all touches
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            activeTouchesRef.current[touch.identifier] = {
                x: touch.clientX,
                y: touch.clientY 
            };
        }
        
        // Use the first touch to control this circle
        if (e.touches.length > 0) {
            const primaryTouch = e.touches[0];
            
            // Calculate new position based on touch coordinates
            const newPosition = calculateTrapezoidPosition(primaryTouch.clientX, primaryTouch.clientY);
            
            // Update the circle size based on vertical position
            const newCircleSize = mapRange(newPosition.yPercent, 0, 100, 20, 80);
            setCircleSize(newCircleSize);
            
            // Update position state for UI
            setPosition(newPosition);
            
            // Get trapezoid dimensions at the new y position
            const { leftOffset, width } = getWidthAtYPosition(newPosition.yPercent);
            
            // Calculate the x position in pixels
            const xPosInPx = (newPosition.xPercent / 100) * boundingBox.x;
            
            // Calculate relative position within the current trapezoid slice
            const relativePos = (xPosInPx - leftOffset) / width;
            
            // Map to pan value (-1 to 1)
            const panValue = (relativePos * 2) - 1;
            
            // Map volume from top to bottom
            const volumeValue = mapRange(
                newPosition.yPercent, 
                marginPercent, 
                100 - marginPercent - (newCircleSize / boundingBox.y) * 100, 
                silentVolume, 
                0
            );
            
            // Use the throttled update function for audio parameters during dragging
            updateAudioParams(panValue, volumeValue);
        }
    }, [dragging, boundingBox, updateAudioParams, silentVolume, marginPercent]);

    const onTouchEnd = useCallback((e: TouchEvent) => {
        // Remove ended touches from the active touches
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            delete activeTouchesRef.current[touch.identifier];
        }
        
        // If no touches remain, end the drag
        if (Object.keys(activeTouchesRef.current).length === 0) {
            onMouseUp(); // Reuse the same logic for finishing parameter updates
        }
    }, []);

    // Add and remove event listeners
    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
            window.addEventListener("touchmove", onTouchMove, { passive: false });
            window.addEventListener("touchend", onTouchEnd);
            window.addEventListener("touchcancel", onTouchEnd);
        }

        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("touchcancel", onTouchEnd);
        };
    }, [dragging, onMouseMove, onTouchMove, onTouchEnd]);

    // Function to calculate the actual position in pixels based on trapezoid
    const calculatePixelPosition = () => {
        if (!boundingBox) return { x: 0, y: 0 };
        
        // Calculate Y position
        const yPos = (position.yPercent * boundingBox.y) / 100;
        
        // Get X position directly from percentage
        const xPos = (position.xPercent * boundingBox.x) / 100;
        
        return { x: xPos, y: yPos };
    };

    return (
        <>
            <CircleUI
                xPercent={position.xPercent}
                yPercent={position.yPercent}
                pixelPosition={calculatePixelPosition()}
                circleSize={circleSize}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                isDragging={dragging || isHandControlled} // Consider hand control as dragging for visual feedback               
                boundingBox={boundingBox}
                color={color}
                opacity={position.yPercent / 100 + 0.2}
                instrumentName={instrumentName}
                isPlaying={masterIsPlaying}  // Use master playing state
                isMuted={isMuted}
                audioData={audioData}
                isHandControlled={isHandControlled} // Pass to CircleUI for visual feedback
            />

            <div
                style={{
                    position: 'absolute',
                    top: `${(position.yPercent * boundingBox.y) / 100 - 20}px`,
                    left: `${calculatePixelPosition().x + circleSize}px`,
                    backgroundColor: 'rgb(0,0,0)',
                    color: 'white',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    pointerEvents: 'none', 
                    display: (dragging || isHandControlled) ? 'block' : 'none'                }}
            >
                Vol: {currentVolume.toFixed(1)}dB | Pan: {currentPan.toFixed(2)}
            </div>
        </>
    );
}