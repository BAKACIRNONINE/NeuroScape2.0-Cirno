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
import { FixedAudioSessionPage } from '../src/ui/pages/FixedAudioSessionPage.js';
import { journeyPlan, neuroState, snapshot } from './fixtures.js';

beforeEach(() =>
  vi
    .spyOn(runtimeStore, 'getInitialState')
    .mockImplementation(() => runtimeStore.getState()),
);
afterEach(() => {
  vi.restoreAllMocks();
  runtimeStore.setState({
    neuroState: null,
    neuroStateReceivedAtMs: null,
    sceneJourneyPlan: null,
    sceneJourneyPlanReceivedAtMs: null,
    runtimeWorldState: null,
    decision2History: [],
  });
});
const populate = () => {
  runtimeStore.getState().publishRuntimeWorldState(snapshot());
  runtimeStore.getState().publishNeuroState(neuroState(), 100);
  runtimeStore.getState().publishSceneJourneyPlan(journeyPlan(), 100);
};
describe('migrated NeuroScape UI', () => {
  it('renders planner and actual soundscape data without invented items', () => {
    populate();
    const plan = renderToStaticMarkup(<JourneyPlanPanel />);
    const sounds = renderToStaticMarkup(<ActiveSoundscapePanel />);
    expect(plan).toContain('stream-bank');
    expect(plan).toContain('smoothstep');
    expect(sounds).toContain('ambient.water');
    expect(sounds).toContain('event.bird');
  });
  it('displays baseline-relative evidence and backend planner reasoning', () => {
    populate();
    const neuro = renderToStaticMarkup(<NeuroStatePanel />);
    const ai = renderToStaticMarkup(<AIAdaptationPanel />);
    expect(neuro).toContain('Baseline-Relative Neuro State');
    expect(neuro).toContain('TBR delta from baseline');
    expect(neuro).not.toContain('Relaxation');
    expect(ai).toContain('Move gradually toward running water.');
  });
  it('keeps completed Decision 2 executions visible', () => {
    runtimeStore.getState().recordDecision2({
      timestampMs: 180_000,
      message: 'Decision 2 · Added a distant bird cue.',
    });
    const ai = renderToStaticMarkup(<AIAdaptationPanel />);
    expect(ai).toContain('Decision 2 Executions (1)');
    expect(ai).toContain('3:00');
    expect(ai).toContain('Added a distant bird cue.');
  });
  it('renders loading, supplied preview semantics, and the three-column session shell', () => {
    populate();
    runtimeStore.getState().setSessionRuntime({
      status: 'loading',
      plannerStatus: 'planning',
      plannerMessage: 'Planning a safe transition',
    });
    expect(renderToStaticMarkup(<LoadingPage />)).toContain(
      'Planning a safe transition',
    );
    expect(
      renderToStaticMarkup(<PreviewPage onEnter={() => undefined} />),
    ).toContain('Support sustained calm');
    const session = renderToStaticMarkup(<SessionPage />);
    expect(session).toContain('Journey Plan');
    expect(session).toContain('Runtime World');
    expect(session).toContain('Neuro State');
  });
  it('keeps replay and live operation on the same singleton Runtime Store', () => {
    populate();
    const before = runtimeStore.getState().runtimeWorldState;
    expect(before).not.toBeNull();
    expect(renderToStaticMarkup(<SessionPage />)).toContain(
      String(before!.timestampMs),
    );
  });
  it('shows the three study entry points and labels non-adaptive runtime explicitly', () => {
    const home = renderToStaticMarkup(
      <HomePage
        onCalibration={() => undefined}
        onRealTime={() => undefined}
        onNonAdaptive={() => undefined}
      />,
    );
    expect(home).toContain('Calibration');
    expect(home).toContain('Real-Time Adaptive Meditation');
    expect(home).toContain('Non-Adaptive Meditation');
    const session = renderToStaticMarkup(
      <FixedAudioSessionPage onHome={() => undefined} />,
    );
    expect(session).toContain('same opening voice and continuous forest');
    expect(session).toContain('Muse EEG');
    expect(session).toContain('never changes playback');
    expect(session).toContain('/audio/forest/ambient/forest_ambient_bed_01.mp3');
    expect(session).toContain(
      '/audio/common/opening/meditation_opening.mp3',
    );
  });
});
