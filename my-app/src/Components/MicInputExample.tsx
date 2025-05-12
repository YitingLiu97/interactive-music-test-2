'use client';
import React, { useEffect, useState } from 'react';
import { useMicInput } from '@/app/utils/useMicInput';

const MicInputExample = () => {
  const {
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error,
    setDeviceIndex
  } = useMicInput();

  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [analyzerNode, setAnalyzerNode] = useState<AnalyserNode | null>(null);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  // Set up audio analysis when stream changes
  useEffect(() => {
    if (!mediaStream) return;
    
    // Clean up previous analyzer
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    // Create audio context and analyzer
    const audioContext = new (window.AudioContext)();
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    
    // Connect media stream to analyzer
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyzer);
    
    setAnalyzerNode(analyzer);
    
    // Start analyzing audio levels
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    const updateAudioLevel = () => {
      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      
      // Normalize to 0-100
      setAudioLevel(Math.round((avg / 255) * 100));
      
      // Continue animation loop
      const frame = requestAnimationFrame(updateAudioLevel);
      setAnimationFrame(frame);
    };
    
    updateAudioLevel();
    
    // Cleanup
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      source.disconnect();
      audioContext.close();
    };
  }, [mediaStream]);
  
  // Handle device selection from dropdown
  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = parseInt(event.target.value, 10);
    setDeviceIndex(newIndex);
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Microphone Input</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {!isPermissionGranted ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Please grant microphone access to use this feature.
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label htmlFor="deviceSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Select Microphone:
            </label>
            <select
              id="deviceSelect"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              value={deviceIndex}
              onChange={handleDeviceChange}
            >
              {audioDevices.map((device: MediaDeviceInfo, index: number) => (
                <option key={device.deviceId} value={index}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Audio Level:
            </label>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div 
                className="bg-green-600 h-4 rounded-full transition-all duration-100 ease-out"
                style={{ width: `${audioLevel}%` }}
              ></div>
            </div>
            <div className="text-right text-sm text-gray-500 mt-1">
              {audioLevel}%
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            {mediaStream ? (
              <p>Microphone active: {audioDevices[deviceIndex]?.label || `Microphone ${deviceIndex + 1}`}</p>
            ) : (
              <p>No active microphone</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MicInputExample;