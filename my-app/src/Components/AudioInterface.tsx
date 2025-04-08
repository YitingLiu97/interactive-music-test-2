import React from "react"
import { useEffect, useState, useRef } from "react"
import { Button } from "@radix-ui/themes"

// should i have props to have the data related to all the clips 
type Props = {
    trackListName: string;
    authorName: string;
    onPlayAll: () => void;
    onPauseAll: () => void;
    onToggleAll: () => void;
}
export default function AudioInterface({ 
    trackListName,
    authorName,
    onPlayAll,
    onPauseAll,
    onToggleAll,
}: Props) {
    return (
        <>
            <div className="fixed bottom-0 m-auto w-full bg-black">
                <h1>Current audio is </h1>
                <p>${trackListName}</p>
                <p>Author is ${authorName}</p>
                <Button onClick={onPlayAll}>Play</Button>
                <Button onClick={onPauseAll}>Pause</Button>
                <Button onClick={onToggleAll}>LoopToggle</Button>
            </div>
        </>
    )
}