import type { RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import { disposeObject, syncObjects } from './objectRendererUtils.js';
import type { SceneRenderer } from './ThreeScene.js';

export class ActionRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  readonly objects = new Map<string, THREE.Object3D>();
  initialize(scene: THREE.Scene): void { this.group.name = 'actions'; scene.add(this.group); }
  update(state: Readonly<RuntimeWorldState>): void {
    syncObjects(this.group, this.objects, state.action, () => new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xf0cb75, wireframe: true }),
    ), (object, value) => {
      // worldPosition is authoritative; attachment and relativePosition are debug metadata only.
      object.position.fromArray(value.worldPosition);
      object.visible = value.active;
      object.userData = { assetId: value.assetId, attachment: value.attachment, relativePosition: [...value.relativePosition], gain: value.gain };
    });
  }
  getObject(id: string): THREE.Object3D | undefined { return this.objects.get(id); }
  dispose(): void { this.objects.forEach(disposeObject); this.objects.clear(); this.group.removeFromParent(); }
}
