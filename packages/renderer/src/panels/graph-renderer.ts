/**
 * GraphRenderer — renders the relationship graph to an ASCII character grid.
 * Draws nodes as labels, edges as lines with relationship-type colors.
 */

import type { EntityId } from '@fws/core';
import type { Graph, GraphNode, GraphEdge, RelationshipType, RelationshipStrength } from './graph-layout.js';

/**
 * Colors for relationship types.
 */
export const RELATIONSHIP_COLORS: Readonly<Record<RelationshipType, string>> = {
  ally: '#44FF44',      // Green - strong positive
  friend: '#88FF88',    // Light green - positive
  family: '#FFAA00',    // Orange - blood ties
  rival: '#FFFF44',     // Yellow - competitive
  enemy: '#FF4444',     // Red - hostile
  neutral: '#888888',   // Gray - no strong relation
  member: '#4488FF',    // Blue - organizational
  leader: '#8844FF',    // Purple - authority
  vassal: '#88AAFF',    // Light blue - subordinate
  trade: '#44FFAA',     // Teal - economic
  unknown: '#666666',   // Dark gray - unclassified
};

/**
 * Line characters for different strengths.
 */
export const STRENGTH_LINES: Readonly<Record<RelationshipStrength, string>> = {
  strong: '═',   // Double line
  moderate: '─', // Single line
  weak: '·',     // Dotted
};

/**
 * Directional arrow characters.
 */
export const ARROWS = {
  right: '→',
  left: '←',
  up: '↑',
  down: '↓',
  upRight: '↗',
  upLeft: '↖',
  downRight: '↘',
  downLeft: '↙',
  bidirectional: '↔',
} as const;

/**
 * Entity type icons.
 */
export const ENTITY_ICONS: Readonly<Record<GraphNode['entityType'], string>> = {
  character: '👤',
  faction: '⚜',
  location: '🏰',
  artifact: '✦',
  unknown: '●',
};

/**
 * A cell in the render grid.
 */
export interface GridCell {
  char: string;
  fg: string;
  bg: string;
  entityId?: EntityId;
}

/**
 * Render grid for the graph.
 */
export class RenderGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly cells: GridCell[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = [];

    for (let y = 0; y < height; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < width; x++) {
        row.push({ char: ' ', fg: '#888888', bg: '#000000' });
      }
      this.cells.push(row);
    }
  }

  /**
   * Set a cell value.
   */
  set(x: number, y: number, char: string, fg: string, bg?: string, entityId?: EntityId): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const row = this.cells[y];
      if (row !== undefined) {
        row[x] = {
          char,
          fg,
          bg: bg ?? '#000000',
          ...(entityId !== undefined ? { entityId } : {}),
        };
      }
    }
  }

  /**
   * Get a cell value.
   */
  get(x: number, y: number): GridCell | undefined {
    const row = this.cells[y];
    if (row !== undefined) {
      return row[x];
    }
    return undefined;
  }

  /**
   * Check if a cell is empty.
   */
  isEmpty(x: number, y: number): boolean {
    const cell = this.get(x, y);
    return cell === undefined || cell.char === ' ';
  }

  /**
   * Get grid dimensions.
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Convert to array of strings for rendering.
   */
  toLines(): string[] {
    const lines: string[] = [];
    for (const row of this.cells) {
      let line = '';
      for (const cell of row) {
        line += cell.char;
      }
      lines.push(line);
    }
    return lines;
  }

  /**
   * Convert to styled content with blessed formatting.
   */
  toStyledContent(): string {
    const lines: string[] = [];

    for (const row of this.cells) {
      let line = '';
      let currentFg = '';

      for (const cell of row) {
        if (cell.fg !== currentFg) {
          if (currentFg !== '') {
            line += '{/}';
          }
          line += `{${cell.fg}-fg}`;
          currentFg = cell.fg;
        }
        line += cell.char;
      }

      if (currentFg !== '') {
        line += '{/}';
      }
      lines.push(line);
    }

    return lines.join('\n');
  }
}

/**
 * GraphRenderer renders a Graph to a RenderGrid.
 */
export class GraphRenderer {
  private readonly width: number;
  private readonly height: number;
  private highlightedNode: EntityId | null = null;
  private showLabels = true;
  private showEdgeLabels = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Set the highlighted node (brighter color, thicker edges).
   */
  setHighlightedNode(nodeId: EntityId | null): void {
    this.highlightedNode = nodeId;
  }

  /**
   * Toggle node label display.
   */
  setShowLabels(show: boolean): void {
    this.showLabels = show;
  }

  /**
   * Toggle edge label display.
   */
  setShowEdgeLabels(show: boolean): void {
    this.showEdgeLabels = show;
  }

  /**
   * Render the graph to a grid.
   */
  render(graph: Graph): RenderGrid {
    const grid = new RenderGrid(this.width, this.height);

    // Draw edges first (so nodes draw over them)
    for (const edge of graph.edges) {
      this.drawEdge(grid, graph.nodes, edge);
    }

    // Draw nodes
    for (const node of graph.nodes.values()) {
      this.drawNode(grid, node);
    }

    return grid;
  }

  /**
   * Draw a node on the grid.
   */
  private drawNode(grid: RenderGrid, node: GraphNode): void {
    const isHighlighted = node.entityId === this.highlightedNode;
    const isCenter = node.ring === 0;

    // Get base color for entity type
    let fg = this.getNodeColor(node.entityType);
    if (isHighlighted || isCenter) {
      fg = brightenColor(fg);
    }

    // Draw icon
    const icon = ENTITY_ICONS[node.entityType];
    grid.set(node.x, node.y, icon, fg, undefined, node.entityId);

    // Draw label
    if (this.showLabels) {
      const labelX = node.x + 2; // Offset from icon
      const label = node.label;

      for (let i = 0; i < label.length; i++) {
        const char = label[i];
        if (char !== undefined) {
          grid.set(labelX + i, node.y, char, fg, undefined, node.entityId);
        }
      }
    }

    // Draw bracket for highlighted/center nodes
    if (isHighlighted || isCenter) {
      grid.set(node.x - 1, node.y, '[', fg);
      const endX = this.showLabels ? node.x + 2 + node.label.length : node.x + 1;
      grid.set(endX, node.y, ']', fg);
    }
  }

  /**
   * Draw an edge between two nodes.
   */
  private drawEdge(grid: RenderGrid, nodes: Map<EntityId, GraphNode>, edge: GraphEdge): void {
    const fromNode = nodes.get(edge.fromId);
    const toNode = nodes.get(edge.toId);

    if (fromNode === undefined || toNode === undefined) {
      return;
    }

    const color = RELATIONSHIP_COLORS[edge.relationshipType];
    const lineChar = STRENGTH_LINES[edge.strength];

    // Get start and end points (offset from node center)
    const fromX = fromNode.x + 1;
    const fromY = fromNode.y;
    const toX = toNode.x - 1;
    const toY = toNode.y;

    // Draw line using Bresenham's algorithm
    this.drawLine(grid, fromX, fromY, toX, toY, lineChar, color);

    // Draw arrow or bidirectional indicator at destination
    if (edge.bidirectional) {
      const midX = Math.floor((fromX + toX) / 2);
      const midY = Math.floor((fromY + toY) / 2);
      grid.set(midX, midY, ARROWS.bidirectional, color);
    } else {
      const arrow = this.getArrowChar(fromX, fromY, toX, toY);
      grid.set(toX, toY, arrow, color);
    }

    // Draw edge label if enabled
    if (this.showEdgeLabels && edge.label !== undefined) {
      const labelX = Math.floor((fromX + toX) / 2);
      const labelY = Math.floor((fromY + toY) / 2);
      for (let i = 0; i < edge.label.length && i < 6; i++) {
        const char = edge.label[i];
        if (char !== undefined && grid.isEmpty(labelX + i, labelY - 1)) {
          grid.set(labelX + i, labelY - 1, char, color);
        }
      }
    }
  }

  /**
   * Draw a line between two points using Bresenham's algorithm.
   */
  private drawLine(
    grid: RenderGrid,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    char: string,
    color: string
  ): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      // Only draw if cell is empty (don't overwrite nodes)
      if (grid.isEmpty(x, y)) {
        // Choose appropriate line character based on direction
        const lineChar = this.getLineChar(x, y, x0, y0, x1, y1, char);
        grid.set(x, y, lineChar, color);
      }

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Get the appropriate line character based on direction.
   */
  private getLineChar(
    _x: number,
    _y: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    defaultChar: string
  ): string {
    const dx = x1 - x0;
    const dy = y1 - y0;

    // Determine primary direction
    if (Math.abs(dx) > Math.abs(dy) * 2) {
      // Mostly horizontal
      return defaultChar;
    } else if (Math.abs(dy) > Math.abs(dx) * 2) {
      // Mostly vertical
      return '│';
    } else if (dx > 0 && dy > 0) {
      return '╲';
    } else if (dx > 0 && dy < 0) {
      return '╱';
    } else if (dx < 0 && dy > 0) {
      return '╱';
    } else if (dx < 0 && dy < 0) {
      return '╲';
    }

    return defaultChar;
  }

  /**
   * Get arrow character based on direction.
   */
  private getArrowChar(fromX: number, fromY: number, toX: number, toY: number): string {
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (Math.abs(dx) > Math.abs(dy) * 2) {
      return dx > 0 ? ARROWS.right : ARROWS.left;
    } else if (Math.abs(dy) > Math.abs(dx) * 2) {
      return dy > 0 ? ARROWS.down : ARROWS.up;
    } else if (dx > 0 && dy > 0) {
      return ARROWS.downRight;
    } else if (dx > 0 && dy < 0) {
      return ARROWS.upRight;
    } else if (dx < 0 && dy > 0) {
      return ARROWS.downLeft;
    } else {
      return ARROWS.upLeft;
    }
  }

  /**
   * Get color for node type.
   */
  private getNodeColor(entityType: GraphNode['entityType']): string {
    switch (entityType) {
      case 'character':
        return '#88AAFF';
      case 'faction':
        return '#FF8844';
      case 'location':
        return '#FFDD00';
      case 'artifact':
        return '#FF00FF';
      default:
        return '#CCCCCC';
    }
  }

  /**
   * Get the entity at a given grid position.
   */
  getEntityAt(grid: RenderGrid, x: number, y: number): EntityId | undefined {
    const cell = grid.get(x, y);
    return cell?.entityId;
  }
}

/**
 * Brighten a hex color.
 */
function brightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const factor = 1.4;
  const newR = Math.min(255, Math.round(r * factor));
  const newG = Math.min(255, Math.round(g * factor));
  const newB = Math.min(255, Math.round(b * factor));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Render a legend for relationship types.
 */
export function renderLegend(): string[] {
  const lines: string[] = [];
  lines.push('Relationships:');

  const pairs: Array<[RelationshipType, string]> = [
    ['ally', 'Ally'],
    ['friend', 'Friend'],
    ['family', 'Family'],
    ['rival', 'Rival'],
    ['enemy', 'Enemy'],
    ['member', 'Member'],
    ['leader', 'Leader'],
    ['trade', 'Trade'],
  ];

  for (const [type, label] of pairs) {
    const color = RELATIONSHIP_COLORS[type];
    lines.push(`  {${color}-fg}─{/} ${label}`);
  }

  lines.push('');
  lines.push('Strength:');
  lines.push(`  ${STRENGTH_LINES.strong} Strong`);
  lines.push(`  ${STRENGTH_LINES.moderate} Moderate`);
  lines.push(`  ${STRENGTH_LINES.weak} Weak`);

  return lines;
}
