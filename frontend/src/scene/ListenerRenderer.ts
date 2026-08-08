import type { RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import type { SceneRenderer } from './ThreeScene.js';

export class ListenerRenderer implements SceneRenderer {
  readonly object = new THREE.Group();
  readonly forward = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 1.4, 0xc9ffea);
  #geometry = new THREE.SphereGeometry(0.28, 16, 12);
  #material = new THREE.MeshBasicMaterial({ color: 0x91e9c8, wireframe: true });
  initialize(scene: THREE.Scene): void {
    this.object.name = 'listener';
    this.object.add(new THREE.Mesh(this.#geometry, this.#material), this.forward);
    scene.add(this.object);
  }
  update(state: Readonly<RuntimeWorldState>): void {
    this.object.position.fromArray(state.listener.worldPosition);
    this.object.quaternion.fromArray(state.listener.orientation);
    this.object.userData = { semanticLocation: state.listener.semanticLocation, velocity: [...state.listener.velocity] };
  }
  dispose(): void { this.object.removeFromParent(); this.#geometry.dispose(); this.#material.dispose(); this.forward.dispose(); }
}
