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

  // Add current playback time tracking
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(180); // Default 3 minutes
  const playbackTimerRef = useRef<number | null>(null);

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
    },
    // {
    //     audioUrl: "/resources/ATCTwoMix_03.L.mp3",
    //     circleColor: "blue",
    //     instrumentName: "Mix_L"
    // },
    // {
    //     audioUrl: "/resources/ATCTwoMix_03.R.mp3",
    //     circleColor: "blue",
    //     instrumentName: "Mix_R"
    // }
  ];

  // Initialize the refs array with the correct length first
  const audioRefs = useRef<React.RefObject<AudioControlRef | null>[]>(
    Array(audioInfos.length)
      .fill(null)
      .map(() => React.createRef<AudioControlRef>())
  );
  // Start a timer to update current time when playing
  useEffect(() => {
    if (isPlaying) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }

      // Update time every 100ms (10 times per second)
      playbackTimerRef.current = window.setInterval(() => {
        setCurrentTime((prevTime) => {
          // Loop back to start if we reach the end and looping is enabled
          if (prevTime >= totalDuration) {
            if (isLooping) {
              return 0;
            } else {
              pauseAll();
              return totalDuration;
            }
          }
          return prevTime + 0.1;
        });
      }, 100);
    } else {
      // Clear the timer if not playing
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    // Clean up on unmount
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, isLooping, totalDuration]);

  // This useEffect will run only once after component mounts
  useEffect(() => {
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
        console.log("Size updated:", rect.width, rect.height - 150);
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

  // Start a timer to update current time when playing
  useEffect(() => {
    if (isPlaying) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }

      // Update time every 100ms (10 times per second)
      playbackTimerRef.current = window.setInterval(() => {
        setCurrentTime((prevTime) => {
          // Loop back to start if we reach the end and looping is enabled
          if (prevTime >= totalDuration) {
            if (isLooping) {
              return 0;
            } else {
              pauseAll();
              return totalDuration;
            }
          }
          return prevTime + 0.1;
        });
      }, 100);
    } else {
      // Clear the timer if not playing
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    // Clean up on unmount
    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, isLooping, totalDuration]);

  // In BoundingBox.tsx
  function playAll() {
    console.log("Play all triggered, refs:", audioRefs.current.length);
    // First, start all tracks playing - they'll all play simultaneously
    audioRefs.current.forEach((ref, index) => {
      if (ref.current && ref.current.play) {
        console.log(`Playing track ${index}`);
        ref.current.play();
      } else {
        console.log(`Ref ${index} is not ready`);
      }
    });
    setIsPlaying(true);
    setCurrentTrack("All instruments");
  }

  // Handle seeking to a specific time
  function seekTo(timeInSeconds: number) {
    // Set the current time
    setCurrentTime(timeInSeconds);

    // If currently playing, stop all tracks first
    if (isPlaying) {
      pauseAll();
    }

    // Then start playing from the new position
    // Note: In a real implementation, you would need to set the start position
    // in the audio player before playing. Since Tone.js doesn't support direct seeking,
    // you would typically need to create a new player or use other techniques.
    playAll();
  }

  // create setTimeOut
  useEffect(() => {
    // Store the timeout ID so we can clear it if needed
    const timeoutId = setTimeout(() => {
      audioRefs.current.forEach((ref) => {
        if (ref.current && ref.current.applyPositionMuting) {
          ref.current.applyPositionMuting();
        }
      });
    }, 50);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  function pauseAll() {
    console.log("Pause all triggered");
    audioRefs.current.forEach((ref, index) => {
      if (ref.current && ref.current.stop) {
        console.log(`Stopping track ${index}`);
        ref.current.stop();
      }
    });
    setIsPlaying(false);
  }

  function toggleAll() {
    console.log("Toggle loop triggered");
    audioRefs.current.forEach((ref, index) => {
      if (ref.current && ref.current.toggle) {
        console.log(`Toggling loop for track ${index}`);
        ref.current.toggle();
      }
    });
    setIsLooping(!isLooping);
  }

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
              onPlay={() => {
                setIsPlaying(true);
                setCurrentTrack(info.instrumentName || `Track ${index + 1}`);
              }}
              onStop={() => {
                setIsPlaying(false);
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
