import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

export function AIAdaptationPanel() {
  const plan = useStore(runtimeStore, (state) => state.sceneJourneyPlan);
  const neuro = useStore(runtimeStore, (state) => state.neuroState);
  const plannerMessage = useStore(
    runtimeStore,
    (state) => state.sessionRuntime.plannerMessage,
  );
  const decision2History = useStore(
    runtimeStore,
    (state) => state.decision2History,
  );
  return (
    <section className="glass-panel data-panel adaptation-panel">
      <h2>AI Adaptation</h2>
      <dl>
        <div>
          <dt>Attention</dt>
          <dd>
            {neuro?.attention
              ? `Reference-relative ${neuro.attention.relativePosition?.toFixed(2) ?? 'unavailable'} · ${neuro.attention.trajectory ?? neuro.attention.trend}`
              : neuro
                ? `${Math.round(neuro.arousal.value * 100)}% · ${neuro.arousal.trend}`
                : 'Unavailable'}
          </dd>
        </div>
        <div>
          <dt>Latest Checkpoint</dt>
          <dd>{plannerMessage ?? 'Awaiting checkpoint'}</dd>
        </div>
        <div>
          <dt>Decision 2 Executions ({decision2History.length})</dt>
          <dd>
            {decision2History.length ? (
              <ol className="decision-2-history">
                {decision2History.map((entry, index) => (
                  <li key={`${entry.timestampMs}-${index}`}>
                    <time>{Math.floor(entry.timestampMs / 60_000)}:{String(Math.floor(entry.timestampMs / 1_000) % 60).padStart(2, '0')}</time>
                    <span>{entry.message.replace(/^Decision 2\s*[·路]\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            ) : (
              'No Decision 2 applied yet'
            )}
          </dd>
        </div>
        <div>
          <dt>Planner Interpretation</dt>
          <dd>{plan?.reasoningSummary ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Adaptation Goal</dt>
          <dd>{plan?.userJourney.goal ?? 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Scene Update</dt>
          <dd>
            {plan?.userJourney.waypoints.at(-1)?.locationId ?? 'Unavailable'}
          </dd>
        </div>
        <div>
          <dt>Transition Policy</dt>
          <dd>
            {plan
              ? `${plan.transitionPolicy.curve} over ${plan.transitionPolicy.defaultDurationMs} ms`
              : 'Unavailable'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
