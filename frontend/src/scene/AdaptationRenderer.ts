import type { RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import type { SceneRenderer } from './ThreeScene.js';

const EFFECT_DURATION_MS = 12_000;

export class AdaptationRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  readonly rings = [0, 1, 2].map(
    (index) =>
      new THREE.Mesh(
        new THREE.TorusGeometry(0.8 + index * 0.5, 0.045, 8, 48),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xffd77a : 0x79ffe1,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      ),
  );
  #startedAtMs: number | null = null;

  initialize(scene: THREE.Scene): void {
    this.group.name = 'decision-2-effect';
    this.rings.forEach((ring) => {
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;
      this.group.add(ring);
    });
    scene.add(this.group);
  }

  trigger(state: Readonly<RuntimeWorldState>, message: string): void {
    this.#startedAtMs = state.timestampMs;
    this.group.position.fromArray(state.listener.worldPosition);
    this.group.userData = { message, triggeredAtMs: state.timestampMs };
    this.update(state);
  }

  update(state: Readonly<RuntimeWorldState>): void {
    if (this.#startedAtMs === null) return;
    const elapsed = state.timestampMs - this.#startedAtMs;
    const active = elapsed >= 0 && elapsed <= EFFECT_DURATION_MS;
    this.group.position.fromArray(state.listener.worldPosition);
    this.rings.forEach((ring, index) => {
      ring.visible = active;
      if (!active) return;
      const phase = Math.max(0, Math.min(1, elapsed / EFFECT_DURATION_MS));
      const wave = 0.65 + Math.sin(phase * Math.PI * 8 + index) * 0.18;
      ring.scale.setScalar(1 + phase * (1.1 + index * 0.25));
      (ring.material as THREE.MeshBasicMaterial).opacity = wave * (1 - phase);
    });
  }

  dispose(): void {
    this.rings.forEach((ring) => {
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    });
    this.group.removeFromParent();
  }
}
