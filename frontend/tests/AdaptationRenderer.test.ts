import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AdaptationRenderer } from '../src/scene/AdaptationRenderer.js';
import { snapshot } from './fixtures.js';

describe('Decision 2 adaptation visualization', () => {
  it('shows a pulse at the listener and expires after twelve seconds', () => {
    const renderer = new AdaptationRenderer();
    renderer.initialize(new THREE.Scene());
    const state = snapshot(180_000);
    renderer.trigger(state, 'Decision 2 applied');
    expect(renderer.group.position.toArray()).toEqual(state.listener.worldPosition);
    expect(renderer.rings.every((ring) => ring.visible)).toBe(true);
    renderer.update({ ...state, timestampMs: 193_000 });
    expect(renderer.rings.every((ring) => !ring.visible)).toBe(true);
    renderer.dispose();
  });
});
