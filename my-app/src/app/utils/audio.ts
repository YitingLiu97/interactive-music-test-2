import * as Tone from "tone";

let player: Tone.Player;
let panner: Tone.Panner;
let volume: Tone.Volume;

export async function setupPlayer(url:string){
    await Tone.start();
    player = new Tone.Player(url);
    volume = new Tone.Volume(0);
    panner = new Tone.Panner(0);

    player.connect(panner);
    panner.connect(volume);
    volume.toDestination();
    player.autostart = false;

}

export function startPlayback(){
    player.start();
}
export function stopPlayback(){
    player.stop();
}

export function AdjustVolume(value: number) {
    if (volume) volume.volume.value = value; // value in dB
}

// 0 to 1 
export function AdjustPanning(value: number) {
    if (panner) panner.pan.value = value; // value from -1 to 1
}