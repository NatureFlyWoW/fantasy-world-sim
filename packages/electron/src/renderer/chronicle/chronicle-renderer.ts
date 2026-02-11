import type { ChronicleEntry } from './event-aggregator.js';
import { ContextMenu } from '../context-menu.js';
import type { ContextMenuItem } from '../context-menu.js';

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
 */
export class ChronicleRenderer {
  private readonly scrollContainer: HTMLElement;
  private readonly contentDiv: HTMLElement;
  private readonly newEventsIndicator: HTMLElement;
  private readonly cardPool: HTMLElement[] = [];
  private readonly contextMenu = new ContextMenu();
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

  public onEntityClick: ((entityId: number) => void) | null = null;
  public onEventClick: ((eventId: number) => void) | null = null;

  constructor(container: HTMLElement) {
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
    const wasAtBottom = this.isAtBottom();
    const oldTotalHeight = this.cumulativeHeights.length > 0
      ? this.cumulativeHeights[this.cumulativeHeights.length - 1] ?? 0
      : 0;
    const oldScrollTop = this.scrollContainer.scrollTop;
    const previousCount = this.previousEntryCount;

    this.entries = entries;
    this.mode = mode;
    this.entityNames = entityNames ?? new Map();
    this.previousEntryCount = entries.length;

    // Compute cumulative heights
    this.cumulativeHeights = [];
    let total = 0;
    for (const entry of entries) {
      const height = this.getEntryHeight(entry);
      total += height;
      this.cumulativeHeights.push(total);
    }

    this.contentDiv.style.height = `${total}px`;

    if (isModeChange) {
      // ── Mode/filter change: preserve scroll position proportionally ──
      // Map the old scroll fraction to the new total height so the user
      // sees roughly the same temporal position after the switch.
      if (wasAtBottom) {
        this.updateVisibleCards();
        this.scrollToBottom();
      } else if (oldTotalHeight > 0 && total > 0) {
        const fraction = oldScrollTop / oldTotalHeight;
        this.scrollContainer.scrollTop = Math.round(fraction * total);
        this.updateVisibleCards();
      } else {
        this.updateVisibleCards();
      }
      // Never show the "New events" indicator for mode changes.
    } else {
      // ── New data: auto-scroll or show indicator ──
      this.updateVisibleCards();
      if (wasAtBottom) {
        this.scrollToBottom();
      } else if (entries.length > previousCount) {
        // Only show indicator when entries actually grew.
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
    // Guard against re-entrant calls from programmatic scrollTop changes
    // (scrollToBottom or proportional scroll adjustment trigger the scroll
    // handler, which calls this method again redundantly).
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const { scrollTop, clientHeight } = this.scrollContainer;
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

      // Reset all cards
      for (const card of this.cardPool) {
        card.style.display = 'none';
      }

      // Populate visible cards
      let poolIdx = 0;
      for (let i = startIdx; i < endIdx && i < this.entries.length; i++) {
        const entry = this.entries[i];
        const card = this.cardPool[poolIdx++];
        if (!entry || !card) continue;

        const top = i === 0 ? 0 : (this.cumulativeHeights[i - 1] ?? 0);
        card.style.top = `${top}px`;
        card.style.display = 'block';

        this.populateCard(card, entry);
      }
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

    // Find the entry index from the card position
    const poolIdx = this.cardPool.indexOf(card);
    if (poolIdx === -1) return;

    // Get the visible range to determine the entry
    const { scrollTop } = this.scrollContainer;
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
    const startIdx = Math.max(0, firstVisible - 10);
    const entryIdx = startIdx + poolIdx;
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

  private readonly handleScroll = (): void => {
    this.updateVisibleCards();
    if (this.isAtBottom()) {
      this.newEventsIndicator.style.display = 'none';
    }
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
