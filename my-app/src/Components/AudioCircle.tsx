"use client";
import React, { useMemo,useEffect, useState, useRef, useCallback } from "react";
import { useAudioCircle } from "@/app/utils/useAudioCircle";
import { mapRange } from "@/app/utils/math";
import CircleUI from "./CircleUI";
import {
  BoundingBox,
  AudioControlRef,
  StartPoint,
} from "@/app/types/audioType";
import {
  FloorCoordinates,
  mapToFloor,
  mapFromFloor,
} from "./PerspectiveStageBackground";

type Props = {
  startPoint: StartPoint;
  boundingBox: BoundingBox;
  floorCoords: FloorCoordinates; // Add this prop
  audioUrl: string;
  instrumentName?: string;
  color: string;
  audioRef?: React.RefObject<AudioControlRef | null>;
  masterIsPlaying?: boolean; // Control from parent
  onTrackSelect?: () => void; // Callback when circle is clicked
};

export default function AudioCircle({
  startPoint,
  boundingBox,
  floorCoords,
  audioUrl,
  color,
  audioRef,
  instrumentName,
  masterIsPlaying = false,
  onTrackSelect,
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
    audioData,
  } = useAudioCircle(audioUrl);

  const [dragging, setDragging] = useState<boolean>(false);
  const [position, setPosition] = useState<{
    xPercent: number;
    yPercent: number;
  }>({
    xPercent: startPoint.x * 100,
    yPercent: startPoint.y * 100,
  });

  const [circleSize, setCircleSize] = useState<number>(50);
  const marginPercent = 10;
  const silentVolume = -20;

  const initializedRef = useRef(false);
  const lastPlayingState = useRef(masterIsPlaying);

  // Use refs to track the last audio parameter values to avoid redundant updates
  const lastPanValue = useRef(0);
  const lastVolumeValue = useRef(0);

  // Throttling for parameter updates during dragging to prevent audio buzzing
  const throttleTimerRef = useRef<number | null>(null);
  const pendingParamUpdateRef = useRef<{ pan: number; volume: number } | null>(
    null
  );
  const actualPosition = useMemo(() => {
    return mapToFloor(position.xPercent, position.yPercent, floorCoords);
  }, [position.xPercent, position.yPercent, floorCoords]);

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
    if (floorCoords && initializedRef.current) {
        // Use mapToFloor to position on the virtual floor
        const floorPosition = mapToFloor(
            startPoint.x,
            startPoint.y, 
            floorCoords
        );
        
        // Convert floor position to percentage
        const xPercent = (floorPosition.x / boundingBox.x) * 100;
        const yPercent = (floorPosition.y / boundingBox.y) * 100;
        
        // Update position
        setPosition({
            xPercent,
            yPercent
        });
    }
}, [floorCoords, startPoint.x, startPoint.y, boundingBox]);
  // Cleanup function for timers
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        window.clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  // Throttled audio parameter update function to prevent buzzing
  const updateAudioParams = useCallback(
    (panValue: number, volumeValue: number) => {
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
    },
    [loaded, setPan, setVolume]
  );

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
            const minXPercent = marginPercent;
            const maxXPercent =
              100 - (circleSize / boundingBox.x) * 100 - marginPercent;
            const minYPercent = marginPercent;
            const maxYPercent =
              100 - (circleSize / boundingBox.y) * 100 - marginPercent;

            const panValue = mapRange(
              position.xPercent,
              minXPercent,
              maxXPercent,
              -1,
              1
            );
            const volumeValue = mapRange(
              position.yPercent,
              minYPercent,
              maxYPercent,
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
        },
      };
    }
  }, [
    silentVolume,
    audioRef,
    play,
    stop,
    pause,
    seekTo,
    toggleLoop,
    setLooping,
    getDuration,
    loaded,
    setPan,
    setVolume,
    position,
    boundingBox,
    circleSize,
    marginPercent,
  ]);

  // Initial parameter setting and updates from position changes
  useEffect(() => {
    if (loaded && !dragging) {
      // Only update parameters on position changes when not actively dragging
      // (Dragging updates are handled separately in onMouseMove for better performance)
      const panValue = mapRange(position.xPercent, 0, 100, -1, 1);
      const volumeValue = mapRange(position.yPercent, 0, 100, silentVolume, 0);

      // Update without throttling for initial setup and non-drag updates
      setPan(panValue);
      setVolume(volumeValue);

      // Store the values
      lastPanValue.current = panValue;
      lastVolumeValue.current = volumeValue;
    }
  }, [
    loaded,
    position.xPercent,
    position.yPercent,
    setPan,
    setVolume,
    silentVolume,
    dragging,
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
      // If no pending updates, ensure current position values are applied
      const minXPercent = marginPercent;
      const maxXPercent =
        100 - (circleSize / boundingBox.x) * 100 - marginPercent;
      const minYPercent = marginPercent;
      const maxYPercent =
        100 - (circleSize / boundingBox.y) * 100 - marginPercent;

      const panValue = mapRange(
        position.xPercent,
        minXPercent,
        maxXPercent,
        -1,
        1
      );
      const volumeValue = mapRange(
        position.yPercent,
        minYPercent,
        maxYPercent,
        0,
        silentVolume
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

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !boundingBox) return;

      // Calculate new position based on mouse coordinates
      const container = document
        .querySelector('div[ref="boxRef"]')
        ?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: boundingBox.x,
        height: boundingBox.y,
      };

      const relativeX = e.clientX - container.left;
      const relativeY = e.clientY - container.top;

      const { normalX, normalY } = mapFromFloor(
        relativeX,
        relativeY,
        floorCoords
      );

      // Calculate position as percentage of container
      // Apply boundaries to prevent going outside the bounding box
      const minXPercent = marginPercent;
      const maxXPercent =
        100 - (circleSize / boundingBox.x) * 100 - marginPercent;

      const minYPercent = marginPercent;
      const maxYPercent =
        100 - (circleSize / boundingBox.y) * 100 - marginPercent;

      const boundedXPercent = Math.max(0, Math.min(1, normalX));
      const boundedYPercent = Math.max(0, Math.min(1, normalY));

      // Update the circle size based on vertical position
      const newCircleSize = mapRange(boundedYPercent, 0, 100, 20, 80);
      setCircleSize(newCircleSize);

      // Update position state for UI
      setPosition({
        xPercent: boundedXPercent,
        yPercent: boundedYPercent,
      });

      // Map position to audio parameters
      // Pan from left to right (-1 to 1)
      const panValue = mapRange(
        boundedXPercent,
        minXPercent,
        maxXPercent,
        -1,
        1
      );

      // Map volume from top to bottom (0dB to -60dB)
      const mappedVolume = mapRange(
        boundedYPercent,
        minYPercent,
        maxYPercent,
        silentVolume,
        0
      );

      // Use the throttled update function for audio parameters during dragging
      updateAudioParams(panValue, mappedVolume);
    },
    [
      silentVolume,
      dragging,
      boundingBox,
      floorCoords,
      marginPercent,
      circleSize,
      updateAudioParams,
    ]
  );

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseUp, dragging, onMouseMove]);

  return (
    <>
      <CircleUI
        xPercent={actualPosition.x}
         yPercent={actualPosition.y}
        circleSize={circleSize}
        onMouseDown={onMouseDown}
        isDragging={dragging}
        boundingBox={boundingBox}
        color={color}
        opacity={position.yPercent / 100 + 0.2}
        instrumentName={instrumentName}
        isPlaying={masterIsPlaying} // Use master playing state
        isMuted={isMuted}
        audioData={audioData}
      />

      <div
        style={{
          position: "absolute",
          top: `${actualPosition.y - 20}px`,
          left: `${actualPosition.x + circleSize}px`,
          backgroundColor: "rgb(0,0,0)",
          color: "white",
          padding: "2px 5px",
          borderRadius: "3px",
          fontSize: "10px",
          pointerEvents: "none",
          display: dragging ? "block" : "none",
        }}
      >
        Vol: {currentVolume.toFixed(1)}dB | Pan: {currentPan.toFixed(2)}
      </div>
    </>
  );
}
