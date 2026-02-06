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

// Graph layout and rendering
export {
  layoutGraph,
  createGraphNode,
  createGraphEdge,
  truncateLabel,
  affinityToRelationType,
  affinityToStrength,
  nodesOverlap,
  resolveOverlaps,
  filterByDepth,
  DEFAULT_LAYOUT_CONFIG,
} from './graph-layout.js';
export type {
  GraphNode,
  GraphEdge,
  Graph,
  LayoutConfig,
  RelationshipStrength,
  RelationshipType,
} from './graph-layout.js';

export {
  RenderGrid,
  GraphRenderer,
  RELATIONSHIP_COLORS,
  STRENGTH_LINES,
  ARROWS,
  ENTITY_ICONS,
  renderLegend,
} from './graph-renderer.js';
export type { GridCell } from './graph-renderer.js';

// Relationships panel
export {
  RelationshipsPanel,
  createRelationshipsPanelLayout,
} from './relationships-panel.js';
export type { RelationshipFilter } from './relationships-panel.js';

// Timeline panel
export {
  TimelinePanel,
  createTimelinePanelLayout,
  ZOOM_SCALES,
  SIGNIFICANCE_MARKERS,
  CATEGORY_COLORS as TIMELINE_CATEGORY_COLORS,
} from './timeline.js';
export type {
  TimelineZoomLevel,
  TimelineTrack,
  EraMarker,
} from './timeline.js';

// Statistics panel
export {
  StatisticsPanel,
  createStatsPanelLayout,
  CHART_BARS,
  FILL_CHARS,
  renderBarChart,
  renderVerticalBars,
  renderLineChart,
} from './stats.js';
export type {
  StatsView,
  DataPoint,
  TimeSeries,
  WorldStats,
} from './stats.js';

// Fingerprint panel
export {
  FingerprintPanel,
  createFingerprintPanelLayout,
  renderSparkline,
  renderProgressBar,
  renderHexChart,
  renderCivPalette,
  renderCivPalettePlain,
  SPARKLINE_CHARS,
} from './fingerprint-panel.js';

// Branch comparison panel
export {
  BranchComparisonPanel,
  createBranchComparisonPanelLayout,
  compareBranches,
} from './branch-view.js';
export type {
  BranchRef,
  UniqueEntity,
  TerritoryDifference,
  BranchComparison,
} from './branch-view.js';
