'use client'
import React from "react"
import { useState, useEffect } from "react";
import { AdjustPanning, AdjustVolume } from "@/app/utils/audio";
import { mapRange } from "@/app/utils/math";
type BoundingBox = {
  x: number,
  y: number
}
type Props = {
  boundingBox: BoundingBox;
}

export default function DraggableCircle({ boundingBox }: Props) {
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState<boolean>(false);
  const [position, setPosition] = useState<{ xPercent: number, yPercent: number }>({
    xPercent: 50,
    yPercent: 50
  });
  const circleSize = 50;
  const marginPercent = 1;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (dragging) {
        const xPercent = (e.clientX / boundingBox.x) * 100;
        const yPercent = (e.clientY / boundingBox.y) * 100;

        const maxXPercent = 100 - (circleSize / boundingBox.x) * 100 - -marginPercent;
        const maxYPercent = 100 - (circleSize / boundingBox.y) * 100 - marginPercent;
        const boundedXPercent = Math.round(Math.min(Math.max(0, xPercent), maxXPercent) * 100) / 100;
        const boundedYPercent = Math.round(Math.min(Math.max(0, yPercent), maxYPercent) * 100) / 100;
        setPosition({ xPercent: boundedXPercent, yPercent: boundedYPercent });
        const pan = mapRange(boundedXPercent, 0, 100, -1, 1);
        const vol = mapRange(boundedYPercent, 0, 100, -30, 0); // in dB
    
        AdjustPanning(pan);
        AdjustVolume(vol);
       }
    }
    function handleMouseUp() {
      setDragging(false);
    }

    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, boundingBox]);

  function onMouseDown() {
    setDragging(true);
  }
  if (!mounted) return null;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: circleSize,
        height: circleSize,
        borderRadius: "50%",
        backgroundColor: "red",
        position: "absolute",
        transform: `translate(${(position.xPercent * boundingBox.x) / 100}px, ${(position.yPercent * boundingBox.y) / 100}px)`,
        cursor: dragging ? "grabbing" : "grab"
      }}
    />
  );
}