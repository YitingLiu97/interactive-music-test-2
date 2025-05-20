"use client";
import React, { useCallback, useRef } from 'react';
import RecorderForAudioCircle from './RecorderForAudioCircle';
import { AudioInfo } from '@/app/types/audioType';

interface AudioRecordingManagerProps {
  width: number;
  height: number;
  loopDurationFromStem: number;
  onRecordingComplete: (audioInfo: AudioInfo) => void;
  onRecordingUpdate: (audioInfo: AudioInfo) => void;
  onRecordingStart: () => void;
  recordingSlot?: AudioInfo | null;
  toggleVisbiilty?: ()=>void ;
  isVisible: boolean;
}

export const AudioRecordingManager: React.FC<AudioRecordingManagerProps> = ({
  width,
  height,
  loopDurationFromStem,
  onRecordingUpdate,
  onRecordingComplete,
  onRecordingStart,
  recordingSlot, 
  toggleVisbiilty,
  isVisible
}) => {
console.log("🔧 AudioRecordingManager rendered with props:", {
    onRecordingComplete: typeof onRecordingComplete,
    onRecordingStart: typeof onRecordingStart,
    hasComplete: !!onRecordingComplete,
    hasStart: !!onRecordingStart,
    recordingSlot: recordingSlot?.id
  });
  const createdAudioInfoRef = useRef<AudioInfo| null>(null);

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

  const handleRecordingUpdate = useCallback((blobUrl: string) => {
    console.log("🎤 AudioRecordingManager: handleRecordingUpdate called with:", blobUrl);
    
    if (!blobUrl) {
      console.error("❌ AudioRecordingManager: No blob URL provided!");
      return;
    }
    if (!blobUrl.startsWith('blob:')) {
      console.error("❌ AudioRecordingManager: Invalid blob URL format:", blobUrl);
      return;
    }

    if (!createdAudioInfoRef.current) {
      console.error("❌ AudioRecordingManager: No audio info stored to update!");
      return;
    }

    const updatedAudioInfo: AudioInfo = {
      ...createdAudioInfoRef.current,
      audioUrl: blobUrl
    }

    console.log("🔄 AudioRecordingManager: Calling parent onRecordingUpdate with:", updatedAudioInfo);

    if (onRecordingUpdate && typeof onRecordingUpdate === 'function') {
      onRecordingUpdate(updatedAudioInfo);
      console.log("✅ AudioRecordingManager: Parent onRecordingUpdate executed");
    } else {
      console.error("❌ AudioRecordingManager: onRecordingUpdate is not a function:", typeof onRecordingComplete);
    }
  }, [onRecordingUpdate]);


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
      id: recordingSlot?.id || "vocal-recording", // Use existing ID if updating existing slot
      audioUrl: blobUrl,
      instrumentName: "Vocal Recording",
      circleColor: recordingSlot?.circleColor || "yellow",
      audioSource: 'recording',
      isRecording: false,
      position: { x: 200, y: 200 },
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
    <div className={isVisible ? 'audio-recording-manager  border-2 border-blue-200 p-2' : 'audio-recording-manager p-2'}>
         <div className='bg-red-400 overflow-y-scroll '>
          <div className={isVisible ? 'block' : 'hidden'} >
            <RecorderForAudioCircle
              width={width}
              height={height}
              loopDurationFromStem={loopDurationFromStem}
              onRecordingComplete={handleRecordingReady}
              onRecordingUpdated={handleRecordingUpdate}
              onRecordingStart={handleRecordingStart}
              />
          </div>
          </div>
    </div>
  );
};