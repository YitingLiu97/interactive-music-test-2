import React from "react"
import { Button } from "@radix-ui/themes"

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
            <div className="fixed bottom-0 m-auto w-full bg-black text-white p-4">
                <h1 className="text-xl">Current audio is: {trackListName}</h1>
                <p className="mb-2">Author is: {authorName}</p>
                <div className="flex gap-2">
                    <Button onClick={onPlayAll}>Play</Button>
                    <Button onClick={onPauseAll}>Pause</Button>
                    <Button onClick={onToggleAll}>LoopToggle</Button>
                </div>
            </div>
        </>
    )
}