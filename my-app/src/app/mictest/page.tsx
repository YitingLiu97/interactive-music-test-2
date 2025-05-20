import RecorderForAudioCircle from "@/Components/RecorderForAudioCircle";
export default function MicTestPage() {
  return (
    <div >
       <RecorderForAudioCircle width={300} height={500}  loopDurationFromStem={30}/>
    </div>
  );
}
