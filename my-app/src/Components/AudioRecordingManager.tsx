"use client";
import React, { useCallback, useState } from 'react';
import RecorderForAudioCircle from './RecorderForAudioCircle';
import { AudioInfo } from '@/app/types/audioType';
import { Button } from '@radix-ui/themes';

interface AudioRecordingManagerProps {
  width: number;
  height: number;
  loopDurationFromStem: number;
  onRecordingComplete: (audioInfo: AudioInfo) => void;
  onRecordingStart: () => void;
  recordingSlot?: AudioInfo | null;
}

export const AudioRecordingManager: React.FC<AudioRecordingManagerProps> = ({
  width,
  height,
  loopDurationFromStem,
  onRecordingComplete,
  onRecordingStart,
  recordingSlot
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  // Simple toggle for visibility only
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  // Callback when recording produces a blob URL
  const handleRecordingReady = useCallback((blobUrl: string) => {
  console.log("🎤 Recording ready with blob URL:", blobUrl);
  
  if (!blobUrl) {
    console.error("❌ No blob URL provided!");
    return;
  }

   fetch(blobUrl)
    .then(response => {
      console.log("✅ Blob URL is accessible, size:", response.headers.get('content-length'));
      return response.blob();
    })
    .then(blob => {
      console.log("✅ Blob details:", {
        size: blob.size,
        type: blob.type
      });
    })
    .catch(error => {
      console.error("❌ Blob URL not accessible:", error);
    });


    const newAudioInfo: AudioInfo = {
      id: `vocal-recording-${Date.now()}`,
      audioUrl: blobUrl,
      instrumentName: "Vocal Recording",
      circleColor: recordingSlot?.circleColor || "yellow",
      audioSource: 'recording',
      isRecording: false,
      position: { x: 50, y: 50 },
      audioParams: { pan: 0, volume: 0 }
    };
  console.log("🔄 Calling onRecordingComplete with:", newAudioInfo);

    onRecordingComplete(newAudioInfo);
  }, [onRecordingComplete, recordingSlot]);

  return (
    <div className="audio-recording-manager">
      <Button
        color={isVisible ? "red" : "blue"}
        onClick={toggleVisibility}
        variant={isVisible ? "solid" : "outline"}
      >
        {isVisible ? 'Hide' : 'Show'} Audio Recorder
      </Button>
      
      {/* Animated container for smooth transitions */}

        <div className="pt-4">
          {/* Keep component mounted but control visibility */}
          <div className={isVisible ? 'block' : 'hidden'}>
            <RecorderForAudioCircle
              width={width}
              height={height}
              loopDurationFromStem={loopDurationFromStem}
              onRecordingComplete={handleRecordingReady}
              onRecordingStart={onRecordingStart}
              isVisible={isVisible} // Pass visibility state to recorder
            />
          </div>
        </div>
      </div>

  );
};