export class GainManager {
  constructor(readonly rampSeconds = 0.04) {}
  apply(parameter: AudioParam, gain: number, time: number): void {
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(parameter.value, time);
    parameter.linearRampToValueAtTime(gain, time + this.rampSeconds);
  }
  setMaster(parameter: AudioParam, gain: number, time: number): void {
    this.apply(parameter, Math.min(1, Math.max(0, gain)), time);
  }
  applyEnvelope(
    parameter: AudioParam,
    peak: number,
    startTime: number,
    durationSeconds: number,
    fadeInSeconds: number,
    fadeOutSeconds: number,
  ): void {
    const end = startTime + Math.max(0, durationSeconds);
    const fadeInEnd = Math.min(end, startTime + Math.max(0, fadeInSeconds));
    const fadeOutStart = Math.max(fadeInEnd, end - Math.max(0, fadeOutSeconds));
    parameter.cancelScheduledValues(startTime);
    parameter.setValueAtTime(0, startTime);
    parameter.linearRampToValueAtTime(peak, fadeInEnd);
    parameter.setValueAtTime(peak, fadeOutStart);
    parameter.linearRampToValueAtTime(0, end);
  }
  release(parameter: AudioParam, time: number, fadeOutSeconds: number): void {
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(parameter.value, time);
    parameter.linearRampToValueAtTime(0, time + Math.max(0, fadeOutSeconds));
  }
  applyBurstSequence(
    parameter: AudioParam,
    gains: readonly number[],
    startTime: number,
    clipDurationSeconds: number,
    repeatGapSeconds: number,
  ): void {
    parameter.cancelScheduledValues(startTime);
    gains.forEach((gain, index) => {
      parameter.setValueAtTime(
        gain,
        startTime + index * (clipDurationSeconds + repeatGapSeconds),
      );
    });
  }
}
