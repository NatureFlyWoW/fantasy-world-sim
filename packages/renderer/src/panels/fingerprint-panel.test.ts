/**
 * Tests for FingerprintPanel and ASCII visualization helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FingerprintPanel,
  createFingerprintPanelLayout,
  renderSparkline,
  renderProgressBar,
  renderHexChart,
  renderCivPalettePlain,
  SPARKLINE_CHARS,
} from './fingerprint-panel.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { RenderContext } from '../types.js';
import { EventLog, EventBus, EventCategory, toEventId, toEntityId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, WorldEvent } from '@fws/core';

// Create mock world with Territory store
function createMockWorld(factionIds: number[] = []): World {
  const factionSet = new Set(factionIds);
  return {
    hasStore: (type: string) => type === 'Territory' && factionIds.length > 0,
    query: () => factionIds.map((id) => toEntityId(id)),
    getComponent: () => undefined,
  } as unknown as World;
}

// Create a mock event
function createMockEvent(
  id: number,
  timestamp: number,
  significance: number,
  category: EventCategory,
  participants: number[] = [],
): WorldEvent {
  return {
    id: toEventId(toEntityId(id)),
    category,
    subtype: `test.${category.toLowerCase()}`,
    timestamp,
    participants: participants.map((p) => toEntityId(p)),
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  };
}

// Create mock render context
function createMockContext(
  events: WorldEvent[] = [],
  factionIds: number[] = [],
): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  for (const event of events) {
    eventLog.append(event);
  }

  return {
    world: createMockWorld(factionIds),
    clock: {
      currentTick: 360,
      currentTime: { year: 1, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

describe('renderSparkline', () => {
  it('returns empty string for empty data', () => {
    expect(renderSparkline([], 10)).toBe('');
  });

  it('renders single value as middle block', () => {
    const result = renderSparkline([50], 10);
    expect(result.length).toBe(1);
    // Single value: normalized = 0.5 → index 4 → '▅'
    expect(SPARKLINE_CHARS).toContain(result);
  });

  it('renders ascending data with ascending blocks', () => {
    const data = [0, 25, 50, 75, 100];
    const result = renderSparkline(data, 5);
    expect(result.length).toBe(5);
    // First char should be lowest block, last should be highest
    expect(result[0]).toBe('▁');
    expect(result[4]).toBe('█');
  });

  it('renders flat data as identical blocks', () => {
    const data = [50, 50, 50, 50];
    const result = renderSparkline(data, 4);
    // All values the same → normalized = 0.5 → all same char
    const firstChar = result[0];
    for (const ch of result) {
      expect(ch).toBe(firstChar);
    }
  });

  it('limits output to maxWidth', () => {
    const data = Array.from({ length: 100 }, (_, i) => i);
    const result = renderSparkline(data, 20);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('handles all-zero data', () => {
    const data = [0, 0, 0];
    const result = renderSparkline(data, 3);
    expect(result.length).toBe(3);
  });
});

describe('renderProgressBar', () => {
  it('renders 0/100 as all empty', () => {
    const result = renderProgressBar(0, 20);
    expect(result).toContain('0/100');
    expect(result).toContain('░');
    expect(result).not.toContain('██');
  });

  it('renders 100/100 as all filled', () => {
    const result = renderProgressBar(100, 20);
    expect(result).toContain('100/100');
    expect(result).toContain('█');
    expect(result).not.toContain('░');
  });

  it('renders 50/100 as half filled', () => {
    const result = renderProgressBar(50, 20);
    expect(result).toContain('50/100');
    expect(result).toContain('█');
    expect(result).toContain('░');
  });
});

describe('renderHexChart', () => {
  it('renders 7 lines', () => {
    const balance = new Map<string, number>([
      ['Warfare', 50],
      ['Magic', 50],
      ['Religion', 50],
      ['Commerce', 50],
      ['Scholarship', 50],
      ['Diplomacy', 50],
    ]);
    const lines = renderHexChart(balance as Parameters<typeof renderHexChart>[0]);
    expect(lines.length).toBe(7);
  });

  it('contains domain abbreviations', () => {
    const balance = new Map<string, number>([
      ['Warfare', 10],
      ['Magic', 20],
      ['Religion', 30],
      ['Commerce', 40],
      ['Scholarship', 50],
      ['Diplomacy', 60],
    ]);
    const output = renderHexChart(balance as Parameters<typeof renderHexChart>[0]).join('\n');
    expect(output).toContain('WAR');
    expect(output).toContain('MAG');
    expect(output).toContain('REL');
    expect(output).toContain('COM');
    expect(output).toContain('SCH');
    expect(output).toContain('DIP');
  });

  it('contains numeric values', () => {
    const balance = new Map<string, number>([
      ['Warfare', 42],
      ['Magic', 0],
      ['Religion', 100],
      ['Commerce', 7],
      ['Scholarship', 55],
      ['Diplomacy', 83],
    ]);
    const output = renderHexChart(balance as Parameters<typeof renderHexChart>[0]).join('\n');
    expect(output).toContain('42');
    expect(output).toContain(' 0');
    expect(output).toContain('100');
  });

  it('shows balanced indicator when values are close', () => {
    const balance = new Map<string, number>([
      ['Warfare', 16],
      ['Magic', 17],
      ['Religion', 16],
      ['Commerce', 17],
      ['Scholarship', 17],
      ['Diplomacy', 17],
    ]);
    const output = renderHexChart(balance as Parameters<typeof renderHexChart>[0]).join('\n');
    // Low stdDev → ● center
    expect(output).toContain('●');
  });

  it('shows skewed indicator when values are far apart', () => {
    const balance = new Map<string, number>([
      ['Warfare', 90],
      ['Magic', 0],
      ['Religion', 0],
      ['Commerce', 0],
      ['Scholarship', 10],
      ['Diplomacy', 0],
    ]);
    const output = renderHexChart(balance as Parameters<typeof renderHexChart>[0]).join('\n');
    // High stdDev → · center
    expect(output).toContain('·');
  });
});

describe('renderCivPalettePlain', () => {
  it('renders empty bar for no factions', () => {
    const result = renderCivPalettePlain([], 20);
    expect(result).toBe('░'.repeat(20));
  });

  it('renders full bar for single faction', () => {
    const palette = [{ factionId: 1, proportion: 1.0, color: 'red' }] as Parameters<typeof renderCivPalettePlain>[0];
    const result = renderCivPalettePlain(palette, 20);
    expect(result).toBe('█'.repeat(20));
  });

  it('splits bar proportionally between two factions', () => {
    const palette = [
      { factionId: 1, proportion: 0.75, color: 'red' },
      { factionId: 2, proportion: 0.25, color: 'blue' },
    ] as Parameters<typeof renderCivPalettePlain>[0];
    const result = renderCivPalettePlain(palette, 20);
    expect(result.length).toBe(20);
    // All should be filled blocks
    expect(result).toBe('█'.repeat(20));
  });

  it('total width matches requested width', () => {
    const palette = [
      { factionId: 1, proportion: 0.33, color: 'red' },
      { factionId: 2, proportion: 0.33, color: 'blue' },
      { factionId: 3, proportion: 0.34, color: 'green' },
    ] as Parameters<typeof renderCivPalettePlain>[0];
    const result = renderCivPalettePlain(palette, 30);
    expect(result.length).toBe(30);
  });
});

describe('FingerprintPanel', () => {
  let screen: MockScreen;
  let panel: FingerprintPanel;

  beforeEach(() => {
    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const layout = createFingerprintPanelLayout(0, 0, 60, 40);
    panel = new FingerprintPanel(screen as unknown as any, layout, boxFactory as unknown as any);
  });

  it('creates with correct panel ID', () => {
    const layout = panel.getLayout();
    expect(layout.id).toBe('Fingerprint');
  });

  it('renders without errors with empty context', () => {
    const context = createMockContext();
    expect(() => panel.render(context)).not.toThrow();
  });

  it('renders with events and produces a cached fingerprint', () => {
    const events = [
      createMockEvent(1, 0, 60, EventCategory.Military, [100]),
      createMockEvent(2, 100, 40, EventCategory.Magical, [101]),
      createMockEvent(3, 200, 70, EventCategory.Economic, [100]),
    ];
    const context = createMockContext(events, [100, 101]);
    panel.render(context);

    const fp = panel.getFingerprint();
    expect(fp).toBeDefined();
    expect(fp!.domainBalance.size).toBe(6);
    expect(fp!.civilizationPalette.length).toBeGreaterThan(0);
  });

  it('caches fingerprint and reuses when event count unchanged', () => {
    const events = [
      createMockEvent(1, 0, 60, EventCategory.Military),
    ];
    const context = createMockContext(events);
    panel.render(context);
    const fp1 = panel.getFingerprint();

    panel.render(context);
    const fp2 = panel.getFingerprint();

    // Same object reference (cached)
    expect(fp1).toBe(fp2);
  });

  it('recalculates when event count changes', () => {
    const events1 = [
      createMockEvent(1, 0, 60, EventCategory.Military),
    ];
    const context1 = createMockContext(events1);
    panel.render(context1);
    const fp1 = panel.getFingerprint();

    const events2 = [
      createMockEvent(1, 0, 60, EventCategory.Military),
      createMockEvent(2, 100, 40, EventCategory.Magical),
    ];
    const context2 = createMockContext(events2);
    panel.render(context2);
    const fp2 = panel.getFingerprint();

    expect(fp1).not.toBe(fp2);
  });

  it('handles R key to force refresh', () => {
    expect(panel.handleInput('r')).toBe(true);
  });

  it('handles scroll keys', () => {
    expect(panel.handleInput('up')).toBe(true);
    expect(panel.handleInput('down')).toBe(true);
    expect(panel.handleInput('k')).toBe(true);
    expect(panel.handleInput('j')).toBe(true);
  });

  it('returns false for unhandled keys', () => {
    expect(panel.handleInput('x')).toBe(false);
    expect(panel.handleInput('q')).toBe(false);
  });
});

describe('createFingerprintPanelLayout', () => {
  it('creates layout with Fingerprint panel ID', () => {
    const layout = createFingerprintPanelLayout(10, 20, 60, 40);
    expect(layout.id).toBe('Fingerprint');
    expect(layout.x).toBe(10);
    expect(layout.y).toBe(20);
    expect(layout.width).toBe(60);
    expect(layout.height).toBe(40);
    expect(layout.focused).toBe(false);
  });
});
