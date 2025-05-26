# Introduction 
An interactive web application for spatial audio processing and visualization that allows users to manipulate microphone input and audio tracks in a two-dimensional space, creating immersive sonic landscapes with real-time visual feedback.

# Overview 
This application creates an interactive audio-visual environment where:
- Live microphone input is processed in real-time with dynamic visualizations
- Users can position different audio sources in a 2D environment:
  - Horizontal position (X-axis) controls stereo panning (left to right)
  - Vertical position (Y-axis) controls volume level
- Visual feedback shows audio spectrum and waveform data in real-time
- Interactive transport controls make navigating through pre-recorded audio sections intuitive
- Global transport controls: Play, pause, and loop functionality for pre-recorded tracks
- Precise time scrubbing: Seek to any point in pre-recorded audio with the timeline slider
- Multi-source mixing: Combine live microphone input with pre-recorded tracks

# Technical Implementation
## Technology Stack
- **Frontend Framework**: [Next.js](https://nextjs.org/) (v15.2)
- **UI Library**: [React](https://reactjs.org/) (v19)
- **Audio Engine**: [Tone.js](https://tonejs.github.io/) (v15.0)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4)
- **TypeScript**: For type safety and improved developer experience

## Audio Processing Architecture
The application uses a custom React hook (`useAudioCircle`) that encapsulates Tone.js audio nodes in a component-friendly API:
Each audio source is processed through:
1. **Panner node**: Controls the stereo position (left/right)
2. **Volume node**: Controls amplitude levels
3. **Analyzer nodes**: Generate real-time FFT and waveform data for visualizations

### Component Structure
- `BoundingBox`: Main container managing all audio sources
- `AudioCircle`: Draggable component representing a single audio source (mic or track)
- `CircleUI`: Visual representation of audio with real-time visualizations
- `AudioInterface`: Transport controls and input management
- `HandDetection`: Computer vision component for gesture recognition and control
- Custom hooks: `useAudioCircle` for audio processing and `useAudioRecorder` for audio recording and `useHandDetection` for hand detection using MediaPipe's tasks-vision. 

# Getting Started
## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

1. Clone the repository:

bashgit clone https://github.com/YitingLiu97/interactive-music-test-2 
cd my-app

2. Install dependencies:

```bash
npm install
```
# or
```bash
yarn
```
3. Start the development server:

```bash
npm run dev
```
# or
```bash
yarn dev
```

4. Open http://localhost:3000 to view the application in your browser

# To update the media content 
1. Create a folder under `public/content` with the project name [Project-Name] and put audio files in the` public/content/[Project Name]/Sounds` folder and put background image in the `public/content/[Prject Name]/Image` folder and name the background image to be `bg.jpg`
2. Create an `info.json` in the folder of [Project Name]. Please update all the necessary information by referencing the exisiting example in the two folders: Air-Traffic or Justin. 
- `Sections` means the division of time based on intro, verse, chorus, bridge, and outro. 
- `AudioInfos` are must to fill with correct file addresses and specific id and circle color. 

Each project folder maintains its own:
- Audio source configurations
- Spatial positioning settings
- Effect chain parameters
- Session info

## 📚 Developer Notes

- The `BoundingBox` component handles the overall layout and manages all audio sources
- `useAudioRecorder` component handles requesting microphone permissions and capturing audio and visualization 
- `useAudioRecorder` is made up with two parts: `useAudioSystem` which requests the microphone permissions and capturing audio and `useLoopBuffer` which creates audio loop and canvas visualization for the captured audio
- Each `AudioCircle` has its own isolated audio processing chain via the `useAudioCircle` hook
- The `CircleUI` component visualizes audio properties including FFT data and waveform
- Audio parameters (pan and volume) are mapped to spatial coordinates with smooth transitions
- The app uses throttled parameter updates during dragging to prevent audio artifacts
- It also 

## 🔮 Future Enhancements

- Expand audio effect options (convolution reverb, pitch shifting, etc.)
- Add support for multiple simultaneous microphone inputs
- Implement audio recording and export functionality
- Create preset effect chains and positions for quick access
- Add machine learning-based audio analysis for more advanced visualizations
- Implement WebRTC for collaborative remote audio sessions
- Add multi-touch support for mobile devices
- Integrate with MIDI controllers for external parameter control

# Acknowledgements
- Tone.js for the audio processing capabilities
- Radix UI for accessible UI components
- Demo music tracks used: Air Traffic - The Magician's Wife (Clara Berry and Wooldog) and Chinese Instruments Music by Justin Scholar 玉刻
- This project was created for NYU Shanghai Creative Innovation Lab led by Alex Ruthmann 

