/**
 * Entity Inspector Panel - displays detailed information about selected entities.
 * Detects entity type and delegates to specialized sub-inspectors.
 */

import type * as blessed from 'blessed';
import { BasePanel } from '../panel.js';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { EventCategory, WorldFingerprintCalculator, FINGERPRINT_DOMAINS } from '@fws/core';
import type { EntityId, WorldEvent } from '@fws/core';
import { CharacterInspector } from './character-inspector.js';
import { LocationInspector } from './location-inspector.js';
import { FactionInspector } from './faction-inspector.js';
import { ArtifactInspector } from './artifact-inspector.js';
import { CATEGORY_ICONS } from './event-formatter.js';

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
 * Data for the pre-simulation welcome screen.
 */
export interface WelcomeData {
  readonly seed: number;
  readonly factionCount: number;
  readonly characterCount: number;
  readonly settlementCount: number;
  readonly tensions: readonly string[];
  readonly worldSize: string;
}

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

  // World dashboard
  private readonly fingerprintCalculator = new WorldFingerprintCalculator();
  private dashboardScrollOffset = 0;

  // Welcome screen data (pre-simulation)
  private welcomeData: WelcomeData | null = null;

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
   * Set welcome data for the pre-simulation welcome screen.
   */
  setWelcomeData(data: WelcomeData): void {
    this.welcomeData = data;
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
    // Dashboard scroll when no entity selected
    if (this.currentEntityId === null) {
      if (key === 'up' || key === 'k' || key === 'wheelup') {
        if (this.dashboardScrollOffset > 0) {
          this.dashboardScrollOffset--;
          return true;
        }
        return false;
      }
      if (key === 'down' || key === 'j' || key === 'wheeldown') {
        this.dashboardScrollOffset++;
        return true;
      }
      return false;
    }

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
      this.renderWorldDashboard(context);
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
   * Render world dashboard when no entity is selected.
   * Before simulation: shows "Story So Far" welcome.
   * During simulation: shows World Pulse, Top Factions, Active Tensions, Recent Notable Events.
   */
  private renderWorldDashboard(context: RenderContext): void {
    const lines: string[] = [];
    const { width } = this.getInnerDimensions();
    const barWidth = Math.max(10, Math.min(20, width - 20));

    // Pre-simulation welcome screen
    const hasEvents = context.eventLog.getAll().length > 0;
    if (!hasEvents && this.welcomeData !== null) {
      this.renderWelcomeScreen(lines, width);
      const { height } = this.getInnerDimensions();
      const visibleLines = lines.slice(this.dashboardScrollOffset, this.dashboardScrollOffset + height);
      this.setContent(visibleLines.join('\n'));
      return;
    }

    // ── WORLD PULSE ─────────────────────
    lines.push(`{bold} \u2500\u2500\u2500 WORLD PULSE ${'─'.repeat(Math.max(0, width - 18))} {/bold}`);

    try {
      const fingerprint = this.fingerprintCalculator.calculateFingerprint(context.world, context.eventLog);
      for (const domain of FINGERPRINT_DOMAINS) {
        const value = fingerprint.domainBalance.get(domain) ?? 0;
        const pct = Math.round(value * 100);
        const filled = Math.round((pct / 100) * barWidth);
        const empty = barWidth - filled;
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
        const domainLabel = domain.padEnd(12);
        lines.push(`  ${domainLabel} ${bar} ${pct}`);
      }
    } catch {
      lines.push('  (No event data yet)');
    }

    lines.push('');

    // ── TOP FACTIONS ─────────────────────
    lines.push(`{bold} \u2500\u2500\u2500 TOP FACTIONS ${'─'.repeat(Math.max(0, width - 19))} {/bold}`);

    const factionEntries = this.getTopFactions(context, 5);
    if (factionEntries.length === 0) {
      lines.push('  (No factions yet)');
    } else {
      for (const entry of factionEntries) {
        const popStr = entry.population > 0 ? `pop: ${entry.population.toLocaleString()}` : '';
        lines.push(`  \u269C ${entry.name.padEnd(Math.max(1, width - 20))} ${popStr}`);
      }
    }

    lines.push('');

    // ── ACTIVE TENSIONS ──────────────────
    lines.push(`{bold} \u2500\u2500\u2500 ACTIVE TENSIONS ${'─'.repeat(Math.max(0, width - 22))} {/bold}`);

    const tensions = this.getActiveTensions(context, 5);
    if (tensions.length === 0) {
      lines.push('  (No active tensions)');
    } else {
      for (const tension of tensions) {
        const icon = CATEGORY_ICONS[tension.category];
        const desc = tension.description.slice(0, Math.max(1, width - 6));
        lines.push(`  ${icon} ${desc}`);
      }
    }

    lines.push('');

    // ── RECENT NOTABLE EVENTS ────────────
    lines.push(`{bold} \u2500\u2500\u2500 RECENT NOTABLE ${'─'.repeat(Math.max(0, width - 20))} {/bold}`);

    const notable = this.getRecentNotableEvents(context, 8);
    if (notable.length === 0) {
      lines.push('  (No notable events yet)');
    } else {
      for (const event of notable) {
        const sigChar = event.significance >= 90 ? '\u2605' : event.significance >= 70 ? '\u25CF' : '\u25CB';
        const desc = this.getEventShortDescription(event).slice(0, Math.max(1, width - 14));
        lines.push(`  ${sigChar} ${desc.padEnd(Math.max(1, width - 14))} [sig ${event.significance}]`);
      }
    }

    lines.push('');
    lines.push('{#888888-fg}  Click any item to inspect  |  Select entity to view details{/}');

    // Apply dashboard scroll
    const { height } = this.getInnerDimensions();
    const visibleLines = lines.slice(this.dashboardScrollOffset, this.dashboardScrollOffset + height);
    this.setContent(visibleLines.join('\n'));
  }

  /**
   * Render the pre-simulation welcome screen.
   */
  private renderWelcomeScreen(lines: string[], width: number): void {
    if (this.welcomeData === null) return;
    const w = this.welcomeData;
    const sep = '\u2550'.repeat(Math.max(0, width - 4));

    lines.push('');
    lines.push(`  {bold}\u2552${sep}\u2555{/bold}`);
    lines.push(`  {bold}     \u00C6TERNUM — THE STORY SO FAR{/bold}`);
    lines.push(`  {bold}\u2558${sep}\u255B{/bold}`);
    lines.push('');
    lines.push(`  Seed: ${w.seed}  |  World Size: ${w.worldSize}`);
    lines.push('');
    lines.push(`  {bold}Civilizations:{/bold}`);
    lines.push(`    ${w.factionCount} factions  |  ${w.settlementCount} settlements  |  ${w.characterCount} characters`);
    lines.push('');

    if (w.tensions.length > 0) {
      lines.push(`  {bold}Initial Tensions:{/bold}`);
      for (const tension of w.tensions) {
        lines.push(`    \u2022 ${tension}`);
      }
      lines.push('');
    }

    lines.push('  The world has been shaped by millennia of pre-history.');
    lines.push('  Ancient ruins dot the landscape, and old grudges simmer');
    lines.push('  beneath the surface of fragile alliances.');
    lines.push('');
    lines.push(`  {bold}Press Space to watch history unfold.{/bold}`);
    lines.push('');
  }

  /**
   * Get top factions by population (from Territory components).
   */
  private getTopFactions(context: RenderContext, limit: number): Array<{ name: string; population: number; entityId: EntityId }> {
    const factions: Array<{ name: string; population: number; entityId: EntityId }> = [];

    if (!context.world.hasStore('Territory')) return factions;

    for (const [entityId] of context.world.getStore('Territory').getAll()) {
      let name = `Faction #${entityId}`;
      let population = 0;

      // Try to get name from Status component
      if (context.world.hasStore('Status')) {
        const status = context.world.getComponent(entityId, 'Status');
        if (status !== undefined) {
          const titles = (status as { titles?: string[] }).titles;
          if (titles !== undefined && titles.length > 0 && titles[0] !== undefined) {
            name = titles[0];
          }
        }
      }

      // Try to get population from Territory
      const territory = context.world.getComponent(entityId, 'Territory');
      if (territory !== undefined) {
        population = (territory as { totalPopulation?: number }).totalPopulation ?? 0;
      }

      factions.push({ name, population, entityId });
    }

    factions.sort((a, b) => b.population - a.population);
    return factions.slice(0, limit);
  }

  /**
   * Get active tensions from recent high-significance Political/Military events.
   */
  private getActiveTensions(context: RenderContext, limit: number): Array<{ description: string; category: EventCategory }> {
    const tensions: Array<{ description: string; category: EventCategory }> = [];
    const all = context.eventLog.getAll();

    // Look at last 500 events for tension-related events
    const recentEvents = all.slice(Math.max(0, all.length - 500));

    for (const event of recentEvents) {
      if (event.significance < 60) continue;
      if (event.category !== EventCategory.Political && event.category !== EventCategory.Military) continue;

      const data = event.data as Record<string, unknown>;
      const desc = typeof data['description'] === 'string'
        ? data['description']
        : event.subtype.split('.').slice(1).join(' ').replace(/_/g, ' ');

      tensions.push({ description: desc, category: event.category });
    }

    // Deduplicate by description and return most recent
    const seen = new Set<string>();
    const unique: Array<{ description: string; category: EventCategory }> = [];
    for (let i = tensions.length - 1; i >= 0 && unique.length < limit; i--) {
      const t = tensions[i];
      if (t !== undefined && !seen.has(t.description)) {
        seen.add(t.description);
        unique.push(t);
      }
    }
    return unique;
  }

  /**
   * Get recent notable events (sorted by significance).
   */
  private getRecentNotableEvents(context: RenderContext, limit: number): WorldEvent[] {
    const all = context.eventLog.getAll();
    const recent = all.slice(Math.max(0, all.length - 200));

    // Sort by significance descending
    const sorted = [...recent].sort((a, b) => b.significance - a.significance);
    return sorted.slice(0, limit);
  }

  /**
   * Get a short description for an event (for dashboard display).
   */
  private getEventShortDescription(event: WorldEvent): string {
    const data = event.data as Record<string, unknown>;
    if (typeof data['description'] === 'string') {
      return data['description'];
    }
    const parts = event.subtype.split('.');
    if (parts.length >= 2) {
      const action = parts.slice(1).join(' ').replace(/_/g, ' ');
      return action.charAt(0).toUpperCase() + action.slice(1);
    }
    return event.subtype.replace(/_/g, ' ');
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
