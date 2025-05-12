"use client";
import { useState, useEffect, useCallback } from "react";

export function useMicInput() {
  // get the device input
  // select the device
  // emits mediatstream intsnace

  const [mediaStream, setMediaStream] = useState<MediaStream | null>();
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState<number>(0);
  const [isPermissionGranted, setIsPermissionGranted] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

        const validIndex = Math.max(0, Math.min(index, audioDevices.length));
        const deviceId = audioDevices[validIndex]?.deviceId;

        if (!deviceId) {
          throw new Error("Invalid device ID");
        }

        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
        });
        setMediaStream(stream);
        setDeviceIndex(validIndex);
        return stream;
      } catch (error) {
        console.error("Error selecting audio device:", error);
        setError(`Failed to access audio device at index ${index}`);
        return null;
      }
    },
    [audioDevices, mediaStream, getAudioDevices]
  );


  useEffect(()=>{
    const initializeDevices = async()=>{
        await getAudioDevices();
        if (audioDevices.length> 0){
            await selectAudioDevice(deviceIndex);
        }
    }
    initializeDevices();

    navigator.mediaDevices.addEventListener("devicechange", getAudioDevices);

    return ()=>{
        if(mediaStream){
            mediaStream.getTracks().forEach(track => track.stop());

        }
        navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    }

  },[]);

  return {
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error,
    getAudioDevices,
    selectAudioDevice,
    setDeviceIndex: (index:number)=> selectAudioDevice(index)
  };
}
