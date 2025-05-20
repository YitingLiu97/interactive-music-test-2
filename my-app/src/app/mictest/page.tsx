"use client";
import { AudioRecordingManager } from "@/Components/AudioRecordingManager";
import { useState } from "react";
export default function MicTestPage() {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const handleRecordingComplete = () => {
    console.log("recording complete");
  };
  const handleRecordingUpdate = () => {
    console.log("recording updated");
  };
  const handleRecordingStart = () => {
    console.log("recording started");
  };

  const handleToggleVisibilty = () => {
    console.log("toggle visibility: " + isVisible);
    setIsVisible((prev) => !prev);
  };

  return (
    <div>
      <AudioRecordingManager
        width={300}
        height={800}
        loopDurationFromStem={30}
        onRecordingComplete={handleRecordingComplete}
        onRecordingUpdate={handleRecordingUpdate}
        onRecordingStart={handleRecordingStart}
        recordingSlot={null}
        toggleVisbiilty={handleToggleVisibilty}
        isVisible={isVisible}
      />
    </div>
  );
}
