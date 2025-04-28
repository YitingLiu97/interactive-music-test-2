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
interface AudioInfo {
  audioUrl: string;
  circleColor: string;
  instrumentName?: string;
}

export default function BoundingBox() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ x: 100, y: 100 });
  const [trapezoid, setTrapezoid] = useState<Trapezoid>({topLeftOffset:20, topWidth: 100});
  const [mounted, setMounted] = useState<boolean>(false);
  const [audioRefsCreated, setAudioRefsCreated] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  // Add current playback time tracking for UI
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(180); // Default 3 minutes
  const playbackTimerRef = useRef<number | null>(null);
  // Track if we're currently seeking to avoid timer updates
  const isSeekingRef = useRef(false);
  
  // Track which audio circle is being controlled by hand gestures
  const [activeHandCircleIndex, setActiveHandCircleIndex] = useState<number | null>(null);

  const audioInfos: AudioInfo[] = [
    {
      audioUrl: "/resources/ATCBaritoneGuitar_03.mp3",
      circleColor: "red",
      instrumentName: "BaritoneGuitar",
    },
    {
      audioUrl: "/resources/ATCBass_03.mp3",
      circleColor: "orange",
      instrumentName: "Bass",
    },
    {
      audioUrl: "/resources/ATCBGVocals_03.mp3",
      circleColor: "yellow",
      instrumentName: "BGVocals",
    },
    {
      audioUrl: "/resources/ATCDrums_03.mp3",
      circleColor: "green",
      instrumentName: "Drums",
    },
    {
      audioUrl: "/resources/ATCLeadVocals_03.mp3",
      circleColor: "teal",
      instrumentName: "LeadVocals",
    },
    {
      audioUrl: "/resources/ATCPedalSteel_03.mp3",
      circleColor: "blue",
      instrumentName: "PedalSteel",
    },
    {
      audioUrl: "/resources/ATCPiano_03.mp3",
      circleColor: "purple",
      instrumentName: "Piano",
    },
    {
      audioUrl: "/resources/ATCTimpani_03.mp3",
      circleColor: "pink",
      instrumentName: "Timpani",
    }
  ];

  // Initialize the refs array with the correct length first
  const audioRefs = useRef<React.RefObject<AudioControlRef | null>[]>(
    Array(audioInfos.length)
      .fill(null)
      .map(() => React.createRef<AudioControlRef>())
  );
  
  // Create refs for audio circle positions
  const audioCirclePositions = useRef<{x: number, y: number}[]>(
    Array(audioInfos.length)
      .fill(null)
      .map((_, index) => ({ 
        x: (0.3 + index * 0.1) * 100,  // Convert to percentage 
        y: 0.3 * 100 
      }))
  );

  // Hand detection gesture handlers
  // Hand detection gesture handlers
  const handleHandMove = useCallback((x: number, y: number) => {
    // When hand is open and moving, we just track it without affecting audio circles
    // This is just for visualization/feedback to the user
    
    // Find the closest audio circle to the hand position
    if (boxRef.current && activeHandCircleIndex === null) {
      const boxRect = boxRef.current.getBoundingClientRect();
      
      // Convert absolute coordinates to percentages
      const xPercent = ((x - boxRect.left) / boxRect.width) * 100;
      const yPercent = ((y - boxRect.top) / boxRect.height) * 100;
      
      // Check if hand is close enough to any circle to "highlight" it
      let closestDistance = Infinity;
      let closestIndex = -1;
      
      audioCirclePositions.current.forEach((pos, index) => {
        const distance = Math.sqrt(
          Math.pow(xPercent - pos.x, 2) + 
          Math.pow(yPercent - pos.y, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      // If hand is close enough to a circle, highlight it
      // This would be implemented in AudioCircle component
      if (closestDistance < 15) {  // 15% of container as threshold
        // We could set a state to highlight this circle
        setCurrentTrack(audioInfos[closestIndex].instrumentName || `Track ${closestIndex + 1}`);
      }
    }
  }, [activeHandCircleIndex, audioInfos]);
  
  const handleHandGrab = useCallback((x: number, y: number) => {
    // When hand makes grabbing gesture
    if (!boxRef.current) return;
    
    const boxRect = boxRef.current.getBoundingClientRect();
    
    // Convert absolute coordinates to percentages
    const xPercent = ((x - boxRect.left) / boxRect.width) * 100;
    const yPercent = ((y - boxRect.top) / boxRect.height) * 100;
    
    if (activeHandCircleIndex === null) {
      // Not currently dragging - find closest circle to grab
      let closestDistance = Infinity;
      let closestIndex = -1;
      
      audioCirclePositions.current.forEach((pos, index) => {
        const distance = Math.sqrt(
          Math.pow(xPercent - pos.x, 2) + 
          Math.pow(yPercent - pos.y, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      
      // If close enough to a circle, start dragging it
      if (closestDistance < 15) {  // 15% of container as threshold
        setActiveHandCircleIndex(closestIndex);
        setCurrentTrack(audioInfos[closestIndex].instrumentName || `Track ${closestIndex + 1}`);
      }
    } else {
      // Already dragging - update position of active circle
      // We'll update the position in audioCirclePositions ref
      // This will be synced to the actual AudioCircle components
      const newPositions = [...audioCirclePositions.current];
      
      // Apply boundaries to prevent going outside the bounding box
      const marginPercent = 10;
      const circleSize = 50; // Default circle size
      
      const minXPercent = marginPercent;
      const maxXPercent = 100 - (circleSize / boxRect.width) * 100 - marginPercent;
      
      const minYPercent = marginPercent;
      const maxYPercent = 100 - (circleSize / boxRect.height) * 100 - marginPercent;
      
      const boundedXPercent = Math.max(minXPercent, Math.min(xPercent, maxXPercent));
      const boundedYPercent = Math.max(minYPercent, Math.min(yPercent, maxYPercent));
      
      newPositions[activeHandCircleIndex] = {
        x: boundedXPercent,
        y: boundedYPercent
      };
      
      audioCirclePositions.current = newPositions;
      
      // Force a re-render to update circle positions
      setSize(prevSize => ({ ...prevSize }));
    }
  }, [activeHandCircleIndex, audioInfos]);
  
  const handleHandRelease = useCallback(() => {
    // When hand opens from grab, release the active circle
    setActiveHandCircleIndex(null);
  }, []);

  // Initialize hand detection
  const {
    isHandDetectionActive,
    toggleHandDetection,
    handPosition,
    isGrabbing,
    videoRef,
    canvasRef
  } = useHandDetection(boxRef, handleHandMove, handleHandGrab, handleHandRelease);

  // This useEffect will run only once after component mounts
  useEffect(() => {
    if(mounted && audioRefsCreated) return;
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
          topLeftOffset:rect.width*0.1,
          topWidth:rect.width*0.8
        })
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
    console.log("Playing all tracks", startTimeSeconds !== undefined ? `at ${startTimeSeconds}s` : "");
    
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
    
    console.log(`Successfully started ${successCount} of ${audioRefs.current.length} tracks`);
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
        console.log(`Seeking track: ${success ? 'success' : 'failed'}`);
      }
    });
    playAll();

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
      <div className="absolute top-4 right-4 z-100">
        <Button
          variant={isHandDetectionActive ? "solid" : "outline"}
          color={isHandDetectionActive ? "green" : "gray"}
          onClick={toggleHandDetection}
        >
          <VideoIcon /> {isHandDetectionActive ? "Disable" : "Enable"} Hand Control
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
            zIndex: 5,
          }}
        >
          <defs>
            <linearGradient id="trapezoidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.02)" />
            </linearGradient>
          </defs>
          <path 
            d={`M ${trapezoid.topLeftOffset} 0 L ${trapezoid.topLeftOffset + trapezoid.topWidth} 0 L ${size.x} ${size.y} L 0 ${size.y} Z`}
            fill="url(#trapezoidGradient)"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="2"
          />
        </svg>
        {audioRefsCreated &&
          audioInfos.map((info, index) => {
            // Get position from our ref to support hand movement
            const position = audioCirclePositions.current[index];
            
            return (
              <AudioCircle
                key={index}
                startPoint={{ 
                  x: position.x / 100, // Convert back to decimal for startPoint
                  y: position.y / 100 
                }}
                boundingBox={{x:size.x, y:size.y}}
                trapezoid={trapezoid}
                audioUrl={info.audioUrl}
                color={info.circleColor}
                audioRef={audioRefs.current[index]}
                instrumentName={info.instrumentName}
                masterIsPlaying={isPlaying}
                onTrackSelect={() => {
                  setCurrentTrack(info.instrumentName || `Track ${index + 1}`);
                }}
                isHandControlled={activeHandCircleIndex === index}
                onPositionChange={(xPercent, yPercent) => {
                  const newPositions = [...audioCirclePositions.current];
                  newPositions[index] = { x: xPercent, y: yPercent };
                  audioCirclePositions.current = newPositions;
                }}
              />
            );
          })}
        
        {/* Hand detection visualization overlay */}
        {isHandDetectionActive && (
          <>
            <video 
              ref={videoRef}
              className="absolute top-0 left-0 object-cover opacity-30 mirror-image"
              style={{ 
                width: "25%", 
                height: "25%",
                transform: "scaleX(-1)", // Mirror the video
                zIndex: 5,
                borderRadius: "0 0 8px 0",
                opacity: 0.2  // Make video semi-transparent
              }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 object-cover mirror-image"
              style={{ 
                width: "25%", 
                height: "25%",
                transform: "scaleX(-1)",  // Mirror the canvas
                zIndex: 6,
                borderRadius: "0 0 8px 0"
              }}
              width={640}
              height={480}
            />
            
            {/* Hand position indicator (optional) */}
            {handPosition && (
              <div
                className="absolute z-10 pointer-events-none"
                style={{
                  left: `${handPosition.x}px`,
                  top: `${handPosition.y}px`,
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: isGrabbing ? "rgba(255, 0, 0, 0.5)" : "rgba(0, 255, 0, 0.5)",
                  transform: "translate(-50%, -50%)",
                  boxShadow: `0 0 10px ${isGrabbing ? "red" : "green"}`
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Audio interface outside the bounding box */}
      <AudioInterface
        trackListName="Air Traffic - The Magician's Wife"
        authorName="Clara Berry and Wooldog"
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
          { id: "1", name: "Intro", startTime: 0, endTime: 30 },
          { id: "2", name: "Verse 1", startTime: 30, endTime: 60 },
          { id: "3", name: "Chorus", startTime: 60, endTime: 90 },
          { id: "4", name: "Verse 2", startTime: 90, endTime: 120 },
          { id: "5", name: "Bridge", startTime: 120, endTime: 150 },
          { id: "6", name: "Outro", startTime: 150, endTime: 180 },
        ]}
      />
      
    </div>
  );
}