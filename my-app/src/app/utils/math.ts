export function mapRange(value:number, inMin: number, inMax:number, outMin:number, outMax :number){
   return (value-inMin)/(inMax-inMin)*(outMax-outMin)+outMin;
}