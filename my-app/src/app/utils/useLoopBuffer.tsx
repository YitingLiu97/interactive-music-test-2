"use client";
import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

export function useLoopBuffer(){
    // owns a fixed size circular buffer 
    // on loop overfloow, overwrites begigning 
    // accpets timestamp and audio data stream 
}