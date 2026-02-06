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
