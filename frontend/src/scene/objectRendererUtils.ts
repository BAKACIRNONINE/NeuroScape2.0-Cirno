import * as THREE from 'three';

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
  object.removeFromParent();
}

export function syncObjects<T extends { id: string }>(
  sceneGroup: THREE.Group,
  objects: Map<string, THREE.Object3D>,
  values: readonly T[],
  create: (value: T) => THREE.Object3D,
  update: (object: THREE.Object3D, value: T) => void,
): void {
  const incoming = new Set(values.map((value) => value.id));
  for (const [id, object] of objects) if (!incoming.has(id)) { disposeObject(object); objects.delete(id); }
  values.forEach((value) => {
    let object = objects.get(value.id);
    if (!object) { object = create(value); object.name = value.id; objects.set(value.id, object); sceneGroup.add(object); }
    update(object, value);
  });
}
