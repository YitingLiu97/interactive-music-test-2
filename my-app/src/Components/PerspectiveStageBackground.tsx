// PerspectiveStageBackground.tsx
import React from 'react';
import { BoundingBox } from '@/app/types/audioType';

interface PerspectiveStageProps {
  boundingBox: BoundingBox;
  floorColor?: string;
  wallColor?: string;
  backgroundColor?: string;
}

export default function PerspectiveStageBackground({
  boundingBox,
  floorColor = '#3c5d8f',
  wallColor = '#2a3f5f',
  backgroundColor = '#f0f0f0',
}: PerspectiveStageProps) {
  const { x, y } = boundingBox;
  
  // Define the perspective floor points
  const floorPoints = `
    ${x * 0.1},${y * 0.8} 
    ${x * 0.9},${y * 0.8} 
    ${x * 0.8},${y * 0.4} 
    ${x * 0.2},${y * 0.4}
  `;
  
  // Define the left wall points
  const leftWallPoints = `
    ${x * 0.1},${y * 0.8}
    ${x * 0.1},${y * 0.2}
    ${x * 0.2},${y * 0.1}
    ${x * 0.2},${y * 0.4}
  `;
  
  // Define the right wall points
  const rightWallPoints = `
    ${x * 0.9},${y * 0.8}
    ${x * 0.9},${y * 0.2}
    ${x * 0.8},${y * 0.1}
    ${x * 0.8},${y * 0.4}
  `;
  
  // Define the back wall points
  const backWallPoints = `
    ${x * 0.2},${y * 0.1}
    ${x * 0.8},${y * 0.1}
    ${x * 0.8},${y * 0.4}
    ${x * 0.2},${y * 0.4}
  `;
  
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
      />
      
      {/* Back wall */}
      <polygon
        points={backWallPoints}
        fill={wallColor}
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Left wall */}
      <polygon
        points={leftWallPoints}
        fill={wallColor}
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Right wall */}
      <polygon
        points={rightWallPoints}
        fill={wallColor}
        stroke="#000"
        strokeWidth="2"
      />
      
      {/* Floor */}
      <polygon
        points={floorPoints}
        fill={floorColor}
        stroke="#000"
        strokeWidth="2"
        id="interactive-floor"
      />
    </svg>
  );
}