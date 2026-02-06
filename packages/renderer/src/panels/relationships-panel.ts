/**
 * RelationshipsPanel — visualizes the social network around a selected entity.
 * Displays relationships in a graph with concentric rings by hop distance.
 */

import type * as blessed from 'blessed';
import { BasePanel } from '../panel.js';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import type { EntityId } from '@fws/core';
import type { GraphNode, GraphEdge, RelationshipType } from './graph-layout.js';
import {
  layoutGraph,
  createGraphNode,
  createGraphEdge,
  resolveOverlaps,
  filterByDepth,
  affinityToStrength,
} from './graph-layout.js';
import { GraphRenderer, renderLegend } from './graph-renderer.js';

/**
 * Relationship filter options.
 */
export type RelationshipFilter =
  | 'all'
  | 'positive'
  | 'negative'
  | 'family'
  | 'political'
  | 'economic';

/**
 * Filter display names.
 */
const FILTER_NAMES: Readonly<Record<RelationshipFilter, string>> = {
  all: 'All',
  positive: 'Positive',
  negative: 'Negative',
  family: 'Family',
  political: 'Political',
  economic: 'Economic',
};

/**
 * Relationships panel for visualizing social networks.
 */
export class RelationshipsPanel extends BasePanel {
  private centerEntity: EntityId | null = null;
  private depth = 2;
  private filter: RelationshipFilter = 'all';
  private cursorX = 0;
  private cursorY = 0;
  private showLegend = false;
  private renderer: GraphRenderer;

  // Event handlers
  private inspectHandler: ((entityId: EntityId) => void) | null = null;
  private centerHandler: ((entityId: EntityId) => void) | null = null;

  // Filter cycle order
  private static readonly FILTER_ORDER: readonly RelationshipFilter[] = [
    'all',
    'positive',
    'negative',
    'family',
    'political',
    'economic',
  ];

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Relationships');

    const { width, height } = this.getInnerDimensions();
    this.renderer = new GraphRenderer(width, height);
  }

  /**
   * Set the center entity for the graph.
   */
  setCenterEntity(entityId: EntityId): void {
    this.centerEntity = entityId;
    this.cursorX = 0;
    this.cursorY = 0;
  }

  /**
   * Get the current center entity.
   */
  getCenterEntity(): EntityId | null {
    return this.centerEntity;
  }

  /**
   * Set the relationship depth (1-3 hops).
   */
  setDepth(depth: number): void {
    this.depth = Math.max(1, Math.min(3, depth));
  }

  /**
   * Get the current depth.
   */
  getDepth(): number {
    return this.depth;
  }

  /**
   * Cycle to the next depth level.
   */
  cycleDepth(): void {
    this.depth = (this.depth % 3) + 1;
  }

  /**
   * Set the relationship filter.
   */
  setFilter(filter: RelationshipFilter): void {
    this.filter = filter;
  }

  /**
   * Get the current filter.
   */
  getFilter(): RelationshipFilter {
    return this.filter;
  }

  /**
   * Cycle to the next filter.
   */
  cycleFilter(): void {
    const currentIndex = RelationshipsPanel.FILTER_ORDER.indexOf(this.filter);
    const nextIndex = (currentIndex + 1) % RelationshipsPanel.FILTER_ORDER.length;
    const nextFilter = RelationshipsPanel.FILTER_ORDER[nextIndex];
    if (nextFilter !== undefined) {
      this.filter = nextFilter;
    }
  }

  /**
   * Toggle the legend display.
   */
  toggleLegend(): void {
    this.showLegend = !this.showLegend;
  }

  /**
   * Check if legend is shown.
   */
  isLegendShown(): boolean {
    return this.showLegend;
  }

  /**
   * Set handler for inspecting entities.
   */
  setInspectHandler(handler: (entityId: EntityId) => void): void {
    this.inspectHandler = handler;
  }

  /**
   * Get the inspect handler (for testing).
   */
  getInspectHandler(): ((entityId: EntityId) => void) | null {
    return this.inspectHandler;
  }

  /**
   * Set handler for centering on a different entity.
   */
  setCenterHandler(handler: (entityId: EntityId) => void): void {
    this.centerHandler = handler;
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    switch (key) {
      case 'd':
        this.cycleDepth();
        return true;

      case 'f':
        this.cycleFilter();
        return true;

      case 'l':
        this.toggleLegend();
        return true;

      case 'up':
      case 'k':
        this.cursorY = Math.max(0, this.cursorY - 1);
        return true;

      case 'down':
      case 'j':
        this.cursorY++;
        return true;

      case 'left':
      case 'h':
        this.cursorX = Math.max(0, this.cursorX - 1);
        return true;

      case 'right':
      case 'l':
        this.cursorX++;
        return true;

      case 'enter':
        // Inspect entity at cursor
        return this.inspectAtCursor();

      case 'c':
        // Re-center on entity at cursor
        return this.centerOnCursor();

      default:
        return false;
    }
  }

  /**
   * Inspect entity at cursor position.
   */
  private inspectAtCursor(): boolean {
    if (this.inspectHandler !== null && this.lastGrid !== null) {
      const entityId = this.renderer.getEntityAt(this.lastGrid, this.cursorX, this.cursorY);
      if (entityId !== undefined) {
        this.inspectHandler(entityId);
        return true;
      }
    }
    return false;
  }

  /**
   * Re-center graph on entity at cursor position.
   */
  private centerOnCursor(): boolean {
    if (this.lastGrid !== null) {
      const entityId = this.renderer.getEntityAt(this.lastGrid, this.cursorX, this.cursorY);
      if (entityId !== undefined) {
        if (this.centerHandler !== null) {
          this.centerHandler(entityId);
        }
        this.setCenterEntity(entityId);
        return true;
      }
    }
    return false;
  }

  // Store the last rendered grid for cursor interaction
  private lastGrid: import('./graph-renderer.js').RenderGrid | null = null;

  /**
   * Render the relationships panel.
   */
  render(context: RenderContext): void {
    this.clearArea();

    if (this.centerEntity === null) {
      this.renderEmptyState();
      return;
    }

    // Update renderer dimensions
    const { width, height } = this.getInnerDimensions();
    this.renderer = new GraphRenderer(width, height - 2); // Reserve space for status

    // Build graph from world data
    const { nodes, edges } = this.buildGraph(context);

    if (nodes.size === 0) {
      this.renderNoRelationships();
      return;
    }

    // Filter and layout
    const filtered = filterByDepth(nodes, edges, this.centerEntity, this.depth);
    const config = { width, height: height - 2, ringSpacing: 6, nodeSpacing: 3 };
    const graph = layoutGraph(filtered.nodes, filtered.edges, this.centerEntity, config);

    // Resolve overlaps
    resolveOverlaps(graph.nodes, config);

    // Highlight center
    this.renderer.setHighlightedNode(this.centerEntity);

    // Render to grid
    const grid = this.renderer.render(graph);
    this.lastGrid = grid;

    // Build output
    const lines: string[] = [];

    // Status line
    const filterName = FILTER_NAMES[this.filter];
    lines.push(`Depth: ${this.depth} | Filter: ${filterName} | [d]epth [f]ilter [l]egend [c]enter [Enter]inspect`);
    lines.push('─'.repeat(width));

    // Graph content
    const graphLines = grid.toLines();
    lines.push(...graphLines);

    // Legend overlay if enabled
    if (this.showLegend) {
      const legendLines = renderLegend();
      // Overlay legend in top-right corner
      const legendWidth = 20;
      const legendX = width - legendWidth - 2;
      for (let i = 0; i < legendLines.length && i + 2 < lines.length; i++) {
        const line = lines[i + 2];
        const legendLine = legendLines[i];
        if (line !== undefined && legendLine !== undefined) {
          const paddedLegend = legendLine.padEnd(legendWidth);
          lines[i + 2] = line.slice(0, legendX) + paddedLegend;
        }
      }
    }

    // Draw cursor
    if (this.cursorY + 2 < lines.length) {
      const line = lines[this.cursorY + 2];
      if (line !== undefined && this.cursorX < line.length) {
        const before = line.slice(0, this.cursorX);
        const cursor = line[this.cursorX] ?? ' ';
        const after = line.slice(this.cursorX + 1);
        lines[this.cursorY + 2] = `${before}{inverse}${cursor}{/inverse}${after}`;
      }
    }

    this.setContent(lines.join('\n'));
  }

  /**
   * Build graph from world data.
   */
  private buildGraph(context: RenderContext): { nodes: Map<EntityId, GraphNode>; edges: GraphEdge[] } {
    const { world } = context;
    const nodes = new Map<EntityId, GraphNode>();
    const edges: GraphEdge[] = [];

    if (this.centerEntity === null) {
      return { nodes, edges };
    }

    // Add center node
    const centerLabel = this.getEntityLabel(this.centerEntity, world);
    const centerType = this.detectEntityType(this.centerEntity, world);
    nodes.set(this.centerEntity, createGraphNode(this.centerEntity, centerLabel, centerType));

    // Get relationships from the center entity
    if (world.hasStore('Relationship')) {
      const relComp = world.getComponent(this.centerEntity, 'Relationship') as
        | { relationships?: Map<number, string>; affinity?: Map<number, number> }
        | undefined;

      if (relComp !== undefined) {
        const relationships = relComp.relationships ?? new Map();
        const affinities = relComp.affinity ?? new Map();

        for (const [targetId, relType] of relationships) {
          const entityId = targetId as EntityId;
          const affinity = affinities.get(targetId) ?? 0;

          // Apply filter
          if (!this.passesFilter(relType, affinity)) {
            continue;
          }

          // Add node if not present
          if (!nodes.has(entityId)) {
            const label = this.getEntityLabel(entityId, world);
            const type = this.detectEntityType(entityId, world);
            nodes.set(entityId, createGraphNode(entityId, label, type));
          }

          // Add edge
          const relTypeEnum = this.mapRelationType(relType);
          const strength = affinityToStrength(affinity);
          edges.push(createGraphEdge(this.centerEntity, entityId, relTypeEnum, strength, relType));
        }
      }
    }

    // Add faction membership edges
    if (world.hasStore('Membership')) {
      const memComp = world.getComponent(this.centerEntity, 'Membership') as
        | { factionId?: number; role?: string }
        | undefined;

      if (memComp?.factionId !== undefined) {
        const factionId = memComp.factionId as EntityId;

        if (!nodes.has(factionId)) {
          const label = this.getEntityLabel(factionId, world);
          nodes.set(factionId, createGraphNode(factionId, label, 'faction'));
        }

        const relType: RelationshipType = memComp.role === 'leader' ? 'leader' : 'member';
        edges.push(createGraphEdge(this.centerEntity, factionId, relType, 'moderate'));
      }
    }

    // Expand to secondary connections for depth > 1
    if (this.depth > 1) {
      const primaryNodes = new Set(nodes.keys());
      for (const nodeId of primaryNodes) {
        if (nodeId === this.centerEntity) continue;

        if (world.hasStore('Relationship')) {
          const relComp = world.getComponent(nodeId, 'Relationship') as
            | { relationships?: Map<number, string>; affinity?: Map<number, number> }
            | undefined;

          if (relComp !== undefined) {
            const relationships = relComp.relationships ?? new Map();
            const affinities = relComp.affinity ?? new Map();

            for (const [targetId, relType] of relationships) {
              const entityId = targetId as EntityId;
              const affinity = affinities.get(targetId) ?? 0;

              if (!this.passesFilter(relType, affinity)) {
                continue;
              }

              // Skip if already connected to center (avoid duplicates)
              if (primaryNodes.has(entityId) && entityId !== this.centerEntity) {
                // Add edge between existing nodes
                const relTypeEnum = this.mapRelationType(relType);
                const strength = affinityToStrength(affinity);
                const existingEdge = edges.find(
                  e =>
                    (e.fromId === nodeId && e.toId === entityId) ||
                    (e.fromId === entityId && e.toId === nodeId)
                );
                if (existingEdge === undefined) {
                  edges.push(createGraphEdge(nodeId, entityId, relTypeEnum, strength));
                }
              } else if (!nodes.has(entityId)) {
                // Add new secondary node
                const label = this.getEntityLabel(entityId, world);
                const type = this.detectEntityType(entityId, world);
                nodes.set(entityId, createGraphNode(entityId, label, type));

                const relTypeEnum = this.mapRelationType(relType);
                const strength = affinityToStrength(affinity);
                edges.push(createGraphEdge(nodeId, entityId, relTypeEnum, strength));
              }
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Check if a relationship passes the current filter.
   */
  private passesFilter(relType: string, affinity: number): boolean {
    switch (this.filter) {
      case 'all':
        return true;

      case 'positive':
        return affinity >= 0;

      case 'negative':
        return affinity < 0;

      case 'family':
        return (
          relType.toLowerCase().includes('family') ||
          relType.toLowerCase().includes('parent') ||
          relType.toLowerCase().includes('child') ||
          relType.toLowerCase().includes('spouse') ||
          relType.toLowerCase().includes('sibling')
        );

      case 'political':
        return (
          relType.toLowerCase().includes('ally') ||
          relType.toLowerCase().includes('enemy') ||
          relType.toLowerCase().includes('vassal') ||
          relType.toLowerCase().includes('lord') ||
          relType.toLowerCase().includes('leader')
        );

      case 'economic':
        return (
          relType.toLowerCase().includes('trade') ||
          relType.toLowerCase().includes('merchant') ||
          relType.toLowerCase().includes('debtor') ||
          relType.toLowerCase().includes('creditor')
        );

      default:
        return true;
    }
  }

  /**
   * Map string relationship type to enum.
   */
  private mapRelationType(relType: string): RelationshipType {
    const lower = relType.toLowerCase();

    if (lower.includes('ally')) return 'ally';
    if (lower.includes('friend')) return 'friend';
    if (lower.includes('family') || lower.includes('spouse') || lower.includes('parent') || lower.includes('child')) {
      return 'family';
    }
    if (lower.includes('rival')) return 'rival';
    if (lower.includes('enemy')) return 'enemy';
    if (lower.includes('member')) return 'member';
    if (lower.includes('leader') || lower.includes('lord')) return 'leader';
    if (lower.includes('vassal')) return 'vassal';
    if (lower.includes('trade') || lower.includes('merchant')) return 'trade';

    // Use affinity-based detection as fallback
    return 'neutral';
  }

  /**
   * Get a label for an entity.
   */
  private getEntityLabel(entityId: EntityId, world: import('@fws/core').World): string {
    // Try Status component for name/titles
    if (world.hasStore('Status')) {
      const status = world.getComponent(entityId, 'Status') as
        | { titles?: string[]; name?: string }
        | undefined;
      if (status?.titles !== undefined && status.titles.length > 0) {
        const firstTitle = status.titles[0];
        if (firstTitle !== undefined) {
          return firstTitle;
        }
      }
      if (status?.name !== undefined) {
        return status.name;
      }
    }

    // Fallback to ID
    return `#${entityId}`;
  }

  /**
   * Detect entity type from components.
   */
  private detectEntityType(
    entityId: EntityId,
    world: import('@fws/core').World
  ): GraphNode['entityType'] {
    if (world.hasStore('Attribute') && world.getComponent(entityId, 'Attribute') !== undefined) {
      return 'character';
    }
    if (world.hasStore('Territory') && world.getComponent(entityId, 'Territory') !== undefined) {
      return 'faction';
    }
    if (world.hasStore('Population') && world.getComponent(entityId, 'Population') !== undefined) {
      return 'location';
    }
    if (world.hasStore('CreationHistory') && world.getComponent(entityId, 'CreationHistory') !== undefined) {
      return 'artifact';
    }
    return 'unknown';
  }

  /**
   * Render empty state when no entity is selected.
   */
  private renderEmptyState(): void {
    const lines = [
      '',
      '  No entity selected',
      '',
      '  Select an entity from the Inspector',
      '  to view its relationships.',
      '',
      '  Controls:',
      '    d - Cycle depth (1-3 hops)',
      '    f - Toggle filter',
      '    l - Toggle legend',
      '    c - Re-center on cursor',
      '    Enter - Inspect entity',
      '    Arrow keys - Move cursor',
    ];
    this.setContent(lines.join('\n'));
  }

  /**
   * Render state when entity has no relationships.
   */
  private renderNoRelationships(): void {
    const lines = [
      '',
      `  Entity #${this.centerEntity}`,
      '',
      '  No relationships found.',
      '',
      `  Current filter: ${FILTER_NAMES[this.filter]}`,
      '  Try changing the filter with [f]',
    ];
    this.setContent(lines.join('\n'));
  }

  /**
   * Clean up resources.
   */
  override destroy(): void {
    this.centerEntity = null;
    this.lastGrid = null;
    super.destroy();
  }
}

/**
 * Create relationships panel layout.
 */
export function createRelationshipsPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.RelationshipGraph,
    x,
    y,
    width,
    height,
    focused: false,
  };
}
