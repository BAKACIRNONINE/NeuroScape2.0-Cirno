import type { RuntimeWorldState } from '@neuroscape/contracts';
import * as THREE from 'three';
import { ActionRenderer } from './ActionRenderer.js';
import { AmbientRenderer } from './AmbientRenderer.js';
import { DebugRenderer } from './DebugRenderer.js';
import { EventRenderer } from './EventRenderer.js';
import { JourneyRenderer } from './JourneyRenderer.js';
import { ListenerRenderer } from './ListenerRenderer.js';

export interface SceneRenderer { initialize(scene: THREE.Scene): void; update(state: Readonly<RuntimeWorldState>): void; dispose(): void }

export class ThreeScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  readonly layers: readonly SceneRenderer[];
  #renderer: THREE.WebGLRenderer | null = null;

  constructor() {
    this.scene.background = new THREE.Color(0x06100d);
    this.camera.position.set(12, 10, 12);
    this.camera.lookAt(0, 1, -3);
    this.layers = [new DebugRenderer(), new JourneyRenderer(), new AmbientRenderer(), new ActionRenderer(), new EventRenderer(), new ListenerRenderer()];
    this.layers.forEach((layer) => layer.initialize(this.scene));
  }

  mount(container: HTMLElement): void {
    this.#renderer = new THREE.WebGLRenderer({ antialias: true });
    this.#renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2));
    container.replaceChildren(this.#renderer.domElement);
    this.resize(container.clientWidth, container.clientHeight);
  }

  update(state: Readonly<RuntimeWorldState>): void {
    this.layers.forEach((layer) => layer.update(state));
    this.render();
  }

  resize(width: number, height: number): void {
    const safeHeight = Math.max(height, 1);
    this.camera.aspect = Math.max(width, 1) / safeHeight;
    this.camera.updateProjectionMatrix();
    this.#renderer?.setSize(Math.max(width, 1), safeHeight, false);
    this.render();
  }

  render(): void { this.#renderer?.render(this.scene, this.camera); }

  dispose(): void {
    this.layers.forEach((layer) => layer.dispose());
    this.#renderer?.dispose();
    this.#renderer?.domElement.remove();
    this.#renderer = null;
  }
}
