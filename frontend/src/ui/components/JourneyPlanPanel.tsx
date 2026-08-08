import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

export function JourneyPlanPanel() {
  const plan = useStore(runtimeStore, (state) => state.sceneJourneyPlan); const runtime = useStore(runtimeStore, (state) => state.runtimeWorldState);
  const destination = plan?.userJourney.waypoints.at(-1)?.locationId;
  return <section className="glass-panel data-panel"><h2>Journey Plan</h2><dl>
    <div><dt>Current Location</dt><dd>{runtime?.listener.semanticLocation ?? 'Unavailable'}</dd></div>
    <div><dt>Destination</dt><dd>{destination ?? 'Unavailable'}</dd></div>
    <div><dt>Current Goal</dt><dd>{plan?.userJourney.goal ?? 'Unavailable'}</dd></div>
    <div><dt>Journey</dt><dd>{plan?.userJourney.waypoints.map((point) => point.locationId).join(' → ') || 'Unavailable'}</dd></div>
    <div><dt>Transition Policy</dt><dd>{plan ? `${plan.transitionPolicy.curve}, ${plan.transitionPolicy.defaultDurationMs} ms` : 'Unavailable'}</dd></div>
    <div><dt>Planning Horizon</dt><dd>{plan ? `${plan.planningHorizonSec} sec` : 'Unavailable'}</dd></div>
  </dl></section>;
}
