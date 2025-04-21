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
    Separator,
    Tooltip
} from "@radix-ui/themes";
import { PlayIcon, PauseIcon, ResetIcon, InfoCircledIcon } from "@radix-ui/react-icons";

// Define a type for audio sections
interface AudioSection {
    id: string;
    name: string;
    startTime: number; // Start time in seconds
    endTime: number;   // End time in seconds
}

type Props = {
    trackListName: string;
    authorName: string;
    onPlayAll: () => void;
    onPauseAll: () => void;
    onToggleAll: () => void;
    isPlaying: boolean;
    isLooping: boolean;
    currentTrack: string|null;
    totalDuration?: number; // Total duration in seconds
    currentTime?: number; // Current playback time in seconds
    // New props
    sections?: AudioSection[];
    onSeekTo?: (timeInSeconds: number) => void;
};

export default function AudioInterface({ 
    trackListName,
    authorName,
    onPlayAll,
    onPauseAll,
    onToggleAll,
    isPlaying,
    isLooping,
    currentTrack,
    totalDuration = 180, // Default 3 minutes
    currentTime = 0, // Current time from parent
    sections = [
        { id: '1', name: 'Intro', startTime: 0, endTime: 15 },
        { id: '2', name: 'Verse 1', startTime: 15, endTime: 45 },
        { id: '3', name: 'Chorus', startTime: 45, endTime: 75 },
        { id: '4', name: 'Verse 2', startTime: 75, endTime: 105 },
        { id: '5', name: 'Bridge', startTime: 105, endTime: 135 },
        { id: '6', name: 'Outro', startTime: 135, endTime: 180 }
    ],
    onSeekTo = () => {},
}: Props) {
    // Progress based on currentTime prop (percentage)
    const progress = (currentTime / totalDuration) * 100;
    
    // Calculate progress percentage from time in seconds
    const calculateProgressFromTime = (timeInSeconds: number): number => {
        return (timeInSeconds / totalDuration) * 100;
    };

    // Calculate time in seconds from progress percentage
    const calculateTimeFromProgress = (progressPercentage: number): number => {
        return (progressPercentage / 100) * totalDuration;
    };

    // Handle section click
    const handleSectionClick = (section: AudioSection) => {
        onSeekTo(section.startTime);
    };

    // Handle slider change
    const handleSliderChange = (value: number[]) => {
        if (value.length > 0) {
            const newTime = calculateTimeFromProgress(value[0]);
            onSeekTo(newTime);
        }
    };

    // Get current section based on currentTime
    const getCurrentSection = (): AudioSection | undefined => {
        return sections.find(
            section => currentTime >= section.startTime && currentTime <= section.endTime
        );
    };

    const currentSection = getCurrentSection();

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
                            <Text size="2" className="text-orange-400">
                                Now playing: {currentTrack}
                            </Text>
                        )}
                        {currentSection && (
                            <Text size="2" className="text-blue-400">
                                Section: {currentSection.name}
                            </Text>
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
                    
                    <Flex direction="column" className="px-2 relative">
                        {/* Time indicators */}
                        <Flex align="center" gap="3">
                            <Text size="1" className="text-gray-300 w-10">
                                {formatTime(currentTime)}
                            </Text>
                            <Box className="flex-1 relative">
                                <Slider 
                                    value={[progress]} 
                                    max={100}
                                    step={0.1}
                                    color="orange"
                                    onValueChange={handleSliderChange}
                                />
                                
                                {/* Section markers */}
                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                    {sections.map((section, index) => (
                                        <div 
                                            key={section.id}
                                            className="absolute top-0 h-full"
                                            style={{
                                                left: `${calculateProgressFromTime(section.startTime)}%`,
                                                width: `${calculateProgressFromTime(section.endTime - section.startTime)}%`,
                                            }}
                                        >
                                            {/* Marker line */}
                                            {index > 0 && (
                                                <div 
                                                    className="absolute top-0 left-0 w-0.5 h-full bg-gray-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Box>
                            <Text size="1" className="text-gray-300 w-10">
                                {formatTime(totalDuration)}
                            </Text>
                        </Flex>
                        
                        {/* Section labels */}
                        <Flex className="mt-1 relative h-6">
                            {sections.map((section) => (
                                <Tooltip key={section.id} content={`Jump to ${section.name}`}>
                                    <Button 
                                        size="1"
                                        variant="ghost"
                                        className="p-0 h-6 text-xs absolute top-0 transform -translate-x-1/2"
                                        style={{
                                            left: `${calculateProgressFromTime(section.startTime + (section.endTime - section.startTime) / 2)}%`,
                                            maxWidth: `${calculateProgressFromTime(section.endTime - section.startTime)}%`,
                                            color: currentSection?.id === section.id ? 'rgb(255, 160, 90)' : 'rgb(156, 163, 175)',
                                        }}
                                        onClick={() => handleSectionClick(section)}
                                    >
                                        {section.name}
                                    </Button>
                                </Tooltip>
                            ))}
                        </Flex>
                    </Flex>
                </Flex>
                
                <Separator orientation="vertical" className="h-20" />
               
            </Flex>
        </Card>
    );
}

// Helper function to format time as mm:ss
function formatTime(timeInSeconds: number): string {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}