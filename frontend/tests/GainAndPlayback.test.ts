import { describe, expect, it } from 'vitest';
import { GainManager } from '../src/audio/GainManager.js';
import { PlaybackScheduler, type PlaybackTarget } from '../src/audio/PlaybackScheduler.js';
import { FakeAudioContext, FakeAudioParam, FakeNode, fakeBuffer } from './audioFakes.js';

describe('gain and playback scheduling', () => {
  it('ramps authoritative gain using AudioParam scheduling', () => {
    const parameter = new FakeAudioParam(); parameter.value = 0.2; new GainManager(0.05).apply(parameter as unknown as AudioParam, 0.8, 3);
    expect(parameter.calls).toEqual([['cancel', 0, 3], ['set', 0.2, 3], ['ramp', 0.8, 3.05]]);
  });
  it('prevents duplicate playback and recreates one-shot source nodes after reactivation', () => {
    const context = new FakeAudioContext(); const scheduler = new PlaybackScheduler(context as unknown as BaseAudioContext);
    const target: PlaybackTarget = { input: new FakeNode() as unknown as AudioNode, source: null, playing: false, activationPlayed: false };
    expect(scheduler.start(target, fakeBuffer, false, 2)).toBe(true); expect(scheduler.start(target, fakeBuffer, false, 2)).toBe(false);
    scheduler.stop(target, 2); expect(scheduler.start(target, fakeBuffer, false, 2)).toBe(false);
    scheduler.resetActivation(target); expect(scheduler.start(target, fakeBuffer, false, 2)).toBe(true); expect(context.sources).toHaveLength(2);
  });
});
