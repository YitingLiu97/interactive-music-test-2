'use client'
import React from "react"
import { useState, useEffect } from "react";

type Circle = {
  x: number,
  y: number
}

type BoundingBox = {
  x: number,
  y: number
}
type Props = {
  boundingBox: BoundingBox;
}

export default function DraggableCircle({ boundingBox }: Props) {
  const [dragging, SetDragging] = useState<boolean>(false);
  const [position, setPosition] = useState<Circle>({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (dragging) {
        const boxWidth = boundingBox.x;
        const boxHeight = boundingBox.y;
        const circleSize = 50;
        let newX = Math.min(Math.max(0, e.clientX), boxWidth - circleSize);
        let newY = Math.min(Math.max(0, e.clientY), boxHeight - circleSize);
        setPosition({ x: newX, y: newY });
      }
    }
    function handleMouseUp() {
      SetDragging(false);
    }

    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);


  function onMouseDown() {
    SetDragging(true);
    console.log("set dragging to be true");
  }
  function onMouseUp() {
    SetDragging(false);
    console.log("set dragging to be false");

  }
  function onMouseMove(x: number, y: number) {
    if (dragging) {

      const boxWidth = 300;
      const boxHeight = 300;
      const circleSize = 50;

      let newX = Math.min(Math.max(0, x), boxWidth - circleSize);
      let newY = Math.min(Math.max(0, y), boxHeight - circleSize);

      setPosition({ x: newX, y: newY });
      console.log(`set position to be ${x} and ${y}`);
    }
  }

  return (
    <>
      <div onMouseUp={onMouseUp} onMouseDown={onMouseDown} onMouseMove={(e) => onMouseMove(e.clientX, e.clientY)} >

        <div style={{
          width: 50,
          height: 50,
          borderRadius: "50%",
          backgroundColor: "red",
          position: "absolute",
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: "grab"
        }}>

        </div>
      </div>
    </>
  )
}