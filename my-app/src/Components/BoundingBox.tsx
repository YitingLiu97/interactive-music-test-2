"use client";
import React from "react";
import AudioCircle from "./AudioCircle";
import { useRef, useEffect, useState } from "react";
import AudioInterface from "./AudioInterface";
import { AudioControlRef } from "@/app/types/audioType";

interface AudioInfo {
  audioUrl: string;
  circleColor: string;
  instrumentName?: string;
}

export default function BoundingBox() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ x: 100, y: 100 });
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
        {audioRefsCreated &&
          audioInfos.map((info, index) => (
            <AudioCircle
              key={index}
              startPoint={{ x: 0.3 + index * 0.1, y: 0.3 }}
              boundingBox={size}
              audioUrl={info.audioUrl}
              color={info.circleColor}
              audioRef={audioRefs.current[index]}
              instrumentName={info.instrumentName}
              masterIsPlaying={isPlaying}
              onTrackSelect={() => {
                setCurrentTrack(info.instrumentName || `Track ${index + 1}`);
              }}
            />
          ))}
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