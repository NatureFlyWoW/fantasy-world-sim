/**
 * FingerprintPanel — renders the World DNA Fingerprint as ASCII visualization.
 *
 * Displays:
 * - Balance Glyph: hexagonal radar chart (one axis per domain)
 * - Civilization Palette: colored faction bar
 * - Sparklines: volatility, magic, population per century
 * - Complexity score: progress bar with numeric value
 */

import type * as blessed from 'blessed';
import {
  WorldFingerprintCalculator,
  FINGERPRINT_DOMAINS,
} from '@fws/core';
import type { WorldFingerprint, FingerprintDomain } from '@fws/core';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { BasePanel } from '../panel.js';

/**
 * Sparkline block characters, 8 levels from lowest to tallest.
 */
export const SPARKLINE_CHARS: readonly string[] = [
  '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█',
];

/**
 * Convert a numeric array to a sparkline string.
 * Values are normalized relative to the array's own min/max.
 */
export function renderSparkline(data: readonly number[], maxWidth: number): string {
  if (data.length === 0) return '';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  // Sample data to fit width if needed
  const step = Math.max(1, Math.ceil(data.length / maxWidth));
  let result = '';

  for (let i = 0; i < maxWidth && i * step < data.length; i++) {
    const value = data[i * step] ?? 0;
    const normalized = range > 0 ? (value - min) / range : 0.5;
    const charIndex = Math.min(7, Math.floor(normalized * 8));
    result += SPARKLINE_CHARS[charIndex] ?? '▁';
  }

  return result;
}

/**
 * Render a progress bar: [████████░░] 82/100
 */
export function renderProgressBar(value: number, width: number): string {
  const barWidth = Math.max(1, width - 8); // leave room for " XX/100"
  const filledWidth = Math.round((value / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;
  const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
  const label = `${value}`.padStart(3);
  return `${bar} ${label}/100`;
}

/**
 * Render a hexagonal radar chart as ASCII lines.
 *
 * Layout (7 lines tall, ~25 chars wide):
 *       WAR(XX)
 *      ╱      ╲
 * DIP(XX)      MAG(XX)
 *     │   ●    │
 * SCH(XX)      REL(XX)
 *      ╲      ╱
 *       COM(XX)
 *
 * The center dot size hints at overall balance (● if balanced, · if skewed).
 */
export function renderHexChart(balance: Map<FingerprintDomain, number>): string[] {
  const val = (domain: FingerprintDomain): string => {
    const v = Math.round(balance.get(domain) ?? 0);
    return `${v}`.padStart(2);
  };

  // Calculate balance indicator: standard deviation of domain values
  const values = FINGERPRINT_DOMAINS.map((d) => balance.get(d) ?? 0);
  const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, values.length);
  const stdDev = Math.sqrt(variance);
  // Low stdDev = balanced, high = skewed
  const centerChar = stdDev < 8 ? '●' : stdDev < 15 ? '◉' : '·';

  const lines: string[] = [];

  //       WAR(XX)
  lines.push(`       WAR(${val('Warfare')})`);
  //      ╱      ╲
  lines.push('      ╱        ╲');
  // DIP(XX)      MAG(XX)
  lines.push(`DIP(${val('Diplomacy')})        MAG(${val('Magic')})`);
  //     │   ●    │
  lines.push(`    │     ${centerChar}     │`);
  // SCH(XX)      REL(XX)
  lines.push(`SCH(${val('Scholarship')})        REL(${val('Religion')})`);
  //      ╲      ╱
  lines.push('      ╲        ╱');
  //       COM(XX)
  lines.push(`       COM(${val('Commerce')})`);

  return lines;
}

/**
 * Render the civilization palette as a colored horizontal bar.
 * Each faction gets a proportional segment using block characters.
 */
export function renderCivPalette(
  palette: WorldFingerprint['civilizationPalette'],
  width: number,
): string {
  if (palette.length === 0) return '░'.repeat(width);

  let bar = '';
  let remaining = width;

  for (let i = 0; i < palette.length; i++) {
    const entry = palette[i];
    if (entry === undefined) continue;

    const segmentWidth =
      i === palette.length - 1
        ? remaining // last segment takes whatever is left
        : Math.max(1, Math.round(entry.proportion * width));

    const chars = '█'.repeat(Math.min(segmentWidth, remaining));
    bar += `{${entry.color}-fg}${chars}{/}`;
    remaining -= chars.replace(/\{[^}]*\}/g, '').length;

    if (remaining <= 0) break;
  }

  return bar;
}

/**
 * Render the civilization palette without color tags (for testing).
 */
export function renderCivPalettePlain(
  palette: WorldFingerprint['civilizationPalette'],
  width: number,
): string {
  if (palette.length === 0) return '░'.repeat(width);

  let bar = '';
  let remaining = width;

  for (let i = 0; i < palette.length; i++) {
    const entry = palette[i];
    if (entry === undefined) continue;

    const segmentWidth =
      i === palette.length - 1
        ? remaining
        : Math.max(1, Math.round(entry.proportion * width));

    const chars = '█'.repeat(Math.min(segmentWidth, remaining));
    bar += chars;
    remaining -= chars.length;

    if (remaining <= 0) break;
  }

  return bar;
}

/**
 * FingerprintPanel renders the World DNA signature.
 */
export class FingerprintPanel extends BasePanel {
  private calculator = new WorldFingerprintCalculator();
  private cachedFingerprint: WorldFingerprint | undefined;
  private lastEventCount = -1;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement,
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('World DNA');
  }

  /**
   * Render the fingerprint panel.
   */
  render(context: RenderContext): void {
    this.clearArea();
    const { width, height } = this.getInnerDimensions();

    // Recalculate fingerprint only when event count changes
    const eventCount = context.eventLog.getCount();
    if (this.cachedFingerprint === undefined || eventCount !== this.lastEventCount) {
      this.cachedFingerprint = this.calculator.calculateFingerprint(
        context.world,
        context.eventLog,
      );
      this.lastEventCount = eventCount;
    }

    const fp = this.cachedFingerprint;
    const lines: string[] = [];

    // Section 1: Balance Glyph (hex chart)
    lines.push('{bold}Domain Balance{/bold}');
    lines.push(...renderHexChart(fp.domainBalance));
    lines.push('');

    // Section 2: Civilization Palette
    lines.push('{bold}Civilization Palette{/bold}');
    const paletteWidth = Math.max(1, width - 2);
    lines.push(`[${renderCivPalette(fp.civilizationPalette, paletteWidth)}]`);

    // Legend (top factions)
    for (let i = 0; i < Math.min(4, fp.civilizationPalette.length); i++) {
      const entry = fp.civilizationPalette[i];
      if (entry === undefined) continue;
      const pct = Math.round(entry.proportion * 100);
      lines.push(
        ` {${entry.color}-fg}█{/} Faction #${entry.factionId} ${pct}%`,
      );
    }
    lines.push('');

    // Section 3: Sparklines
    lines.push('{bold}Historical Trends{/bold}');
    const sparkWidth = Math.max(1, width - 16);
    lines.push(`Volatility: ${renderSparkline(fp.volatilityTimeline, sparkWidth)}`);
    lines.push(`Magic:      ${renderSparkline(fp.magicCurve, sparkWidth)}`);
    lines.push(`Population: ${renderSparkline(fp.populationTrend, sparkWidth)}`);
    lines.push('');

    // Section 4: Complexity Score
    lines.push('{bold}Complexity{/bold}');
    const progWidth = Math.max(1, width - 14);
    lines.push(`Complexity: ${renderProgressBar(fp.complexityScore, progWidth)}`);

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
      case 'r':
        // Force recalculate
        this.cachedFingerprint = undefined;
        this.lastEventCount = -1;
        return true;
      case 'up':
      case 'k':
        this.scroll(-1);
        return true;
      case 'down':
      case 'j':
        this.scroll(1);
        return true;
      default:
        return false;
    }
  }

  /**
   * Get the cached fingerprint (for external use / testing).
   */
  getFingerprint(): WorldFingerprint | undefined {
    return this.cachedFingerprint;
  }

  private renderFooter(width: number): string {
    const controls = '[R] Refresh  [↑/↓] Scroll';
    return controls.slice(0, width).padEnd(width);
  }
}

/**
 * Create a layout for the fingerprint panel.
 */
export function createFingerprintPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number,
): PanelLayout {
  return {
    id: PanelId.Fingerprint,
    x,
    y,
    width,
    height,
    focused: false,
  };
}
