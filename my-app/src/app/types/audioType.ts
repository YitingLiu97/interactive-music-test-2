export interface AudioControlRef {
  isPlaying?: boolean;
  play: (startTime?: number) => boolean | void;
  stop: () => boolean | void;
  pause: () => boolean | void;
  toggle: () => void;
  seekTo?: (timeInSeconds: number) => boolean | void;
  setLooping?: (loopState: boolean) => void;
  getDuration?: () => number;
  applyPositionMuting: () => void;
  updatePosition?: (newXPercent: number, newYPercent: number) => boolean | void;
}

export interface BoundingBox {
  x: number;
  y: number;
}

export interface Trapezoid {
  topWidth: number;
  topLeftOffset: number;
}

export interface StartPoint {
  x: number;
  y: number;
}

export interface AudioInfo {
  id: string;
  audioUrl: string | null;
  instrumentName: string;
  circleColor: string;
  audioSource: "recording" | "file";
  isRecording?: boolean;
  position?: { x: number; y: number };
  audioParams?: { pan: number; volume: number };
}

export interface HandState {
  x: number;
  y: number;
  handedness: "Left" | "Right";
  grabbing: boolean;
}

export interface AudioSection {
  id: string;
  name: string;
  startTime: number; // Start time in seconds
  endTime: number;   // End time in seconds
  description?: string; // Optional description of the section
}

export interface JsonInfo{
  projectName:string; 
  title: string;
  author: string; 
  imageUrl: string,
  folderUrl: string; // this contains a group of content 
  audioInfos: AudioInfo[],
  sections?: AudioSection[]; // Add sections to JsonInfo
}