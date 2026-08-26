import type { AmbientState, RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import { disposeObject, syncObjects } from './objectRendererUtils.js';
import type { SceneRenderer } from './ThreeScene.js';

export class AmbientRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  readonly objects = new Map<string, THREE.Object3D>();
  readonly globalObjects = new Map<string, THREE.Object3D>();
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
    const global = state.ambient.filter((item) => item.mode === 'global');
    syncObjects(this.group, this.globalObjects, global, () => new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.025, 6, 48),
      new THREE.MeshBasicMaterial({ color: 0x63d9b7, transparent: true, opacity: 0.35, depthWrite: false }),
    ), (object, value) => {
      const index = global.findIndex((item) => item.id === value.id);
      object.position.set(...state.listener.worldPosition);
      object.position.y += 0.15 + index * 0.16;
      object.rotation.x = Math.PI / 2;
      object.scale.setScalar(1 + index * 0.18);
      object.visible = value.active;
      ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, Math.min(0.65, value.gain));
      object.userData = { assetId: value.assetId, gain: value.gain, mode: value.mode };
    });
    this.group.userData = { global: global.map((item) => ({ id: item.id, assetId: item.assetId, gain: item.gain, active: item.active })) };
  }
  getObject(id: string): THREE.Object3D | undefined { return this.objects.get(id); }
  dispose(): void { this.objects.forEach(disposeObject); this.globalObjects.forEach(disposeObject); this.objects.clear(); this.globalObjects.clear(); this.group.removeFromParent(); }
}
