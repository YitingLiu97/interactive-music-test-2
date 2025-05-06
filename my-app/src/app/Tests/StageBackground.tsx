import React from 'react';
import { BoundingBox } from '@/app/types/audioType';

interface StageBackgroundProps {
  boundingBox: BoundingBox;
  floorColor?: string;
  backgroundColor?: string;
}

export default function StageBackground({
  boundingBox,
  floorColor = '#3c5d8f',
  backgroundColor = '#f0f0f0',
}: StageBackgroundProps) {
  const { x, y } = boundingBox;
  
  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${x} ${y}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 z-0"
    >
      {/* Background */}
      <rect
        x="0"
        y="0"
        width={x}
        height={y}
        fill={backgroundColor}
        opacity={0.3}
      />
      
      {/* Simple floor area - entire area where circles can move */}
      <rect
        x={0}
        y={0}
        width={x}
        height={y}
        fill={floorColor}
        id="interactive-floor"
        stroke="#000"
        strokeWidth="2"
        opacity={0.3}

      />
    </svg>
  );
}