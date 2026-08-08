import { describe, expect, it } from 'vitest';
import { computeSpatialDiagnostics, HRTFRenderer, relativePosition } from '../src/audio/HRTFRenderer.js';
import { FakeAudioContext, FakeNode, FakePanner } from './audioFakes.js';

describe('HRTFRenderer', () => {
  it('computes relative position, azimuth, elevation, and distance in the runtime convention', () => {
    expect(relativePosition([2, 3, -4], [1, 1, -1])).toEqual([1, 2, -3]);
    const result = computeSpatialDiagnostics([1, 1, -1], [0, 0, 0], [0, 0, 0, 1]);
    expect(result.distance).toBeCloseTo(Math.sqrt(3)); expect(result.azimuthDegrees).toBeCloseTo(45); expect(result.elevationDegrees).toBeCloseTo(35.264);
  });
  it('applies the inverse listener quaternion before positioning the HRTF node', () => {
    const result = computeSpatialDiagnostics([0, 0, -1], [0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
    expect(result.listenerSpacePosition[0]).toBeCloseTo(1); expect(result.azimuthDegrees).toBeCloseTo(90);
    const context = new FakeAudioContext(); const renderer = new HRTFRenderer(context as unknown as BaseAudioContext, new FakeNode() as unknown as AudioNode);
    const panner = renderer.createSpatializer(); renderer.update('sound', panner, [0, 0, -1], [0, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2], 2);
    expect((panner as unknown as FakePanner).panningModel).toBe('HRTF'); renderer.dispose(); expect((panner as unknown as FakePanner).disconnected).toBe(true);
  });
});
