/**
 * TimelinePanel — displays a horizontal ASCII timeline of world events.
 * Shows significance-based markers, parallel faction tracks, and supports zoom/scroll.
 */

import type * as blessed from 'blessed';
import type { EntityId, WorldEvent, EventCategory, EventId } from '@fws/core';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { BasePanel } from '../panel.js';

/**
 * Timeline zoom level determines time scale.
 */
export type TimelineZoomLevel = 'year' | 'decade' | 'century';

/**
 * Ticks per character at each zoom level.
 */
export const ZOOM_SCALES: Readonly<Record<TimelineZoomLevel, number>> = {
  year: 30,      // 1 char = 30 days (monthly resolution)
  decade: 360,   // 1 char = 1 year (360 days)
  century: 3600, // 1 char = 10 years
};

/**
 * Significance threshold to marker character mapping.
 */
export const SIGNIFICANCE_MARKERS: ReadonlyArray<{ threshold: number; marker: string }> = [
  { threshold: 85, marker: '★' },
  { threshold: 60, marker: '●' },
  { threshold: 30, marker: '○' },
  { threshold: 0, marker: '·' },
];

/**
 * Colors for event categories.
 */
export const CATEGORY_COLORS: Readonly<Record<EventCategory, string>> = {
  Political: '#4488FF',
  Magical: '#FF44FF',
  Cultural: '#FFAA00',
  Religious: '#FFFFFF',
  Scientific: '#44FFAA',
  Personal: '#88AAFF',
  Exploratory: '#AAFF44',
  Economic: '#FFD700',
  Disaster: '#FF4444',
  Military: '#FF8844',
};

/**
 * A timeline track for a specific faction or entity.
 */
export interface TimelineTrack {
  readonly entityId: EntityId;
  readonly label: string;
  readonly events: WorldEvent[];
}

/**
 * Era marker on the timeline.
 */
export interface EraMarker {
  readonly startTick: number;
  readonly endTick: number;
  readonly label: string;
  readonly color: string;
}

/**
 * TimelinePanel renders a horizontal ASCII timeline.
 */
export class TimelinePanel extends BasePanel {
  private zoomLevel: TimelineZoomLevel = 'decade';
  private scrollOffset = 0; // In ticks
  private cursorPosition = 0; // Character position from left
  private selectedEventId: EventId | null = null;
  private tracks: TimelineTrack[] = [];
  private eras: EraMarker[] = [];
  private showTracks = true;
  private categoryFilter: EventCategory | null = null;
  private inspectHandler: ((eventId: EventId) => void) | null = null;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Timeline');
  }

  /**
   * Render the timeline.
   */
  render(context: RenderContext): void {
    this.clearArea();
    const { width, height } = this.getInnerDimensions();
    const lines: string[] = [];

    // Header with zoom level and time range
    const startTick = this.scrollOffset;
    const scale = ZOOM_SCALES[this.zoomLevel];
    const endTick = startTick + width * scale;
    const startYear = Math.floor(startTick / 360) + 1;
    const endYear = Math.floor(endTick / 360) + 1;

    lines.push(this.renderHeader(startYear, endYear, width));

    // Era markers row (if any)
    if (this.eras.length > 0) {
      lines.push(this.renderEras(width, scale));
    }

    // Time scale row
    lines.push(this.renderTimeScale(width, scale));

    // Main timeline row (all events)
    const allEvents = context.eventLog.getByTimeRange(startTick, endTick);
    const filteredEvents = this.categoryFilter !== null
      ? allEvents.filter(e => e.category === this.categoryFilter)
      : allEvents;
    lines.push(this.renderMainTimeline(filteredEvents, width, scale));

    // Parallel tracks (if enabled)
    if (this.showTracks && this.tracks.length > 0) {
      const remainingHeight = height - lines.length - 1; // -1 for footer
      const trackCount = Math.min(this.tracks.length, remainingHeight);

      for (let i = 0; i < trackCount; i++) {
        const track = this.tracks[i];
        if (track !== undefined) {
          lines.push(this.renderTrack(track, width, scale, startTick, endTick));
        }
      }
    }

    // Pad remaining lines
    while (lines.length < height - 1) {
      lines.push(' '.repeat(width));
    }

    // Footer with controls
    lines.push(this.renderFooter(width));

    this.setContent(lines.join('\n'));
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    switch (key) {
      case 'left':
      case 'h':
        this.scrollLeft();
        return true;
      case 'right':
      case 'l':
        this.scrollRight();
        return true;
      case 'z':
        this.cycleZoom();
        return true;
      case 't':
        this.toggleTracks();
        return true;
      case 'c':
        this.cycleCategoryFilter();
        return true;
      case 'home':
        this.scrollToStart();
        return true;
      case 'end':
        this.scrollToEnd();
        return true;
      case 'enter':
      case 'return':
        this.inspectSelectedEvent();
        return true;
      case '[':
        this.moveCursor(-1);
        return true;
      case ']':
        this.moveCursor(1);
        return true;
      default:
        return false;
    }
  }

  // === Public API ===

  /**
   * Get current zoom level.
   */
  getZoomLevel(): TimelineZoomLevel {
    return this.zoomLevel;
  }

  /**
   * Set zoom level.
   */
  setZoomLevel(level: TimelineZoomLevel): void {
    this.zoomLevel = level;
  }

  /**
   * Get scroll offset in ticks.
   */
  getScrollOffset(): number {
    return this.scrollOffset;
  }

  /**
   * Set scroll offset.
   */
  setScrollOffset(offset: number): void {
    this.scrollOffset = Math.max(0, offset);
  }

  /**
   * Get cursor position.
   */
  getCursorPosition(): number {
    return this.cursorPosition;
  }

  /**
   * Check if tracks are visible.
   */
  areTracksVisible(): boolean {
    return this.showTracks;
  }

  /**
   * Set tracks visibility.
   */
  setTracksVisible(visible: boolean): void {
    this.showTracks = visible;
  }

  /**
   * Get category filter.
   */
  getCategoryFilter(): EventCategory | null {
    return this.categoryFilter;
  }

  /**
   * Set category filter.
   */
  setCategoryFilter(category: EventCategory | null): void {
    this.categoryFilter = category;
  }

  /**
   * Add a faction/entity track.
   */
  addTrack(entityId: EntityId, label: string, events: WorldEvent[]): void {
    this.tracks.push({ entityId, label, events });
  }

  /**
   * Clear all tracks.
   */
  clearTracks(): void {
    this.tracks = [];
  }

  /**
   * Get tracks.
   */
  getTracks(): readonly TimelineTrack[] {
    return this.tracks;
  }

  /**
   * Add an era marker.
   */
  addEra(startTick: number, endTick: number, label: string, color: string): void {
    this.eras.push({ startTick, endTick, label, color });
  }

  /**
   * Clear all era markers.
   */
  clearEras(): void {
    this.eras = [];
  }

  /**
   * Get eras.
   */
  getEras(): readonly EraMarker[] {
    return this.eras;
  }

  /**
   * Set the event inspection handler.
   */
  setInspectHandler(handler: (eventId: EventId) => void): void {
    this.inspectHandler = handler;
  }

  /**
   * Clean up.
   */
  destroy(): void {
    this.tracks = [];
    this.eras = [];
    this.selectedEventId = null;
    super.destroy();
  }

  // === Private Methods ===

  private renderHeader(startYear: number, endYear: number, width: number): string {
    const zoomLabel = this.zoomLevel.charAt(0).toUpperCase() + this.zoomLevel.slice(1);
    const range = `Year ${startYear} - ${endYear}`;
    const filter = this.categoryFilter !== null ? ` [${this.categoryFilter}]` : '';
    const header = `${zoomLabel} View: ${range}${filter}`;
    return header.slice(0, width).padEnd(width);
  }

  private renderTimeScale(width: number, scale: number): string {
    let line = '';
    const ticksPerMark = this.getTicksPerMark();

    for (let i = 0; i < width; i++) {
      const tick = this.scrollOffset + i * scale;
      if (tick % ticksPerMark === 0) {
        const year = Math.floor(tick / 360) + 1;
        const yearStr = String(year);
        if (i + yearStr.length <= width) {
          line += yearStr;
          i += yearStr.length - 1;
        } else {
          line += '│';
        }
      } else if (tick % (ticksPerMark / 2) === 0) {
        line += '┼';
      } else {
        line += '─';
      }
    }

    return line.slice(0, width);
  }

  private renderMainTimeline(events: WorldEvent[], width: number, scale: number): string {
    const line = Array(width).fill('─');
    const cursorChar = this.layout.focused ? '▼' : ' ';

    // Place cursor
    if (this.cursorPosition >= 0 && this.cursorPosition < width) {
      line[this.cursorPosition] = cursorChar;
    }

    // Place events
    for (const event of events) {
      const charPos = Math.floor((event.timestamp - this.scrollOffset) / scale);
      if (charPos >= 0 && charPos < width) {
        const marker = this.getSignificanceMarker(event.significance);
        line[charPos] = marker;

        // Track which event is under cursor
        if (charPos === this.cursorPosition) {
          this.selectedEventId = event.id;
        }
      }
    }

    return line.join('');
  }

  private renderTrack(
    track: TimelineTrack,
    width: number,
    scale: number,
    startTick: number,
    endTick: number
  ): string {
    const labelWidth = Math.min(12, track.label.length);
    const label = track.label.slice(0, labelWidth).padEnd(labelWidth);
    const trackWidth = width - labelWidth - 1;

    const line = Array(trackWidth).fill('─');

    // Filter events in range
    const trackEvents = track.events.filter(e => e.timestamp >= startTick && e.timestamp <= endTick);

    for (const event of trackEvents) {
      const charPos = Math.floor((event.timestamp - this.scrollOffset) / scale);
      if (charPos >= 0 && charPos < trackWidth) {
        line[charPos] = this.getSignificanceMarker(event.significance);
      }
    }

    return `${label}│${line.join('')}`;
  }

  private renderEras(width: number, scale: number): string {
    const line = Array(width).fill(' ');

    for (const era of this.eras) {
      const startPos = Math.floor((era.startTick - this.scrollOffset) / scale);
      const endPos = Math.floor((era.endTick - this.scrollOffset) / scale);

      if (endPos < 0 || startPos >= width) continue;

      const clampedStart = Math.max(0, startPos);
      const clampedEnd = Math.min(width - 1, endPos);

      // Draw era bar
      for (let i = clampedStart; i <= clampedEnd; i++) {
        line[i] = '▬';
      }

      // Place label in middle if it fits
      const labelStart = Math.floor((clampedStart + clampedEnd - era.label.length) / 2);
      if (labelStart >= clampedStart && labelStart + era.label.length <= clampedEnd) {
        for (let i = 0; i < era.label.length; i++) {
          const char = era.label[i];
          if (char !== undefined) {
            line[labelStart + i] = char;
          }
        }
      }
    }

    return line.join('');
  }

  private renderFooter(width: number): string {
    const controls = '[←/→] Scroll  [z] Zoom  [t] Tracks  [c] Filter  [Enter] Inspect';
    return controls.slice(0, width).padEnd(width);
  }

  private getSignificanceMarker(significance: number): string {
    for (const { threshold, marker } of SIGNIFICANCE_MARKERS) {
      if (significance >= threshold) {
        return marker;
      }
    }
    return '·';
  }

  private getTicksPerMark(): number {
    switch (this.zoomLevel) {
      case 'year':
        return 360; // Mark every year at year zoom
      case 'decade':
        return 3600; // Mark every 10 years at decade zoom
      case 'century':
        return 36000; // Mark every 100 years at century zoom
    }
  }

  private scrollLeft(): void {
    const scale = ZOOM_SCALES[this.zoomLevel];
    const scrollAmount = scale * 10; // Scroll 10 characters worth
    this.scrollOffset = Math.max(0, this.scrollOffset - scrollAmount);
  }

  private scrollRight(): void {
    const scale = ZOOM_SCALES[this.zoomLevel];
    const scrollAmount = scale * 10;
    this.scrollOffset += scrollAmount;
  }

  private cycleZoom(): void {
    const levels: TimelineZoomLevel[] = ['year', 'decade', 'century'];
    const currentIndex = levels.indexOf(this.zoomLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    const nextLevel = levels[nextIndex];
    if (nextLevel !== undefined) {
      this.zoomLevel = nextLevel;
    }
  }

  private toggleTracks(): void {
    this.showTracks = !this.showTracks;
  }

  private cycleCategoryFilter(): void {
    const categories = Object.values({
      Political: 'Political' as EventCategory,
      Magical: 'Magical' as EventCategory,
      Cultural: 'Cultural' as EventCategory,
      Religious: 'Religious' as EventCategory,
      Scientific: 'Scientific' as EventCategory,
      Personal: 'Personal' as EventCategory,
      Exploratory: 'Exploratory' as EventCategory,
      Economic: 'Economic' as EventCategory,
      Disaster: 'Disaster' as EventCategory,
      Military: 'Military' as EventCategory,
    });

    if (this.categoryFilter === null) {
      this.categoryFilter = categories[0] ?? null;
    } else {
      const currentIndex = categories.indexOf(this.categoryFilter);
      if (currentIndex === categories.length - 1) {
        this.categoryFilter = null;
      } else {
        this.categoryFilter = categories[currentIndex + 1] ?? null;
      }
    }
  }

  private scrollToStart(): void {
    this.scrollOffset = 0;
  }

  private scrollToEnd(): void {
    // Would need context to know max tick - for now just scroll forward
    const scale = ZOOM_SCALES[this.zoomLevel];
    this.scrollOffset += scale * 100;
  }

  private moveCursor(delta: number): void {
    const { width } = this.getInnerDimensions();
    this.cursorPosition = Math.max(0, Math.min(width - 1, this.cursorPosition + delta));
  }

  private inspectSelectedEvent(): void {
    if (this.selectedEventId !== null && this.inspectHandler !== null) {
      this.inspectHandler(this.selectedEventId);
    }
  }
}

/**
 * Create a layout for the timeline panel.
 */
export function createTimelinePanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.Timeline,
    x,
    y,
    width,
    height,
    focused: false,
  };
}
