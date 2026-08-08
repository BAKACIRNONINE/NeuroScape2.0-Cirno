import type { RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import type { SceneRenderer } from './ThreeScene.js';

export class DebugRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  initialize(scene: THREE.Scene): void {
    this.group.name = 'debug';
    this.group.add(new THREE.GridHelper(30, 30, 0x315548, 0x172f27), new THREE.AxesHelper(2));
    scene.add(this.group);
  }
  update(state: Readonly<RuntimeWorldState>): void {
    this.group.userData = {
      timestampMs: state.timestampMs,
      listenerPosition: [...state.listener.worldPosition],
      semanticLocation: state.listener.semanticLocation,
      ids: [...state.ambient, ...state.action, ...state.event].map((item) => item.id),
    };
  }
  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.LineSegments) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
    this.group.removeFromParent();
  }
}
