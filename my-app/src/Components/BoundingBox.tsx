"use client";
import React from "react";
import AudioCircle from "./AudioCircle";
import { useRef, useEffect, useState, useCallback } from "react";
import AudioInterface from "./AudioInterface";
import { AudioControlRef } from "@/app/types/audioType";
import { useHandDetection } from "@/app/utils/useHandDetection";
import { Button } from "@radix-ui/themes";
import { VideoIcon } from "@radix-ui/react-icons";
import { Trapezoid } from "@/app/types/audioType";
import { AudioInfo, HandState } from "@/app/types/audioType";
import { AudioRecordingManager } from "./AudioRecordingManager";
export default function BoundingBox() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ x: 100, y: 100 });
  const [trapezoid, setTrapezoid] = useState<Trapezoid>({
    topLeftOffset: 20,
    topWidth: 100,
  });
  const [mounted, setMounted] = useState<boolean>(false);
  const [audioRefsCreated, setAudioRefsCreated] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Add current playback time tracking for UI
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(180); // Default 3 minutes
  const playbackTimerRef = useRef<number | null>(null);

  // Track if we're currently seeking to avoid timer updates
  const isSeekingRef = useRef(false);

  // Hand detection state
  const [handStates, setHandStates] = useState<Record<number, HandState>>({});

  // Thresholds and parameters for optimized hand detection
  const GRAB_THRESHOLD = 20; // % of container width/height - increased for easier grabbing
  const SMOOTHING_FACTOR = 0.3; // fraction of the distance to move per frame - increased for more responsive feel
  const MOVE_THRESHOLD = 0.1; // minimum percent change to bother updating - decreased for more sensitivity

  // Map to track which hand is controlling which circle
  const handToCircle = useRef<Record<number, number>>({});

  // Debounce timer ref for hand release events
  const releaseDebounceRef = useRef<Record<number, number>>({});
  const RELEASE_DEBOUNCE_TIME = 300; // ms to delay release to prevent accidental drops
  const raf = useRef<number | null>(null);

  const [audioInfos, setAudioInfos] = useState<AudioInfo[]>([
    {
      id: "erhu",
      audioUrl: "/resources/Justin/cx.ai_ Erhu_1.mp3",
      circleColor: "red",
      instrumentName: "Erhu",
      audioSource: "file",
    },
    {
      id: "forest",
      audioUrl: "/resources/Justin/cx.ai_ Forest_1.mp3",
      circleColor: "orange",
      instrumentName: "Forest",
      audioSource: "file",
    },
    {
      id: "main",
      audioUrl: "/resources/Justin/cx.ai_ Main_1.mp3",
      circleColor: "yellow",
      instrumentName: "Main",
      audioSource: "file",
    },
    {
      id: "xiao",
      audioUrl: "/resources/Justin/cx.ai_ Xiao_1.mp3",
      circleColor: "green",
      instrumentName: "Xiao",
      audioSource: "file",
    },
    {
      id: "xun",
      audioUrl: "/resources/Justin/cx.ai_ Xun_1.mp3",
      circleColor: "teal",
      instrumentName: "Xun",
      audioSource: "file",
    },
    {
      id: "zheng",
      audioUrl: "/resources/Justin/cx.ai_ Zheng_1.mp3",
      circleColor: "blue",
      instrumentName: "Zheng",
      audioSource: "file",
    }
  ]);

  // Initialize the refs array with the correct length first
  const audioRefs = useRef<React.RefObject<AudioControlRef | null>[]>(
    Array(audioInfos.length)
      .fill(null)
      .map(() => React.createRef<AudioControlRef>())
  );

  // Create refs for audio circle positions with initial staggered layout
  const audioCirclePositions = useRef<{ x: number; y: number }[]>(
    Array(audioInfos.length)
      .fill(null)
      .map((_, index) => ({
        x: (0.3 + index * 0.1) * 100, // Convert to percentage
        y: 0.3 * 100,
      }))
  );

  // Hand grab event handler - optimized version
  const handleHandGrab = useCallback(
    (handIdx: number, x: number, y: number, handedness: "Left" | "Right") => {
      if (!boxRef.current) return;

      console.log(`Hand ${handIdx} (${handedness}) grabbed at ${x},${y}`);

      // Update the hand state
      setHandStates((prev) => ({
        ...prev,
        [handIdx]: { x, y, handedness, grabbing: true },
      }));

      // Convert absolute coordinates to percentage within the box
      const { left, top, width, height } =
        boxRef.current.getBoundingClientRect();
      const rawPct = (x - left) / width;
      const xPct = rawPct * 100; // (1 - rawPct) * 100;
      const yPct = ((y - top) / height) * 100;

      // Clear any existing release debounce timer for this hand
      if (releaseDebounceRef.current[handIdx]) {
        window.clearTimeout(releaseDebounceRef.current[handIdx]);
        delete releaseDebounceRef.current[handIdx];
      }

      // Find the closest circle to grab
      let closestCircle = -1;
      let closestDistance = Infinity;

      audioCirclePositions.current.forEach((pos, idx) => {
        const distance = Math.hypot(xPct - pos.x, yPct - pos.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCircle = idx;
        }
      });

      // If we found a close enough circle, assign it to this hand
      if (closestDistance < GRAB_THRESHOLD) {
        // Check if this circle is already being controlled
        const existingController = Object.entries(handToCircle.current).find(
          ([, circleIdx]) => circleIdx === closestCircle
        );
        // If another hand is not controlling it, we take control
        if (!existingController) {
          handToCircle.current[handIdx] = closestCircle;
          setCurrentTrack(
            audioInfos[closestCircle].instrumentName ||
              `Track ${closestCircle + 1}`
          );
        }
      }
    },
    [handStates, audioInfos]
  );

  // Hand move event handler - optimized with smoothing
  const handleHandMove = useCallback(
    (handIdx: number, x: number, y: number, handedness: "Left" | "Right") => {
      // Update hand state regardless of whether we're controlling a circle
      setHandStates((prev) => {
        const state = prev[handIdx];
        return {
          ...prev,
          [handIdx]: {
            x,
            y,
            handedness,
            grabbing: state?.grabbing || false,
          },
        };
      });

      // If this hand isn't controlling a circle, exit early
      const circleIdx = handToCircle.current[handIdx];
      if (circleIdx === undefined || !boxRef.current) return;

      // Convert absolute coordinates to percentage within the box
      const { left, top, width, height } =
        boxRef.current.getBoundingClientRect();
      const xPct = ((x - left) / width) * 100;
      const yPct = ((y - top) / height) * 100;

      // Get the current position of the controlled circle
      const currentPos = audioCirclePositions.current[circleIdx];

      // Calculate the distance to move
      const dx = xPct - currentPos.x;
      const dy = yPct - currentPos.y;

      // Skip small movements for better performance
      if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD)
        return;

      // Apply smoothing factor to movement
      const newX = Math.max(
        0,
        Math.min(100, currentPos.x + dx * SMOOTHING_FACTOR)
      );
      const newY = Math.max(
        0,
        Math.min(100, currentPos.y + dy * SMOOTHING_FACTOR)
      );

      // Update the circle position
      audioCirclePositions.current[circleIdx] = { x: newX, y: newY };

      // Update audio parameters using the updatePosition method if available
      if (audioRefs.current[circleIdx].current?.updatePosition) {
        console.log("update position");
        audioRefs.current[circleIdx].current.updatePosition(newX, newY);
      }

      // Force re-render to reflect position changes
      if (!raf.current) {
        raf.current = requestAnimationFrame(() => {
          setSize((s) => ({ ...s }));
          raf.current = null;
        });
      }
    },
    []
  );

  // Hand release event handler - with debounce to prevent accidental drops
  const handleHandRelease = useCallback(
    (handIdx: number, handedness: "Left" | "Right") => {
      console.log(`Hand ${handIdx} (${handedness}) release detected`);

      // Check if this hand was controlling a circle
      if (handToCircle.current[handIdx] !== undefined) {
        // Set a debounce timer to delay the actual release
        releaseDebounceRef.current[handIdx] = window.setTimeout(() => {
          console.log(`Hand ${handIdx} (${handedness}) released`);

          // Update hand state
          setHandStates((prev) => {
            const state = prev[handIdx];
            if (!state) return prev;
            return {
              ...prev,
              [handIdx]: { ...state, grabbing: false, handedness },
            };
          });

          // Clear the hand-to-circle mapping
          delete handToCircle.current[handIdx];
          delete releaseDebounceRef.current[handIdx];

          // Reset current track if no other hands are controlling circles
          if (Object.keys(handToCircle.current).length === 0) {
            setCurrentTrack(null);
          }
        }, RELEASE_DEBOUNCE_TIME);
      } else {
        // Hand wasn't controlling anything, update state immediately
        setHandStates((prev) => {
          const state = prev[handIdx];
          if (!state) return prev;
          return {
            ...prev,
            [handIdx]: { ...state, grabbing: false, handedness },
          };
        });
      }
    },
    []
  );

  const handleHandLost = useCallback((handIdx: number) => {
    // 1) If that hand was controlling a circle, drop it immediately:
    if (handToCircle.current[handIdx] !== undefined) {
      // if no more hands are controlling anything, clear your track label
      if (Object.keys(handToCircle.current).length === 0) {
        setCurrentTrack(null);
      }
      delete handToCircle.current[handIdx];
    }

    // 2) Kill any pending release‐debounce for that hand:
    if (releaseDebounceRef.current[handIdx]) {
      clearTimeout(releaseDebounceRef.current[handIdx]);
      delete releaseDebounceRef.current[handIdx];
    }

    // 3) Remove it from your handStates entirely:
    setHandStates((prev) => {
      const next = { ...prev };
      delete next[handIdx];
      return next;
    });
  }, []);

  // Initialize hand detection
  const { isHandDetectionActive, toggleHandDetection, videoRef, canvasRef } =
    useHandDetection(
      boxRef,
      handleHandGrab,
      handleHandMove,
      handleHandRelease,
      handleHandLost
    );

  const handleRecordingComplete = useCallback((newAudioInfo: AudioInfo) => {
  console.log("🎉 BoundingBox: handleRecordingComplete called with:", newAudioInfo);
  setAudioInfos((prev) => {
      // Find if there's an existing recording slot
      const recordingIndex = prev.findIndex(
        (info) => info.isRecording && !info.audioUrl
      );

      if (recordingIndex >= 0) {
        // Replace the recording slot with actual recording
        const updated = [...prev];
        updated[recordingIndex] = newAudioInfo;
        console.log("📝 BoundingBox: Updated audioInfos from", prev.length, "to", updated.length);
        console.log("📝 BoundingBox: New audioInfos:", newAudioInfo);

        return updated;
      } else {
        // Add as new audio circle
        
        return [...prev, newAudioInfo];
      }
    });

    // Rebuild audio refs array
    rebuildAudioRefs();
  }, []);

  // Handle recording start
  const handleRecordingStart = useCallback(() => {
      console.log("🎬 BoundingBox: handleRecordingStart called");
      setCurrentTrack("Recording in progress...");
  }, []);

  // Method to rebuild audio refs when audioInfos changes
  const rebuildAudioRefs = useCallback(() => {
    console.log("📝 rebuildAudioRefs");

    audioRefs.current = audioInfos.map(() =>
      React.createRef<AudioControlRef>()
    );
    setAudioRefsCreated(false);
    setTimeout(() => setAudioRefsCreated(true), 100);
  }, [ audioInfos]);

  // Effect to handle audio infos changes
  useEffect(() => {
    rebuildAudioRefs();
  }, [audioInfos, rebuildAudioRefs]);

  // Cleanup function for debounce timers on unmount
  useEffect(() => {
    return () => {
      // Clear all release debounce timers
      Object.values(releaseDebounceRef.current).forEach((timerId) => {
        if (timerId) window.clearTimeout(timerId);
      });
    };
  }, []);

  // This useEffect will run only once after component mounts
  useEffect(() => {
    if (mounted && audioRefsCreated) return;
    setMounted(true);
    setAudioRefsCreated(true);
  }, []);

  // Update size when mounted or on resize
  useEffect(() => {
    function updateSize() {
      if (boxRef.current) {
        const rect = boxRef.current.getBoundingClientRect();
        setSize({
          x: rect.width,
          y: rect.height,
        });
        setTrapezoid({
          topLeftOffset: rect.width * 0.1,
          topWidth: rect.width * 0.8,
        });
      }
    }

    if (mounted) {
      updateSize();
      window.addEventListener("resize", updateSize);

      return () => {
        window.removeEventListener("resize", updateSize);
      };
    }
  }, [mounted]);

  // Get audio duration from first loaded track
  useEffect(() => {
    if (audioRefsCreated) {
      // Set a small delay to ensure audio has loaded
      const timeoutId = setTimeout(() => {
        for (const ref of audioRefs.current) {
          if (ref.current && ref.current.getDuration) {
            const duration = ref.current.getDuration();
            if (duration && duration > 0) {
              setTotalDuration(duration);
              console.log("Found audio duration:", duration);
              break;
            }
          }
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [audioRefsCreated]);

  // Start a timer to update current time when playing (UI only)
  useEffect(() => {
    // Clear any existing timer first to prevent multiple timers
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    // Only start timer when playing and not seeking
    if (isPlaying && !isSeekingRef.current) {
      // Use setTimeout to ensure this code runs AFTER the render completes
      const timerStartId = setTimeout(() => {
        // Update time every 100ms
        playbackTimerRef.current = window.setInterval(() => {
          // Don't update if actively seeking
          if (!isSeekingRef.current) {
            setCurrentTime((prevTime) => {
              // Loop back to start if we reach the end and looping is enabled
              if (prevTime >= totalDuration) {
                if (isLooping) {
                  // If looping, DON'T call pauseAll here - use an event handler approach instead
                  const newTime = 0;
                  // Use setTimeout to avoid calling state setters during render
                  setTimeout(() => {
                    // First update the time to 0
                    setCurrentTime(0);
                    // Then in another tick, restart playback
                    setTimeout(() => {
                      audioRefs.current.forEach((ref) => {
                        if (ref.current && ref.current.seekTo) {
                          ref.current.seekTo(0);
                        }
                      });
                    }, 20);
                  }, 0);
                  return newTime;
                } else {
                  // If not looping, use setTimeout to pause AFTER the render cycle completes
                  setTimeout(() => {
                    setIsPlaying(false);
                    audioRefs.current.forEach((ref) => {
                      if (ref.current && ref.current.pause) {
                        ref.current.pause();
                      }
                    });
                  }, 0);
                  return totalDuration;
                }
              }
              return prevTime + 0.1;
            });
          }
        }, 100);
      }, 0);

      return () => {
        clearTimeout(timerStartId);
        if (playbackTimerRef.current) {
          clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
      };
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, isLooping, totalDuration]);

  // Play all audio circles
  function playAll(startTimeSeconds?: number) {
    console.log(
      "Playing all tracks",
      startTimeSeconds !== undefined ? `at ${startTimeSeconds}s` : ""
    );

    setIsPlaying(true);
    setCurrentTrack("All instruments");

    // If time is specified, update UI time
    if (startTimeSeconds !== undefined) {
      setCurrentTime(startTimeSeconds);
    }

    // Call play on all audio circles
    let successCount = 0;
    audioRefs.current.forEach((ref) => {
      if (ref.current && ref.current.play) {
        // Pass the start time if specified
        const success = ref.current.play(startTimeSeconds);
        if (success) successCount++;
      }
    });

    console.log(
      `Successfully started ${successCount} of ${audioRefs.current.length} tracks`
    );
  }

  // Pause all audio circles
  function pauseAll() {
    console.log("Pausing all tracks");

    // Set UI state
    setIsPlaying(false);

    // Call pause on all audio circles
    audioRefs.current.forEach((ref) => {
      if (ref.current && ref.current.pause) {
        ref.current.pause();
      }
    });
  }

  // Improved seek function that forces playback after seeking
  function seekTo(timeInSeconds: number) {
    console.log(`Seeking to ${timeInSeconds}s`);

    // Mark that we're seeking to avoid timer updates
    isSeekingRef.current = true;

    // Update UI time immediately
    setCurrentTime(timeInSeconds);

    // Always pause first to avoid conflicts
    pauseAll();

    console.log("Paused all tracks, now seeking each track...");

    // First update all audio track positions
    audioRefs.current.forEach((ref) => {
      if (ref.current && ref.current.seekTo) {
        const success = ref.current.seekTo(timeInSeconds);
        console.log(`Seeking track: ${success ? "success" : "failed"}`);
      }
    });

    // 1) Stop everything first
    // audioRefs.current.forEach(r => r.current?.stop())

    // // 2) Jump each track to the right spot
    // audioRefs.current.forEach(r => r.current?.seekTo?.(timeSec))

    // // 3) Restart playback
    // audioRefs.current.forEach(r => {
    //   const ok = r.current?.play(timeInSeconds)
    //   // 4) Re-assert loop flag on each
    //   if (isLooping) {
    //     r.current?.setLooping?.(true)
    //   }
    //   r.current?.play()

    // })

    // 5) Update your UI
    // setCurrentTime(timeInSeconds)
    // setIsPlaying(true)

    // Start playback again
    playAll();

    if (isLooping) {
      audioRefs.current.forEach((ref) => {
        if (ref.current?.setLooping) {
          ref.current.setLooping(true);
        }
      });
    }

    // Use a small delay to ensure all tracks are properly positioned
    setTimeout(() => {
      // Start playback at the new position
      console.log("Starting playback at new position:", timeInSeconds);

      // Clear the seeking flag after everything is done
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 50);
    }, 50);
  }

  // Toggle loop state for all tracks
  function toggleAll() {
    const newLoopState = !isLooping;
    setIsLooping(newLoopState);

    audioRefs.current.forEach((ref) => {
      if (ref.current && ref.current.setLooping) {
        ref.current.setLooping(newLoopState);
      }
    });
  }



  // Apply position-based muting for all audio circles
  useEffect(() => {
    if (audioRefsCreated) {
      const timeoutId = setTimeout(() => {
        audioRefs.current.forEach((ref) => {
          if (ref.current && ref.current.applyPositionMuting) {
            ref.current.applyPositionMuting();
          }
        });
      }, 500);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [audioRefsCreated]);

  



  // Don't render anything on the server, only render on client
  if (!mounted) return null;


  return (
    <div className="flex flex-col h-screen w-screen">
      {/* Hand detection toggle button */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant={isHandDetectionActive ? "solid" : "outline"}
          color={isHandDetectionActive ? "green" : "gray"}
          onClick={toggleHandDetection}
        >
          <VideoIcon /> {isHandDetectionActive ? "Disable" : "Enable"} Hand
          Control
        </Button>
      </div>

      {/* Main bounding box for audio circles */}
      <div
        ref={boxRef}
        style={{
          width: "100%",
          height: "calc(100vh - 150px)", // Reserve space for audio interface
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#f0f0f0",
        }}
      >
        {/* Trapezoid shape overlay */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <defs>
            <linearGradient
              id="trapezoidGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
            </linearGradient>
          </defs>
          <path
            d={`M ${trapezoid.topLeftOffset} 0 L ${
              trapezoid.topLeftOffset + trapezoid.topWidth
            } 0 L ${size.x} ${size.y} L 0 ${size.y} Z`}
            fill="url(#trapezoidGradient)"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="2"
          />
          {!isHandDetectionActive && (
            <image
              href="/image/guilin-mountain.jpg"
              opacity="0.5"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
            />
          )}
        </svg>

        {audioRefsCreated &&
          audioInfos.map((info, index) => {
            // Get position from our ref to support hand movement
            const position = audioCirclePositions.current[index];

            // Check if this circle is being controlled by hand
            const isHandControlled = Object.values(
              handToCircle.current
            ).includes(index);

            return (
              <AudioCircle
                key={index}
                startPoint={{
                  x: position?.x / 100, // Convert back to decimal for startPoint
                  y: position?.y / 100,
                }}
                boundingBox={size}
                trapezoid={trapezoid}
                audioUrl={info.audioUrl!}
                color={info.circleColor}
                audioRef={audioRefs.current[index]}
                instrumentName={info.instrumentName}
                masterIsPlaying={isPlaying}
                onTrackSelect={() => {
                  setCurrentTrack(info.instrumentName || `Track ${index + 1}`);
                }}
                isHandControlled={isHandControlled}
                onPositionChange={(xPercent, yPercent) => {
                  const newPositions = [...audioCirclePositions.current];
                  newPositions[index] = { x: xPercent, y: yPercent };
                  audioCirclePositions.current = newPositions;
                }}
              />
            );
          })}

        {/* Hand detection status display */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            zIndex: 10,
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "8px",
            borderRadius: "4px",
            fontSize: "14px",
            display: isHandDetectionActive ? "block" : "none",
          }}
        >
          {Object.entries(handStates).map(([idx, { handedness, grabbing }]) => {
            const controllingCircleIdx = handToCircle.current[Number(idx)];
            const controllingInstrument =
              controllingCircleIdx !== undefined
                ? audioInfos[controllingCircleIdx].instrumentName
                : null;

            return (
              <div key={idx}>
                Hand {Number(idx) + 1}({handedness}):{" "}
                {grabbing ? "CLOSED PALM" : "OPEN PALM"}
                {controllingInstrument && grabbing && (
                  <span
                    style={{
                      color: audioInfos[controllingCircleIdx].circleColor,
                    }}
                  >
                    {" - controlling "}
                    {controllingInstrument}
                  </span>
                )}
              </div>
            );
          })}
          {Object.keys(handStates).length === 0 && "No hands detected"}
        </div>

        {/* Hand detection visualization overlay */}
        {isHandDetectionActive && (
          <>
            <video
              ref={videoRef}
              className="absolute top-0 left-0 object-cover opacity-30 mirror-image"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror the video
                zIndex: 0,
                borderRadius: "0 0 8px 0",
                opacity: 0.2, // Make video semi-transparent
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 object-cover mirror-image"
              style={{
                width: "100%",
                height: "100%",
                transform: "scaleX(-1)", // Mirror the canvas
                objectFit: "cover",
                zIndex: 1,
                pointerEvents: "none",
                borderRadius: "0 0 8px 0",
              }}
              width={640}
              height={480}
            />
          </>
        )}
      </div>
      
      <div className="flex flex-col left-0 top-0">
        <AudioRecordingManager
          width={300}
          height={2000}
          loopDurationFromStem={totalDuration}
          onRecordingComplete={handleRecordingComplete}
          onRecordingUpdate={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          recordingSlot={null}
        />
        {/* Audio interface outside the bounding box */}
        <AudioInterface
          setting={{ width: 1000, height: 150 }}
          trackListName="Chinese Instrumental"
          authorName="Justin Scholar 玉刻"
          onPlayAll={playAll}
          onPauseAll={pauseAll}
          onToggleAll={toggleAll}
          isPlaying={isPlaying}
          isLooping={isLooping}
          currentTrack={currentTrack}
          currentTime={currentTime}
          totalDuration={totalDuration}
          onSeekTo={seekTo}
          sections={[
            { id: "1", name: "Intro", startTime: 0, endTime: 3 },
            { id: "2", name: "Verse 1", startTime: 3, endTime: 8 },
            { id: "3", name: "Chorus", startTime: 8, endTime: 15 },
            { id: "4", name: "Verse 2", startTime: 15, endTime: 22 },
            { id: "5", name: "Bridge", startTime: 22, endTime: 30 },
            { id: "6", name: "Outro", startTime: 30, endTime: 38 },
          ]}
        />
      </div>
    </div>
  );
}
