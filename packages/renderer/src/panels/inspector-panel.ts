/**
 * Entity Inspector Panel - displays detailed information about selected entities.
 * Detects entity type and delegates to specialized sub-inspectors.
 */

import type * as blessed from 'blessed';
import { BasePanel } from '../panel.js';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import type { EntityId } from '@fws/core';
import { CharacterInspector } from './character-inspector.js';
import { LocationInspector } from './location-inspector.js';
import { FactionInspector } from './faction-inspector.js';
import { ArtifactInspector } from './artifact-inspector.js';

/**
 * Entity types that can be inspected.
 */
export type InspectableEntityType = 'character' | 'location' | 'faction' | 'artifact' | 'unknown';

/**
 * Navigation history entry.
 */
export interface HistoryEntry {
  readonly entityId: EntityId;
  readonly entityType: InspectableEntityType;
  readonly timestamp: number;
}

/**
 * Inspector mode.
 */
export type InspectorMode = 'overview' | 'relationships' | 'timeline' | 'details';

/**
 * Section within an inspector.
 */
export interface InspectorSection {
  readonly id: string;
  readonly title: string;
  collapsed: boolean;
}

/**
 * Inspector panel for viewing entity details.
 */
export class InspectorPanel extends BasePanel {
  private currentEntityId: EntityId | null = null;
  private currentEntityType: InspectableEntityType = 'unknown';
  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private mode: InspectorMode = 'overview';
  private scrollOffset = 0;
  private sections: InspectorSection[] = [];

  // Sub-inspectors
  private readonly characterInspector: CharacterInspector;
  private readonly locationInspector: LocationInspector;
  private readonly factionInspector: FactionInspector;
  private readonly artifactInspector: ArtifactInspector;

  // Event handlers
  private inspectHandler: ((entityId: EntityId) => void) | null = null;
  private goToLocationHandler: ((x: number, y: number) => void) | null = null;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Inspector');

    // Initialize sub-inspectors
    this.characterInspector = new CharacterInspector();
    this.locationInspector = new LocationInspector();
    this.factionInspector = new FactionInspector();
    this.artifactInspector = new ArtifactInspector();
  }

  /**
   * Inspect an entity by ID.
   * Auto-detects entity type from components.
   */
  inspect(entityId: EntityId, context: RenderContext): void {
    const entityType = this.detectEntityType(entityId, context);
    this.inspectWithType(entityId, entityType, context);
  }

  /**
   * Inspect an entity with known type.
   */
  inspectWithType(entityId: EntityId, entityType: InspectableEntityType, _context: RenderContext): void {
    // Add to history if different from current
    if (this.currentEntityId !== entityId) {
      // Truncate forward history if navigating from middle
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      const entry: HistoryEntry = {
        entityId,
        entityType,
        timestamp: Date.now(),
      };
      this.history.push(entry);
      this.historyIndex = this.history.length - 1;
    }

    this.currentEntityId = entityId;
    this.currentEntityType = entityType;
    this.scrollOffset = 0;
    this.mode = 'overview';
    this.initializeSections(entityType);
  }

  /**
   * Navigate back in history.
   */
  back(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const entry = this.history[this.historyIndex];
      if (entry !== undefined) {
        this.currentEntityId = entry.entityId;
        this.currentEntityType = entry.entityType;
        this.scrollOffset = 0;
        this.initializeSections(entry.entityType);
        return true;
      }
    }
    return false;
  }

  /**
   * Navigate forward in history.
   */
  forward(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const entry = this.history[this.historyIndex];
      if (entry !== undefined) {
        this.currentEntityId = entry.entityId;
        this.currentEntityType = entry.entityType;
        this.scrollOffset = 0;
        this.initializeSections(entry.entityType);
        return true;
      }
    }
    return false;
  }

  /**
   * Clear the inspector and history.
   */
  clear(): void {
    this.currentEntityId = null;
    this.currentEntityType = 'unknown';
    this.history = [];
    this.historyIndex = -1;
    this.scrollOffset = 0;
    this.sections = [];
  }

  /**
   * Detect entity type from its components.
   */
  detectEntityType(entityId: EntityId, context: RenderContext): InspectableEntityType {
    const { world } = context;

    // Character: has Attribute component
    if (world.hasStore('Attribute') && world.getComponent(entityId, 'Attribute') !== undefined) {
      return 'character';
    }

    // Location: has Position and Population components
    if (world.hasStore('Position') && world.hasStore('Population')) {
      const pos = world.getComponent(entityId, 'Position');
      const pop = world.getComponent(entityId, 'Population');
      if (pos !== undefined && pop !== undefined) {
        return 'location';
      }
    }

    // Faction: has Territory component
    if (world.hasStore('Territory') && world.getComponent(entityId, 'Territory') !== undefined) {
      return 'faction';
    }

    // Artifact: has CreationHistory or OwnershipChain component
    if (world.hasStore('CreationHistory') && world.getComponent(entityId, 'CreationHistory') !== undefined) {
      return 'artifact';
    }
    if (world.hasStore('OwnershipChain') && world.getComponent(entityId, 'OwnershipChain') !== undefined) {
      return 'artifact';
    }

    return 'unknown';
  }

  /**
   * Initialize sections for the entity type.
   */
  private initializeSections(entityType: InspectableEntityType): void {
    switch (entityType) {
      case 'character':
        this.sections = this.characterInspector.getSections();
        break;
      case 'location':
        this.sections = this.locationInspector.getSections();
        break;
      case 'faction':
        this.sections = this.factionInspector.getSections();
        break;
      case 'artifact':
        this.sections = this.artifactInspector.getSections();
        break;
      default:
        this.sections = [];
    }
  }

  /**
   * Toggle a section collapsed state.
   */
  toggleSection(sectionId: string): void {
    const section = this.sections.find(s => s.id === sectionId);
    if (section !== undefined) {
      section.collapsed = !section.collapsed;
    }
  }

  /**
   * Get current entity ID.
   */
  getCurrentEntityId(): EntityId | null {
    return this.currentEntityId;
  }

  /**
   * Get current entity type.
   */
  getCurrentEntityType(): InspectableEntityType {
    return this.currentEntityType;
  }

  /**
   * Get history entries.
   */
  getHistory(): readonly HistoryEntry[] {
    return this.history;
  }

  /**
   * Get current history index.
   */
  getHistoryIndex(): number {
    return this.historyIndex;
  }

  /**
   * Get current mode.
   */
  getMode(): InspectorMode {
    return this.mode;
  }

  /**
   * Set inspector mode.
   */
  setMode(mode: InspectorMode): void {
    this.mode = mode;
  }

  /**
   * Get sections.
   */
  getSections(): readonly InspectorSection[] {
    return this.sections;
  }

  /**
   * Set handler for inspecting other entities.
   */
  setInspectHandler(handler: (entityId: EntityId) => void): void {
    this.inspectHandler = handler;
  }

  /**
   * Get the inspect handler (for testing and external use).
   */
  getInspectHandler(): ((entityId: EntityId) => void) | null {
    return this.inspectHandler;
  }

  /**
   * Set handler for navigating to locations.
   */
  setGoToLocationHandler(handler: (x: number, y: number) => void): void {
    this.goToLocationHandler = handler;
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    switch (key) {
      case 'backspace':
      case 'left':
        return this.back();

      case 'right':
        return this.forward();

      case 'up':
      case 'k':
        if (this.scrollOffset > 0) {
          this.scrollOffset--;
          return true;
        }
        return false;

      case 'down':
      case 'j':
        this.scrollOffset++;
        return true;

      case 'o':
        this.mode = 'overview';
        return true;

      case 'r':
        this.mode = 'relationships';
        return true;

      case 't':
        this.mode = 'timeline';
        return true;

      case 'd':
        this.mode = 'details';
        return true;

      case 'g':
        // Go to location
        return this.handleGoToLocation();

      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
        // Toggle section by number
        const sectionIndex = parseInt(key, 10) - 1;
        const section = this.sections[sectionIndex];
        if (section !== undefined) {
          section.collapsed = !section.collapsed;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Handle go to location command.
   */
  private handleGoToLocation(): boolean {
    if (this.goToLocationHandler === null || this.currentEntityId === null) {
      return false;
    }

    // Location uses its own position
    if (this.currentEntityType === 'location') {
      // Will be resolved during render when context is available
      return true;
    }

    return false;
  }

  /**
   * Render the inspector panel.
   */
  render(context: RenderContext): void {
    this.clearArea();

    if (this.currentEntityId === null) {
      this.renderEmptyState();
      return;
    }

    const lines: string[] = [];

    // Render header with navigation
    lines.push(...this.renderHeader());

    // Render content based on entity type
    switch (this.currentEntityType) {
      case 'character':
        lines.push(...this.characterInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'location':
        lines.push(...this.locationInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'faction':
        lines.push(...this.factionInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      case 'artifact':
        lines.push(...this.artifactInspector.render(this.currentEntityId, context, this.sections, this.mode));
        break;
      default:
        lines.push('Unknown entity type');
    }

    // Apply scroll offset
    const { height } = this.getInnerDimensions();
    const visibleLines = lines.slice(this.scrollOffset, this.scrollOffset + height);

    this.setContent(visibleLines.join('\n'));
  }

  /**
   * Render empty state when no entity selected.
   */
  private renderEmptyState(): void {
    const lines = [
      '',
      '  No entity selected',
      '',
      '  Select an entity from:',
      '    - Map panel (click/enter)',
      '    - Event log (enter on event)',
      '',
      '  Navigation:',
      '    ← / Backspace - Back',
      '    → - Forward',
      '    ↑/↓ - Scroll',
      '',
      '  Modes:',
      '    o - Overview',
      '    r - Relationships',
      '    t - Timeline',
      '    d - Details',
    ];

    this.setContent(lines.join('\n'));
  }

  /**
   * Render header with entity name and navigation.
   */
  private renderHeader(): string[] {
    const lines: string[] = [];

    // Navigation indicator
    const canBack = this.historyIndex > 0;
    const canForward = this.historyIndex < this.history.length - 1;
    const navIndicator = `${canBack ? '←' : ' '} ${this.historyIndex + 1}/${this.history.length} ${canForward ? '→' : ' '}`;

    // Entity type icon
    const typeIcon = this.getEntityTypeIcon(this.currentEntityType);

    // Mode tabs
    const modes: InspectorMode[] = ['overview', 'relationships', 'timeline', 'details'];
    const modeLabels = modes.map(m => {
      const label = m.charAt(0).toUpperCase();
      return m === this.mode ? `[${label}]` : ` ${label} `;
    }).join('');

    lines.push(`${typeIcon} Entity #${this.currentEntityId}  ${navIndicator}`);
    lines.push(`Mode: ${modeLabels}`);
    lines.push('─'.repeat(40));

    return lines;
  }

  /**
   * Get icon for entity type.
   */
  private getEntityTypeIcon(type: InspectableEntityType): string {
    switch (type) {
      case 'character':
        return '👤';
      case 'location':
        return '🏰';
      case 'faction':
        return '⚜';
      case 'artifact':
        return '✦';
      default:
        return '?';
    }
  }

  /**
   * Clean up resources.
   */
  override destroy(): void {
    this.clear();
    super.destroy();
  }
}

/**
 * Create inspector panel layout.
 */
export function createInspectorPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.Inspector,
    x,
    y,
    width,
    height,
    focused: false,
  };
}
