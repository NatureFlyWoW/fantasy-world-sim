/**
 * StatisticsPanel — displays ASCII charts and world statistics.
 * Shows population, territory, technology, and conflict data.
 */

import type * as blessed from 'blessed';
import type { EntityId, EventCategory } from '@fws/core';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { BasePanel } from '../panel.js';

// Constants for chart rendering
const FULL_CHAR = '█';
const EMPTY_CHAR = ' ';

/**
 * Statistics view modes.
 */
export type StatsView = 'population' | 'territory' | 'technology' | 'conflict' | 'overview';

/**
 * Characters for vertical bar/line charts (8 levels).
 */
export const CHART_BARS: readonly string[] = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Characters for horizontal bar fills.
 */
export const FILL_CHARS: Readonly<Record<string, string>> = {
  full: '█',
  high: '▓',
  medium: '▒',
  low: '░',
  empty: ' ',
};

/**
 * Data point for charts.
 */
export interface DataPoint {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

/**
 * Time series data.
 */
export interface TimeSeries {
  readonly name: string;
  readonly data: readonly number[];
  readonly color?: string;
}

/**
 * Statistics snapshot at a point in time.
 */
export interface WorldStats {
  readonly totalPopulation: number;
  readonly factionCount: number;
  readonly settlementCount: number;
  readonly warCount: number;
  readonly eventCount: number;
  readonly techsUnlocked: number;
  readonly averageWealth: number;
}

/**
 * StatisticsPanel renders ASCII charts and statistics.
 */
export class StatisticsPanel extends BasePanel {
  private currentView: StatsView = 'overview';
  private scrollOffset = 0;
  private timeSeries: Map<string, TimeSeries> = new Map();
  private categoryStats: Map<EventCategory, number> = new Map();
  private factionStats: Map<EntityId, { name: string; population: number; territory: number }> = new Map();

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Statistics');
  }

  /**
   * Render the statistics panel.
   */
  render(context: RenderContext): void {
    this.clearArea();
    const { width, height } = this.getInnerDimensions();

    // Update stats from context
    this.updateStatsFromContext(context);

    const lines: string[] = [];

    // Header
    lines.push(this.renderHeader(width));
    lines.push('');

    // Render view-specific content
    switch (this.currentView) {
      case 'overview':
        lines.push(...this.renderOverview(context, width, height - 4));
        break;
      case 'population':
        lines.push(...this.renderPopulation(width, height - 4));
        break;
      case 'territory':
        lines.push(...this.renderTerritory(width, height - 4));
        break;
      case 'technology':
        lines.push(...this.renderTechnology(width, height - 4));
        break;
      case 'conflict':
        lines.push(...this.renderConflict(context, width, height - 4));
        break;
    }

    // Pad to fill height
    while (lines.length < height - 1) {
      lines.push('');
    }

    // Footer
    lines.push(this.renderFooter(width));

    this.setContent(lines.join('\n'));
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    switch (key) {
      case '1':
        this.currentView = 'overview';
        return true;
      case '2':
        this.currentView = 'population';
        return true;
      case '3':
        this.currentView = 'territory';
        return true;
      case '4':
        this.currentView = 'technology';
        return true;
      case '5':
        this.currentView = 'conflict';
        return true;
      case 'up':
      case 'k':
        this.scrollOffset = Math.max(0, this.scrollOffset - 1);
        return true;
      case 'down':
      case 'j':
        this.scrollOffset += 1;
        return true;
      default:
        return false;
    }
  }

  // === Public API ===

  /**
   * Get current view.
   */
  getCurrentView(): StatsView {
    return this.currentView;
  }

  /**
   * Set current view.
   */
  setCurrentView(view: StatsView): void {
    this.currentView = view;
    this.scrollOffset = 0;
  }

  /**
   * Add time series data.
   */
  addTimeSeries(name: string, data: readonly number[], color?: string): void {
    const series: TimeSeries = {
      name,
      data,
      ...(color !== undefined ? { color } : {}),
    };
    this.timeSeries.set(name, series);
  }

  /**
   * Clear all time series.
   */
  clearTimeSeries(): void {
    this.timeSeries.clear();
  }

  /**
   * Get time series.
   */
  getTimeSeries(): Map<string, TimeSeries> {
    return new Map(this.timeSeries);
  }

  /**
   * Update faction statistics.
   */
  setFactionStats(
    factionId: EntityId,
    name: string,
    population: number,
    territory: number
  ): void {
    this.factionStats.set(factionId, { name, population, territory });
  }

  /**
   * Clear faction stats.
   */
  clearFactionStats(): void {
    this.factionStats.clear();
  }

  /**
   * Clean up.
   */
  destroy(): void {
    this.timeSeries.clear();
    this.categoryStats.clear();
    this.factionStats.clear();
    super.destroy();
  }

  // === Private Methods ===

  private updateStatsFromContext(context: RenderContext): void {
    // Update category stats from event log
    this.categoryStats.clear();
    const allEvents = context.eventLog.getAll();

    for (const event of allEvents) {
      const count = this.categoryStats.get(event.category) ?? 0;
      this.categoryStats.set(event.category, count + 1);
    }
  }

  private renderHeader(width: number): string {
    const views = [
      { key: '1', name: 'Overview', active: this.currentView === 'overview' },
      { key: '2', name: 'Population', active: this.currentView === 'population' },
      { key: '3', name: 'Territory', active: this.currentView === 'territory' },
      { key: '4', name: 'Technology', active: this.currentView === 'technology' },
      { key: '5', name: 'Conflict', active: this.currentView === 'conflict' },
    ];

    let header = '';
    for (const v of views) {
      const label = v.active ? `[${v.key}:${v.name}]` : ` ${v.key}:${v.name} `;
      header += label;
    }

    return header.slice(0, width);
  }

  private renderOverview(context: RenderContext, width: number, maxHeight: number): string[] {
    const lines: string[] = [];
    const allEvents = context.eventLog.getAll();
    const currentTick = context.clock.currentTick;
    const currentYear = Math.floor(currentTick / 360) + 1;

    lines.push(`World Age: Year ${currentYear}`);
    lines.push(`Total Events: ${allEvents.length}`);
    lines.push('');

    // Event category breakdown as sparkline bar chart
    lines.push('Events by Category:');
    const categoryData = Array.from(this.categoryStats.entries())
      .sort((a, b) => b[1] - a[1]);

    const maxCount = Math.max(1, ...categoryData.map(([, count]) => count));

    for (const [category, count] of categoryData) {
      const barWidth = Math.max(0, Math.min(width - 20, 30));
      const filledWidth = Math.round((count / maxCount) * barWidth);
      const bar = FULL_CHAR.repeat(filledWidth) + EMPTY_CHAR.repeat(Math.max(0, barWidth - filledWidth));
      const label = category.padEnd(12);
      lines.push(`${label} ${bar} ${count}`);
    }

    lines.push('');

    // Significance distribution
    lines.push('Event Significance Distribution:');
    let sigMinor = 0;
    let sigNotable = 0;
    let sigMajor = 0;
    let sigCritical = 0;
    for (const event of allEvents) {
      if (event.significance >= 85) sigCritical++;
      else if (event.significance >= 60) sigMajor++;
      else if (event.significance >= 30) sigNotable++;
      else sigMinor++;
    }
    const sigBuckets = [sigMinor, sigNotable, sigMajor, sigCritical];

    const sigLabels = ['Minor (<30)', 'Notable (30-60)', 'Major (60-85)', 'Critical (85+)'];
    const maxSig = Math.max(1, ...sigBuckets);

    for (let i = 0; i < 4; i++) {
      const count = sigBuckets[i] ?? 0;
      const barWidth = Math.max(0, Math.min(width - 25, 25));
      const filledWidth = Math.round((count / maxSig) * barWidth);
      const bar = FULL_CHAR.repeat(filledWidth);
      const label = (sigLabels[i] ?? '').padEnd(18);
      lines.push(`${label} ${bar} ${count}`);
    }

    return lines.slice(0, maxHeight);
  }

  private renderPopulation(width: number, maxHeight: number): string[] {
    const lines: string[] = [];
    lines.push('Population by Faction:');
    lines.push('');

    if (this.factionStats.size === 0) {
      lines.push('(No faction data available)');
      return lines;
    }

    // Sort by population
    const factions = Array.from(this.factionStats.values())
      .sort((a, b) => b.population - a.population);

    const maxPop = Math.max(1, ...factions.map(f => f.population));
    const barWidth = Math.min(width - 25, 30);

    for (const faction of factions) {
      const filledWidth = Math.round((faction.population / maxPop) * barWidth);
      const bar = FULL_CHAR.repeat(filledWidth);
      const label = faction.name.slice(0, 15).padEnd(15);
      lines.push(`${label} ${bar} ${faction.population.toLocaleString()}`);
    }

    // Population time series if available
    const popSeries = this.timeSeries.get('population');
    if (popSeries !== undefined && popSeries.data.length > 0) {
      lines.push('');
      lines.push('Population over Time:');
      lines.push(this.renderSparkline(popSeries.data, width - 4));
    }

    return lines.slice(0, maxHeight);
  }

  private renderTerritory(width: number, maxHeight: number): string[] {
    const lines: string[] = [];
    lines.push('Territory by Faction:');
    lines.push('');

    if (this.factionStats.size === 0) {
      lines.push('(No territory data available)');
      return lines;
    }

    // Sort by territory
    const factions = Array.from(this.factionStats.values())
      .sort((a, b) => b.territory - a.territory);

    const maxTerritory = Math.max(1, ...factions.map(f => f.territory));
    const barWidth = Math.min(width - 25, 30);

    for (const faction of factions) {
      const filledWidth = Math.round((faction.territory / maxTerritory) * barWidth);
      const bar = FULL_CHAR.repeat(filledWidth);
      const label = faction.name.slice(0, 15).padEnd(15);
      lines.push(`${label} ${bar} ${faction.territory} tiles`);
    }

    // Territory time series if available
    const territorySeries = this.timeSeries.get('territory');
    if (territorySeries !== undefined && territorySeries.data.length > 0) {
      lines.push('');
      lines.push('Total Territory over Time:');
      lines.push(this.renderSparkline(territorySeries.data, width - 4));
    }

    return lines.slice(0, maxHeight);
  }

  private renderTechnology(width: number, maxHeight: number): string[] {
    const lines: string[] = [];
    lines.push('Technology Progress:');
    lines.push('');

    // Tech time series if available
    const techSeries = this.timeSeries.get('technology');
    if (techSeries !== undefined && techSeries.data.length > 0) {
      lines.push('Technologies Unlocked over Time:');
      lines.push(this.renderSparkline(techSeries.data, width - 4));
      lines.push('');

      const latest = techSeries.data[techSeries.data.length - 1] ?? 0;
      lines.push(`Current Technologies: ${latest}`);
    } else {
      lines.push('(No technology data available)');
    }

    return lines.slice(0, maxHeight);
  }

  private renderConflict(context: RenderContext, width: number, maxHeight: number): string[] {
    const lines: string[] = [];
    lines.push('Conflict Statistics:');
    lines.push('');

    // Count military events
    const militaryEvents = context.eventLog.getByCategory('Military' as EventCategory);
    lines.push(`Military Events: ${militaryEvents.length}`);

    // Count by significance (proxy for battle size)
    let majorBattles = 0;
    let minorSkirmishes = 0;
    for (const event of militaryEvents) {
      if (event.significance >= 60) majorBattles++;
      else minorSkirmishes++;
    }

    lines.push(`Major Battles: ${majorBattles}`);
    lines.push(`Minor Skirmishes: ${minorSkirmishes}`);
    lines.push('');

    // War time series if available
    const warSeries = this.timeSeries.get('wars');
    if (warSeries !== undefined && warSeries.data.length > 0) {
      lines.push('Active Wars over Time:');
      lines.push(this.renderSparkline(warSeries.data, width - 4));
    }

    // Casualties series if available
    const casualtiesSeries = this.timeSeries.get('casualties');
    if (casualtiesSeries !== undefined && casualtiesSeries.data.length > 0) {
      lines.push('');
      lines.push('Casualties over Time:');
      lines.push(this.renderSparkline(casualtiesSeries.data, width - 4));
    }

    return lines.slice(0, maxHeight);
  }

  private renderSparkline(data: readonly number[], width: number): string {
    if (data.length === 0) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Sample data to fit width
    const step = Math.max(1, Math.floor(data.length / width));
    const sampledData: number[] = [];

    for (let i = 0; i < data.length; i += step) {
      sampledData.push(data[i] ?? 0);
    }

    // Convert to bar characters
    let sparkline = '';
    for (const value of sampledData.slice(0, width)) {
      const normalized = (value - min) / range;
      const barIndex = Math.min(7, Math.floor(normalized * 8));
      const bar = CHART_BARS[barIndex];
      sparkline += bar ?? '▁';
    }

    return sparkline;
  }

  private renderFooter(width: number): string {
    const controls = '[1-5] Views  [↑/↓] Scroll';
    return controls.slice(0, width).padEnd(width);
  }
}

/**
 * Create a layout for the statistics panel.
 */
export function createStatsPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.Statistics,
    x,
    y,
    width,
    height,
    focused: false,
  };
}

/**
 * Render a horizontal bar chart.
 */
export function renderBarChart(
  data: readonly DataPoint[],
  width: number,
  labelWidth: number = 12
): string[] {
  const lines: string[] = [];
  const maxValue = Math.max(1, ...data.map(d => d.value));
  const barWidth = width - labelWidth - 8;

  for (const point of data) {
    const filledWidth = Math.round((point.value / maxValue) * barWidth);
    const bar = FULL_CHAR.repeat(filledWidth) + EMPTY_CHAR.repeat(barWidth - filledWidth);
    const label = point.label.slice(0, labelWidth).padEnd(labelWidth);
    lines.push(`${label} ${bar} ${point.value}`);
  }

  return lines;
}

/**
 * Render a vertical bar chart (single row of bars).
 */
export function renderVerticalBars(data: readonly number[], width: number): string {
  if (data.length === 0) return '';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Sample to fit width
  const step = Math.max(1, Math.ceil(data.length / width));
  let result = '';

  for (let i = 0; i < width && i * step < data.length; i++) {
    const value = data[i * step] ?? 0;
    const normalized = (value - min) / range;
    const barIndex = Math.min(7, Math.floor(normalized * 8));
    result += CHART_BARS[barIndex] ?? '▁';
  }

  return result;
}

/**
 * Render a line chart using braille characters.
 */
export function renderLineChart(
  series: readonly TimeSeries[],
  width: number,
  height: number
): string[] {
  const lines: string[] = [];

  if (series.length === 0 || series[0] === undefined) {
    return Array(height).fill(' '.repeat(width));
  }

  // Get data range
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const v of s.data) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  const range = max - min || 1;

  // Create grid
  const grid: string[][] = [];
  for (let y = 0; y < height; y++) {
    grid.push(Array(width).fill(' '));
  }

  // Plot each series
  for (const s of series) {
    const step = Math.max(1, Math.floor(s.data.length / width));

    for (let x = 0; x < width && x * step < s.data.length; x++) {
      const value = s.data[x * step] ?? 0;
      const normalized = (value - min) / range;
      const y = Math.floor((1 - normalized) * (height - 1));

      if (y >= 0 && y < height) {
        const row = grid[y];
        if (row !== undefined) {
          row[x] = '•';
        }
      }
    }
  }

  // Convert grid to lines
  for (const row of grid) {
    lines.push(row.join(''));
  }

  return lines;
}
