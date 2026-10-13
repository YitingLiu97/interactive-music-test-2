"use client";

import React from "react";

interface AudioSection {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
}

type Props = {
  trackListName: string;
  authorName: string;
  onPlayAll: (time: number) => void;
  onPauseAll: () => void;
  onToggleAll: () => void;
  isPlaying: boolean;
  isLooping: boolean;
  currentTrack: string | null;
  totalDuration?: number;
  currentTime?: number;
  sections?: AudioSection[];
  onSeekTo?: (timeInSeconds: number) => void;
  onStartMixRecording: () => void;
  onStopMixRecording: () => void;
  isMixRecording: boolean;
  finalMixBlob: { blob: Blob; url: string } | null;
};

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export default function AudioInterface({
  trackListName,
  authorName,
  onPlayAll,
  onPauseAll,
  onToggleAll,
  isPlaying,
  isLooping,
  currentTrack,
  totalDuration = 180,
  currentTime = 0,
  sections = [],
  onSeekTo = () => {},
  onStartMixRecording,
  onStopMixRecording,
  isMixRecording,
  finalMixBlob,
}: Props) {
  const currentSection = sections.find(
    (section) => currentTime >= section.startTime && currentTime < section.endTime
  );

  return (
    <section className="lab-transport" aria-label="Music playback and mix controls">
      <div className="lab-track-info">
        <span className="lab-overline">Now exploring</span>
        <h2>{trackListName}</h2>
        <p>Music by {authorName}</p>
        <p className="lab-track-status" aria-live="polite">
          {currentTrack ? `Selected: ${currentTrack}` : "Drag a sound to change the mix"}
          {currentSection ? ` · ${currentSection.name}` : ""}
        </p>
      </div>

      <div className="lab-playback">
        <div className="lab-playback-top">
          <div className="lab-button-row">
            <button
              className="lab-play-button"
              type="button"
              onClick={() => isPlaying ? onPauseAll() : onPlayAll(currentTime >= totalDuration ? 0 : currentTime)}
              aria-label={isPlaying ? "Pause music" : "Play music"}
            >
              {isPlaying ? "Ⅱ" : "▶"}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>
            <button
              className={`lab-outline-button ${isLooping ? "is-active" : ""}`}
              type="button"
              onClick={onToggleAll}
              aria-pressed={isLooping}
            >
              Loop {isLooping ? "on" : "off"}
            </button>
          </div>
          <span className="lab-time">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
        </div>

        <label className="lab-sr-only" htmlFor="lab-seek">Seek within the music</label>
        <input
          id="lab-seek"
          className="lab-seek"
          type="range"
          min={0}
          max={Math.max(totalDuration, 1)}
          step={0.1}
          value={Math.min(currentTime, Math.max(totalDuration, 1))}
          onChange={(event) => onSeekTo(Number(event.target.value))}
          style={{ "--progress": `${Math.min(100, currentTime / Math.max(totalDuration, 1) * 100)}%` } as React.CSSProperties}
        />

        <div className="lab-sections" aria-label="Jump to song section">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={currentSection?.id === section.id ? "is-current" : ""}
              onClick={() => onSeekTo(section.startTime)}
              aria-current={currentSection?.id === section.id ? "step" : undefined}
            >
              {section.name}
            </button>
          ))}
        </div>
      </div>

      <div className="lab-capture">
        <span className="lab-overline">Capture your mix</span>
        <button
          className={`lab-outline-button ${isMixRecording ? "is-recording" : ""}`}
          type="button"
          onClick={isMixRecording ? onStopMixRecording : onStartMixRecording}
          aria-label={isMixRecording ? "Stop recording the mix" : "Record the mix"}
        >
          <span className="lab-record-dot" aria-hidden="true" />
          {isMixRecording ? "Stop recording" : "Record mix"}
        </button>
        {finalMixBlob && (
          <a className="lab-download" href={finalMixBlob.url} download={`${trackListName}_mix.webm`}>
            Download recording ↗
          </a>
        )}
      </div>
    </section>
  );
}
