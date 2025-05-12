"use client";
import { useState, useEffect, useCallback } from "react";

export function useMicInput() {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  const [isPermissionGranted, setIsPermissionGranted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Add a state to track the current device ID (not just the index)
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  const getAudioDevices = useCallback(async () => {
    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setIsPermissionGranted(true);
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );
      setAudioDevices(audioInputs);
      initialStream.getTracks().forEach((track) => track.stop());
      return audioInputs;
    } catch (error) {
      console.error("Error getting audio devices:", error);
      setError("Failed to access audio devices. Please check permissions.");
      return [];
    }
  }, []);

  const selectAudioDevice = useCallback(
    async (index: number) => {
      try {
        if (audioDevices?.length === 0) {
          const devices = await getAudioDevices();
          if (devices.length === 0) {
            throw new Error("No audio input devices available");
          }
        }

        const validIndex = Math.max(0, Math.min(index, audioDevices.length - 1));
        const currentDeviceId = audioDevices[validIndex]?.deviceId;

        if (!currentDeviceId) {
          throw new Error("Invalid device ID");
        }

        // Stop previous stream if it exists
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
        }

        // Create new stream with selected device
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: currentDeviceId } },
        });
        
        setMediaStream(stream);
        setDeviceIndex(validIndex);
        // Also update the deviceId state
        setDeviceId(currentDeviceId);
        
        console.log(`Selected device ${validIndex} with ID: ${currentDeviceId}`);
        
        return stream;
      } catch (error) {
        console.error("Error selecting audio device:", error);
        setError(`Failed to access audio device at index ${index}`);
        return null;
      }
    },
    [audioDevices, mediaStream, getAudioDevices]
  );

  useEffect(() => {
    const initializeDevices = async () => {
      const devices = await getAudioDevices();
      if (devices.length > 0) {
        await selectAudioDevice(0); // Start with first device
      }
    };
    
    initializeDevices();

    // Listen for device changes
    const handleDeviceChange = async () => {
      await getAudioDevices();
      // Don't automatically select a device here to avoid unexpected behavior
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  return {
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error,
    deviceId, // Now returning the actual deviceId string
    getAudioDevices,
    selectAudioDevice,
    setDeviceIndex: (index: number) => selectAudioDevice(index),
  };
}