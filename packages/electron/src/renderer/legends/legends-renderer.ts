/**
 * Legends Renderer — virtual-scroll list renderer for entity entries.
 *
 * Uses a fixed-height card pool pattern (same approach as chronicle-renderer.ts)
 * for smooth scrolling with hundreds of entities.
 *
 * Each entity row is ~36px tall with: Name, Detail1, Detail2, Star button.
 * A separator row ("-- Favorites (N) --") divides favorites from the rest.
 */
import type { LegendsEntry } from './legends-store.js';

const ROW_HEIGHT = 36;
const SEPARATOR_HEIGHT = 28;
const POOL_SIZE = 60;

export type LegendRowKind = 'entity' | 'separator';

export interface LegendRow {
  readonly kind: LegendRowKind;
  /** Only set for entity rows */
  readonly entry?: LegendsEntry;
  /** Only set for separator rows */
  readonly text?: string;
}

export class LegendsRenderer {
  private readonly scrollContainer: HTMLElement;
  private readonly contentDiv: HTMLElement;
  private readonly cardPool: HTMLElement[] = [];
  private rows: readonly LegendRow[] = [];
  private cumulativeHeights: number[] = [];

  private isUpdating = false;
  private scrollRafPending = false;
  private prevStartIdx = -1;
  private prevEndIdx = -1;
  private entryToCard = new Map<number, number>();
  private dataGeneration = 0;
  private lastRenderedGeneration = -1;

  public onEntityClick: ((id: number, type: string) => void) | null = null;
  public onFavoriteToggle: ((id: number) => void) | null = null;

  constructor(container: HTMLElement) {
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'legends-scroll';

    this.contentDiv = document.createElement('div');
    this.contentDiv.className = 'legends-scroll__content';
    this.scrollContainer.appendChild(this.contentDiv);

    container.appendChild(this.scrollContainer);

    // Create card pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const card = document.createElement('div');
      card.style.position = 'absolute';
      card.style.left = '0';
      card.style.width = '100%';
      card.style.display = 'none';
      this.contentDiv.appendChild(card);
      this.cardPool.push(card);
    }

    // Event delegation
    this.scrollContainer.addEventListener('click', this.handleClick);
    this.scrollContainer.addEventListener('scroll', this.handleScroll);
  }

  /**
   * Render entity rows with optional favorites separator.
   */
  render(entries: readonly LegendsEntry[], showFavoritesSeparator: boolean): void {
    // Build row list with optional separator
    const rows: LegendRow[] = [];

    if (showFavoritesSeparator) {
      const favs = entries.filter(e => e.isFavorite);
      const rest = entries.filter(e => !e.isFavorite);

      if (favs.length > 0) {
        rows.push({ kind: 'separator', text: `Favorites (${favs.length})` });
        for (const entry of favs) {
          rows.push({ kind: 'entity', entry });
        }
      }

      if (rest.length > 0) {
        const totalLabel = entries.length - favs.length;
        rows.push({ kind: 'separator', text: `All (${totalLabel})` });
        for (const entry of rest) {
          rows.push({ kind: 'entity', entry });
        }
      }
    } else {
      for (const entry of entries) {
        rows.push({ kind: 'entity', entry });
      }
    }

    this.rows = rows;
    this.dataGeneration++;

    // Compute cumulative heights
    this.cumulativeHeights = [];
    let total = 0;
    for (const row of rows) {
      const height = row.kind === 'separator' ? SEPARATOR_HEIGHT : ROW_HEIGHT;
      total += height;
      this.cumulativeHeights.push(total);
    }

    this.contentDiv.style.height = `${total}px`;
    this.updateVisibleCards();
  }

  /**
   * Render an empty state message.
   */
  renderEmpty(message: string): void {
    this.rows = [];
    this.dataGeneration++;
    this.cumulativeHeights = [];
    this.contentDiv.style.height = '100%';

    // Hide all pool cards
    for (const card of this.cardPool) {
      card.style.display = 'none';
    }
    this.entryToCard.clear();
    this.prevStartIdx = -1;
    this.prevEndIdx = -1;

    // Show empty message in first card
    const card = this.cardPool[0];
    if (card !== undefined) {
      card.className = 'legends-empty';
      card.textContent = message;
      card.style.position = 'relative';
      card.style.display = 'flex';
      card.style.top = '';
    }
  }

  scrollToTop(): void {
    this.scrollContainer.scrollTop = 0;
  }

  destroy(): void {
    this.scrollContainer.removeEventListener('click', this.handleClick);
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    this.cardPool.length = 0;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private updateVisibleCards(): void {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
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

      const startIdx = Math.max(0, firstVisible - 5);
      let endIdx = startIdx;
      while (endIdx < this.rows.length) {
        const height = this.cumulativeHeights[endIdx];
        if (height === undefined || height > viewportEnd + 200) break;
        endIdx++;
      }

      const forceRepopulate = this.lastRenderedGeneration !== this.dataGeneration;

      if (forceRepopulate) {
        this.lastRenderedGeneration = this.dataGeneration;
        this.entryToCard.clear();

        for (const card of this.cardPool) {
          card.style.display = 'none';
        }

        let poolIdx = 0;
        for (let i = startIdx; i < endIdx && i < this.rows.length; i++) {
          const row = this.rows[i];
          const card = this.cardPool[poolIdx];
          if (row === undefined || card === undefined) continue;

          const top = i === 0 ? 0 : (this.cumulativeHeights[i - 1] ?? 0);
          card.style.position = 'absolute';
          card.style.top = `${top}px`;
          card.style.display = '';
          this.populateCard(card, row);
          this.entryToCard.set(i, poolIdx);
          poolIdx++;
        }
      } else {
        // Differential update
        const prevStart = this.prevStartIdx;
        const prevEnd = this.prevEndIdx;
        const freedPool: number[] = [];

        for (let i = prevStart; i < prevEnd; i++) {
          if (i < startIdx || i >= endIdx) {
            const poolIdx = this.entryToCard.get(i);
            if (poolIdx !== undefined) {
              const card = this.cardPool[poolIdx];
              if (card !== undefined) card.style.display = 'none';
              freedPool.push(poolIdx);
              this.entryToCard.delete(i);
            }
          }
        }

        let freeIdx = 0;
        for (let i = startIdx; i < endIdx && i < this.rows.length; i++) {
          if (this.entryToCard.has(i)) continue;

          let poolIdx: number | undefined;
          if (freeIdx < freedPool.length) {
            poolIdx = freedPool[freeIdx++];
          } else {
            for (let p = 0; p < this.cardPool.length; p++) {
              const card = this.cardPool[p];
              if (card !== undefined && card.style.display === 'none') {
                poolIdx = p;
                break;
              }
            }
          }

          if (poolIdx === undefined) break;

          const row = this.rows[i];
          const card = this.cardPool[poolIdx];
          if (row === undefined || card === undefined) continue;

          const top = i === 0 ? 0 : (this.cumulativeHeights[i - 1] ?? 0);
          card.style.position = 'absolute';
          card.style.top = `${top}px`;
          card.style.display = '';
          this.populateCard(card, row);
          this.entryToCard.set(i, poolIdx);
        }
      }

      this.prevStartIdx = startIdx;
      this.prevEndIdx = endIdx;
    } finally {
      this.isUpdating = false;
    }
  }

  private populateCard(card: HTMLElement, row: LegendRow): void {
    card.className = '';
    card.innerHTML = '';

    if (row.kind === 'separator') {
      card.className = 'legends-separator';
      const span = document.createElement('span');
      span.className = 'legends-separator__text';
      span.textContent = row.text ?? '';
      card.appendChild(span);
      return;
    }

    const entry = row.entry;
    if (entry === undefined) return;

    card.className = 'legends-row';
    card.setAttribute('data-entity-id', String(entry.id));
    card.setAttribute('data-entity-type', entry.entityType);

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'legends-row__name';
    nameSpan.textContent = entry.name;

    // Detail 1
    const detail1Span = document.createElement('span');
    detail1Span.className = 'legends-row__detail';
    detail1Span.textContent = entry.detail1;

    // Detail 2
    const detail2Span = document.createElement('span');
    detail2Span.className = 'legends-row__detail';
    detail2Span.textContent = entry.detail2;

    // Star button
    const starBtn = document.createElement('button');
    starBtn.className = entry.isFavorite ? 'legends-row__star legends-row__star--active' : 'legends-row__star';
    starBtn.setAttribute('data-fav-id', String(entry.id));
    starBtn.textContent = entry.isFavorite ? '\u2605' : '\u2606';
    starBtn.title = entry.isFavorite ? 'Remove from favorites' : 'Add to favorites';

    card.appendChild(nameSpan);
    card.appendChild(detail1Span);
    card.appendChild(detail2Span);
    card.appendChild(starBtn);
  }

  private readonly handleClick = (e: Event): void => {
    const target = e.target as HTMLElement;

    // Star button click
    if (target.classList.contains('legends-row__star')) {
      e.stopPropagation();
      const idStr = target.getAttribute('data-fav-id');
      if (idStr !== null) {
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          this.onFavoriteToggle?.(id);
        }
      }
      return;
    }

    // Row click -> inspect entity
    const row = target.closest('.legends-row');
    if (row instanceof HTMLElement) {
      const idStr = row.getAttribute('data-entity-id');
      const typeStr = row.getAttribute('data-entity-type');
      if (idStr !== null && typeStr !== null) {
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          this.onEntityClick?.(id, typeStr);
        }
      }
    }
  };

  private readonly handleScroll = (): void => {
    if (this.scrollRafPending) return;
    this.scrollRafPending = true;
    requestAnimationFrame(() => {
      this.scrollRafPending = false;
      this.updateVisibleCards();
    });
  };
}
