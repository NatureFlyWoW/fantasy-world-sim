/**
 * UI panels module.
 * Provides specialized panel components for different views.
 */

// Event formatter
export {
  EventFormatter,
  CATEGORY_ICONS,
  defaultFormatter,
} from './event-formatter.js';

// Event log panel
export {
  EventLogPanel,
  createEventLogPanelLayout,
} from './event-log-panel.js';
export type {
  FilterConfig,
  Bookmark,
  CascadeNode,
  EventSelectionHandler,
  GoToLocationHandler,
  InspectEntityHandler,
} from './event-log-panel.js';

// Inspector panel
export {
  InspectorPanel,
  createInspectorPanelLayout,
} from './inspector-panel.js';
export type {
  InspectableEntityType,
  HistoryEntry,
  InspectorMode,
  InspectorSection,
} from './inspector-panel.js';

// Sub-inspectors
export { CharacterInspector } from './character-inspector.js';
export { LocationInspector } from './location-inspector.js';
export { FactionInspector } from './faction-inspector.js';
export { ArtifactInspector } from './artifact-inspector.js';
