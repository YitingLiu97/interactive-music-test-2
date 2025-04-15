// Place this file in a shared location, like @/app/types/audioTypes.ts
export interface AudioControlRef {
    play: () => void;
    stop: () => void;
    pause: () => void;
    toggle: () => void;
    applyPositionMuting: () => void; // Add this
}
export interface BoundingBox {
    x: number;
    y: number;
}

export interface StartPoint{
    x: number;
    y: number;
}