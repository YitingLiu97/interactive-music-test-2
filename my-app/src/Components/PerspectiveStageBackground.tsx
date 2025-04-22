"use client";
import { useEffect } from "react";
import React from "react";
import { BoundingBox } from "@/app/types/audioType";

// Add these as exports from the component file
export interface FloorCoordinates {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

interface PerspectiveStageProps {
  boundingBox: BoundingBox;
  floorColor?: string;
  wallColor?: string;
  backgroundColor?: string;
  onFloorCoordinatesChange?: (coords: FloorCoordinates) => void;
}

export default function PerspectiveStageBackground({
  boundingBox,
  floorColor = "#3c5d8f",
  wallColor = "#2a3f5f",
  backgroundColor = "#f0f0f0",
  onFloorCoordinatesChange,
}: PerspectiveStageProps) {
  const { x, y } = boundingBox;

  // Define the perspective floor points
  const floorCoords: FloorCoordinates = {
    topLeft: { x: x * 0.2, y: y * 0.4 },
    topRight: { x: x * 0.8, y: y * 0.4 },
    bottomRight: { x: x * 0.9, y: y * 0.8 },
    bottomLeft: { x: x * 0.1, y: y * 0.8 },
  };

  const floorPoints = `
    ${floorCoords.bottomLeft.x},${floorCoords.bottomLeft.y} 
    ${floorCoords.bottomRight.x},${floorCoords.bottomRight.y} 
    ${floorCoords.topRight.x},${floorCoords.topRight.y} 
    ${floorCoords.topLeft.x},${floorCoords.topLeft.y}
  `;
 
  // Notify parent component of floor coordinates
  useEffect(() => {
    if (onFloorCoordinatesChange) {
      onFloorCoordinatesChange(floorCoords);
    }
  }, [x, y, onFloorCoordinatesChange, floorCoords]);

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
      <rect x="0" y="0" width={x} height={y} fill={backgroundColor} />

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

// Map a normalized (0-1) coordinate to floor space
export function mapToFloor(
  normalX: number, // 0-1 normalized x coordinate
  normalY: number, // 0-1 normalized y coordinate
  floorCoords: FloorCoordinates
): {x: number, y: number} {
  // Bilinear interpolation to map unit square to quadrilateral
  const topX = floorCoords.topLeft.x + normalX * (floorCoords.topRight.x - floorCoords.topLeft.x);
  const bottomX = floorCoords.bottomLeft.x + normalX * (floorCoords.bottomRight.x - floorCoords.bottomLeft.x);
  const leftY = floorCoords.topLeft.y + normalY * (floorCoords.bottomLeft.y - floorCoords.topLeft.y);
  const rightY = floorCoords.topRight.y + normalY * (floorCoords.bottomRight.y - floorCoords.topRight.y);
  
  const x = topX + normalY * (bottomX - topX);
  const y = leftY + normalX * (rightY - leftY);
  
  return {x, y};
}

// Map from floor space back to normalized coordinates
export function mapFromFloor(
  x: number,
  y: number,
  floorCoords: FloorCoordinates
): {normalX: number, normalY: number} {
  // This is a simplified inverse mapping

  // Approximate normalY
  const normalY = (y - floorCoords.topLeft.y) / (floorCoords.bottomLeft.y - floorCoords.topLeft.y);
  
  // Use normalY to find the expected x-coordinate range at this y-level
  const xAtY1 = floorCoords.topLeft.x + normalY * (floorCoords.bottomLeft.x - floorCoords.topLeft.x);
  const xAtY2 = floorCoords.topRight.x + normalY * (floorCoords.bottomRight.x - floorCoords.topRight.x);
  
  // Estimate normalX
  const normalX = (x - xAtY1) / (xAtY2 - xAtY1);
  
  return {normalX, normalY};
}