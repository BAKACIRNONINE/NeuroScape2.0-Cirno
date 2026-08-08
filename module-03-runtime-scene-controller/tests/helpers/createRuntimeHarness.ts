import { ActionController } from '../../src/controllers/ActionController.js';
import { AmbientController } from '../../src/controllers/AmbientController.js';
import { EventController } from '../../src/controllers/EventController.js';
import { JourneyController } from '../../src/controllers/JourneyController.js';
import { TransitionController } from '../../src/controllers/TransitionController.js';
import { RuntimeController } from '../../src/core/RuntimeController.js';
import { RuntimeWorldStateBuilder } from '../../src/core/RuntimeWorldStateBuilder.js';
import { RuntimeEventBus } from '../../src/events/RuntimeEvents.js';
import { SceneGraph } from '../../src/scene-graph/SceneGraph.js';
import { SemanticLocationMapper } from '../../src/scene-graph/SemanticLocationMapper.js';
import { PlanValidator } from '../../src/validation/PlanValidator.js';
import { sceneGraphDefinitionFixture } from '../fixtures/phase1Fixtures.js';

export function createRuntimeHarness() {
  const graph = new SceneGraph(sceneGraphDefinitionFixture);
  const mapper = new SemanticLocationMapper(graph);
  const events = new RuntimeEventBus();
  const transitions = new TransitionController(events);
  const journey = new JourneyController(mapper, events);
  const ambient = new AmbientController(mapper, transitions);
  const action = new ActionController(transitions);
  const event = new EventController(mapper, transitions, events);
  const controller = new RuntimeController({
    validator: new PlanValidator(graph),
    stateBuilder: new RuntimeWorldStateBuilder(),
    journey,
    ambient,
    action,
    event,
    transitions,
    events,
  });
  return { controller, graph, mapper, events, transitions, journey, ambient, action, event };
}
