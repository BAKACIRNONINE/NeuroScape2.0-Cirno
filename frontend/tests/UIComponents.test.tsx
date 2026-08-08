import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { runtimeStore } from '../src/runtime/RuntimeStore.js';
import { ActiveSoundscapePanel } from '../src/ui/components/ActiveSoundscapePanel.js';
import { AIAdaptationPanel } from '../src/ui/components/AIAdaptationPanel.js';
import { JourneyPlanPanel } from '../src/ui/components/JourneyPlanPanel.js';
import { NeuroStatePanel } from '../src/ui/components/NeuroStatePanel.js';
import { LoadingPage } from '../src/ui/pages/LoadingPage.js';
import { PreviewPage } from '../src/ui/pages/PreviewPage.js';
import { SessionPage } from '../src/ui/pages/SessionPage.js';
import { HomePage } from '../src/ui/pages/HomePage.js';
import { journeyPlan, neuroState, snapshot } from './fixtures.js';

beforeEach(() => vi.spyOn(runtimeStore, 'getInitialState').mockImplementation(() => runtimeStore.getState()));
afterEach(() => { vi.restoreAllMocks(); runtimeStore.setState({ neuroState: null, neuroStateReceivedAtMs: null, sceneJourneyPlan: null, sceneJourneyPlanReceivedAtMs: null, runtimeWorldState: null }); });
const populate = () => { runtimeStore.getState().publishRuntimeWorldState(snapshot()); runtimeStore.getState().publishNeuroState(neuroState(), 100); runtimeStore.getState().publishSceneJourneyPlan(journeyPlan(), 100); };
describe('migrated NeuroScape UI', () => {
  it('renders planner and actual soundscape data without invented items', () => { populate(); const plan = renderToStaticMarkup(<JourneyPlanPanel />); const sounds = renderToStaticMarkup(<ActiveSoundscapePanel />); expect(plan).toContain('stream-bank'); expect(plan).toContain('smoothstep'); expect(sounds).toContain('ambient.water'); expect(sounds).toContain('event.bird'); });
  it('displays canonical Arousal and backend planner reasoning', () => { populate(); const neuro = renderToStaticMarkup(<NeuroStatePanel />); const ai = renderToStaticMarkup(<AIAdaptationPanel />); expect(neuro).toContain('Arousal'); expect(neuro).not.toContain('Relaxation'); expect(neuro).toContain('41%'); expect(ai).toContain('Move gradually toward running water.'); });
  it('renders loading, supplied preview semantics, and the three-column session shell', () => { populate(); runtimeStore.getState().setSessionRuntime({ status: 'loading', plannerStatus: 'planning', plannerMessage: 'Planning a safe transition' }); expect(renderToStaticMarkup(<LoadingPage />)).toContain('Planning a safe transition'); expect(renderToStaticMarkup(<PreviewPage onEnter={() => undefined} />)).toContain('Support sustained calm'); const session = renderToStaticMarkup(<SessionPage />); expect(session).toContain('Journey Plan'); expect(session).toContain('Runtime World'); expect(session).toContain('Neuro State'); });
  it('keeps replay and live operation on the same singleton Runtime Store', () => { populate(); const before = runtimeStore.getState().runtimeWorldState; expect(before).not.toBeNull(); expect(renderToStaticMarkup(<SessionPage />)).toContain(String(before!.timestampMs)); });
  it('labels integration and diagnostic entry points and session modes explicitly', () => { const home = renderToStaticMarkup(<HomePage onStart={() => undefined} onDemo={() => undefined} onLongDemo={() => undefined} onSpatialDiagnostic={() => undefined} />); expect(home).toContain('deterministic forest'); expect(home).toContain('long forest validation'); expect(home).toContain('spatial event stress test'); expect(renderToStaticMarkup(<SessionPage mode="demo" />)).toContain('Module 03 active'); expect(renderToStaticMarkup(<SessionPage mode="long-demo" />)).toContain('Long validation'); expect(renderToStaticMarkup(<SessionPage mode="diagnostic" />)).toContain('Spatial diagnostic'); });
});
