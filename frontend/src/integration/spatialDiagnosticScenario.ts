import type { EventPlanItem, NeuroState, SceneJourneyPlan, Vector3 } from '@neuroscape/contracts';
import type { SceneGraphDefinition } from '@neuroscape/runtime-scene-controller';

export const SPATIAL_DIAGNOSTIC_DURATION_MS = 150_000;
export const spatialDiagnosticPlanTransitionTimesMs = [0, 32_000, 48_000, 68_000, 86_000, 118_000, 136_000, 146_000] as const;

export const spatialDiagnosticPositions = {
  center:[0,0,0], front:[0,0,-6], right:[6,0,0], back:[0,0,6], left:[-6,0,0], frontRight:[4,0,-4], backRight:[4,0,4], backLeft:[-4,0,4], frontLeft:[-4,0,-4],
  nearFront:[0,0,-1.5], midFront:[0,0,-6], farFront:[0,0,-16], farFrontLeft:[-12,0,-12], nearLeft:[-1.5,0,-1], nearFrontRight:[2,0,-2], farBackRight:[12,0,12],
  aboveFront:[0,3,-5], aboveRight:[5,3,0], aboveBack:[0,3,5], aboveLeft:[-5,3,0], belowFront:[0,-3,-5], belowRight:[5,-3,0], belowBack:[0,-3,5], belowLeft:[-5,-3,0],
} as const satisfies Record<string, Vector3>;

const idFor = (name: keyof typeof spatialDiagnosticPositions) => `diagnostic_${name}`;
export const spatialDiagnosticSceneGraph: SceneGraphDefinition = { nodes:Object.entries(spatialDiagnosticPositions).map(([name, worldPosition]) => ({ id:`diagnostic_${name}`, worldPosition:[...worldPosition], neighbors:[], ambientAssetIds:[], eventAssetIds:['event.bird-pass','event.leaves'] })) };
const point = (name: keyof typeof spatialDiagnosticPositions, timestampMs: number) => ({ locationId:idFor(name), timestampMs });
const event = (id: string, assetId: 'event.bird-pass' | 'event.leaves', activationTimeMs: number, durationMs: number, trajectory: EventPlanItem['trajectory'], gain = .75): EventPlanItem => ({ id, assetId, activationTimeMs, durationMs, trajectory, gain });
const isolated = (id: string, assetId: 'event.bird-pass' | 'event.leaves', at: number, position: keyof typeof spatialDiagnosticPositions) => event(id,assetId,at,3_200,[point(position,at)]);

export const spatialDiagnosticPhases: readonly { id:string; startMs:number; endMs:number; events:readonly EventPlanItem[] }[] = [
  { id:'cardinal-horizontal', startMs:0, endMs:32_000, events:[
    isolated('cardinal-front','event.bird-pass',500,'front'), isolated('cardinal-right','event.leaves',4_500,'right'), isolated('cardinal-back','event.bird-pass',8_500,'back'), isolated('cardinal-left','event.leaves',12_500,'left'),
    isolated('cardinal-front-right','event.bird-pass',16_500,'frontRight'), isolated('cardinal-back-right','event.leaves',20_500,'backRight'), isolated('cardinal-back-left','event.bird-pass',24_500,'backLeft'), isolated('cardinal-front-left','event.leaves',28_500,'frontLeft'),
  ]},
  { id:'distance', startMs:32_000, endMs:48_000, events:[isolated('distance-near','event.bird-pass',32_500,'nearFront'), isolated('distance-mid','event.bird-pass',37_500,'midFront'), isolated('distance-far','event.bird-pass',42_500,'farFront')] },
  { id:'horizontal-orbit', startMs:48_000, endMs:68_000, events:[event('horizontal-orbit','event.bird-pass',48_000,19_500,[point('front',48_000),point('frontRight',50_375),point('right',52_750),point('backRight',55_125),point('back',57_500),point('backLeft',59_875),point('left',62_250),point('frontLeft',64_625),point('front',67_000)])] },
  { id:'curved-pass', startMs:68_000, endMs:86_000, events:[event('curved-pass','event.leaves',68_000,17_500,[point('farFrontLeft',68_000),point('nearLeft',73_500),point('nearFrontRight',79_000),point('farBackRight',85_000)])] },
  { id:'elevation', startMs:86_000, endMs:118_000, events:[
    isolated('elevation-above-front','event.bird-pass',86_500,'aboveFront'), isolated('elevation-above-right','event.leaves',90_500,'aboveRight'), isolated('elevation-above-back','event.bird-pass',94_500,'aboveBack'), isolated('elevation-above-left','event.leaves',98_500,'aboveLeft'),
    isolated('elevation-level','event.bird-pass',102_500,'front'), isolated('elevation-below-front','event.leaves',106_500,'belowFront'), isolated('elevation-below-right','event.bird-pass',110_500,'belowRight'), isolated('elevation-below-back','event.leaves',114_500,'belowBack'),
  ]},
  { id:'three-dimensional-spiral', startMs:118_000, endMs:136_000, events:[event('three-dimensional-spiral','event.bird-pass',118_000,17_500,[point('belowLeft',118_000),point('left',120_500),point('aboveLeft',123_000),point('aboveBack',125_500),point('backRight',128_000),point('right',130_500),point('belowRight',133_000),point('front',135_500)])] },
  { id:'opposing-sources', startMs:136_000, endMs:146_000, events:[
    event('opposing-bird','event.bird-pass',136_000,9_500,[point('aboveLeft',136_000),point('aboveFront',140_500),point('aboveRight',145_500)]),
    event('opposing-rustle','event.leaves',136_000,9_500,[point('belowRight',136_000),point('belowBack',140_500),point('belowLeft',145_500)]),
  ]},
  { id:'lifecycle-stress', startMs:146_000, endMs:150_000, events:[
    event('stress-1','event.bird-pass',146_000,1_200,[point('front',146_000),point('right',147_200)]), event('stress-2','event.leaves',147_000,1_200,[point('right',147_000),point('back',148_200)]),
    event('stress-3','event.bird-pass',148_000,1_200,[point('back',148_000),point('left',149_200)]), event('stress-4','event.leaves',149_000,700,[point('left',149_000),point('front',149_700)]),
  ]},
];

export const spatialDiagnosticPlans: readonly SceneJourneyPlan[] = spatialDiagnosticPhases.map((phase, index) => ({
  planId:`spatial-diagnostic-plan-${index + 1}`, planningHorizonSec:(phase.endMs - phase.startMs) / 1000, reasoningSummary:`Diagnostic phase ${index + 1}: ${phase.id}.`,
  userJourney:{ goal:'Keep the listener stationary while testing source motion', waypoints:[{ locationId:idFor('center'), pauseDurationMs:phase.endMs - phase.startMs }] },
  soundscape:{ ambient:[], action:[], event:[...phase.events] }, transitionPolicy:{ defaultDurationMs:300, curve:'smoothstep' },
}));

export const spatialDiagnosticNeuroStates: readonly NeuroState[] = [0,30_000,60_000,90_000,120_000,150_000].map((timestampMs) => ({ timestampMs, arousal:{ value:.5, trend:'stable' }, confidence:.95 }));
