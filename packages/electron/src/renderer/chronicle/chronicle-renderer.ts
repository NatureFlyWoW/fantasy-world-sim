import type { ChronicleEntry } from './event-aggregator.js';
import { ContextMenu } from '../context-menu.js';
import type { ContextMenuItem } from '../context-menu.js';
import type { FavoritesManager } from '../favorites-manager.js';
import { uiEvents } from '../ui-events.js';

/**
 * Virtual-scroll DOM renderer for Chronicle entries.
 * Uses fixed-height cards with a reusable pool for performance.
 *
 * Key behaviors:
 * - On new data (isModeChange=false): auto-scrolls to bottom if the user was
 *   already there; shows "New events" indicator only when entries actually grew.
 * - On mode/filter change (isModeChange=true): preserves the user's current
 *   scroll position proportionally so they see roughly the same content, and
 *   never shows the "New events" indicator.
 * - Re-entrant updateVisibleCards calls (from programmatic scrollTop changes
 *   triggering the scroll handler) are suppressed via an isUpdating guard.
 * - Scroll events are gated through requestAnimationFrame to avoid redundant
 *   repaints within a single frame.
 * - Only cards that enter the viewport are repopulated; cards that remain
 *   visible across frames keep their DOM unchanged.
 */
export class ChronicleRenderer {
  private readonly scrollContainer: HTMLElement;
  private readonly contentDiv: HTMLElement;
  private readonly newEventsIndicator: HTMLElement;
  private readonly cardPool: HTMLElement[] = [];
  private readonly contextMenu = new ContextMenu();
  private readonly favoritesManager: FavoritesManager;
  private entries: readonly ChronicleEntry[] = [];
  private mode: 'prose' | 'compact' = 'prose';
  private entityNames: ReadonlyMap<number, string> = new Map();
  private cumulativeHeights: number[] = [];

  /**
   * Tracks the previous entry count so that the "New events" indicator is
   * only shown when the entry list actually grew (not on mode switch or
   * entity-name refresh).
   */
  private previousEntryCount = 0;

  /**
   * Guards against re-entrant updateVisibleCards calls caused by programmatic
   * scrollTop assignment triggering the scroll handler.
   */
  private isUpdating = false;

  /**
   * Gates scroll-handler calls through rAF so only one update runs per frame.
   */
  private scrollRafPending = false;

  /**
   * Track the visible range from the previous updateVisibleCards call.
   * Used to diff against the new range so only newly-visible cards are
   * populated, avoiding full DOM teardown on every scroll event.
   */
  private prevStartIdx = -1;
  private prevEndIdx = -1;

  /**
   * Maps entry index -> card pool index for currently assigned cards.
   * Allows O(1) lookup to check whether a given entry already has a card.
   */
  private entryToCard = new Map<number, number>();

  /**
   * Incremented on full data changes (new entries array, mode switch) to
   * force a complete card repopulation rather than a differential update.
   */
  private dataGeneration = 0;
  private lastRenderedGeneration = -1;

  public onEntityClick: ((entityId: number) => void) | null = null;
  public onEventClick: ((eventId: number) => void) | null = null;

  constructor(container: HTMLElement, favoritesManager: FavoritesManager) {
    this.favoritesManager = favoritesManager;
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'chronicle-scroll';

    this.contentDiv = document.createElement('div');
    this.contentDiv.className = 'chronicle-scroll__content';
    this.scrollContainer.appendChild(this.contentDiv);

    this.newEventsIndicator = document.createElement('div');
    this.newEventsIndicator.className = 'chronicle-new-events';
    this.newEventsIndicator.textContent = 'New events \u2193';
    this.newEventsIndicator.style.display = 'none';

    container.appendChild(this.scrollContainer);
    container.appendChild(this.newEventsIndicator);

    // Create reusable card pool
    for (let i = 0; i < 50; i++) {
      const card = document.createElement('div');
      card.style.position = 'absolute';
      card.style.left = '0';
      card.style.width = '100%';
      card.style.display = 'none';
      this.contentDiv.appendChild(card);
      this.cardPool.push(card);
    }

    // Event delegation for entity links
    this.scrollContainer.addEventListener('click', this.handleClick);
    this.scrollContainer.addEventListener('contextmenu', this.handleContextMenu);
    this.scrollContainer.addEventListener('scroll', this.handleScroll);
    this.newEventsIndicator.addEventListener('click', () => this.scrollToBottom());

    // Listen for favorite changes to re-render affected cards
    uiEvents.on('favorite-changed', () => {
      // Force a full repopulation to update favorite status
      this.dataGeneration++;
      this.updateVisibleCards();
    });
  }

  /**
   * Render entries into the virtual scroll.
   *
   * @param isModeChange - when true, preserves scroll position proportionally
   *   and suppresses the "New events" indicator. Passed from ChroniclePanel
   *   when the render was caused by a mode switch or filter change rather
   *   than incoming simulation data.
   */
  public render(
    entries: readonly ChronicleEntry[],
    mode: 'prose' | 'compact',
    entityNames?: ReadonlyMap<number, string>,
    isModeChange = false,
  ): void {
    // ── Batch DOM reads before any writes ──
    const scrollHeight = this.scrollContainer.scrollHeight;
    const scrollTop = this.scrollContainer.scrollTop;
    const clientHeight = this.scrollContainer.clientHeight;
    const wasAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    const oldTotalHeight = this.cumulativeHeights.length > 0
      ? this.cumulativeHeights[this.cumulativeHeights.length - 1] ?? 0
      : 0;
    const previousCount = this.previousEntryCount;

    const modeChanged = mode !== this.mode;
    const entriesChanged = entries !== this.entries;

    this.entries = entries;
    this.mode = mode;
    this.entityNames = entityNames ?? new Map();
    this.previousEntryCount = entries.length;

    // Invalidate card mapping on full data change (mode switch, new array)
    if (isModeChange || modeChanged) {
      this.dataGeneration++;
    }

    // Compute cumulative heights
    this.cumulativeHeights = [];
    let total = 0;
    for (const entry of entries) {
      const height = this.getEntryHeight(entry);
      total += height;
      this.cumulativeHeights.push(total);
    }

    // ── DOM writes ──
    this.contentDiv.style.height = `${total}px`;

    if (isModeChange) {
      // ── Mode/filter change: preserve scroll position proportionally ──
      if (wasAtBottom) {
        this.updateVisibleCards();
        this.scrollToBottom();
      } else if (oldTotalHeight > 0 && total > 0) {
        const fraction = scrollTop / oldTotalHeight;
        this.scrollContainer.scrollTop = Math.round(fraction * total);
        this.updateVisibleCards();
      } else {
        this.updateVisibleCards();
      }
      // Never show the "New events" indicator for mode changes.
    } else {
      // If entries grew but the array identity is the same (incremental append),
      // we can do a differential update. If entries changed identity, force full.
      if (entriesChanged) {
        this.dataGeneration++;
      }
      this.updateVisibleCards();
      if (wasAtBottom) {
        this.scrollToBottom();
      } else if (entries.length > previousCount) {
        this.newEventsIndicator.style.display = 'block';
      }
    }
  }

  public scrollToBottom(): void {
    this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    this.newEventsIndicator.style.display = 'none';
  }

  public isAtBottom(): boolean {
    const { scrollHeight, scrollTop, clientHeight } = this.scrollContainer;
    return scrollHeight - scrollTop - clientHeight < 50;
  }

  public destroy(): void {
    this.scrollContainer.removeEventListener('click', this.handleClick);
    this.scrollContainer.removeEventListener('contextmenu', this.handleContextMenu);
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    this.cardPool.length = 0;
  }

  private getEntryHeight(entry: ChronicleEntry): number {
    if (entry.kind === 'header') return 36;
    if (entry.kind === 'aggregate') return 52;
    return this.mode === 'prose' ? 80 : 28;
  }

  private updateVisibleCards(): void {
    // Guard against re-entrant calls from programmatic scrollTop changes.
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      // ── Batch all DOM reads up front ──
      const scrollTop = this.scrollContainer.scrollTop;
      const clientHeight = this.scrollContainer.clientHeight;
      const viewportEnd = scrollTop + clientHeight;

      // Binary search for first visible index
      let firstVisible = 0;
      let left = 0;
      let right = this.cumulativeHeights.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const height = this.cumulativeHeights[mid];
        if (height === undefined) break;
        if (height < scrollTop) {
          left = mid + 1;
        } else {
          firstVisible = mid;
          right = mid - 1;
        }
      }

      // Determine visible range with buffer
      const startIdx = Math.max(0, firstVisible - 10);
      let endIdx = startIdx;
      while (endIdx < this.entries.length) {
        const height = this.cumulativeHeights[endIdx];
        if (height === undefined || height > viewportEnd + 400) break;
        endIdx++;
      }

      const forceRepopulate = this.lastRenderedGeneration !== this.dataGeneration;

      if (forceRepopulate) {
        // ── Full repopulate: data changed (mode switch, new entries array) ──
        this.lastRenderedGeneration = this.dataGeneration;
        this.entryToCard.clear();

        // Hide all cards
        for (const card of this.cardPool) {
          card.style.display = 'none';
        }

        // Populate visible range
        let poolIdx = 0;
        for (let i = startIdx; i < endIdx && i < this.entries.length; i++) {
          const entry = this.entries[i];
          const card = this.cardPool[poolIdx];
          if (!entry || !card) continue;

          const top = i === 0 ? 0 : (this.cumulativeHeights[i - 1] ?? 0);
          card.style.top = `${top}px`;
          card.style.display = 'block';
          this.populateCard(card, entry);
          this.entryToCard.set(i, poolIdx);
          poolIdx++;
        }
      } else {
        // ── Differential update: only populate newly-visible cards ──
        const prevStart = this.prevStartIdx;
        const prevEnd = this.prevEndIdx;

        // Collect card pool indices that left the viewport
        const freedPool: number[] = [];
        for (let i = prevStart; i < prevEnd; i++) {
          if (i < startIdx || i >= endIdx) {
            const poolIdx = this.entryToCard.get(i);
            if (poolIdx !== undefined) {
              const card = this.cardPool[poolIdx];
              if (card) card.style.display = 'none';
              freedPool.push(poolIdx);
              this.entryToCard.delete(i);
            }
          }
        }

        // Find indices that entered the viewport and need population
        let freeIdx = 0;
        for (let i = startIdx; i < endIdx && i < this.entries.length; i++) {
          if (this.entryToCard.has(i)) {
            // Already has a card — check if the entry content was mutated
            // (e.g. aggregate count changed). Re-populate if so.
            // For simplicity, skip — aggregates are rare updates.
            continue;
          }

          // Need a pool slot. Try freed first, then scan for hidden cards.
          let poolIdx: number | undefined;
          if (freeIdx < freedPool.length) {
            poolIdx = freedPool[freeIdx++];
          } else {
            // Scan pool for an unused (hidden) card
            for (let p = 0; p < this.cardPool.length; p++) {
              const card = this.cardPool[p];
              if (card && card.style.display === 'none') {
                poolIdx = p;
                break;
              }
            }
          }

          if (poolIdx === undefined) break; // No more pool cards available

          const entry = this.entries[i];
          const card = this.cardPool[poolIdx];
          if (!entry || !card) continue;

          const top = i === 0 ? 0 : (this.cumulativeHeights[i - 1] ?? 0);
          card.style.top = `${top}px`;
          card.style.display = 'block';
          this.populateCard(card, entry);
          this.entryToCard.set(i, poolIdx);
        }
      }

      this.prevStartIdx = startIdx;
      this.prevEndIdx = endIdx;
    } finally {
      this.isUpdating = false;
    }
  }

  private populateCard(card: HTMLElement, entry: ChronicleEntry): void {
    card.className = '';
    card.innerHTML = '';

    if (entry.kind === 'header') {
      card.className = 'temporal-header';
      const span = document.createElement('span');
      span.className = 'temporal-header__text';
      span.textContent = entry.text;
      card.appendChild(span);
    } else if (entry.kind === 'aggregate') {
      card.className = 'aggregate-card';
      card.style.borderLeftColor = entry.categoryColor;
      card.setAttribute('data-event-ids', entry.eventIds.join(','));
      card.innerHTML = `
        <span class="aggregate-card__icon">${escapeHtml(entry.icon)}</span>
        <span class="aggregate-card__theme">${escapeHtml(entry.theme)}</span>
      `;
    } else {
      card.className = this.mode === 'compact' ? 'event-card event-card--compact' : 'event-card';

      // Store event ID for click-to-inspect
      card.setAttribute('data-event-id', String(entry.event.id));

      // Add legendary class for high significance events
      if (entry.formatted.significanceTier === 'legendary') {
        card.classList.add('event-card--legendary');
      }

      // Check if any participant is favorited
      const hasFavorite = entry.formatted.entityIds.some((id) => this.favoritesManager.isFavorite(id));
      if (hasFavorite) {
        card.classList.add('event-card--favorite');
      }

      const sigDiv = document.createElement('div');
      sigDiv.className = 'event-card__sig';
      sigDiv.setAttribute('data-tier', entry.formatted.significanceTier);

      const badgeDiv = document.createElement('div');
      badgeDiv.className = 'event-card__badge';
      badgeDiv.style.backgroundColor = entry.formatted.categoryColor;
      badgeDiv.textContent = entry.formatted.icon;

      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'event-card__body';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'event-card__title';
      titleDiv.textContent = entry.formatted.title;

      bodyDiv.appendChild(titleDiv);

      if (this.mode === 'prose') {
        const descDiv = document.createElement('div');
        descDiv.className = 'event-card__desc';
        descDiv.innerHTML = linkifyDescription(
          entry.formatted.description,
          entry.formatted.entityIds,
          this.entityNames
        );

        const timeDiv = document.createElement('div');
        timeDiv.className = 'event-card__time';
        timeDiv.textContent = entry.formatted.timestamp;

        bodyDiv.appendChild(descDiv);
        bodyDiv.appendChild(timeDiv);
      }

      card.appendChild(sigDiv);
      card.appendChild(badgeDiv);
      card.appendChild(bodyDiv);
    }
  }

  private readonly handleClick = (e: Event): void => {
    const target = e.target as HTMLElement;

    // Entity link click (names within event descriptions)
    const link = target.closest('.entity-link');
    if (link instanceof HTMLElement) {
      const idStr = link.getAttribute('data-entity-id');
      if (idStr) {
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          this.onEntityClick?.(id);
        }
      }
      return;
    }

    // Aggregate card click — inspect the first constituent event
    const aggregate = target.closest('.aggregate-card');
    if (aggregate instanceof HTMLElement) {
      const idsStr = aggregate.getAttribute('data-event-ids');
      if (idsStr) {
        const firstId = parseInt(idsStr.split(',')[0] ?? '', 10);
        if (!isNaN(firstId)) {
          this.onEventClick?.(firstId);
        }
      }
      return;
    }

    // Event card click (inspect the event itself)
    const card = target.closest('.event-card');
    if (card instanceof HTMLElement) {
      const eventIdStr = card.getAttribute('data-event-id');
      if (eventIdStr) {
        const eventId = parseInt(eventIdStr, 10);
        if (!isNaN(eventId)) {
          this.onEventClick?.(eventId);
        }
      }
    }
  };

  private readonly handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const card = target.closest('.event-card');
    if (!(card instanceof HTMLElement)) return;

    // Find the entry index from the card's entryToCard mapping
    let entryIdx = -1;
    for (const [idx, poolIdx] of this.entryToCard) {
      if (this.cardPool[poolIdx] === card) {
        entryIdx = idx;
        break;
      }
    }
    if (entryIdx === -1) return;

    const entry = this.entries[entryIdx];
    if (!entry || entry.kind !== 'event') return;

    const items: ContextMenuItem[] = [
      {
        label: 'Inspect Event',
        onClick: () => {
          this.onEventClick?.(entry.event.id);
        },
      },
    ];

    this.contextMenu.show(e.clientX, e.clientY, items);
  };

  /**
   * Scroll handler gated through requestAnimationFrame. Multiple scroll events
   * within a single frame are coalesced into one updateVisibleCards call.
   */
  private readonly handleScroll = (): void => {
    if (this.scrollRafPending) return;
    this.scrollRafPending = true;
    requestAnimationFrame(() => {
      this.scrollRafPending = false;
      this.updateVisibleCards();
      if (this.isAtBottom()) {
        this.newEventsIndicator.style.display = 'none';
      }
    });
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function linkifyDescription(
  desc: string,
  entityIds: readonly number[],
  entityNames: ReadonlyMap<number, string>
): string {
  const nameToId = new Map<string, number>();
  for (const id of entityIds) {
    const name = entityNames.get(id);
    if (name) {
      nameToId.set(name, id);
    }
  }

  // Sort names by length (longest first) to avoid partial matches
  const sortedNames = Array.from(nameToId.keys()).sort((a, b) => b.length - a.length);

  let result = escapeHtml(desc);
  for (const name of sortedNames) {
    const id = nameToId.get(name);
    if (id === undefined) continue;
    const escapedName = escapeHtml(name);
    const link = `<span class="entity-link" data-entity-id="${id}">${escapedName}</span>`;
    result = result.replace(escapedName, link);
  }

  return result;
}
