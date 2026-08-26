import type { EventState, RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import { disposeObject, syncObjects } from './objectRendererUtils.js';
import type { SceneRenderer } from './ThreeScene.js';

const lifecycleColor: Record<EventState['lifecycle'], number> = { waiting: 0x7598a8, active: 0xff9575, finished: 0x555b59 };

export class EventRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  readonly objects = new Map<string, THREE.Object3D>();
  initialize(scene: THREE.Scene): void { this.group.name = 'events'; scene.add(this.group); }
  update(state: Readonly<RuntimeWorldState>): void {
    syncObjects(this.group, this.objects, state.event, () => new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38), new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.85 }),
    ), (object, value) => {
      object.position.fromArray(value.worldPosition);
      object.visible = value.active || value.lifecycle === 'waiting';
      object.scale.setScalar(value.active ? 1.6 : 0.9);
      (object as THREE.Mesh).material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial;
      ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(lifecycleColor[value.lifecycle]);
      object.userData = { assetId: value.assetId, velocity: [...value.velocity], gain: value.gain, lifecycle: value.lifecycle };
    });
  }
  getObject(id: string): THREE.Object3D | undefined { return this.objects.get(id); }
  dispose(): void { this.objects.forEach(disposeObject); this.objects.clear(); this.group.removeFromParent(); }
}
