import { describe, it, expect, beforeEach } from 'vitest';
import {
  StatisticsPanel,
  createStatsPanelLayout,
  renderBarChart,
  renderVerticalBars,
  renderLineChart,
  CHART_BARS,
  FILL_CHARS,
} from './stats.js';
import { MockScreen, createMockBoxFactory } from '../panel.js';
import type { RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { EventLog, EventBus, toEventId, toEntityId } from '@fws/core';
import type { World, WorldClock, SpatialIndex, WorldEvent, EventCategory } from '@fws/core';

// Create mock world
function createMockWorld(): World {
  return {
    hasStore: () => false,
    getComponent: () => undefined,
  } as unknown as World;
}

// Create a mock event
function createMockEvent(
  id: number,
  timestamp: number,
  significance: number,
  category: EventCategory = 'Political' as EventCategory
): WorldEvent {
  return {
    id: toEventId(toEntityId(id)),
    category,
    subtype: 'test.event',
    timestamp,
    participants: [toEntityId(1)],
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  };
}

// Create mock render context
function createMockContext(events: WorldEvent[] = []): RenderContext {
  const eventLog = new EventLog();
  const eventBus = new EventBus();

  for (const event of events) {
    eventLog.append(event);
  }

  return {
    world: createMockWorld(),
    clock: {
      currentTick: 360,
      currentTime: { year: 1, month: 1, day: 1 },
    } as unknown as WorldClock,
    eventLog,
    eventBus,
    spatialIndex: {} as SpatialIndex,
  };
}

describe('StatisticsPanel', () => {
  let screen: MockScreen;
  let panel: StatisticsPanel;
  let context: RenderContext;

  beforeEach(() => {
    screen = new MockScreen();
    const boxFactory = createMockBoxFactory(screen);
    const layout = createStatsPanelLayout(0, 0, 60, 30);
    panel = new StatisticsPanel(screen as unknown as any, layout, boxFactory as unknown as any);
    context = createMockContext();
  });

  describe('initialization', () => {
    it('creates with correct layout', () => {
      const layout = panel.getLayout();
      expect(layout.id).toBe(PanelId.Statistics);
      expect(layout.width).toBe(60);
      expect(layout.height).toBe(30);
    });

    it('starts with overview view', () => {
      expect(panel.getCurrentView()).toBe('overview');
    });
  });

  describe('view switching', () => {
    it('sets view directly', () => {
      panel.setCurrentView('population');
      expect(panel.getCurrentView()).toBe('population');

      panel.setCurrentView('conflict');
      expect(panel.getCurrentView()).toBe('conflict');
    });

    it('switches view with number keys', () => {
      panel.handleInput('1');
      expect(panel.getCurrentView()).toBe('overview');

      panel.handleInput('2');
      expect(panel.getCurrentView()).toBe('population');

      panel.handleInput('3');
      expect(panel.getCurrentView()).toBe('territory');

      panel.handleInput('4');
      expect(panel.getCurrentView()).toBe('technology');

      panel.handleInput('5');
      expect(panel.getCurrentView()).toBe('conflict');
    });
  });

  describe('scrolling', () => {
    it('scrolls with up/down keys', () => {
      expect(panel.handleInput('down')).toBe(true);
      expect(panel.handleInput('j')).toBe(true);
      expect(panel.handleInput('up')).toBe(true);
      expect(panel.handleInput('k')).toBe(true);
    });
  });

  describe('time series data', () => {
    it('adds and retrieves time series', () => {
      expect(panel.getTimeSeries().size).toBe(0);

      panel.addTimeSeries('population', [100, 150, 200, 250], '#FF0000');
      expect(panel.getTimeSeries().size).toBe(1);

      const series = panel.getTimeSeries().get('population');
      expect(series?.name).toBe('population');
      expect(series?.data).toEqual([100, 150, 200, 250]);
    });

    it('clears time series', () => {
      panel.addTimeSeries('test1', [1, 2, 3]);
      panel.addTimeSeries('test2', [4, 5, 6]);
      expect(panel.getTimeSeries().size).toBe(2);

      panel.clearTimeSeries();
      expect(panel.getTimeSeries().size).toBe(0);
    });
  });

  describe('faction statistics', () => {
    it('sets and updates faction stats', () => {
      panel.setFactionStats(toEntityId(1), 'Empire', 10000, 50);
      panel.setFactionStats(toEntityId(2), 'Kingdom', 5000, 30);

      // Render to verify no errors
      expect(() => panel.render(context)).not.toThrow();
    });

    it('clears faction stats', () => {
      panel.setFactionStats(toEntityId(1), 'Test', 100, 10);
      panel.clearFactionStats();

      // Should render without data
      expect(() => panel.render(context)).not.toThrow();
    });
  });

  describe('rendering', () => {
    it('renders overview without errors', () => {
      panel.setCurrentView('overview');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders population view', () => {
      panel.setCurrentView('population');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders territory view', () => {
      panel.setCurrentView('territory');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders technology view', () => {
      panel.setCurrentView('technology');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders conflict view', () => {
      panel.setCurrentView('conflict');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders with events', () => {
      const events = [
        createMockEvent(1, 100, 25, 'Political' as EventCategory),
        createMockEvent(2, 200, 50, 'Military' as EventCategory),
        createMockEvent(3, 300, 75, 'Cultural' as EventCategory),
        createMockEvent(4, 400, 90, 'Disaster' as EventCategory),
      ];
      const ctx = createMockContext(events);

      expect(() => panel.render(ctx)).not.toThrow();
    });

    it('renders with faction data', () => {
      panel.setFactionStats(toEntityId(1), 'Empire', 10000, 50);
      panel.setFactionStats(toEntityId(2), 'Kingdom', 5000, 30);

      panel.setCurrentView('population');
      expect(() => panel.render(context)).not.toThrow();

      panel.setCurrentView('territory');
      expect(() => panel.render(context)).not.toThrow();
    });

    it('renders with time series', () => {
      panel.addTimeSeries('population', [100, 150, 200, 180, 220]);
      panel.addTimeSeries('territory', [10, 15, 20, 25, 30]);
      panel.addTimeSeries('technology', [1, 2, 3, 5, 8]);
      panel.addTimeSeries('wars', [0, 1, 2, 1, 0]);
      panel.addTimeSeries('casualties', [0, 100, 500, 200, 0]);

      for (const view of ['population', 'territory', 'technology', 'conflict'] as const) {
        panel.setCurrentView(view);
        expect(() => panel.render(context)).not.toThrow();
      }
    });
  });

  describe('keyboard input', () => {
    it('returns false for unhandled keys', () => {
      expect(panel.handleInput('x')).toBe(false);
      expect(panel.handleInput('q')).toBe(false);
      expect(panel.handleInput('0')).toBe(false);
    });

    it('returns true for handled keys', () => {
      expect(panel.handleInput('1')).toBe(true);
      expect(panel.handleInput('2')).toBe(true);
      expect(panel.handleInput('3')).toBe(true);
      expect(panel.handleInput('4')).toBe(true);
      expect(panel.handleInput('5')).toBe(true);
      expect(panel.handleInput('up')).toBe(true);
      expect(panel.handleInput('down')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('clears state on destroy', () => {
      panel.addTimeSeries('test', [1, 2, 3]);
      panel.setFactionStats(toEntityId(1), 'Test', 100, 10);

      panel.destroy();

      expect(panel.getTimeSeries().size).toBe(0);
    });
  });

  describe('createStatsPanelLayout', () => {
    it('creates layout with correct values', () => {
      const layout = createStatsPanelLayout(5, 10, 80, 40);

      expect(layout.id).toBe(PanelId.Statistics);
      expect(layout.x).toBe(5);
      expect(layout.y).toBe(10);
      expect(layout.width).toBe(80);
      expect(layout.height).toBe(40);
      expect(layout.focused).toBe(false);
    });
  });
});

describe('CHART_BARS', () => {
  it('has 8 levels', () => {
    expect(CHART_BARS.length).toBe(8);
  });

  it('has increasing bar heights', () => {
    // Visual verification - bars should look progressively taller
    expect(CHART_BARS[0]).toBe('▁');
    expect(CHART_BARS[7]).toBe('█');
  });
});

describe('FILL_CHARS', () => {
  it('has all fill levels', () => {
    expect(FILL_CHARS.full).toBe('█');
    expect(FILL_CHARS.high).toBe('▓');
    expect(FILL_CHARS.medium).toBe('▒');
    expect(FILL_CHARS.low).toBe('░');
    expect(FILL_CHARS.empty).toBe(' ');
  });
});

describe('renderBarChart', () => {
  it('renders bars for data points', () => {
    const data = [
      { label: 'A', value: 100 },
      { label: 'B', value: 50 },
      { label: 'C', value: 75 },
    ];

    const lines = renderBarChart(data, 40, 10);

    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('A');
    expect(lines[1]).toContain('B');
    expect(lines[2]).toContain('C');
  });

  it('handles empty data', () => {
    const lines = renderBarChart([], 40);
    expect(lines.length).toBe(0);
  });

  it('truncates long labels', () => {
    const data = [{ label: 'Very Long Label Name', value: 100 }];
    const lines = renderBarChart(data, 40, 8);

    // Label should be truncated to 8 chars
    expect(lines[0]?.slice(0, 8)).toBe('Very Lon');
  });
});

describe('renderVerticalBars', () => {
  it('renders sparkline for data', () => {
    const data = [10, 50, 100, 75, 25];
    const result = renderVerticalBars(data, 5);

    expect(result.length).toBe(5);
    // Each character should be from CHART_BARS
    for (const char of result) {
      expect(CHART_BARS).toContain(char);
    }
  });

  it('handles empty data', () => {
    const result = renderVerticalBars([], 10);
    expect(result).toBe('');
  });

  it('samples data to fit width', () => {
    const data = Array(100).fill(0).map((_, i) => i);
    const result = renderVerticalBars(data, 20);

    expect(result.length).toBeLessThanOrEqual(20);
  });
});

describe('renderLineChart', () => {
  it('renders chart with data', () => {
    const series = [
      { name: 'test', data: [10, 50, 100, 75, 25], color: '#FF0000' },
    ];

    const lines = renderLineChart(series, 20, 10);

    expect(lines.length).toBe(10);
    // Each line should have correct width
    for (const line of lines) {
      expect(line.length).toBe(20);
    }
  });

  it('handles empty series', () => {
    const lines = renderLineChart([], 20, 10);

    expect(lines.length).toBe(10);
    // All empty
    for (const line of lines) {
      expect(line.trim()).toBe('');
    }
  });

  it('handles multiple series', () => {
    const series = [
      { name: 'a', data: [10, 20, 30] },
      { name: 'b', data: [30, 20, 10] },
    ];

    const lines = renderLineChart(series, 20, 10);
    expect(lines.length).toBe(10);
  });
});
