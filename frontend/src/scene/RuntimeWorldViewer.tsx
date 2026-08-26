import { useEffect, useRef } from 'react';
import { runtimeStore } from '../runtime/RuntimeStore.js';
import { ThreeScene } from './ThreeScene.js';
import { runtimeDiagnostics } from '../debug/index.js';

export function RuntimeWorldViewer() {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const host = container.current;
    const world = new ThreeScene();
    world.mount(host);
    const renderLatest = () => { const state = runtimeStore.getState().runtimeWorldState; if (state) { const startedAt = performance.now(); world.update(state); runtimeDiagnostics.recordThreeFrame(performance.now() - startedAt); } };
    const unsubscribe = runtimeStore.subscribe((state, previous) => {
      if (state.runtimeWorldState !== previous.runtimeWorldState) renderLatest();
      if (state.decision2History.length > previous.decision2History.length && state.runtimeWorldState) {
        const latest = state.decision2History.at(-1);
        if (latest) world.showAdaptation(state.runtimeWorldState, latest.message);
      }
    });
    const resize = () => world.resize(host.clientWidth, host.clientHeight);
    globalThis.addEventListener('resize', resize);
    renderLatest();
    return () => { unsubscribe(); globalThis.removeEventListener('resize', resize); world.dispose(); };
  }, []);
  return <div className="runtime-viewer" ref={container} aria-label="Runtime world viewer" />;
}
