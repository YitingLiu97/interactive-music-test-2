export type InitState = 'idle' | 'permission' | 'devices' | 'tone' | 'recorder' | 'ready' | 'failed';

// Interface for recorded blob
export interface RecordedBlob {
  blob: Blob;
  url: string;
}

// Status information for debugging and coordination
export interface AudioSystemStatus {
  initState: InitState;
  deviceCount: number;
  toneState: string;
  selectedDevice: string;
}

// Complete return type for useAudioRecorder hook
export interface UseAudioRecorderReturn {
  // Device state
  mediaStream: MediaStream | null;
  audioDevices: MediaDeviceInfo[];
  deviceIndex: number;
  
  // Permission state
  isPermissionGranted: boolean;
  
  // Tone.js state
  isToneInitialized: boolean;
  isRecorderReady: boolean;
  
  // Recording state
  isRecording: boolean;
  recordedBlob: RecordedBlob | null;
  
  // Loop state
  loopBuffer: AudioBuffer | null;
  loopDuration: number;
  loopPosition: number;
  isLoopPlaybackActive: boolean;
  isLoopRecording: boolean;
  
  // Error state
  error: string | null;
  
  // Functions
  initialize: () => Promise<boolean>;
  selectAudioDevice: (index: number) => Promise<boolean>;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<RecordedBlob | null>;
  
  // Loop functions
  initializeLoopBuffer: (duration?: number) => Promise<boolean>;
  startLoopRecordingAt: (startPosition: number, duration: number) => Promise<boolean>;
  stopLoopRecordingAndMerge: () => Promise<boolean>;
  playLoopWithTracking: () => Promise<boolean>;
  stopLoopPlayback: () => boolean;
  
  // Visualization
  getWaveformData: (resolution?: number) => number[];
  getLoopPositionRatio: () => number;
  
  // Status for debugging/coordination
  status: AudioSystemStatus & {
    hasLoopBuffer: boolean;
    loopDuration: number;
  };
}