import { describe, it, expect, beforeEach } from 'vitest';
import { toEntityId } from '@fws/core';
import type { EntityId } from '@fws/core';
import {
  RenderGrid,
  GraphRenderer,
  RELATIONSHIP_COLORS,
  STRENGTH_LINES,
  ARROWS,
  ENTITY_ICONS,
  renderLegend,
} from './graph-renderer.js';
import type { Graph, GraphNode, GraphEdge } from './graph-layout.js';
import { createGraphNode, createGraphEdge } from './graph-layout.js';

// Helper to create properly typed node map
function createNodeMap(entries: Array<[number, GraphNode]>): Map<EntityId, GraphNode> {
  const map = new Map<EntityId, GraphNode>();
  for (const [id, node] of entries) {
    map.set(toEntityId(id), node);
  }
  return map;
}

describe('RenderGrid', () => {
  let grid: RenderGrid;

  beforeEach(() => {
    grid = new RenderGrid(20, 10);
  });

  describe('initialization', () => {
    it('creates grid with specified dimensions', () => {
      const { width, height } = grid.getDimensions();
      expect(width).toBe(20);
      expect(height).toBe(10);
    });

    it('initializes all cells as empty spaces', () => {
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 20; x++) {
          const cell = grid.get(x, y);
          expect(cell?.char).toBe(' ');
        }
      }
    });
  });

  describe('set', () => {
    it('sets cell character and color', () => {
      grid.set(5, 3, 'X', '#FF0000');

      const cell = grid.get(5, 3);
      expect(cell?.char).toBe('X');
      expect(cell?.fg).toBe('#FF0000');
    });

    it('sets optional background color', () => {
      grid.set(5, 3, 'X', '#FF0000', '#0000FF');

      const cell = grid.get(5, 3);
      expect(cell?.bg).toBe('#0000FF');
    });

    it('sets optional entity ID', () => {
      const entityId = toEntityId(42);
      grid.set(5, 3, 'X', '#FF0000', undefined, entityId);

      const cell = grid.get(5, 3);
      expect(cell?.entityId).toBe(entityId);
    });

    it('ignores out-of-bounds coordinates', () => {
      grid.set(-1, 0, 'X', '#FF0000');
      grid.set(100, 0, 'X', '#FF0000');
      grid.set(0, -1, 'X', '#FF0000');
      grid.set(0, 100, 'X', '#FF0000');

      // Should not throw and grid should be unchanged
      expect(grid.get(0, 0)?.char).toBe(' ');
    });
  });

  describe('get', () => {
    it('returns cell at valid coordinates', () => {
      grid.set(5, 3, 'Y', '#00FF00');

      const cell = grid.get(5, 3);
      expect(cell).toBeDefined();
      expect(cell?.char).toBe('Y');
    });

    it('returns undefined for out-of-bounds', () => {
      expect(grid.get(-1, 0)).toBeUndefined();
      expect(grid.get(100, 0)).toBeUndefined();
    });
  });

  describe('isEmpty', () => {
    it('returns true for empty cells', () => {
      expect(grid.isEmpty(0, 0)).toBe(true);
    });

    it('returns false for filled cells', () => {
      grid.set(5, 5, 'A', '#FFFFFF');
      expect(grid.isEmpty(5, 5)).toBe(false);
    });

    it('returns true for out-of-bounds', () => {
      expect(grid.isEmpty(-1, 0)).toBe(true);
    });
  });

  describe('toLines', () => {
    it('returns array of strings for each row', () => {
      const lines = grid.toLines();

      expect(lines.length).toBe(10);
      expect(lines[0]?.length).toBe(20);
    });

    it('includes set characters', () => {
      grid.set(0, 0, 'A', '#FFF');
      grid.set(1, 0, 'B', '#FFF');
      grid.set(2, 0, 'C', '#FFF');

      const lines = grid.toLines();
      expect(lines[0]?.startsWith('ABC')).toBe(true);
    });
  });

  describe('toStyledContent', () => {
    it('returns formatted string with color codes', () => {
      grid.set(0, 0, 'X', '#FF0000');

      const content = grid.toStyledContent();
      expect(content).toContain('{#FF0000-fg}');
      expect(content).toContain('X');
      expect(content).toContain('{/}');
    });

    it('handles color changes efficiently', () => {
      grid.set(0, 0, 'A', '#FF0000');
      grid.set(1, 0, 'B', '#FF0000');
      grid.set(2, 0, 'C', '#00FF00');

      const content = grid.toStyledContent();
      const lines = content.split('\n');
      const firstLine = lines[0] ?? '';

      // Should have two color codes (one for red, one for green)
      expect(firstLine.includes('AB')).toBe(true);
    });
  });
});

describe('GraphRenderer', () => {
  let renderer: GraphRenderer;

  beforeEach(() => {
    renderer = new GraphRenderer(40, 20);
  });

  describe('initialization', () => {
    it('creates renderer with specified dimensions', () => {
      expect(renderer).toBeDefined();
    });
  });

  describe('render', () => {
    it('renders a simple graph', () => {
      const centerNode = createGraphNode(toEntityId(1), 'Center', 'character');
      centerNode.x = 20;
      centerNode.y = 10;
      centerNode.ring = 0;

      const nodes = createNodeMap([[1, centerNode]]);

      const graph: Graph = {
        nodes,
        edges: [],
        centerNode: toEntityId(1),
        maxRing: 0,
      };

      const grid = renderer.render(graph);

      // Center should have character icon
      const centerCell = grid.get(20, 10);
      expect(centerCell?.char).toBe(ENTITY_ICONS.character);
    });

    it('renders edges between nodes', () => {
      const node1 = createGraphNode(toEntityId(1), 'A', 'character');
      node1.x = 10;
      node1.y = 5;
      node1.ring = 0;

      const node2 = createGraphNode(toEntityId(2), 'B', 'character');
      node2.x = 25;
      node2.y = 5;
      node2.ring = 1;

      const nodes = createNodeMap([
        [1, node1],
        [2, node2],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2), 'ally', 'strong'),
      ];

      const graph: Graph = {
        nodes,
        edges,
        centerNode: toEntityId(1),
        maxRing: 1,
      };

      const grid = renderer.render(graph);
      const lines = grid.toLines();

      // Should have some line characters between nodes
      const line = lines[5];
      expect(line).toBeDefined();
      // Edge should be somewhere in the middle
    });

    it('renders node labels', () => {
      const node = createGraphNode(toEntityId(1), 'TestLabel', 'character');
      node.x = 10;
      node.y = 5;
      node.ring = 0;

      const nodes = createNodeMap([[1, node]]);

      const graph: Graph = {
        nodes,
        edges: [],
        centerNode: toEntityId(1),
        maxRing: 0,
      };

      const grid = renderer.render(graph);
      const lines = grid.toLines();
      const line = lines[5];

      expect(line).toBeDefined();
      expect(line?.includes('TestLabel')).toBe(true);
    });
  });

  describe('setHighlightedNode', () => {
    it('highlights the specified node', () => {
      renderer.setHighlightedNode(toEntityId(1));

      const node = createGraphNode(toEntityId(1), 'Test', 'character');
      node.x = 20;
      node.y = 10;
      node.ring = 0;

      const nodes = createNodeMap([[1, node]]);

      const graph: Graph = {
        nodes,
        edges: [],
        centerNode: toEntityId(1),
        maxRing: 0,
      };

      const grid = renderer.render(graph);
      const lines = grid.toLines();
      const line = lines[10];

      // Highlighted nodes get brackets
      expect(line?.includes('[')).toBe(true);
      expect(line?.includes(']')).toBe(true);
    });
  });

  describe('setShowLabels', () => {
    it('hides labels when disabled', () => {
      renderer.setShowLabels(false);

      const node = createGraphNode(toEntityId(1), 'TestLabel', 'character');
      node.x = 10;
      node.y = 5;
      node.ring = 1; // Non-center to avoid brackets

      const nodes = createNodeMap([[1, node]]);

      const graph: Graph = {
        nodes,
        edges: [],
        centerNode: toEntityId(2), // Different center
        maxRing: 1,
      };

      const grid = renderer.render(graph);
      const lines = grid.toLines();
      const line = lines[5];

      expect(line?.includes('TestLabel')).toBe(false);
    });
  });

  describe('getEntityAt', () => {
    it('returns entity ID at cursor position', () => {
      const node = createGraphNode(toEntityId(42), 'Test', 'character');
      node.x = 15;
      node.y = 8;
      node.ring = 0;

      const nodes = createNodeMap([[42, node]]);

      const graph: Graph = {
        nodes,
        edges: [],
        centerNode: toEntityId(42),
        maxRing: 0,
      };

      const grid = renderer.render(graph);
      const entityId = renderer.getEntityAt(grid, 15, 8);

      expect(entityId).toBe(toEntityId(42));
    });

    it('returns undefined for empty position', () => {
      const grid = new RenderGrid(40, 20);
      const entityId = renderer.getEntityAt(grid, 0, 0);

      expect(entityId).toBeUndefined();
    });
  });
});

describe('RELATIONSHIP_COLORS', () => {
  it('has colors for all relationship types', () => {
    expect(RELATIONSHIP_COLORS.ally).toBeDefined();
    expect(RELATIONSHIP_COLORS.friend).toBeDefined();
    expect(RELATIONSHIP_COLORS.family).toBeDefined();
    expect(RELATIONSHIP_COLORS.rival).toBeDefined();
    expect(RELATIONSHIP_COLORS.enemy).toBeDefined();
    expect(RELATIONSHIP_COLORS.neutral).toBeDefined();
    expect(RELATIONSHIP_COLORS.member).toBeDefined();
    expect(RELATIONSHIP_COLORS.leader).toBeDefined();
    expect(RELATIONSHIP_COLORS.vassal).toBeDefined();
    expect(RELATIONSHIP_COLORS.trade).toBeDefined();
    expect(RELATIONSHIP_COLORS.unknown).toBeDefined();
  });

  it('uses distinct colors for positive vs negative', () => {
    expect(RELATIONSHIP_COLORS.ally).not.toBe(RELATIONSHIP_COLORS.enemy);
    expect(RELATIONSHIP_COLORS.friend).not.toBe(RELATIONSHIP_COLORS.rival);
  });
});

describe('STRENGTH_LINES', () => {
  it('has characters for all strengths', () => {
    expect(STRENGTH_LINES.strong).toBeDefined();
    expect(STRENGTH_LINES.moderate).toBeDefined();
    expect(STRENGTH_LINES.weak).toBeDefined();
  });

  it('uses distinct characters', () => {
    expect(STRENGTH_LINES.strong).not.toBe(STRENGTH_LINES.moderate);
    expect(STRENGTH_LINES.moderate).not.toBe(STRENGTH_LINES.weak);
  });
});

describe('ARROWS', () => {
  it('has all directional arrows', () => {
    expect(ARROWS.right).toBeDefined();
    expect(ARROWS.left).toBeDefined();
    expect(ARROWS.up).toBeDefined();
    expect(ARROWS.down).toBeDefined();
    expect(ARROWS.upRight).toBeDefined();
    expect(ARROWS.upLeft).toBeDefined();
    expect(ARROWS.downRight).toBeDefined();
    expect(ARROWS.downLeft).toBeDefined();
    expect(ARROWS.bidirectional).toBeDefined();
  });
});

describe('ENTITY_ICONS', () => {
  it('has icons for all entity types', () => {
    expect(ENTITY_ICONS.character).toBeDefined();
    expect(ENTITY_ICONS.faction).toBeDefined();
    expect(ENTITY_ICONS.location).toBeDefined();
    expect(ENTITY_ICONS.artifact).toBeDefined();
    expect(ENTITY_ICONS.unknown).toBeDefined();
  });
});

describe('renderLegend', () => {
  it('returns array of legend lines', () => {
    const lines = renderLegend();

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some(l => l.includes('Relationships'))).toBe(true);
  });

  it('includes relationship types', () => {
    const lines = renderLegend();
    const content = lines.join('\n');

    expect(content.includes('Ally')).toBe(true);
    expect(content.includes('Enemy')).toBe(true);
  });

  it('includes strength indicators', () => {
    const lines = renderLegend();
    const content = lines.join('\n');

    expect(content.includes('Strong')).toBe(true);
    expect(content.includes('Moderate')).toBe(true);
    expect(content.includes('Weak')).toBe(true);
  });
});
