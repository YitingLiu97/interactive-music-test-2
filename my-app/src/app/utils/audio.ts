import * as Tone from "tone";

let player: Tone.Player;
let panner: Tone.Panner;
let volume: Tone.Volume;

export async function setupPlayer(url:string){
    await Tone.start();
    player = new Tone.Player(url).toDestination();
    player.autostart = false;
}

export function startPlayback(){
    player.start();
}
export function stopPlayback(){
    player.stop();
}

export function AdjustVolume(value: number) {
    volume = new Tone.Volume(value).toDestination();
    player.connect(volume);
}

// 0 to 1 
export function AdjustPanning(value: number) {
    panner = new Tone.Panner(value).toDestination();
    player.connect(panner);

}