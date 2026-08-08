import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

export function AIAdaptationPanel() {
  const plan = useStore(runtimeStore, (state) => state.sceneJourneyPlan); const neuro = useStore(runtimeStore, (state) => state.neuroState);
  return <section className="glass-panel data-panel adaptation-panel"><h2>AI Adaptation</h2><dl>
    <div><dt>Neuro Change / Context</dt><dd>{neuro?.historySummary ?? 'Unavailable'}</dd></div>
    <div><dt>Planner Interpretation</dt><dd>{plan?.reasoningSummary ?? 'Unavailable'}</dd></div>
    <div><dt>Adaptation Goal</dt><dd>{plan?.userJourney.goal ?? 'Unavailable'}</dd></div>
    <div><dt>Scene Update</dt><dd>{plan?.userJourney.waypoints.at(-1)?.locationId ?? 'Unavailable'}</dd></div>
    <div><dt>Transition Policy</dt><dd>{plan ? `${plan.transitionPolicy.curve} over ${plan.transitionPolicy.defaultDurationMs} ms` : 'Unavailable'}</dd></div>
  </dl></section>;
}
