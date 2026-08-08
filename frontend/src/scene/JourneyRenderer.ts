import type { RuntimeWorldState, Vector3 } from '@neuroscape/contracts';
import * as THREE from 'three';
import type { SceneRenderer } from './ThreeScene.js';

const line = (points: readonly Vector3[], color: number) => new THREE.Line(
  new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point))),
  new THREE.LineBasicMaterial({ color }),
);

export class JourneyRenderer implements SceneRenderer {
  readonly group = new THREE.Group();
  initialize(scene: THREE.Scene): void { this.group.name = 'journey'; scene.add(this.group); }
  update(state: Readonly<RuntimeWorldState>): void {
    this.#clear();
    const journey = state.journey;
    if (!journey) return;
    if (journey.plannedPath.length > 1) {
      const planned = line(journey.plannedPath, 0x357661); planned.name = 'plannedPath'; this.group.add(planned);
      const start = journey.plannedPath[journey.currentSegmentIndex];
      const end = journey.plannedPath[journey.currentSegmentIndex + 1];
      if (start && end) { const current = line([start, end], 0xe5ff93); current.name = 'currentSegment'; this.group.add(current); }
    }
    journey.remainingWaypoints.forEach((point, index) => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0xa7d8c5 }));
      marker.position.fromArray(point); marker.name = `remainingWaypoint:${index}`; this.group.add(marker);
    });
    this.group.userData = { currentSegmentIndex: journey.currentSegmentIndex };
  }
  dispose(): void { this.#clear(); this.group.removeFromParent(); }
  #clear(): void {
    this.group.children.splice(0).forEach((child) => {
      child.removeFromParent();
      if ('geometry' in child) (child.geometry as THREE.BufferGeometry).dispose();
      if ('material' in child) (child.material as THREE.Material).dispose();
    });
  }
}
