import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ActionRenderer } from '../src/scene/ActionRenderer.js';
import { AmbientRenderer } from '../src/scene/AmbientRenderer.js';
import { EventRenderer } from '../src/scene/EventRenderer.js';
import { JourneyRenderer } from '../src/scene/JourneyRenderer.js';
import { ListenerRenderer } from '../src/scene/ListenerRenderer.js';
import { snapshot } from './fixtures.js';

describe('authoritative scene renderers', () => {
  it('uses the exact listener transform and journey coordinates', () => {
    const scene = new THREE.Scene(); const listener = new ListenerRenderer(); const journey = new JourneyRenderer();
    listener.initialize(scene); journey.initialize(scene); const state = snapshot(); listener.update(state); journey.update(state);
    expect(listener.object.position.toArray()).toEqual([1, 2, 3]);
    expect(listener.object.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    const planned = journey.group.getObjectByName('plannedPath') as THREE.Line;
    expect(Array.from(planned.geometry.getAttribute('position').array)).toEqual([0, 0, 0, 2, 0, -2]);
    listener.dispose(); journey.dispose();
  });

  it('renders only localized ambience and consumes authoritative action/event positions', () => {
    const scene = new THREE.Scene(); const ambient = new AmbientRenderer(); const action = new ActionRenderer(); const event = new EventRenderer();
    [ambient, action, event].forEach((renderer) => renderer.initialize(scene)); const state = snapshot();
    ambient.update(state); action.update(state); event.update(state);
    expect(ambient.objects.size).toBe(1); expect(ambient.getObject('wind')).toBeUndefined();
    expect(action.getObject('breath')?.position.toArray()).toEqual([9, 8, 7]);
    expect(event.getObject('bird')?.position.toArray()).toEqual([-3, 4, -5]);
    state.action = []; action.update(state); expect(action.objects.size).toBe(0);
    [ambient, action, event].forEach((renderer) => renderer.dispose());
  });
});
