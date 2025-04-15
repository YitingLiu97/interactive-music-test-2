'use client'
import React from "react";
import { 
    Button, 
    Flex, 
    Text, 
    Heading, 
    Card, 
    Slider, 
    Box,
    Separator
} from "@radix-ui/themes";
import { PlayIcon, PauseIcon, ResetIcon, InfoCircledIcon } from "@radix-ui/react-icons";

type Props = {
    trackListName: string;
    authorName: string;
    onPlayAll: () => void;
    onPauseAll: () => void;
    onToggleAll: () => void;
    isPlaying: boolean;
    isLooping: boolean;
    currentTrack: string | null;
};

export default function AudioInterface({ 
    trackListName,
    authorName,
    onPlayAll,
    onPauseAll,
    onToggleAll,
    isPlaying,
    isLooping,
    currentTrack
}: Props) {
    // Simulated playback progress (would need to be connected to actual audio playback)
    const [progress, setProgress] = React.useState(0);
    
    // Update progress bar if playing
    React.useEffect(() => {
        let intervalId: NodeJS.Timeout;
        
        if (isPlaying) {
            intervalId = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        if (isLooping) return 0;
                        clearInterval(intervalId);
                        return 100;
                    }
                    return prev + 0.1;
                });
            }, 100);
        }
        
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isPlaying, isLooping]);
    
    // Reset progress when playback stops
    React.useEffect(() => {
        if (!isPlaying) {
            setProgress(0);
        }
    }, [isPlaying]);

    return (
        <Card className="w-full h-[150px] bg-black text-white rounded-none">
            <Flex direction="row" gap="4" align="center" className="h-full">
                {/* Track info section */}
                <Box className="w-1/2 p1-4">
                    <Flex direction="column" gap="2">
                        <Heading size="4" className="text-white">
                            {trackListName}
                        </Heading>
                        <Text size="2" className="text-gray-400">
                            <InfoCircledIcon /> By {authorName}
                        </Text>
                        {currentTrack && (
                            <></>
                            // <Badge color="orange" variant="soft" radius="full">
                            //     Now playing: {currentTrack}
                            // </Badge>
                        )}
                    </Flex>
                </Box>
                
                <Separator orientation="vertical" className="h-20" />
                
                {/* Controls section */}
                <Flex direction="column" className="w-3/4" gap="3">
                    <Flex gap="2" justify="center">
                        <Button 
                            variant={isPlaying ? "outline" : "solid"} 
                            color="orange"
                            onClick={isPlaying ? onPauseAll : onPlayAll}
                            size="3"
                        >
                            {isPlaying ? <PauseIcon width="20" height="20" /> : <PlayIcon width="20" height="20" />}
                        </Button>
                        <Button 
                            variant={isLooping ? "solid" : "outline"} 
                            color={isLooping ? "green" : "gray"}
                            onClick={onToggleAll}
                            size="3"
                        >
                            <ResetIcon width="20" height="20" />
                        </Button>
                    </Flex>
                    
                    <Flex align="center" gap="3" className="px-2">
                        <Text size="1" className="text-gray-300 w-10">
                            {formatTime(progress)}
                        </Text>
                        <Slider 
                            value={[progress]} 
                            max={100}
                            step={0.1}
                            className="flex-1"
                            color="orange"
                        />
                        <Text size="1" className="text-gray-300 w-10">
                            {formatTime(100)}
                        </Text>
                    </Flex>
                </Flex>
                
                <Separator orientation="vertical" className="h-20" />
               
            </Flex>
        </Card>
    );
}

// Helper function to format time as mm:ss
function formatTime(progress: number): string {
    // Assuming total length is 3 minutes (180 seconds)
    const totalSeconds = (progress / 100) * 180;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}