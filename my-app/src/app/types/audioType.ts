// Place this file in a shared location, like @/app/types/audioTypes.ts

export interface AudioControlRef {
    play: () => void;
    pause: () => void;
    stop: () => void;
    toggle: () => void;
}

export interface BoundingBox {
    x: number;
    y: number;
}

export interface StartPoint{
    x: number;
    y: number;
}