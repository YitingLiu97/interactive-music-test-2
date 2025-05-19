// Place this file in a shared location, like @/app/types/audioTypes.ts
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
  isRecording: boolean;
  position?: { x: number; y: number };
  audioParams?: { pan: number; volume: number };
}

export interface HandState {
  x: number;
  y: number;
  handedness: "Left" | "Right";
  grabbing: boolean;
}
