export class GainManager {
  constructor(readonly rampSeconds = 0.04) {}
  apply(parameter: AudioParam, gain: number, time: number): void {
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(parameter.value, time);
    parameter.linearRampToValueAtTime(gain, time + this.rampSeconds);
  }
  setMaster(parameter: AudioParam, gain: number, time: number): void { this.apply(parameter, Math.min(1, Math.max(0, gain)), time); }
}
