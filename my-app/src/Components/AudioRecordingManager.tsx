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
  console.log("🔧 AudioRecordingManager rendered with props:", {
    onRecordingComplete: typeof onRecordingComplete,
    onRecordingStart: typeof onRecordingStart,
    hasComplete: !!onRecordingComplete,
    hasStart: !!onRecordingStart
  });

  const [isVisible, setIsVisible] = useState<boolean>(false);

  const toggleVisibility = useCallback(() => {
    console.log("👁️ Toggling visibility from", isVisible, "to", !isVisible);
    setIsVisible(prev => !prev);
  }, [isVisible]);

  // Wrap the callbacks with debugging
  const handleRecordingStart = useCallback(() => {
    console.log("🎬 AudioRecordingManager: handleRecordingStart called");
    if (onRecordingStart && typeof onRecordingStart === 'function') {
      onRecordingStart();
      console.log("✅ AudioRecordingManager: onRecordingStart callback executed");
    } else {
      console.error("❌ AudioRecordingManager: onRecordingStart is not a function:", typeof onRecordingStart);
    }
  }, [onRecordingStart]);

  const handleRecordingReady = useCallback((blobUrl: string) => {
    console.log("🎤 AudioRecordingManager: handleRecordingReady called with:", blobUrl);
    
    if (!blobUrl) {
      console.error("❌ AudioRecordingManager: No blob URL provided!");
      return;
    }

    // Validate the blob URL
    if (!blobUrl.startsWith('blob:')) {
      console.error("❌ AudioRecordingManager: Invalid blob URL format:", blobUrl);
      return;
    }

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

    console.log("🔄 AudioRecordingManager: Calling parent onRecordingComplete with:", newAudioInfo);
    
    if (onRecordingComplete && typeof onRecordingComplete === 'function') {
      onRecordingComplete(newAudioInfo);
      console.log("✅ AudioRecordingManager: Parent onRecordingComplete executed");
    } else {
      console.error("❌ AudioRecordingManager: onRecordingComplete is not a function:", typeof onRecordingComplete);
    }
  }, [onRecordingComplete, recordingSlot]);

  return (
    <div className="audio-recording-manager border-2 border-blue-200 p-2">
      <div className="text-xs bg-blue-100 p-2 mb-2 rounded">
        AudioRecordingManager Debug - Visible: {isVisible.toString()}
      </div>
      
      <Button
        color={isVisible ? "red" : "blue"}
        onClick={toggleVisibility}
        variant={isVisible ? "solid" : "outline"}
      >
        {isVisible ? 'Hide' : 'Show'} Audio Recorder
      </Button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isVisible 
            ? 'max-h-96 opacity-100 transform translate-y-0' 
            : 'max-h-0 opacity-0 transform -translate-y-2'
        }`}
      >
        <div className="pt-4">
          <div className={isVisible ? 'block' : 'hidden'}>
            <RecorderForAudioCircle
              width={width}
              height={height}
              loopDurationFromStem={loopDurationFromStem}
              onRecordingComplete={handleRecordingReady}
              onRecordingStart={handleRecordingStart}
              isVisible={isVisible}
            />
          </div>
        </div>
      </div>
    </div>
  );
};