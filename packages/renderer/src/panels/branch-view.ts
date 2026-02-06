/**
 * BranchComparisonPanel — split-screen "What If" timeline comparison.
 *
 * Displays main timeline vs branch timeline side by side.
 * Synchronized date, highlights entity / territory / event differences,
 * and shows a divergence counter.
 */

import type * as blessed from 'blessed';
import type {
  EntityId,
  WorldEvent,
  ComponentType,
  World,
  WorldClock,
  EventLog,
  OwnershipComponent,
} from '@fws/core';
import type { DivergenceAction } from '@fws/core';
import type { PanelLayout, RenderContext } from '../types.js';
import { PanelId } from '../types.js';
import { BasePanel } from '../panel.js';

// ──────────────────────────────────────────────────────────────────
// Local branch reference (avoids coupling to full Branch interface)
// ──────────────────────────────────────────────────────────────────

/**
 * Minimal branch state the panel needs for comparison.
 */
export interface BranchRef {
  readonly id: string;
  readonly label: string;
  readonly divergence: DivergenceAction;
  readonly sourceTick: number;
  readonly world: World;
  readonly clock: WorldClock;
  readonly eventLog: EventLog;
}

// ──────────────────────────────────────────────────────────────────
// Comparison result types
// ──────────────────────────────────────────────────────────────────

/**
 * An entity that exists in one timeline but not the other.
 */
export interface UniqueEntity {
  readonly entityId: EntityId;
  readonly timeline: 'main' | 'branch';
}

/**
 * A territory difference between the two timelines.
 */
export interface TerritoryDifference {
  readonly entityId: EntityId;
  readonly mainOwner: EntityId | null;
  readonly branchOwner: EntityId | null;
}

/**
 * Full comparison result between two timelines.
 */
export interface BranchComparison {
  readonly uniqueEntities: readonly UniqueEntity[];
  readonly territoryDifferences: readonly TerritoryDifference[];
  readonly mainOnlyEvents: readonly WorldEvent[];
  readonly branchOnlyEvents: readonly WorldEvent[];
  readonly significantDifferences: number;
}

/**
 * Compare main timeline world state against a branch.
 * Only considers events after the branch's divergence point.
 */
export function compareBranches(
  mainContext: RenderContext,
  branch: BranchRef
): BranchComparison {
  const mainEntities = new Set(mainContext.world.getAllEntities());
  const branchEntities = new Set(branch.world.getAllEntities());

  // Entities unique to each timeline
  const uniqueEntities: UniqueEntity[] = [];
  for (const id of mainEntities) {
    if (!branchEntities.has(id)) {
      uniqueEntities.push({ entityId: id, timeline: 'main' });
    }
  }
  for (const id of branchEntities) {
    if (!mainEntities.has(id)) {
      uniqueEntities.push({ entityId: id, timeline: 'branch' });
    }
  }

  // Territory differences (compare Ownership components)
  const territoryDifferences: TerritoryDifference[] = [];
  const ownershipType: ComponentType = 'Ownership';
  if (mainContext.world.hasStore(ownershipType) && branch.world.hasStore(ownershipType)) {
    const mainStore = mainContext.world.getStore<OwnershipComponent>(ownershipType);
    const branchStore = branch.world.getStore<OwnershipComponent>(ownershipType);

    for (const [entityId, mainComp] of mainStore.getAll()) {
      const branchComp = branchStore.get(entityId);
      const mainOwner = mainComp.ownerId as EntityId | null;
      const branchOwner = branchComp !== undefined
        ? branchComp.ownerId as EntityId | null
        : null;
      if (mainOwner !== branchOwner) {
        territoryDifferences.push({
          entityId,
          mainOwner,
          branchOwner,
        });
      }
    }
  }

  // Events unique to each timeline (after divergence point)
  const divergenceTick = branch.sourceTick;
  const mainEvents = mainContext.eventLog
    .getByTimeRange(divergenceTick, mainContext.clock.currentTick);
  const branchEvents = branch.eventLog
    .getByTimeRange(divergenceTick, branch.clock.currentTick);

  const mainEventIds = new Set(mainEvents.map((ev: WorldEvent) => ev.id));
  const branchEventIds = new Set(branchEvents.map((ev: WorldEvent) => ev.id));

  const mainOnlyEvents = mainEvents.filter((ev: WorldEvent) => !branchEventIds.has(ev.id));
  const branchOnlyEvents = branchEvents.filter((ev: WorldEvent) => !mainEventIds.has(ev.id));

  // Count significant differences
  const significantDifferences =
    uniqueEntities.length +
    territoryDifferences.length +
    mainOnlyEvents.filter((ev: WorldEvent) => ev.significance >= 50).length +
    branchOnlyEvents.filter((ev: WorldEvent) => ev.significance >= 50).length;

  return {
    uniqueEntities,
    territoryDifferences,
    mainOnlyEvents,
    branchOnlyEvents,
    significantDifferences,
  };
}

// ──────────────────────────────────────────────────────────────────
// Panel
// ──────────────────────────────────────────────────────────────────

/**
 * Layout factory for the branch comparison panel.
 */
export function createBranchComparisonPanelLayout(): PanelLayout {
  return {
    id: PanelId.BranchComparison,
    x: 0,
    y: 0,
    width: 80,
    height: 24,
    focused: false,
  };
}

/**
 * BranchComparisonPanel renders a split-screen view of
 * main timeline (left) vs branch timeline (right).
 */
export class BranchComparisonPanel extends BasePanel {
  private activeBranch: BranchRef | null = null;
  private comparison: BranchComparison | null = null;
  private scrollOffset = 0;
  private view: 'entities' | 'events' | 'territory' = 'entities';

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Branch Comparison');
  }

  /**
   * Set the branch to compare against the main timeline.
   */
  setBranch(branch: BranchRef | null): void {
    this.activeBranch = branch;
    this.comparison = null;
    this.scrollOffset = 0;
  }

  render(context: RenderContext): void {
    this.clearArea();

    if (this.activeBranch === null) {
      this.setContent('No active branch. Create a branch to compare timelines.');
      return;
    }

    // Recompute comparison on each render
    this.comparison = compareBranches(context, this.activeBranch);

    const { width, height } = this.getInnerDimensions();
    const halfWidth = Math.floor(width / 2);
    const lines: string[] = [];

    // Header
    const mainTick = context.clock.currentTick;
    const branchTick = this.activeBranch.clock.currentTick;
    lines.push(this.renderHeader(mainTick, branchTick, halfWidth, width));
    lines.push(this.renderDivergenceBar(width));

    // View-specific content
    switch (this.view) {
      case 'entities':
        lines.push(...this.renderEntityView(halfWidth, width));
        break;
      case 'events':
        lines.push(...this.renderEventView(halfWidth, width));
        break;
      case 'territory':
        lines.push(...this.renderTerritoryView(halfWidth, width));
        break;
    }

    // Apply scroll and truncate to fit
    const visibleLines = lines.slice(this.scrollOffset, this.scrollOffset + height);
    this.setContent(visibleLines.join('\n'));
  }

  handleInput(key: string): boolean {
    switch (key) {
      case 'up':
        this.scrollOffset = Math.max(0, this.scrollOffset - 1);
        return true;
      case 'down':
        this.scrollOffset++;
        return true;
      case 'e':
        this.view = 'entities';
        this.scrollOffset = 0;
        return true;
      case 'v':
        this.view = 'events';
        this.scrollOffset = 0;
        return true;
      case 't':
        this.view = 'territory';
        this.scrollOffset = 0;
        return true;
      default:
        return false;
    }
  }

  // ─── Rendering helpers ────────────────────────────────────────

  private renderHeader(
    mainTick: number,
    branchTick: number,
    halfWidth: number,
    fullWidth: number
  ): string {
    const mainLabel = `Main (tick ${mainTick})`;
    const branchLabel = `Branch (tick ${branchTick})`;
    const leftPad = Math.max(0, Math.floor((halfWidth - mainLabel.length) / 2));
    const rightPad = Math.max(0, Math.floor((halfWidth - branchLabel.length) / 2));
    const left = ' '.repeat(leftPad) + mainLabel;
    const right = ' '.repeat(rightPad) + branchLabel;
    return (left.padEnd(halfWidth) + '|' + right).slice(0, fullWidth);
  }

  private renderDivergenceBar(width: number): string {
    if (this.comparison === null) return '';
    const count = this.comparison.significantDifferences;
    const label = `${count} significant difference${count !== 1 ? 's' : ''}`;
    const viewHint = `[E]ntities [V]ents [T]erritory`;
    const gap = Math.max(1, width - label.length - viewHint.length);
    return label + ' '.repeat(gap) + viewHint;
  }

  private renderEntityView(halfWidth: number, fullWidth: number): string[] {
    if (this.comparison === null) return [];
    const lines: string[] = [];
    lines.push('='.repeat(fullWidth));

    const mainOnly = this.comparison.uniqueEntities.filter(
      (u) => u.timeline === 'main'
    );
    const branchOnly = this.comparison.uniqueEntities.filter(
      (u) => u.timeline === 'branch'
    );
    const maxRows = Math.max(mainOnly.length, branchOnly.length);

    if (maxRows === 0) {
      lines.push('No entity differences detected.');
      return lines;
    }

    lines.push(
      padRight(`Main-only (${mainOnly.length})`, halfWidth) +
        '|' +
        `Branch-only (${branchOnly.length})`
    );
    lines.push('-'.repeat(fullWidth));

    for (let i = 0; i < maxRows; i++) {
      const leftEntry = mainOnly[i];
      const rightEntry = branchOnly[i];
      const left = leftEntry !== undefined
        ? `  Entity #${leftEntry.entityId}`
        : '';
      const right = rightEntry !== undefined
        ? `  Entity #${rightEntry.entityId}`
        : '';
      lines.push(padRight(left, halfWidth) + '|' + right);
    }

    return lines;
  }

  private renderEventView(halfWidth: number, fullWidth: number): string[] {
    if (this.comparison === null) return [];
    const lines: string[] = [];
    lines.push('='.repeat(fullWidth));

    const mainEvents = this.comparison.mainOnlyEvents;
    const branchEvents = this.comparison.branchOnlyEvents;
    const maxRows = Math.max(mainEvents.length, branchEvents.length);

    if (maxRows === 0) {
      lines.push('No event differences detected.');
      return lines;
    }

    lines.push(
      padRight(`Main-only events (${mainEvents.length})`, halfWidth) +
        '|' +
        `Branch-only events (${branchEvents.length})`
    );
    lines.push('-'.repeat(fullWidth));

    for (let i = 0; i < maxRows; i++) {
      const mEvent = mainEvents[i];
      const bEvent = branchEvents[i];
      const left = mEvent !== undefined
        ? `  [${mEvent.significance}] ${mEvent.subtype}`
        : '';
      const right = bEvent !== undefined
        ? `  [${bEvent.significance}] ${bEvent.subtype}`
        : '';
      lines.push(
        padRight(truncate(left, halfWidth - 1), halfWidth) + '|' +
        truncate(right, halfWidth - 1)
      );
    }

    return lines;
  }

  private renderTerritoryView(halfWidth: number, fullWidth: number): string[] {
    if (this.comparison === null) return [];
    const lines: string[] = [];
    lines.push('='.repeat(fullWidth));

    const diffs = this.comparison.territoryDifferences;

    if (diffs.length === 0) {
      lines.push('No territory differences detected.');
      return lines;
    }

    lines.push(
      padRight('Entity', 12) +
        padRight('Main Owner', halfWidth - 12) +
        '|' +
        'Branch Owner'
    );
    lines.push('-'.repeat(fullWidth));

    for (const diff of diffs) {
      const left =
        padRight(`#${diff.entityId}`, 12) +
        padRight(
          diff.mainOwner !== null ? `#${diff.mainOwner}` : '(none)',
          halfWidth - 12
        );
      const right =
        diff.branchOwner !== null ? `#${diff.branchOwner}` : '(none)';
      lines.push(left + '|' + right);
    }

    return lines;
  }
}

// ──────────────────────────────────────────────────────────────────
// String helpers
// ──────────────────────────────────────────────────────────────────

function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 1)) + '…';
}
