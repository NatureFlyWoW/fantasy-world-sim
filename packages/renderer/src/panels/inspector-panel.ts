/**
 * Entity Inspector Panel - displays detailed information about selected entities.
 * Detects entity type and delegates to specialized sub-inspectors.
 */

import type * as blessed from 'blessed';
import { BasePanel } from '../panel.js';
import type { PanelLayout, RenderContext, RenderableTile } from '../types.js';
import { PanelId } from '../types.js';
import { EventCategory, WorldFingerprintCalculator, FINGERPRINT_DOMAINS } from '@fws/core';
import type { EntityId, EventId, WorldEvent } from '@fws/core';
import { getSignificanceColor } from '../theme.js';
import { CharacterInspector } from './character-inspector.js';
import { LocationInspector } from './location-inspector.js';
import { FactionInspector } from './faction-inspector.js';
import { ArtifactInspector } from './artifact-inspector.js';
import { EventInspector } from './event-inspector.js';
import { RegionInspector } from './region-inspector.js';
import { CATEGORY_ICONS, EventFormatter, defaultFormatter } from './event-formatter.js';
import {
  TYPE_ICONS,
  TYPE_COLORS,
  ENTITY_NAME_COLOR,
  DIM_COLOR,
  createEntitySpanMap,
  findEntityAtPosition,
} from './inspector-prose.js';
import type { EntitySpanMap } from './inspector-prose.js';

/**
 * Domain prose mapping — atmospheric text for world pulse domains.
 * Thresholds: 0.0 (dormant), 0.1 (low), 0.3 (moderate), 0.5 (active), 0.7 (high)
 */
const DOMAIN_PROSE: Readonly<Record<string, readonly [number, string][]>> = {
  Warfare: [
    [0.7, 'Blood and fire rage across many fronts'],
    [0.5, 'Skirmishes flare across frontiers'],
    [0.3, 'Armies drill and borders are fortified'],
    [0.1, 'Soldiers stand watch, but swords stay sheathed'],
    [0.0, 'The realm knows an uneasy peace'],
  ],
  Magic: [
    [0.7, 'Arcane power crackles through the very air'],
    [0.5, 'Spellcasters reshape the world around them'],
    [0.3, 'Magic stirs in tower and sanctum'],
    [0.1, 'Faint enchantments linger in old places'],
    [0.0, 'Magic sleeps in forgotten places'],
  ],
  Religion: [
    [0.7, 'The gods intervene openly in mortal affairs'],
    [0.5, 'Faith moves multitudes to action'],
    [0.3, 'Prayers rise from temple and hearth'],
    [0.1, 'The faithful worship quietly'],
    [0.0, 'The heavens are silent'],
  ],
  Commerce: [
    [0.7, 'Markets bustle with exotic goods from distant lands'],
    [0.5, 'Trade caravans crisscross the realm'],
    [0.3, 'Merchants ply steady routes'],
    [0.1, 'Local markets trade in modest goods'],
    [0.0, 'Commerce is sparse and provincial'],
  ],
  Scholarship: [
    [0.7, 'A golden age of learning transforms society'],
    [0.5, 'Scholars push the boundaries of knowledge'],
    [0.3, 'Libraries grow and academies teach'],
    [0.1, 'A few seekers pursue understanding'],
    [0.0, 'Knowledge gathers dust in neglected halls'],
  ],
  Diplomacy: [
    [0.7, 'Envoys reshape the political landscape daily'],
    [0.5, 'Negotiations and alliances dominate the courts'],
    [0.3, 'Diplomats maintain cautious relations'],
    [0.1, 'Nations regard each other warily'],
    [0.0, 'Each realm keeps its own counsel'],
  ],
};

/**
 * Get atmospheric prose for a domain at a given value (0.0 to 1.0).
 */
function getDomainProse(domain: string, value: number): string {
  const thresholds = DOMAIN_PROSE[domain];
  if (thresholds === undefined) {
    return domain;
  }
  for (const [threshold, prose] of thresholds) {
    if (value >= threshold) {
      return prose;
    }
  }
  return thresholds[thresholds.length - 1]?.[1] ?? domain;
}

/**
 * Entity types that can be inspected.
 */
export type InspectableEntityType =
  | 'character'
  | 'location'
  | 'faction'
  | 'artifact'
  | 'event'
  | 'region'
  | 'unknown';

/**
 * Navigation history entry with section state persistence.
 */
export interface NavigationEntry {
  readonly entityId: EntityId;
  readonly entityType: InspectableEntityType;
  readonly scrollOffset: number;
  readonly expandedSections: readonly string[];
  readonly timestamp: number;
  /** For events: store the EventId (different from EntityId) */
  readonly eventId?: EventId;
  /** For regions: store coordinates (regions are not entities) */
  readonly regionCoords?: { readonly x: number; readonly y: number };
}

/**
 * Legacy alias for NavigationEntry.
 */
export type HistoryEntry = NavigationEntry;

/**
 * Inspector mode.
 */
export type InspectorMode = 'overview' | 'relationships' | 'timeline' | 'details';

/**
 * Data for the pre-simulation welcome screen.
 */
export interface WelcomeData {
  readonly seed: number;
  readonly factionCount: number;
  readonly characterCount: number;
  readonly settlementCount: number;
  readonly tensions: readonly string[];
  readonly worldSize: string;
}

/**
 * Section within an inspector.
 */
export interface InspectorSection {
  readonly id: string;
  readonly title: string;
  readonly summaryHint?: string;
  collapsed: boolean;
}

/** Maximum navigation history depth */
const MAX_HISTORY_DEPTH = 50;

/**
 * Inspector panel for viewing entity details.
 */
export class InspectorPanel extends BasePanel {
  private currentEntityId: EntityId | null = null;
  private currentEntityType: InspectableEntityType = 'unknown';
  private history: NavigationEntry[] = [];
  private historyIndex = -1;
  private mode: InspectorMode = 'overview';
  private scrollOffset = 0;
  private sections: InspectorSection[] = [];

  // Sub-inspectors
  private readonly characterInspector: CharacterInspector;
  private readonly locationInspector: LocationInspector;
  private readonly factionInspector: FactionInspector;
  private readonly artifactInspector: ArtifactInspector;
  private readonly eventInspector: EventInspector;
  private readonly regionInspector: RegionInspector;

  // Entity span tracking for clickable names
  private entitySpans: EntitySpanMap = createEntitySpanMap();

  // Current event/region data for non-entity inspections
  private currentEventId: EventId | null = null;
  private currentRegionCoords: { x: number; y: number } | null = null;
  private currentRegionTile: RenderableTile | null = null;

  // World dashboard
  private readonly fingerprintCalculator = new WorldFingerprintCalculator();
  private readonly formatter: EventFormatter = defaultFormatter;
  private dashboardScrollOffset = 0;

  // Welcome screen data (pre-simulation)
  private welcomeData: WelcomeData | null = null;
  private welcomeDismissed = false;

  // Event handlers
  private inspectHandler: ((entityId: EntityId) => void) | null = null;
  private goToLocationHandler: ((x: number, y: number) => void) | null = null;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Inspector');

    // Initialize sub-inspectors
    this.characterInspector = new CharacterInspector();
    this.locationInspector = new LocationInspector();
    this.factionInspector = new FactionInspector();
    this.artifactInspector = new ArtifactInspector();
    this.eventInspector = new EventInspector();
    this.regionInspector = new RegionInspector();
  }

  /**
   * Inspect an entity by ID.
   * Auto-detects entity type from components.
   */
  inspect(entityId: EntityId, context: RenderContext): void {
    const entityType = this.detectEntityType(entityId, context);
    this.inspectWithType(entityId, entityType, context);
  }

  /**
   * Inspect an entity with known type.
   */
  inspectWithType(entityId: EntityId, entityType: InspectableEntityType, _context: RenderContext): void {
    // Save current section state before navigating away
    this.saveCurrentSectionState();

    // Add to history if different from current
    if (this.currentEntityId !== entityId || this.currentEntityType !== entityType) {
      // Truncate forward history if navigating from middle
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      const entry: NavigationEntry = {
        entityId,
        entityType,
        scrollOffset: 0,
        expandedSections: [],
        timestamp: Date.now(),
      };
      this.history.push(entry);

      // Enforce maximum history depth
      if (this.history.length > MAX_HISTORY_DEPTH) {
        this.history = this.history.slice(this.history.length - MAX_HISTORY_DEPTH);
      }
      this.historyIndex = this.history.length - 1;
    }

    this.currentEntityId = entityId;
    this.currentEntityType = entityType;
    this.currentEventId = null;
    this.currentRegionCoords = null;
    this.currentRegionTile = null;
    this.scrollOffset = 0;
    this.mode = 'overview';
    this.entitySpans = createEntitySpanMap();
    this.initializeSections(entityType);
  }

  /**
   * Inspect an event by EventId (events are not ECS entities).
   */
  inspectEvent(eventId: EventId, context: RenderContext): void {
    // Save current section state
    this.saveCurrentSectionState();

    // Use eventId cast as EntityId for history tracking
    const entityId = eventId as unknown as EntityId;

    // Truncate forward history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    const entry: NavigationEntry = {
      entityId,
      entityType: 'event',
      scrollOffset: 0,
      expandedSections: [],
      timestamp: Date.now(),
      eventId,
    };
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY_DEPTH) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY_DEPTH);
    }
    this.historyIndex = this.history.length - 1;

    this.currentEntityId = entityId;
    this.currentEntityType = 'event';
    this.currentEventId = eventId;
    this.currentRegionCoords = null;
    this.currentRegionTile = null;
    this.scrollOffset = 0;
    this.mode = 'overview';
    this.entitySpans = createEntitySpanMap();

    // Initialize event sections
    const event = context.eventLog.getById(eventId);
    this.sections = this.eventInspector.getSections(event);
  }

  /**
   * Inspect a region tile (regions are coordinates, not entities).
   */
  inspectRegion(x: number, y: number, tile: RenderableTile, _context: RenderContext): void {
    // Save current section state
    this.saveCurrentSectionState();

    // Use a synthetic EntityId from coordinates for history
    const syntheticId = (x * 10000 + y) as unknown as EntityId;

    // Truncate forward history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    const entry: NavigationEntry = {
      entityId: syntheticId,
      entityType: 'region',
      scrollOffset: 0,
      expandedSections: [],
      timestamp: Date.now(),
      regionCoords: { x, y },
    };
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY_DEPTH) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY_DEPTH);
    }
    this.historyIndex = this.history.length - 1;

    this.currentEntityId = syntheticId;
    this.currentEntityType = 'region';
    this.currentEventId = null;
    this.currentRegionCoords = { x, y };
    this.currentRegionTile = tile;
    this.scrollOffset = 0;
    this.mode = 'overview';
    this.entitySpans = createEntitySpanMap();

    // Initialize region sections
    this.sections = this.regionInspector.getSections(tile);
  }

  /**
   * Save current section expanded/collapsed state into the current history entry.
   */
  private saveCurrentSectionState(): void {
    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      const currentEntry = this.history[this.historyIndex];
      if (currentEntry !== undefined) {
        const expandedIds = this.sections
          .filter(s => !s.collapsed)
          .map(s => s.id);
        this.history[this.historyIndex] = {
          ...currentEntry,
          scrollOffset: this.scrollOffset,
          expandedSections: expandedIds,
        };
      }
    }
  }

  /**
   * Navigate back in history.
   */
  back(): boolean {
    if (this.historyIndex > 0) {
      this.saveCurrentSectionState();
      this.historyIndex--;
      const entry = this.history[this.historyIndex];
      if (entry !== undefined) {
        this.restoreFromEntry(entry);
        return true;
      }
    }
    return false;
  }

  /**
   * Navigate forward in history.
   */
  forward(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.saveCurrentSectionState();
      this.historyIndex++;
      const entry = this.history[this.historyIndex];
      if (entry !== undefined) {
        this.restoreFromEntry(entry);
        return true;
      }
    }
    return false;
  }

  /**
   * Restore inspector state from a navigation entry.
   */
  private restoreFromEntry(entry: NavigationEntry): void {
    this.currentEntityId = entry.entityId;
    this.currentEntityType = entry.entityType;
    this.currentEventId = entry.eventId ?? null;
    this.currentRegionCoords = entry.regionCoords ? { x: entry.regionCoords.x, y: entry.regionCoords.y } : null;
    this.scrollOffset = entry.scrollOffset;
    this.entitySpans = createEntitySpanMap();
    this.initializeSections(entry.entityType);

    // Restore section expanded state
    if (entry.expandedSections.length > 0) {
      const expandedSet = new Set(entry.expandedSections);
      for (const section of this.sections) {
        section.collapsed = !expandedSet.has(section.id);
      }
    }
  }

  /**
   * Clear the inspector and history.
   */
  clear(): void {
    this.currentEntityId = null;
    this.currentEntityType = 'unknown';
    this.currentEventId = null;
    this.currentRegionCoords = null;
    this.currentRegionTile = null;
    this.history = [];
    this.historyIndex = -1;
    this.scrollOffset = 0;
    this.sections = [];
    this.entitySpans = createEntitySpanMap();
  }

  /**
   * Detect entity type from its components.
   */
  detectEntityType(entityId: EntityId, context: RenderContext): InspectableEntityType {
    const { world } = context;

    // Character: has Attribute component
    if (world.hasStore('Attribute') && world.getComponent(entityId, 'Attribute') !== undefined) {
      return 'character';
    }

    // Location: has Position and Population components
    if (world.hasStore('Position') && world.hasStore('Population')) {
      const pos = world.getComponent(entityId, 'Position');
      const pop = world.getComponent(entityId, 'Population');
      if (pos !== undefined && pop !== undefined) {
        return 'location';
      }
    }

    // Faction: has Territory component
    if (world.hasStore('Territory') && world.getComponent(entityId, 'Territory') !== undefined) {
      return 'faction';
    }

    // Artifact: has CreationHistory or OwnershipChain component
    if (world.hasStore('CreationHistory') && world.getComponent(entityId, 'CreationHistory') !== undefined) {
      return 'artifact';
    }
    if (world.hasStore('OwnershipChain') && world.getComponent(entityId, 'OwnershipChain') !== undefined) {
      return 'artifact';
    }

    return 'unknown';
  }

  /**
   * Initialize sections for the entity type.
   */
  private initializeSections(entityType: InspectableEntityType): void {
    switch (entityType) {
      case 'character':
        this.sections = this.characterInspector.getSections();
        break;
      case 'location':
        this.sections = this.locationInspector.getSections();
        break;
      case 'faction':
        this.sections = this.factionInspector.getSections();
        break;
      case 'artifact':
        this.sections = this.artifactInspector.getSections();
        break;
      case 'event':
        // Sections already initialized in inspectEvent()
        if (this.sections.length === 0) {
          this.sections = this.eventInspector.getSections();
        }
        break;
      case 'region':
        // Sections already initialized in inspectRegion()
        if (this.sections.length === 0 && this.currentRegionTile !== null) {
          this.sections = this.regionInspector.getSections(this.currentRegionTile);
        }
        break;
      default:
        this.sections = [];
    }
  }

  /**
   * Toggle a section collapsed state.
   */
  toggleSection(sectionId: string): void {
    const section = this.sections.find(s => s.id === sectionId);
    if (section !== undefined) {
      section.collapsed = !section.collapsed;
    }
  }

  /**
   * Get current entity ID.
   */
  getCurrentEntityId(): EntityId | null {
    return this.currentEntityId;
  }

  /**
   * Get current entity type.
   */
  getCurrentEntityType(): InspectableEntityType {
    return this.currentEntityType;
  }

  /**
   * Get history entries.
   */
  getHistory(): readonly HistoryEntry[] {
    return this.history;
  }

  /**
   * Get current history index.
   */
  getHistoryIndex(): number {
    return this.historyIndex;
  }

  /**
   * Get current mode.
   */
  getMode(): InspectorMode {
    return this.mode;
  }

  /**
   * Set inspector mode.
   */
  setMode(mode: InspectorMode): void {
    this.mode = mode;
  }

  /**
   * Get sections.
   */
  getSections(): readonly InspectorSection[] {
    return this.sections;
  }

  /**
   * Get entity span map for click detection.
   */
  getEntitySpans(): EntitySpanMap {
    return this.entitySpans;
  }

  /**
   * Get current event ID (for event inspection).
   */
  getCurrentEventId(): EventId | null {
    return this.currentEventId;
  }

  /**
   * Get current region coordinates (for region inspection).
   */
  getCurrentRegionCoords(): { x: number; y: number } | null {
    return this.currentRegionCoords;
  }

  /**
   * Handle click at a position within the inspector panel.
   * Checks entitySpans for clickable entity names.
   * Returns true if a click was handled.
   */
  override handleClick(x: number, y: number): boolean {
    // Adjust for scroll offset
    const adjustedRow = y + this.scrollOffset;

    const entityId = findEntityAtPosition(this.entitySpans, adjustedRow, x);
    if (entityId !== undefined) {
      if (this.inspectHandler !== null) {
        this.inspectHandler(entityId);
      }
      return true;
    }
    return false;
  }

  /**
   * Handle click with context - allows navigation within inspector.
   */
  handleClickWithContext(x: number, y: number, context: RenderContext): boolean {
    const adjustedRow = y + this.scrollOffset;

    const entityId = findEntityAtPosition(this.entitySpans, adjustedRow, x);
    if (entityId !== undefined) {
      if (this.inspectHandler !== null) {
        this.inspectHandler(entityId);
      } else {
        this.inspect(entityId, context);
      }
      return true;
    }
    return false;
  }

  /**
   * Set handler for inspecting other entities.
   */
  setInspectHandler(handler: (entityId: EntityId) => void): void {
    this.inspectHandler = handler;
  }

  /**
   * Get the inspect handler (for testing and external use).
   */
  getInspectHandler(): ((entityId: EntityId) => void) | null {
    return this.inspectHandler;
  }

  /**
   * Set welcome data for the pre-simulation welcome screen.
   */
  setWelcomeData(data: WelcomeData): void {
    this.welcomeData = data;
  }

  /**
   * Dismiss the welcome screen (called when simulation starts).
   */
  dismissWelcome(): void {
    this.welcomeDismissed = true;
  }

  /**
   * Set handler for navigating to locations.
   */
  setGoToLocationHandler(handler: (x: number, y: number) => void): void {
    this.goToLocationHandler = handler;
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    // Dashboard scroll when no entity selected
    if (this.currentEntityId === null) {
      if (key === 'up' || key === 'k' || key === 'wheelup') {
        if (this.dashboardScrollOffset > 0) {
          this.dashboardScrollOffset--;
          return true;
        }
        return false;
      }
      if (key === 'down' || key === 'j' || key === 'wheeldown') {
        this.dashboardScrollOffset++;
        return true;
      }
      return false;
    }

    switch (key) {
      case 'backspace':
      case 'left':
        return this.back();

      case 'right':
        return this.forward();

      case 'up':
      case 'k':
        if (this.scrollOffset > 0) {
          this.scrollOffset--;
          return true;
        }
        return false;

      case 'down':
      case 'j':
        this.scrollOffset++;
        return true;

      case 'o':
        this.mode = 'overview';
        return true;

      case 'r':
        this.mode = 'relationships';
        return true;

      case 't':
        this.mode = 'timeline';
        return true;

      case 'd':
        this.mode = 'details';
        return true;

      case 'g':
        // Go to location
        return this.handleGoToLocation();

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
        // Toggle section by number
        const sectionIndex = parseInt(key, 10) - 1;
        const section = this.sections[sectionIndex];
        if (section !== undefined) {
          section.collapsed = !section.collapsed;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Handle go to location command.
   */
  private handleGoToLocation(): boolean {
    if (this.goToLocationHandler === null || this.currentEntityId === null) {
      return false;
    }

    // Location uses its own position
    if (this.currentEntityType === 'location') {
      // Will be resolved during render when context is available
      return true;
    }

    return false;
  }

  /**
   * Render the inspector panel.
   */
  render(context: RenderContext): void {
    this.clearArea();

    if (this.currentEntityId === null) {
      this.renderWorldDashboard(context);
      return;
    }

    // Clear entity spans for fresh tracking
    this.entitySpans = createEntitySpanMap();

    const lines: string[] = [];

    // Render header with navigation and breadcrumbs
    lines.push(...this.renderHeader(context));

    // Render content based on entity type
    switch (this.currentEntityType) {
      case 'character':
        lines.push(...this.characterInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'location':
        lines.push(...this.locationInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'faction':
        lines.push(...this.factionInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'artifact':
        lines.push(...this.artifactInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'event':
        if (this.currentEventId !== null) {
          lines.push(...this.eventInspector.render(this.currentEventId, context, this.sections, this.mode));
        } else {
          lines.push('Event not found');
        }
        break;
      case 'region':
        if (this.currentRegionCoords !== null && this.currentRegionTile !== null) {
          lines.push(...this.regionInspector.render(
            this.currentRegionCoords.x,
            this.currentRegionCoords.y,
            this.currentRegionTile,
            context,
            this.sections,
            this.mode
          ));
        } else {
          lines.push('Region data unavailable');
        }
        break;
      default:
        lines.push('Unknown entity type');
    }

    // Render footer hint bar
    lines.push('');
    lines.push(this.renderFooterHints());

    // Apply scroll offset
    const { height } = this.getInnerDimensions();
    const visibleLines = lines.slice(this.scrollOffset, this.scrollOffset + height);

    this.setContent(visibleLines.join('\n'));
  }

  /**
   * Render world dashboard when no entity is selected.
   * Before simulation: shows "Story So Far" welcome.
   * During simulation: shows World Pulse, Top Factions, Active Tensions, Recent Notable Events.
   */
  private renderWorldDashboard(context: RenderContext): void {
    const lines: string[] = [];
    const { width } = this.getInnerDimensions();
    const barWidth = Math.max(10, Math.min(20, width - 20));

    // Pre-simulation welcome screen (shown until player presses Space)
    if (!this.welcomeDismissed && this.welcomeData !== null) {
      this.renderWelcomeScreen(lines, width);
      const { height } = this.getInnerDimensions();
      const visibleLines = lines.slice(this.dashboardScrollOffset, this.dashboardScrollOffset + height);
      this.setContent(visibleLines.join('\n'));
      return;
    }

    // ── WORLD PULSE ─────────────────────
    lines.push(`{bold} \u2500\u2500\u2500 WORLD PULSE ${'─'.repeat(Math.max(0, width - 18))} {/bold}`);
    lines.push('');

    try {
      const fingerprint = this.fingerprintCalculator.calculateFingerprint(context.world, context.eventLog);
      for (const domain of FINGERPRINT_DOMAINS) {
        const value = fingerprint.domainBalance.get(domain) ?? 0;
        const prose = getDomainProse(domain, value);
        const filled = Math.round((value * 100 / 100) * barWidth);
        const empty = barWidth - filled;
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
        lines.push(`  ${bar} ${prose}`);
      }

      // Synthesized narrative paragraph combining top 2-3 domain themes
      lines.push('');
      const domainValues: Array<[string, number]> = [];
      for (const domain of FINGERPRINT_DOMAINS) {
        const v = fingerprint.domainBalance.get(domain) ?? 0;
        domainValues.push([domain, v]);
      }
      domainValues.sort((a, b) => b[1] - a[1]);
      const top = domainValues.slice(0, 2);
      const bottom = domainValues.slice(-1);
      if (top.length >= 2 && top[0] !== undefined && top[1] !== undefined) {
        const topProse0 = getDomainProse(top[0][0], top[0][1]).toLowerCase();
        const topProse1 = getDomainProse(top[1][0], top[1][1]).toLowerCase();
        const bottomProse = bottom[0] !== undefined ? getDomainProse(bottom[0][0], bottom[0][1]).toLowerCase() : '';
        const summary = `  {#aaaaaa-fg}This is an age where ${topProse0}, and ${topProse1}. Meanwhile, ${bottomProse}.{/}`;
        lines.push(summary);
      }
    } catch {
      lines.push('  {#888888-fg}The world awaits its first events...{/}');
    }

    lines.push('');

    // ── TOP FACTIONS ─────────────────────
    lines.push(`{bold} \u2500\u2500\u2500 GREAT POWERS ${'─'.repeat(Math.max(0, width - 19))} {/bold}`);
    lines.push('');

    const factionEntries = this.getTopFactions(context, 5);
    if (factionEntries.length === 0) {
      lines.push('  {#888888-fg}The peoples of this land have yet to rally{/}');
      lines.push('  {#888888-fg}under great banners.{/}');
    } else {
      for (const entry of factionEntries) {
        const popStr = entry.population > 0 ? ` \u2014 ${entry.population.toLocaleString()} souls` : '';
        lines.push(`  \u269C {bold}${entry.name}{/bold}${popStr}`);
      }
    }

    lines.push('');

    // ── ACTIVE TENSIONS ──────────────────
    lines.push(`{bold} \u2500\u2500\u2500 WINDS OF CONFLICT ${'─'.repeat(Math.max(0, width - 24))} {/bold}`);
    lines.push('');

    const tensions = this.getActiveTensions(context, 5);
    if (tensions.length === 0) {
      lines.push('  {#888888-fg}An eerie calm settles over the realm.{/}');
    } else {
      for (const tension of tensions) {
        const icon = CATEGORY_ICONS[tension.category];
        // Use formatter to resolve participant names in description
        const desc = this.formatter.getEventDescription(tension.event);
        lines.push(`  ${icon} ${desc.slice(0, Math.max(1, width - 6))}`);
      }
    }

    lines.push('');

    // ── RECENT NOTABLE EVENTS ────────────
    lines.push(`{bold} \u2500\u2500\u2500 RECENT TIDINGS ${'─'.repeat(Math.max(0, width - 21))} {/bold}`);
    lines.push('');

    const notable = this.getRecentNotableEvents(context, 8);
    if (notable.length === 0) {
      lines.push('  {#888888-fg}History holds its breath, waiting.{/}');
    } else {
      // Aggregate repeated subtypes
      const aggregated = this.aggregateEvents(notable);
      for (const item of aggregated) {
        const sigChar = item.maxSignificance >= 90 ? '\u2605' : item.maxSignificance >= 70 ? '\u25CF' : '\u25CB';
        const sigColor = getSignificanceColor(item.maxSignificance);
        let desc: string;
        if (item.count > 2) {
          const baseNarrative = this.formatter.getShortNarrative(item.event);
          desc = `${baseNarrative} (${item.count} recent)`;
        } else {
          // Prepend primary participant name for richer context
          const participantName = item.event.participants.length > 0
            ? this.formatter.resolveEntityIdToName(item.event.participants[0] as unknown as number)
            : null;
          const narrative = this.formatter.getShortNarrative(item.event);
          desc = participantName !== null ? `${participantName}: ${narrative}` : narrative;
        }
        lines.push(`  {${sigColor}-fg}${sigChar}{/} ${desc.slice(0, Math.max(1, width - 6))}`);
      }
    }

    lines.push('');
    lines.push('{#888888-fg}  Select an entity on the map to inspect{/}');

    // Apply dashboard scroll
    const { height } = this.getInnerDimensions();
    const visibleLines = lines.slice(this.dashboardScrollOffset, this.dashboardScrollOffset + height);
    this.setContent(visibleLines.join('\n'));
  }

  /**
   * Render the pre-simulation welcome screen.
   */
  private renderWelcomeScreen(lines: string[], width: number): void {
    if (this.welcomeData === null) return;
    const w = this.welcomeData;
    const sep = '\u2550'.repeat(Math.max(0, width - 4));

    lines.push('');
    lines.push(`  {bold}\u2552${sep}\u2555{/bold}`);
    lines.push(`  {bold}     AETERNUM — THE STORY SO FAR{/bold}`);
    lines.push(`  {bold}\u2558${sep}\u255B{/bold}`);
    lines.push('');

    // Narrative summary paragraph
    const factionWord = w.factionCount <= 3 ? 'A handful of' : w.factionCount <= 6 ? 'Several' : 'Many';
    const sizeWord = w.worldSize === 'small' ? 'modest' : w.worldSize === 'large' ? 'vast' : 'broad';
    lines.push(`  ${factionWord} great powers vie for dominance across a`);
    lines.push(`  ${sizeWord} realm of ${w.settlementCount} settlements. ${w.characterCount} souls`);
    lines.push('  of note shape the course of history.');
    lines.push('');

    if (w.tensions.length > 0) {
      lines.push(`  {bold}Currents of Conflict:{/bold}`);
      for (const tension of w.tensions) {
        const truncated = tension.slice(0, Math.max(1, width - 8));
        lines.push(`    \u2022 ${truncated}`);
      }
      lines.push('');
    }

    lines.push('  {#888888-fg}Ancient ruins dot the landscape, and old grudges{/}');
    lines.push('  {#888888-fg}simmer beneath fragile alliances.{/}');
    lines.push('');
    lines.push(`  {#666666-fg}Seed: ${w.seed}  |  World Size: ${w.worldSize}{/}`);
    lines.push('');
    lines.push(`  {bold}Press Space to watch history unfold.{/bold}`);
    lines.push('');
  }

  /**
   * Get top factions by population (from Territory components).
   */
  private getTopFactions(context: RenderContext, limit: number): Array<{ name: string; population: number; entityId: EntityId }> {
    const factions: Array<{ name: string; population: number; entityId: EntityId }> = [];

    if (!context.world.hasStore('Territory')) return factions;

    for (const [entityId] of context.world.getStore('Territory').getAll()) {
      let name = `Faction #${entityId}`;
      let population = 0;

      // Try to get name from Status component
      if (context.world.hasStore('Status')) {
        const status = context.world.getComponent(entityId, 'Status');
        if (status !== undefined) {
          const titles = (status as { titles?: string[] }).titles;
          if (titles !== undefined && titles.length > 0 && titles[0] !== undefined) {
            name = titles[0];
          }
        }
      }

      // Try to get population from Territory
      const territory = context.world.getComponent(entityId, 'Territory');
      if (territory !== undefined) {
        population = (territory as { totalPopulation?: number }).totalPopulation ?? 0;
      }

      factions.push({ name, population, entityId });
    }

    factions.sort((a, b) => b.population - a.population);
    return factions.slice(0, limit);
  }

  /**
   * Get active tensions from recent high-significance Political/Military events.
   * Returns the actual events so the formatter can resolve participant names.
   */
  private getActiveTensions(context: RenderContext, limit: number): Array<{ event: WorldEvent; category: EventCategory }> {
    const tensions: Array<{ event: WorldEvent; category: EventCategory }> = [];
    const all = context.eventLog.getAll();

    // Look at last 500 events for tension-related events
    const recentEvents = all.slice(Math.max(0, all.length - 500));

    for (const event of recentEvents) {
      if (event.significance < 60) continue;
      if (event.category !== EventCategory.Political && event.category !== EventCategory.Military) continue;
      tensions.push({ event, category: event.category });
    }

    // Deduplicate by subtype and return most recent
    const seen = new Set<string>();
    const unique: Array<{ event: WorldEvent; category: EventCategory }> = [];
    for (let i = tensions.length - 1; i >= 0 && unique.length < limit; i--) {
      const t = tensions[i];
      if (t !== undefined && !seen.has(t.event.subtype)) {
        seen.add(t.event.subtype);
        unique.push(t);
      }
    }
    return unique;
  }

  /**
   * Get recent notable events (sorted by significance).
   */
  private getRecentNotableEvents(context: RenderContext, limit: number): WorldEvent[] {
    const all = context.eventLog.getAll();
    const recent = all.slice(Math.max(0, all.length - 200));

    // Sort by significance descending
    const sorted = [...recent].sort((a, b) => b.significance - a.significance);
    return sorted.slice(0, limit);
  }

  /**
   * Aggregate events by subtype for dashboard display.
   * Groups events with the same subtype, showing count if > 2.
   */
  private aggregateEvents(events: WorldEvent[]): Array<{ event: WorldEvent; count: number; maxSignificance: number }> {
    const grouped = new Map<string, { event: WorldEvent; count: number; maxSignificance: number }>();

    for (const event of events) {
      const existing = grouped.get(event.subtype);
      if (existing !== undefined) {
        existing.count++;
        if (event.significance > existing.maxSignificance) {
          existing.maxSignificance = event.significance;
          existing.event = event;
        }
      } else {
        grouped.set(event.subtype, { event, count: 1, maxSignificance: event.significance });
      }
    }

    // Sort by max significance descending
    return [...grouped.values()].sort((a, b) => b.maxSignificance - a.maxSignificance);
  }

  /**
   * Render header with entity type, name, breadcrumbs.
   */
  private renderHeader(context: RenderContext): string[] {
    const lines: string[] = [];
    const { width } = this.getInnerDimensions();

    const icon = TYPE_ICONS[this.currentEntityType] ?? '?';
    const color = TYPE_COLORS[this.currentEntityType] ?? '#888888';
    const typeLabel = this.currentEntityType.toUpperCase();

    // Line 1: Type label with rule
    const ruleLen = Math.max(0, width - typeLabel.length - 6);
    lines.push(`{${color}-fg}${icon}{/} {bold}${typeLabel}{/bold} ${'─'.repeat(ruleLen)}`);

    // Line 2: Entity name and summary
    const entityName = this.resolveEntityName(context);
    lines.push(`  {bold}${entityName}{/bold}`);

    // Line 3: One-liner summary + temporal context
    const summary = this.getEntitySummary(context);
    if (summary.length > 0) {
      lines.push(`  {${DIM_COLOR}-fg}${summary}{/}`);
    }

    // Line 4: Breadcrumbs
    const breadcrumbs = this.renderBreadcrumbs(context, width);
    lines.push(`  ${breadcrumbs}`);

    // Divider
    lines.push('═'.repeat(Math.min(width, 60)));

    return lines;
  }

  /**
   * Resolve the display name for the current entity.
   */
  private resolveEntityName(context: RenderContext): string {
    if (this.currentEntityId === null) return 'Unknown';

    // Events: use subtype or description
    if (this.currentEntityType === 'event' && this.currentEventId !== null) {
      const event = context.eventLog.getById(this.currentEventId);
      if (event !== undefined) {
        const desc = (event.data as Record<string, unknown>)['description'];
        if (typeof desc === 'string' && desc.length > 0) return desc;
        return this.formatter.getShortNarrative(event);
      }
      return `Event #${this.currentEventId}`;
    }

    // Regions: coordinates
    if (this.currentEntityType === 'region' && this.currentRegionCoords !== null) {
      const biome = this.currentRegionTile?.biome ?? 'Unknown';
      return `${biome} (${this.currentRegionCoords.x}, ${this.currentRegionCoords.y})`;
    }

    // ECS entities: use Status.titles
    const { world } = context;
    if (world.hasStore('Status')) {
      const status = world.getComponent(this.currentEntityId, 'Status') as { titles?: string[] } | undefined;
      if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
        return status.titles[0];
      }
    }

    return `#${this.currentEntityId}`;
  }

  /**
   * Get a one-liner summary for the current entity.
   */
  private getEntitySummary(context: RenderContext): string {
    if (this.currentEntityId === null) return '';

    if (this.currentEntityType === 'event' && this.currentEventId !== null) {
      const event = context.eventLog.getById(this.currentEventId);
      if (event !== undefined) {
        const year = Math.floor(event.timestamp / 360) + 1;
        const season = this.tickToSeason(event.timestamp);
        return `${event.category}  |  Year ${year}, ${season}  |  Significance: ${event.significance}`;
      }
    }

    if (this.currentEntityType === 'region' && this.currentRegionTile !== null) {
      const biome = this.currentRegionTile.biome;
      return biome;
    }

    if (this.currentEntityType === 'character') {
      const parts: string[] = [];
      const { world, clock } = context;

      // Faction membership
      if (world.hasStore('Membership')) {
        const membership = world.getComponent(this.currentEntityId, 'Membership') as { factionId?: number | null; rank?: string } | undefined;
        if (membership?.rank !== undefined) {
          parts.push(membership.rank);
        }
      }

      // Age approximation from current tick
      if (clock.currentTick > 0) {
        const year = Math.floor(clock.currentTick / 360) + 1;
        parts.push(`Year ${year}`);
      }

      return parts.join('  |  ');
    }

    if (this.currentEntityType === 'faction') {
      const { world } = context;
      const parts: string[] = [];

      if (world.hasStore('Government')) {
        const gov = world.getComponent(this.currentEntityId, 'Government') as { governmentType?: string } | undefined;
        if (gov?.governmentType !== undefined) {
          parts.push(gov.governmentType);
        }
      }

      if (world.hasStore('Territory')) {
        const territory = world.getComponent(this.currentEntityId, 'Territory') as { totalPopulation?: number } | undefined;
        if (territory?.totalPopulation !== undefined && territory.totalPopulation > 0) {
          parts.push(`${territory.totalPopulation.toLocaleString()} souls`);
        }
      }

      return parts.join('  |  ');
    }

    return '';
  }

  /**
   * Convert tick to season string.
   */
  private tickToSeason(tick: number): string {
    const month = Math.floor((tick % 360) / 30) + 1;
    if (month >= 1 && month <= 3) return 'Winter';
    if (month >= 4 && month <= 6) return 'Spring';
    if (month >= 7 && month <= 9) return 'Summer';
    return 'Autumn';
  }

  /**
   * Render breadcrumb trail showing navigation path.
   */
  private renderBreadcrumbs(context: RenderContext, _maxWidth: number): string {
    const canBack = this.historyIndex > 0;
    const canForward = this.historyIndex < this.history.length - 1;

    const backStr = canBack ? '{bold}< Back{/bold}' : '{#666666-fg}< Back{/}';
    const fwdStr = canForward ? '{bold}Fwd >{/bold}' : '{#666666-fg}Fwd >{/}';

    // Build breadcrumb segments from history
    const segments: string[] = ['[World]'];
    const startIdx = Math.max(0, this.historyIndex - 2);
    for (let i = startIdx; i <= this.historyIndex; i++) {
      const entry = this.history[i];
      if (entry === undefined) continue;
      const name = this.resolveHistoryEntryName(entry, context);
      const truncated = name.length > 15 ? name.slice(0, 13) + '..' : name;
      if (i === this.historyIndex) {
        segments.push(`{bold}${truncated}{/bold}`);
      } else {
        segments.push(`{${ENTITY_NAME_COLOR}-fg}${truncated}{/}`);
      }
    }

    // Truncate to max 4 segments
    if (segments.length > 4) {
      const kept = segments.slice(segments.length - 3);
      segments.length = 0;
      segments.push('...');
      segments.push(...kept);
    }

    const trail = segments.join(' > ');
    return `${backStr}   ${trail}   ${fwdStr}`;
  }

  /**
   * Resolve a display name for a history entry.
   */
  private resolveHistoryEntryName(entry: NavigationEntry, context: RenderContext): string {
    if (entry.entityType === 'event' && entry.eventId !== undefined) {
      const event = context.eventLog.getById(entry.eventId);
      if (event !== undefined) {
        return this.formatter.getShortNarrative(event);
      }
      return `Event`;
    }

    if (entry.entityType === 'region' && entry.regionCoords !== undefined) {
      return `(${entry.regionCoords.x},${entry.regionCoords.y})`;
    }

    const { world } = context;
    if (world.hasStore('Status')) {
      const status = world.getComponent(entry.entityId, 'Status') as { titles?: string[] } | undefined;
      if (status?.titles !== undefined && status.titles.length > 0 && status.titles[0] !== undefined) {
        return status.titles[0];
      }
    }

    return `#${entry.entityId}`;
  }

  /**
   * Render footer hint bar with context-sensitive controls.
   */
  private renderFooterHints(): string {
    const maxSection = this.sections.length;
    const sectionRange = maxSection > 0 ? `[1-${maxSection}]` : '';

    let hints = `{#666666-fg}${sectionRange} Sections  [Bksp] Back  [o/r/t/d] Mode`;

    switch (this.currentEntityType) {
      case 'character':
        hints += '  [g] Location';
        break;
      case 'faction':
        hints += '  [g] Capital';
        break;
      case 'event':
        hints += '  [g] Map';
        break;
      case 'region':
      case 'location':
        hints += '  [g] Map';
        break;
    }

    hints += '{/}';
    return hints;
  }

  /**
   * Clean up resources.
   */
  override destroy(): void {
    this.clear();
    super.destroy();
  }
}

/**
 * Create inspector panel layout.
 */
export function createInspectorPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.Inspector,
    x,
    y,
    width,
    height,
    focused: false,
  };
}
