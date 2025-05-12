'use client';
import React, { useState, useEffect } from 'react';
import { useMicInput } from '@/app/utils/useMicInput';
import { useMicRecorder } from '@/app/utils/useMicRecorder';
import { Button, Flex, Text, Card, Badge } from '@radix-ui/themes';
import { PlayIcon, PauseIcon, StopIcon, DotFilledIcon } from '@radix-ui/react-icons';

// Simple Record Button Icon Component
const RecordButtonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7.5" cy="7.5" r="7" fill="currentColor" stroke="currentColor" strokeWidth="1" />
  </svg>
);

// TypeScript-friendly AudioContext
interface WindowWithAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const MicRecorderExample = () => {
  // Use the existing mic input hook
  const {
    mediaStream,
    audioDevices,
    deviceIndex,
    isPermissionGranted,
    error,
    setDeviceIndex
  } = useMicInput();

  // State for audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Visualization state
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [analyzerNode, setAnalyzerNode] = useState<AnalyserNode | null>(null);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

   const {
    startRecording,
    stopRecording,
    isRecording,
    isReady,
    recordedBlob,
    initializeTone // Get the new function
  } = useMicRecorder();
  // Mock the useMicRecorder hook for testing
  // In a real implementation, you'd use the actual hook
//   const startRecording = async () => {
//     setIsRecording(true);
//     return true;
//   };

//   const stopRecording = async () => {
//     setIsRecording(false);
//     // Create a dummy blob for testing
//     const dummyBlob = new Blob(['dummy audio data'], { type: 'audio/webm' });
//     const dummyUrl = URL.createObjectURL(dummyBlob);
//     const result = { blob: dummyBlob, url: dummyUrl };
//     setRecordedBlob(result);
//     return result;
//   };

  // Handle device selection from dropdown
  const handleDeviceChange =async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newIndex = parseInt(event.target.value, 10);
    setDeviceIndex(newIndex);
    // Try to initialize Tone.js when changing device - this utilizes user interaction
    await initializeTone();
  };

  // Create audio visualization when stream changes
  useEffect(() => {
    if (!mediaStream) return;
    
    // Clean up previous analyzer
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    // TypeScript-friendly AudioContext creation
    const AudioContextClass = window.AudioContext || 
                             (window as WindowWithAudioContext).webkitAudioContext;
    
    if (!AudioContextClass) {
      console.error('AudioContext not supported in this browser');
      return;
    }
    
    const audioContext = new AudioContextClass();
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
      
      // Normalize to a higher range to make visualization more dramatic
      setAudioLevel(Math.min(100, Math.round((avg / 255) * 150))); 
      
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

  // Handle recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      setRecordingTimer(timer);
    } else if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [isRecording]);

  // Handle audio element creation when recording is available
  useEffect(() => {
    if (recordedBlob?.url) {
      const audio = new Audio(recordedBlob.url);
      audio.addEventListener('ended', () => setIsPlaying(false));
      setAudioElement(audio);
    }
    
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        setIsPlaying(false);
      }
    };
  }, [recordedBlob]);

  // Start recording handler
  const handleStartRecording = async () => {
    if (!isReady) {
      alert('Microphone is not ready. Please wait or check permissions.');
      return;
    }
    
    const success = await startRecording();
    if (!success) {
      alert('Failed to start recording. Please try again.');
    }
  };

  // Stop recording handler
  const handleStopRecording = async () => {
    const result = await stopRecording();
    if (!result) {
      alert('Failed to stop recording. Please try again.');
    }
  };

  // Play/pause the recorded audio
  const togglePlayback = () => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.currentTime = 0;
      audioElement.play().catch(error => {
        console.error('Error playing audio:', error);
        alert('Failed to play recording');
      });
      setIsPlaying(true);
    }
  };

  // Format seconds as mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-lg">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Text size="5" weight="bold">Voice Recorder</Text>
          {isReady ? (
            <Badge color="green">Ready</Badge>
          ) : (
            <Badge color="amber">Initializing...</Badge>
          )}
        </Flex>
        
        {error && (
          <Card  className="p-3 bg-red-400">
            <Text size="2">{error}</Text>
          </Card>
        )}
        
        {!isPermissionGranted ? (
          <Card  className="p-3 bg-amber-400">
            <Text size="2">Please grant microphone access to use this feature.</Text>
          </Card>
        ) : (
          <>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">Select Microphone:</Text>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={deviceIndex}
                onChange={handleDeviceChange}
                disabled={isRecording}
              >
                {audioDevices.map((device: MediaDeviceInfo, index: number) => (
                  <option key={device.deviceId} value={index}>
                    {device.label || `Microphone ${index + 1}`}
                  </option>
                ))}
              </select>
            </Flex>
            
            <Flex direction="column" gap="1">
              <Text size="2" weight="medium">Audio Level:</Text>
              <div className="w-full h-8 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-100 ease-out ${
                    isRecording ? 'bg-red-500' : 'bg-green-600'
                  }`}
                  style={{ width: `${audioLevel}%` }}
                ></div>
              </div>
            </Flex>
            
            {isRecording && (
              <Flex align="center" gap="2">
                <DotFilledIcon className="text-red-500 animate-pulse" />
                <Text size="2" color="red">Recording: {formatDuration(recordingDuration)}</Text>
              </Flex>
            )}
            
            <Flex gap="2" justify="center">
              {isRecording ? (
                <Button 
                  color="red" 
                  onClick={handleStopRecording}
                >
                  <StopIcon /> Stop Recording
                </Button>
              ) : (
                <Button 
                  color="red" 
                  onClick={handleStartRecording}
                  disabled={!isReady}
                >
                  <RecordButtonIcon /> Start Recording
                </Button>
              )}
            </Flex>
            
            {recordedBlob && (
              <Card className="p-3 bg-gray-50">
                <Flex direction="column" gap="2">
                  <Text size="2" weight="medium">Recording:</Text>
                  <Flex gap="2">
                    <Button 
                      variant="soft" 
                      color={isPlaying ? "amber" : "green"}
                      onClick={togglePlayback}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                      {isPlaying ? "Pause" : "Play"}
                    </Button>
                    <Button 
                      variant="soft"
                      onClick={() => {
                        const anchor = document.createElement("a");
                        anchor.download = "recording.webm";
                        anchor.href = recordedBlob.url;
                        anchor.click();
                      }}
                    >
                      Download
                    </Button>
                  </Flex>
                  <audio 
                    src={recordedBlob.url} 
                    controls 
                    className="w-full mt-2"
                  />
                </Flex>
              </Card>
            )}
            
            <Text size="2" color="gray">
              {mediaStream ? (
                <>Active microphone: {audioDevices[deviceIndex]?.label || `Microphone ${deviceIndex + 1}`}</>
              ) : (
                <>No active microphone</>
              )}
            </Text>
          </>

          
        )}
      </Flex>
    </Card>
  );
};

export default MicRecorderExample;