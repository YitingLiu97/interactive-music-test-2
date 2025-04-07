'use client'
import React, { useEffect } from "react";
import { setupPlayer, startPlayback, stopPlayback,AdjustVolume,AdjustPanning } from "@/app/utils/audio";

export default function AudioUI() {
    const url = "/resources/DeanTown.mp3";
 
    return (
        <div>
           <button onClick={() => setupPlayer(url)}>Set up Player</button>  
           <button onClick={startPlayback}>Start Playing</button>  
           <button onClick={stopPlayback}>Stop</button>  
        </div>
     
    );
}