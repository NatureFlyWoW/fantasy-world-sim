/**
 * ASCII Graph Layout Engine — positions nodes in concentric rings.
 * Central node at center, connected entities in rings by hop distance.
 */

import type { EntityId } from '@fws/core';

/**
 * A node in the graph.
 */
export interface GraphNode {
  readonly entityId: EntityId;
  readonly label: string;
  readonly entityType: 'character' | 'faction' | 'location' | 'artifact' | 'unknown';
  x: number;
  y: number;
  ring: number;
}

/**
 * Relationship strength categories.
 */
export type RelationshipStrength = 'strong' | 'moderate' | 'weak';

/**
 * Relationship type for edge coloring.
 */
export type RelationshipType =
  | 'ally'
  | 'friend'
  | 'family'
  | 'rival'
  | 'enemy'
  | 'neutral'
  | 'member'
  | 'leader'
  | 'vassal'
  | 'trade'
  | 'unknown';

/**
 * An edge connecting two nodes.
 */
export interface GraphEdge {
  readonly fromId: EntityId;
  readonly toId: EntityId;
  readonly relationshipType: RelationshipType;
  readonly strength: RelationshipStrength;
  readonly label?: string;
  readonly bidirectional: boolean;
}

/**
 * Graph data structure for rendering.
 */
export interface Graph {
  readonly nodes: Map<EntityId, GraphNode>;
  readonly edges: GraphEdge[];
  readonly centerNode: EntityId;
  readonly maxRing: number;
}

/**
 * Layout configuration.
 */
export interface LayoutConfig {
  readonly width: number;
  readonly height: number;
  readonly ringSpacing: number;
  readonly nodeSpacing: number;
}

/**
 * Default layout configuration.
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  width: 60,
  height: 30,
  ringSpacing: 5,
  nodeSpacing: 3,
};

/**
 * Position nodes in concentric rings around the center node.
 * Uses polar coordinate layout with even angular distribution per ring.
 */
export function layoutGraph(
  nodes: Map<EntityId, GraphNode>,
  edges: GraphEdge[],
  centerNodeId: EntityId,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Graph {
  const { width, height, ringSpacing } = config;
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  // Build adjacency list for BFS
  const adjacency = new Map<EntityId, Set<EntityId>>();
  for (const node of nodes.values()) {
    adjacency.set(node.entityId, new Set());
  }
  for (const edge of edges) {
    const fromSet = adjacency.get(edge.fromId);
    const toSet = adjacency.get(edge.toId);
    if (fromSet !== undefined) {
      fromSet.add(edge.toId);
    }
    if (toSet !== undefined) {
      toSet.add(edge.fromId);
    }
  }

  // BFS to assign ring numbers (hop distance from center)
  const ringAssignment = new Map<EntityId, number>();
  const visited = new Set<EntityId>();
  const queue: Array<{ id: EntityId; ring: number }> = [];

  if (nodes.has(centerNodeId)) {
    queue.push({ id: centerNodeId, ring: 0 });
    visited.add(centerNodeId);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    ringAssignment.set(current.id, current.ring);

    const neighbors = adjacency.get(current.id);
    if (neighbors !== undefined) {
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({ id: neighborId, ring: current.ring + 1 });
        }
      }
    }
  }

  // Handle disconnected nodes - place them in outermost ring + 1
  let maxRing = 0;
  for (const ring of ringAssignment.values()) {
    maxRing = Math.max(maxRing, ring);
  }

  for (const node of nodes.values()) {
    if (!ringAssignment.has(node.entityId)) {
      ringAssignment.set(node.entityId, maxRing + 1);
    }
  }
  if (ringAssignment.size > visited.size) {
    maxRing = maxRing + 1;
  }

  // Group nodes by ring
  const ringGroups = new Map<number, EntityId[]>();
  for (const [id, ring] of ringAssignment) {
    const group = ringGroups.get(ring) ?? [];
    group.push(id);
    ringGroups.set(ring, group);
  }

  // Position nodes in each ring
  for (const [ring, nodeIds] of ringGroups) {
    if (ring === 0) {
      // Center node
      for (const id of nodeIds) {
        const node = nodes.get(id);
        if (node !== undefined) {
          node.x = centerX;
          node.y = centerY;
          node.ring = 0;
        }
      }
    } else {
      // Calculate radius for this ring
      const radius = ring * ringSpacing;

      // Position nodes evenly around the ring
      const count = nodeIds.length;
      const angleStep = (2 * Math.PI) / count;
      const startAngle = -Math.PI / 2; // Start at top

      for (let i = 0; i < nodeIds.length; i++) {
        const id = nodeIds[i];
        if (id === undefined) continue;

        const node = nodes.get(id);
        if (node !== undefined) {
          const angle = startAngle + i * angleStep;
          // Adjust for aspect ratio (console chars are taller than wide)
          node.x = Math.round(centerX + radius * 1.5 * Math.cos(angle));
          node.y = Math.round(centerY + radius * Math.sin(angle));
          node.ring = ring;
        }
      }
    }
  }

  return {
    nodes,
    edges,
    centerNode: centerNodeId,
    maxRing,
  };
}

/**
 * Create a graph node.
 */
export function createGraphNode(
  entityId: EntityId,
  label: string,
  entityType: GraphNode['entityType'] = 'unknown'
): GraphNode {
  return {
    entityId,
    label: truncateLabel(label, 12),
    entityType,
    x: 0,
    y: 0,
    ring: 0,
  };
}

/**
 * Create a graph edge.
 */
export function createGraphEdge(
  fromId: EntityId,
  toId: EntityId,
  relationshipType: RelationshipType = 'unknown',
  strength: RelationshipStrength = 'moderate',
  label?: string,
  bidirectional = false
): GraphEdge {
  return {
    fromId,
    toId,
    relationshipType,
    strength,
    ...(label !== undefined ? { label } : {}),
    bidirectional,
  };
}

/**
 * Truncate a label to fit in the display.
 */
export function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return label.slice(0, maxLength - 1) + '…';
}

/**
 * Get relationship type from affinity value.
 */
export function affinityToRelationType(affinity: number): RelationshipType {
  if (affinity >= 75) return 'ally';
  if (affinity >= 50) return 'friend';
  if (affinity >= 0) return 'neutral';
  if (affinity >= -50) return 'rival';
  return 'enemy';
}

/**
 * Get relationship strength from affinity value.
 */
export function affinityToStrength(affinity: number): RelationshipStrength {
  const absAffinity = Math.abs(affinity);
  if (absAffinity >= 75) return 'strong';
  if (absAffinity >= 40) return 'moderate';
  return 'weak';
}

/**
 * Check if two nodes overlap.
 */
export function nodesOverlap(
  node1: GraphNode,
  node2: GraphNode,
  padding = 2
): boolean {
  const label1End = node1.x + node1.label.length;
  const label2End = node2.x + node2.label.length;

  const horizontalOverlap =
    node1.x <= label2End + padding && label1End + padding >= node2.x;
  const verticalOverlap = Math.abs(node1.y - node2.y) <= padding;

  return horizontalOverlap && verticalOverlap;
}

/**
 * Adjust node positions to avoid overlaps.
 */
export function resolveOverlaps(
  nodes: Map<EntityId, GraphNode>,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): void {
  const nodeList = Array.from(nodes.values());
  const maxIterations = 50;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hasOverlap = false;

    for (let i = 0; i < nodeList.length; i++) {
      const node1 = nodeList[i];
      if (node1 === undefined) continue;

      for (let j = i + 1; j < nodeList.length; j++) {
        const node2 = nodeList[j];
        if (node2 === undefined) continue;

        if (nodesOverlap(node1, node2)) {
          hasOverlap = true;

          // Move nodes apart
          if (node1.ring === node2.ring && node1.ring !== 0) {
            // Same ring: adjust vertically
            if (node1.y <= node2.y) {
              node1.y = Math.max(1, node1.y - 1);
              node2.y = Math.min(config.height - 2, node2.y + 1);
            } else {
              node1.y = Math.min(config.height - 2, node1.y + 1);
              node2.y = Math.max(1, node2.y - 1);
            }
          } else {
            // Different rings: adjust horizontally
            if (node1.x <= node2.x) {
              node1.x = Math.max(0, node1.x - 1);
              node2.x = Math.min(config.width - node2.label.length, node2.x + 1);
            } else {
              node1.x = Math.min(config.width - node1.label.length, node1.x + 1);
              node2.x = Math.max(0, node2.x - 1);
            }
          }
        }
      }
    }

    if (!hasOverlap) break;
  }
}

/**
 * Filter graph to include only nodes within a certain depth from center.
 */
export function filterByDepth(
  nodes: Map<EntityId, GraphNode>,
  edges: GraphEdge[],
  centerNodeId: EntityId,
  maxDepth: number
): { nodes: Map<EntityId, GraphNode>; edges: GraphEdge[] } {
  // First layout to get ring assignments
  const tempGraph = layoutGraph(nodes, edges, centerNodeId);

  // Filter nodes by ring
  const filteredNodes = new Map<EntityId, GraphNode>();
  for (const [id, node] of tempGraph.nodes) {
    if (node.ring <= maxDepth) {
      filteredNodes.set(id, node);
    }
  }

  // Filter edges to only include edges between filtered nodes
  const filteredEdges = edges.filter(
    edge => filteredNodes.has(edge.fromId) && filteredNodes.has(edge.toId)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}
