import { describe, it, expect } from 'vitest';
import { toEntityId } from '@fws/core';
import type { EntityId } from '@fws/core';
import {
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
import type { GraphNode, GraphEdge, LayoutConfig } from './graph-layout.js';

// Helper to create properly typed node map
function createNodeMap(entries: Array<[number, GraphNode]>): Map<EntityId, GraphNode> {
  const map = new Map<EntityId, GraphNode>();
  for (const [id, node] of entries) {
    map.set(toEntityId(id), node);
  }
  return map;
}

describe('graph-layout', () => {
  describe('createGraphNode', () => {
    it('creates a node with default values', () => {
      const node = createGraphNode(toEntityId(1), 'Test Node');

      expect(node.entityId).toBe(toEntityId(1));
      expect(node.label).toBe('Test Node');
      expect(node.entityType).toBe('unknown');
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
      expect(node.ring).toBe(0);
    });

    it('creates a node with specified type', () => {
      const node = createGraphNode(toEntityId(2), 'Character', 'character');

      expect(node.entityType).toBe('character');
    });

    it('truncates long labels', () => {
      const node = createGraphNode(toEntityId(3), 'This is a very long name that should be truncated');

      expect(node.label.length).toBeLessThanOrEqual(12);
      expect(node.label.endsWith('…')).toBe(true);
    });
  });

  describe('createGraphEdge', () => {
    it('creates an edge with default values', () => {
      const edge = createGraphEdge(toEntityId(1), toEntityId(2));

      expect(edge.fromId).toBe(toEntityId(1));
      expect(edge.toId).toBe(toEntityId(2));
      expect(edge.relationshipType).toBe('unknown');
      expect(edge.strength).toBe('moderate');
      expect(edge.bidirectional).toBe(false);
    });

    it('creates an edge with specified values', () => {
      const edge = createGraphEdge(
        toEntityId(1),
        toEntityId(2),
        'ally',
        'strong',
        'Close allies',
        true
      );

      expect(edge.relationshipType).toBe('ally');
      expect(edge.strength).toBe('strong');
      expect(edge.label).toBe('Close allies');
      expect(edge.bidirectional).toBe(true);
    });
  });

  describe('truncateLabel', () => {
    it('returns short labels unchanged', () => {
      expect(truncateLabel('Short', 12)).toBe('Short');
    });

    it('truncates long labels with ellipsis', () => {
      expect(truncateLabel('Very Long Name', 8)).toBe('Very Lo…');
    });

    it('handles exact length labels', () => {
      expect(truncateLabel('Exactly12!', 10)).toBe('Exactly12!');
    });
  });

  describe('affinityToRelationType', () => {
    it('returns ally for high positive affinity', () => {
      expect(affinityToRelationType(80)).toBe('ally');
      expect(affinityToRelationType(75)).toBe('ally');
    });

    it('returns friend for moderate positive affinity', () => {
      expect(affinityToRelationType(60)).toBe('friend');
      expect(affinityToRelationType(50)).toBe('friend');
    });

    it('returns neutral for low affinity', () => {
      expect(affinityToRelationType(25)).toBe('neutral');
      expect(affinityToRelationType(0)).toBe('neutral');
    });

    it('returns rival for moderate negative affinity', () => {
      expect(affinityToRelationType(-30)).toBe('rival');
      expect(affinityToRelationType(-50)).toBe('rival');
    });

    it('returns enemy for high negative affinity', () => {
      expect(affinityToRelationType(-60)).toBe('enemy');
      expect(affinityToRelationType(-100)).toBe('enemy');
    });
  });

  describe('affinityToStrength', () => {
    it('returns strong for high absolute affinity', () => {
      expect(affinityToStrength(80)).toBe('strong');
      expect(affinityToStrength(-90)).toBe('strong');
    });

    it('returns moderate for medium absolute affinity', () => {
      expect(affinityToStrength(50)).toBe('moderate');
      expect(affinityToStrength(-60)).toBe('moderate');
    });

    it('returns weak for low absolute affinity', () => {
      expect(affinityToStrength(20)).toBe('weak');
      expect(affinityToStrength(-30)).toBe('weak');
    });
  });

  describe('nodesOverlap', () => {
    it('detects overlapping nodes', () => {
      const node1: GraphNode = {
        entityId: toEntityId(1),
        label: 'Node A',
        entityType: 'character',
        x: 10,
        y: 5,
        ring: 1,
      };
      const node2: GraphNode = {
        entityId: toEntityId(2),
        label: 'Node B',
        entityType: 'character',
        x: 12,
        y: 5,
        ring: 1,
      };

      expect(nodesOverlap(node1, node2)).toBe(true);
    });

    it('detects non-overlapping nodes', () => {
      const node1: GraphNode = {
        entityId: toEntityId(1),
        label: 'Node A',
        entityType: 'character',
        x: 10,
        y: 5,
        ring: 1,
      };
      const node2: GraphNode = {
        entityId: toEntityId(2),
        label: 'Node B',
        entityType: 'character',
        x: 30,
        y: 15,
        ring: 2,
      };

      expect(nodesOverlap(node1, node2)).toBe(false);
    });

    it('considers vertical distance', () => {
      const node1: GraphNode = {
        entityId: toEntityId(1),
        label: 'Node A',
        entityType: 'character',
        x: 10,
        y: 5,
        ring: 1,
      };
      const node2: GraphNode = {
        entityId: toEntityId(2),
        label: 'Node B',
        entityType: 'character',
        x: 10,
        y: 10,
        ring: 1,
      };

      expect(nodesOverlap(node1, node2)).toBe(false);
    });
  });

  describe('layoutGraph', () => {
    it('places center node at center position', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
      ]);

      const graph = layoutGraph(
        nodes,
        [],
        toEntityId(1),
        { width: 60, height: 30, ringSpacing: 5, nodeSpacing: 3 }
      );

      const centerNode = graph.nodes.get(toEntityId(1));
      expect(centerNode).toBeDefined();
      expect(centerNode?.x).toBe(30);
      expect(centerNode?.y).toBe(15);
      expect(centerNode?.ring).toBe(0);
    });

    it('assigns ring 1 to directly connected nodes', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'Connected')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
      ];

      const graph = layoutGraph(nodes, edges, toEntityId(1));

      const connectedNode = graph.nodes.get(toEntityId(2));
      expect(connectedNode?.ring).toBe(1);
    });

    it('assigns increasing rings for hop distance', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'Hop 1')],
        [3, createGraphNode(toEntityId(3), 'Hop 2')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
        createGraphEdge(toEntityId(2), toEntityId(3)),
      ];

      const graph = layoutGraph(nodes, edges, toEntityId(1));

      expect(graph.nodes.get(toEntityId(1))?.ring).toBe(0);
      expect(graph.nodes.get(toEntityId(2))?.ring).toBe(1);
      expect(graph.nodes.get(toEntityId(3))?.ring).toBe(2);
      expect(graph.maxRing).toBe(2);
    });

    it('places disconnected nodes in outermost ring', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'Connected')],
        [3, createGraphNode(toEntityId(3), 'Disconnected')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
      ];

      const graph = layoutGraph(nodes, edges, toEntityId(1));

      const disconnectedNode = graph.nodes.get(toEntityId(3));
      expect(disconnectedNode?.ring).toBeGreaterThan(1);
    });

    it('distributes nodes evenly around ring', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'A')],
        [3, createGraphNode(toEntityId(3), 'B')],
        [4, createGraphNode(toEntityId(4), 'C')],
        [5, createGraphNode(toEntityId(5), 'D')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
        createGraphEdge(toEntityId(1), toEntityId(3)),
        createGraphEdge(toEntityId(1), toEntityId(4)),
        createGraphEdge(toEntityId(1), toEntityId(5)),
      ];

      const graph = layoutGraph(
        nodes,
        edges,
        toEntityId(1),
        { width: 60, height: 30, ringSpacing: 8, nodeSpacing: 3 }
      );

      // All ring-1 nodes should be at different positions
      const ring1Nodes = Array.from(graph.nodes.values()).filter(n => n.ring === 1);

      expect(ring1Nodes.length).toBe(4);

      // Check that they form a rough circle (different positions)
      const positions = ring1Nodes.map(n => ({ x: n.x, y: n.y }));
      const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
      expect(uniquePositions.size).toBe(4);
    });
  });

  describe('resolveOverlaps', () => {
    it('separates overlapping nodes', () => {
      const node1 = createGraphNode(toEntityId(1), 'Node A');
      node1.x = 10;
      node1.y = 5;
      node1.ring = 1;

      const node2 = createGraphNode(toEntityId(2), 'Node B');
      node2.x = 11;
      node2.y = 5;
      node2.ring = 1;

      const nodes = createNodeMap([
        [1, node1],
        [2, node2],
      ]);

      resolveOverlaps(nodes);

      // After resolution, nodes should not overlap
      expect(nodesOverlap(node1, node2)).toBe(false);
    });

    it('respects layout boundaries', () => {
      const config: LayoutConfig = { width: 40, height: 20, ringSpacing: 5, nodeSpacing: 3 };

      const node1 = createGraphNode(toEntityId(1), 'Node');
      node1.x = 0;
      node1.y = 0;
      node1.ring = 1;

      const nodes = createNodeMap([[1, node1]]);

      resolveOverlaps(nodes, config);

      expect(node1.x).toBeGreaterThanOrEqual(0);
      expect(node1.y).toBeGreaterThanOrEqual(0);
      expect(node1.x).toBeLessThan(config.width);
      expect(node1.y).toBeLessThan(config.height);
    });
  });

  describe('filterByDepth', () => {
    it('includes all nodes within depth', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'Hop 1')],
        [3, createGraphNode(toEntityId(3), 'Hop 2')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
        createGraphEdge(toEntityId(2), toEntityId(3)),
      ];

      const filtered = filterByDepth(nodes, edges, toEntityId(1), 2);

      expect(filtered.nodes.size).toBe(3);
    });

    it('excludes nodes beyond depth', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'Hop 1')],
        [3, createGraphNode(toEntityId(3), 'Hop 2')],
        [4, createGraphNode(toEntityId(4), 'Hop 3')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
        createGraphEdge(toEntityId(2), toEntityId(3)),
        createGraphEdge(toEntityId(3), toEntityId(4)),
      ];

      const filtered = filterByDepth(nodes, edges, toEntityId(1), 2);

      expect(filtered.nodes.size).toBe(3);
      expect(filtered.nodes.has(toEntityId(4))).toBe(false);
    });

    it('filters edges to only include filtered nodes', () => {
      const nodes = createNodeMap([
        [1, createGraphNode(toEntityId(1), 'Center')],
        [2, createGraphNode(toEntityId(2), 'Hop 1')],
        [3, createGraphNode(toEntityId(3), 'Hop 2')],
      ]);

      const edges: GraphEdge[] = [
        createGraphEdge(toEntityId(1), toEntityId(2)),
        createGraphEdge(toEntityId(2), toEntityId(3)),
      ];

      const filtered = filterByDepth(nodes, edges, toEntityId(1), 1);

      expect(filtered.edges.length).toBe(1);
      expect(filtered.edges[0]?.fromId).toBe(toEntityId(1));
      expect(filtered.edges[0]?.toId).toBe(toEntityId(2));
    });
  });

  describe('DEFAULT_LAYOUT_CONFIG', () => {
    it('has reasonable defaults', () => {
      expect(DEFAULT_LAYOUT_CONFIG.width).toBeGreaterThan(0);
      expect(DEFAULT_LAYOUT_CONFIG.height).toBeGreaterThan(0);
      expect(DEFAULT_LAYOUT_CONFIG.ringSpacing).toBeGreaterThan(0);
      expect(DEFAULT_LAYOUT_CONFIG.nodeSpacing).toBeGreaterThan(0);
    });
  });
});
