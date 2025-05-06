// src/components/SvgBackground.tsx
import React from 'react';
import { BoundingBox } from '@/app/types/audioType';

interface SvgBackgroundProps {
  boundingBox: BoundingBox;
  widthPercent?: number;  // Width as percentage of container
  heightPercent?: number; // Height as percentage of container
  offsetX?: number;       // X offset from center in pixels
  offsetY?: number;       // Y offset from center in pixels
  gridSize?: number;
  showGrid?: boolean;
  backgroundColor?: string;
  gridColor?: string;
  borderColor?: string;
}

export default function SvgBackground({
  boundingBox,
  widthPercent = 100,  // Default to full width
  heightPercent = 100, // Default to full height
  offsetX = 0,         // Default centered
  offsetY = 0,         // Default centered
  gridSize = 50,
  showGrid = true,
  backgroundColor = '#f0f0f0',
  gridColor = '#e0e0e0',
  borderColor = '#cccccc'
}: SvgBackgroundProps) {
  const { x, y } = boundingBox;
  
  // Calculate actual size and position of SVG background
  const width = (widthPercent / 100) * x;
  const height = (heightPercent / 100) * y;
  
  // Calculate position to center by default
  const posX = ((x - width) / 2) + offsetX;
  const posY = ((y - height) / 2) + offsetY;
  
  // Generate grid lines
  const horizontalLines = [];
  const verticalLines = [];
  
  if (showGrid) {
    // Create horizontal grid lines
    for (let i = gridSize; i < height; i += gridSize) {
      horizontalLines.push(
        <line 
          key={`h-${i}`} 
          x1={posX} 
          y1={posY + i} 
          x2={posX + width} 
          y2={posY + i} 
          stroke={gridColor} 
          strokeWidth="1" 
        />
      );
    }
    
    // Create vertical grid lines
    for (let i = gridSize; i < width; i += gridSize) {
      verticalLines.push(
        <line 
          key={`v-${i}`} 
          x1={posX + i} 
          y1={posY} 
          x2={posX + i} 
          y2={posY + height} 
          stroke={gridColor} 
          strokeWidth="1" 
        />
      );
    }
  }
  
  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${x} ${y}`}
      preserveAspectRatio="xMinYMin slice"
      className="absolute inset-0 z-0"
    >
      {/* Background rectangle */}
      <rect
        x={posX}
        y={posY}
        width={width}
        height={height}
        fill={backgroundColor}
        stroke={borderColor}
        strokeWidth="2"
      />
      
      {/* Grid lines */}
      {horizontalLines}
      {verticalLines}
    </svg>
  );
}