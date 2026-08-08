import type { AmbientState, RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import { disposeObject, syncObjects } from './objectRendererUtils.js';
import type { SceneRenderer } from './ThreeScene.js';

export class AmbientRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  readonly objects = new Map<string, THREE.Object3D>();
  initialize(scene: THREE.Scene): void { this.group.name = 'ambient'; scene.add(this.group); }
  update(state: Readonly<RuntimeWorldState>): void {
    const localized = state.ambient.filter((item): item is AmbientState & { worldPosition: [number, number, number] } => item.mode === 'localized');
    syncObjects(this.group, this.objects, localized, () => new THREE.Mesh(
      new THREE.SphereGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0x63a78f, wireframe: true }),
    ), (object, value) => {
      object.position.fromArray(value.worldPosition);
      object.visible = value.active;
      object.userData = { assetId: value.assetId, gain: value.gain, mode: value.mode };
    });
    this.group.userData = { global: state.ambient.filter((item) => item.mode === 'global').map((item) => ({ id: item.id, assetId: item.assetId, gain: item.gain, active: item.active })) };
  }
  getObject(id: string): THREE.Object3D | undefined { return this.objects.get(id); }
  dispose(): void { this.objects.forEach(disposeObject); this.objects.clear(); this.group.removeFromParent(); }
}
