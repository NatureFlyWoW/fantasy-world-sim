/**
 * Dual-pane event log panel for displaying raw events and narrative prose.
 * LEFT (55%): Raw event log with scrolling and significance indicators
 * RIGHT (45%): Narrative prose panel with box-drawing borders
 */

import type * as blessed from 'blessed';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { BasePanel } from '../panel.js';
import { THEME, getCategoryColor, getSignificanceColor } from '../theme.js';
import { EventFormatter, CATEGORY_ICONS, defaultFormatter } from './event-formatter.js';
import { EventCategory } from '@fws/core';
import type { WorldEvent, EventId, EntityId, Unsubscribe } from '@fws/core';

/**
 * Filter configuration for the event log.
 */
export interface FilterConfig {
  /** Which categories to show (all true by default) */
  categories: Map<EventCategory, boolean>;
  /** Minimum significance to show (0-100, default 0) */
  minSignificance: number;
  /** Only show events involving these entities (empty = all) */
  entityFilter: Set<EntityId>;
  /** Only show events at these locations (empty = all) */
  locationFilter: Set<number>;
  /** Search query string */
  searchQuery: string;
}

/**
 * Bookmark entry for persisting bookmarked events.
 */
export interface Bookmark {
  readonly eventId: EventId;
  readonly timestamp: number;
}

/**
 * Cascade tree node for visualizing cause-effect chains.
 */
export interface CascadeNode {
  readonly event: WorldEvent;
  readonly children: CascadeNode[];
  readonly depth: number;
}

/**
 * Selection changed handler for when user selects an event.
 */
export type EventSelectionHandler = (event: WorldEvent | null) => void;

/**
 * Go-to location handler for navigating to event locations.
 */
export type GoToLocationHandler = (x: number, y: number) => void;

/**
 * Inspect entity handler for opening entity inspector.
 */
export type InspectEntityHandler = (entityId: EntityId) => void;

/**
 * Panel mode for UI state.
 */
type PanelMode = 'normal' | 'filter' | 'search' | 'cascade';

/**
 * EventLogPanel provides a dual-pane view of world events.
 */
export class EventLogPanel extends BasePanel {
  // Formatter
  private formatter: EventFormatter = defaultFormatter;

  // Event storage
  private events: WorldEvent[] = [];
  private filteredEvents: WorldEvent[] = [];

  // Selection state
  private selectedIndex = -1;
  private selectedEvent: WorldEvent | null = null;

  // Scroll state
  private scrollOffset = 0;
  private autoScroll = true;

  // Filter state
  private filter: FilterConfig;

  // Bookmarks
  private bookmarks: Set<EventId> = new Set();

  // Mode state
  private mode: PanelMode = 'normal';
  private searchBuffer = '';

  // Event handlers
  private onEventSelected: EventSelectionHandler | null = null;
  private onGoToLocation: GoToLocationHandler | null = null;
  private onInspectEntity: InspectEntityHandler | null = null;

  // Live subscription
  private eventSubscription: Unsubscribe | null = null;

  // Flash highlights for high-significance events
  private flashEvents: Map<EventId, number> = new Map();

  // Cascade tree for cause-effect view
  private cascadeRoot: CascadeNode | null = null;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);

    // Initialize filter with all categories enabled
    this.filter = this.createDefaultFilter();

    // Set panel title
    this.setTitle('Event Log');
  }

  /**
   * Create a default filter configuration.
   */
  private createDefaultFilter(): FilterConfig {
    const categories = new Map<EventCategory, boolean>();
    for (const category of Object.values(EventCategory)) {
      categories.set(category, true);
    }

    return {
      categories,
      minSignificance: 0,
      entityFilter: new Set(),
      locationFilter: new Set(),
      searchQuery: '',
    };
  }

  /**
   * Set the event selection handler.
   */
  setEventSelectionHandler(handler: EventSelectionHandler): void {
    this.onEventSelected = handler;
  }

  /**
   * Set the go-to location handler.
   */
  setGoToLocationHandler(handler: GoToLocationHandler): void {
    this.onGoToLocation = handler;
  }

  /**
   * Set the inspect entity handler.
   */
  setInspectEntityHandler(handler: InspectEntityHandler): void {
    this.onInspectEntity = handler;
  }

  /**
   * Subscribe to live events from the EventBus.
   */
  subscribeToEvents(context: RenderContext): void {
    if (this.eventSubscription !== null) {
      this.eventSubscription();
    }

    this.eventSubscription = context.eventBus.onAny((event: WorldEvent) => {
      this.addEvent(event);
    });
  }

  /**
   * Unsubscribe from live events.
   */
  unsubscribeFromEvents(): void {
    if (this.eventSubscription !== null) {
      this.eventSubscription();
      this.eventSubscription = null;
    }
  }

  /**
   * Add a new event to the log.
   */
  addEvent(event: WorldEvent): void {
    this.events.push(event);
    this.applyFilter();

    // Auto-scroll if enabled
    if (this.autoScroll) {
      this.scrollToBottom();
    }

    // Flash highlight for high-significance events
    if (event.significance > 80) {
      this.flashEvents.set(event.id, Date.now());

      // Terminal bell for critical events
      if (event.significance > 95) {
        process.stdout.write('\x07'); // BEL character
      }
    }
  }

  /**
   * Load events from the event log.
   */
  loadEventsFromLog(context: RenderContext): void {
    this.events = context.eventLog.getAll();
    this.applyFilter();

    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Apply the current filter to events.
   */
  applyFilter(): void {
    this.filteredEvents = this.events.filter(event => this.passesFilter(event));

    // Adjust selection if needed
    if (this.selectedIndex >= this.filteredEvents.length) {
      this.selectedIndex = Math.max(0, this.filteredEvents.length - 1);
    }

    this.updateSelectedEvent();
  }

  /**
   * Check if an event passes the current filter.
   */
  passesFilter(event: WorldEvent): boolean {
    // Category filter
    const categoryEnabled = this.filter.categories.get(event.category);
    if (categoryEnabled !== true) {
      return false;
    }

    // Significance filter
    if (event.significance < this.filter.minSignificance) {
      return false;
    }

    // Entity filter
    if (this.filter.entityFilter.size > 0) {
      const hasMatchingEntity = event.participants.some(id =>
        this.filter.entityFilter.has(id)
      );
      if (!hasMatchingEntity) {
        return false;
      }
    }

    // Location filter
    if (this.filter.locationFilter.size > 0) {
      if (event.location === undefined || !this.filter.locationFilter.has(event.location)) {
        return false;
      }
    }

    // Search filter
    if (this.filter.searchQuery.length > 0) {
      const description = this.formatter.getEventDescription(event).toLowerCase();
      const query = this.filter.searchQuery.toLowerCase();
      if (!description.includes(query)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the filter configuration.
   */
  getFilter(): FilterConfig {
    return { ...this.filter };
  }

  /**
   * Set a category filter.
   */
  setCategoryFilter(category: EventCategory, enabled: boolean): void {
    this.filter.categories.set(category, enabled);
    this.applyFilter();
  }

  /**
   * Set the minimum significance filter.
   */
  setMinSignificance(min: number): void {
    this.filter.minSignificance = Math.max(0, Math.min(100, min));
    this.applyFilter();
  }

  /**
   * Add an entity to the entity filter.
   */
  addEntityFilter(entityId: EntityId): void {
    this.filter.entityFilter.add(entityId);
    this.applyFilter();
  }

  /**
   * Remove an entity from the entity filter.
   */
  removeEntityFilter(entityId: EntityId): void {
    this.filter.entityFilter.delete(entityId);
    this.applyFilter();
  }

  /**
   * Clear all entity filters.
   */
  clearEntityFilter(): void {
    this.filter.entityFilter.clear();
    this.applyFilter();
  }

  /**
   * Set the search query.
   */
  setSearchQuery(query: string): void {
    this.filter.searchQuery = query;
    this.applyFilter();
  }

  /**
   * Toggle bookmark for an event.
   */
  toggleBookmark(eventId: EventId): void {
    if (this.bookmarks.has(eventId)) {
      this.bookmarks.delete(eventId);
    } else {
      this.bookmarks.add(eventId);
    }
  }

  /**
   * Check if an event is bookmarked.
   */
  isBookmarked(eventId: EventId): boolean {
    return this.bookmarks.has(eventId);
  }

  /**
   * Get all bookmarked event IDs.
   */
  getBookmarks(): EventId[] {
    return Array.from(this.bookmarks);
  }

  /**
   * Build cascade tree for an event.
   */
  buildCascadeTree(event: WorldEvent, context: RenderContext, maxDepth = 5): CascadeNode {
    return this.buildCascadeNodeRecursive(event, context, 0, maxDepth, new Set());
  }

  /**
   * Recursively build cascade tree nodes.
   */
  private buildCascadeNodeRecursive(
    event: WorldEvent,
    context: RenderContext,
    depth: number,
    maxDepth: number,
    visited: Set<EventId>
  ): CascadeNode {
    visited.add(event.id);

    const children: CascadeNode[] = [];

    if (depth < maxDepth) {
      for (const consequenceId of event.consequences) {
        if (!visited.has(consequenceId)) {
          const consequenceEvent = context.eventLog.getById(consequenceId);
          if (consequenceEvent !== undefined) {
            children.push(
              this.buildCascadeNodeRecursive(consequenceEvent, context, depth + 1, maxDepth, visited)
            );
          }
        }
      }
    }

    return { event, children, depth };
  }

  /**
   * Format cascade tree as ASCII tree.
   */
  formatCascadeTree(node: CascadeNode, prefix = '', isLast = true): string[] {
    const lines: string[] = [];

    const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 '; // └── or ├──
    const description = this.formatter.getEventDescription(node.event);
    const icon = CATEGORY_ICONS[node.event.category];

    if (node.depth === 0) {
      lines.push(`${icon} ${description}`);
    } else {
      lines.push(`${prefix}${connector}${icon} ${description}`);
    }

    const childPrefix = prefix + (isLast ? '    ' : '\u2502   '); // │ for continuation

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child !== undefined) {
        const isChildLast = i === node.children.length - 1;
        lines.push(...this.formatCascadeTree(child, childPrefix, isChildLast));
      }
    }

    return lines;
  }

  /**
   * Render the panel.
   */
  render(context: RenderContext): void {
    const innerDims = this.getInnerDimensions();
    const leftWidth = Math.floor(innerDims.width * 0.55);
    const rightWidth = innerDims.width - leftWidth - 1; // -1 for divider

    let content = '';

    // Handle different modes
    if (this.mode === 'cascade' && this.cascadeRoot !== null) {
      content = this.renderCascadeView(innerDims.height);
    } else if (this.mode === 'filter') {
      content = this.renderFilterView(leftWidth, rightWidth, innerDims.height);
    } else if (this.mode === 'search') {
      content = this.renderSearchView(leftWidth, rightWidth, innerDims.height, context);
    } else {
      content = this.renderNormalView(leftWidth, rightWidth, innerDims.height, context);
    }

    this.setContent(content);

    // Clear old flash events
    this.cleanupFlashEvents();
  }

  /**
   * Render the normal dual-pane view.
   */
  private renderNormalView(
    leftWidth: number,
    rightWidth: number,
    height: number,
    context: RenderContext
  ): string {
    const lines: string[] = [];

    for (let row = 0; row < height; row++) {
      const leftLine = this.renderLeftPaneLine(row, leftWidth, height, context);
      const rightLine = this.renderRightPaneLine(row, rightWidth, context);

      lines.push(`${leftLine}\u2502${rightLine}`); // │ divider
    }

    return lines.join('\n');
  }

  /**
   * Render a line from the left (raw log) panel.
   */
  private renderLeftPaneLine(
    row: number,
    width: number,
    _height: number,
    context: RenderContext
  ): string {
    const eventIndex = this.scrollOffset + row;

    if (eventIndex >= this.filteredEvents.length) {
      return ' '.repeat(width);
    }

    const event = this.filteredEvents[eventIndex];
    if (event === undefined) {
      return ' '.repeat(width);
    }

    const isSelected = eventIndex === this.selectedIndex;
    const isFlashing = this.isEventFlashing(event.id);
    const isBookmarked = this.bookmarks.has(event.id);

    // Build significance indicator (1 char)
    const sigColor = getSignificanceColor(event.significance);
    const sigChar = '\u2588'; // █

    // Build bookmark indicator (1 char)
    const bookmarkChar = isBookmarked ? '\u2605' : ' '; // ★

    // Format the event text
    const rawText = this.formatter.formatRaw(event, context.clock);
    const maxTextWidth = width - 4; // -2 for significance, -1 for bookmark, -1 for margin
    const truncatedText = rawText.slice(0, maxTextWidth);
    const paddedText = truncatedText.padEnd(maxTextWidth);

    // Apply coloring
    const catColor = getCategoryColor(event.category);
    let line: string;

    if (isSelected) {
      line = `{${sigColor}-fg}${sigChar}{/}{${THEME.ui.selection}-bg}{${catColor}-fg}${bookmarkChar}${paddedText}{/}`;
    } else if (isFlashing) {
      line = `{${sigColor}-fg}${sigChar}{/}{#ffff00-bg}{#000000-fg}${bookmarkChar}${paddedText}{/}`;
    } else {
      line = `{${sigColor}-fg}${sigChar}{/}{${catColor}-fg}${bookmarkChar}${paddedText}{/}`;
    }

    return line;
  }

  /**
   * Render a line from the right (narrative) panel.
   */
  private renderRightPaneLine(row: number, width: number, context: RenderContext): string {
    if (this.selectedEvent === null) {
      // No event selected
      if (row === 0) {
        return this.boxDrawTopBorder(width);
      } else if (row === 1) {
        return this.boxDrawLine('No event selected', width);
      } else if (row === 2) {
        return this.boxDrawBottomBorder(width);
      }
      return ' '.repeat(width);
    }

    const event = this.selectedEvent;
    const narrativeLines = this.buildNarrativeContent(event, context);

    // Build box with content
    if (row === 0) {
      return this.boxDrawTopBorder(width);
    } else if (row === 1) {
      // Title line
      const title = this.formatter.getEventDescription(event);
      const truncatedTitle = title.slice(0, width - 4);
      return this.boxDrawLine(truncatedTitle, width, true);
    } else if (row === 2) {
      // Divider
      return this.boxDrawMiddleBorder(width);
    } else {
      const contentRow = row - 3;
      const contentLine = narrativeLines[contentRow];

      if (contentRow < narrativeLines.length && contentLine !== undefined) {
        return this.boxDrawLine(contentLine.slice(0, width - 4), width);
      } else if (contentRow === narrativeLines.length) {
        return this.boxDrawBottomBorder(width);
      }
    }

    return ' '.repeat(width);
  }

  /**
   * Build narrative content for an event.
   */
  private buildNarrativeContent(event: WorldEvent, context: RenderContext): string[] {
    const lines: string[] = [];

    // Significance bar
    lines.push(`Significance: ${this.formatter.formatSignificanceBar(event.significance)}`);
    lines.push('');

    // Participants
    lines.push(`Participants: ${this.formatter.formatParticipants(event, context.world)}`);

    // Location
    const location = this.formatter.formatLocation(event, context.world);
    if (location !== null) {
      lines.push(`Location: ${location}`);
    }

    lines.push('');

    // Narrative placeholder
    lines.push('[Narrative engine pending -');
    lines.push('raw event data shown]');
    lines.push('');

    // Event data dump
    lines.push('Event Data:');
    const data = event.data as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`  ${key}: ${valueStr.slice(0, 30)}`);
    }

    return lines;
  }

  /**
   * Render cascade view.
   */
  private renderCascadeView(height: number): string {
    if (this.cascadeRoot === null) {
      return 'No cascade data';
    }

    const treeLines = this.formatCascadeTree(this.cascadeRoot);
    const paddedLines = treeLines.slice(0, height);

    while (paddedLines.length < height) {
      paddedLines.push('');
    }

    return paddedLines.join('\n');
  }

  /**
   * Render filter view.
   */
  private renderFilterView(_leftWidth: number, _rightWidth: number, height: number): string {
    const lines: string[] = [];

    lines.push('=== Category Filters ===');

    for (const category of Object.values(EventCategory)) {
      const enabled = this.filter.categories.get(category) === true;
      const icon = CATEGORY_ICONS[category];
      const checkbox = enabled ? '[x]' : '[ ]';
      lines.push(`  ${checkbox} ${icon} ${category}`);
    }

    lines.push('');
    lines.push(`Min Significance: ${this.filter.minSignificance}`);
    lines.push(`Search: "${this.filter.searchQuery}"`);
    lines.push('');
    lines.push('Press ESC to close filter panel');

    while (lines.length < height) {
      lines.push('');
    }

    return lines.slice(0, height).join('\n');
  }

  /**
   * Render search view.
   */
  private renderSearchView(
    leftWidth: number,
    rightWidth: number,
    height: number,
    context: RenderContext
  ): string {
    const normalContent = this.renderNormalView(leftWidth, rightWidth, height - 1, context);
    const searchLine = `{#ffcc00-fg}Search: ${this.searchBuffer}__{/}`;

    return `${searchLine}\n${normalContent}`;
  }

  /**
   * Box drawing helpers.
   */
  private boxDrawTopBorder(width: number): string {
    return '\u2554' + '\u2550'.repeat(width - 2) + '\u2557'; // ╔═══╗
  }

  private boxDrawMiddleBorder(width: number): string {
    return '\u2560' + '\u2550'.repeat(width - 2) + '\u2563'; // ╠═══╣
  }

  private boxDrawBottomBorder(width: number): string {
    return '\u255A' + '\u2550'.repeat(width - 2) + '\u255D'; // ╚═══╝
  }

  private boxDrawLine(text: string, width: number, bold = false): string {
    const paddedText = text.padEnd(width - 4).slice(0, width - 4);
    if (bold) {
      return `\u2551 {bold}${paddedText}{/} \u2551`; // ║ text ║
    }
    return `\u2551 ${paddedText} \u2551`;
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    // Handle mode-specific input first
    if (this.mode === 'search') {
      return this.handleSearchInput(key);
    }

    if (this.mode === 'filter') {
      return this.handleFilterInput(key);
    }

    if (this.mode === 'cascade') {
      return this.handleCascadeInput(key);
    }

    // Normal mode
    switch (key) {
      case 'up':
      case 'k':
        this.selectPrevious();
        return true;

      case 'down':
      case 'j':
        this.selectNext();
        return true;

      case 'pageup':
        this.pageUp();
        return true;

      case 'pagedown':
        this.pageDown();
        return true;

      case 'home':
        this.scrollToTop();
        return true;

      case 'end':
        this.scrollToBottom();
        return true;

      case 'f':
        this.mode = 'filter';
        return true;

      case '/':
        this.mode = 'search';
        this.searchBuffer = '';
        return true;

      case 'b':
        this.toggleCurrentBookmark();
        return true;

      case 'c':
        this.showCascade();
        return true;

      case 'g':
        this.goToEventLocation();
        return true;

      case 'enter':
        this.inspectPrimaryParticipant();
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle search mode input.
   */
  private handleSearchInput(key: string): boolean {
    if (key === 'escape') {
      this.mode = 'normal';
      return true;
    }

    if (key === 'enter') {
      this.setSearchQuery(this.searchBuffer);
      this.mode = 'normal';
      return true;
    }

    if (key === 'backspace') {
      this.searchBuffer = this.searchBuffer.slice(0, -1);
      return true;
    }

    // Add printable characters
    if (key.length === 1) {
      this.searchBuffer += key;
      return true;
    }

    return false;
  }

  /**
   * Handle filter mode input.
   */
  private handleFilterInput(key: string): boolean {
    if (key === 'escape' || key === 'f') {
      this.mode = 'normal';
      return true;
    }

    // Number keys toggle categories
    const categories = Object.values(EventCategory);
    const index = parseInt(key, 10) - 1;
    if (index >= 0 && index < categories.length) {
      const category = categories[index];
      if (category !== undefined) {
        const current = this.filter.categories.get(category) === true;
        this.setCategoryFilter(category, !current);
      }
      return true;
    }

    return false;
  }

  /**
   * Handle cascade mode input.
   */
  private handleCascadeInput(key: string): boolean {
    if (key === 'escape' || key === 'c') {
      this.mode = 'normal';
      this.cascadeRoot = null;
      return true;
    }

    return false;
  }

  /**
   * Select the previous event.
   */
  private selectPrevious(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.autoScroll = false;

      // Adjust scroll if needed
      if (this.selectedIndex < this.scrollOffset) {
        this.scrollOffset = this.selectedIndex;
      }

      this.updateSelectedEvent();
    }
  }

  /**
   * Select the next event.
   */
  private selectNext(): void {
    if (this.selectedIndex < this.filteredEvents.length - 1) {
      this.selectedIndex++;

      // Check if we're at the bottom
      const innerDims = this.getInnerDimensions();
      if (this.selectedIndex === this.filteredEvents.length - 1) {
        this.autoScroll = true;
      }

      // Adjust scroll if needed
      if (this.selectedIndex >= this.scrollOffset + innerDims.height) {
        this.scrollOffset = this.selectedIndex - innerDims.height + 1;
      }

      this.updateSelectedEvent();
    }
  }

  /**
   * Page up.
   */
  private pageUp(): void {
    const innerDims = this.getInnerDimensions();
    this.scrollOffset = Math.max(0, this.scrollOffset - innerDims.height);
    this.selectedIndex = this.scrollOffset;
    this.autoScroll = false;
    this.updateSelectedEvent();
  }

  /**
   * Page down.
   */
  private pageDown(): void {
    const innerDims = this.getInnerDimensions();
    const maxScroll = Math.max(0, this.filteredEvents.length - innerDims.height);
    this.scrollOffset = Math.min(maxScroll, this.scrollOffset + innerDims.height);
    this.selectedIndex = Math.min(this.filteredEvents.length - 1, this.scrollOffset);
    this.autoScroll = this.scrollOffset >= maxScroll;
    this.updateSelectedEvent();
  }

  /**
   * Scroll to top.
   */
  private scrollToTop(): void {
    this.scrollOffset = 0;
    this.selectedIndex = 0;
    this.autoScroll = false;
    this.updateSelectedEvent();
  }

  /**
   * Scroll to bottom.
   */
  private scrollToBottom(): void {
    const innerDims = this.getInnerDimensions();
    this.scrollOffset = Math.max(0, this.filteredEvents.length - innerDims.height);
    this.selectedIndex = this.filteredEvents.length - 1;
    this.autoScroll = true;
    this.updateSelectedEvent();
  }

  /**
   * Update the selected event reference.
   */
  private updateSelectedEvent(): void {
    const event = this.filteredEvents[this.selectedIndex];
    this.selectedEvent = event ?? null;

    if (this.onEventSelected !== null) {
      this.onEventSelected(this.selectedEvent);
    }
  }

  /**
   * Toggle bookmark for current event.
   */
  private toggleCurrentBookmark(): void {
    if (this.selectedEvent !== null) {
      this.toggleBookmark(this.selectedEvent.id);
    }
  }

  /**
   * Show cascade for current event.
   */
  private showCascade(): void {
    // This requires the context which we don't have in handleInput
    // Will be called from render() with context
    this.mode = 'cascade';
  }

  /**
   * Build cascade tree for the currently selected event.
   */
  buildCascadeForSelected(context: RenderContext): void {
    if (this.selectedEvent !== null) {
      this.cascadeRoot = this.buildCascadeTree(this.selectedEvent, context);
    }
  }

  /**
   * Go to event location.
   */
  private goToEventLocation(): void {
    if (this.selectedEvent !== null && this.onGoToLocation !== null) {
      // Try to get location from event
      if (this.selectedEvent.location !== undefined) {
        // For now, just emit the location ID as coordinates
        // In a real implementation, this would resolve the SiteId to coordinates
        this.onGoToLocation(this.selectedEvent.location, 0);
      }
    }
  }

  /**
   * Inspect primary participant.
   */
  private inspectPrimaryParticipant(): void {
    if (this.selectedEvent !== null && this.onInspectEntity !== null) {
      const firstParticipant = this.selectedEvent.participants[0];
      if (firstParticipant !== undefined) {
        this.onInspectEntity(firstParticipant);
      }
    }
  }

  /**
   * Check if an event is currently flashing.
   */
  private isEventFlashing(eventId: EventId): boolean {
    const flashTime = this.flashEvents.get(eventId);
    if (flashTime === undefined) return false;

    // Flash for 2 seconds
    return Date.now() - flashTime < 2000;
  }

  /**
   * Clean up old flash events.
   */
  private cleanupFlashEvents(): void {
    const now = Date.now();
    for (const [eventId, flashTime] of this.flashEvents) {
      if (now - flashTime >= 2000) {
        this.flashEvents.delete(eventId);
      }
    }
  }

  /**
   * Get selected event.
   */
  getSelectedEvent(): WorldEvent | null {
    return this.selectedEvent;
  }

  /**
   * Get current mode.
   */
  getMode(): PanelMode {
    return this.mode;
  }

  /**
   * Get filtered event count.
   */
  getFilteredEventCount(): number {
    return this.filteredEvents.length;
  }

  /**
   * Get total event count.
   */
  getTotalEventCount(): number {
    return this.events.length;
  }

  /**
   * Cleanup.
   */
  destroy(): void {
    this.unsubscribeFromEvents();
    super.destroy();
  }
}

/**
 * Create a default layout for the event log panel.
 */
export function createEventLogPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.EventLog,
    x,
    y,
    width,
    height,
    focused: false,
  };
}
