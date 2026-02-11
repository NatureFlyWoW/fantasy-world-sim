/**
 * Inspector panel — renderer-side entity inspector.
 *
 * Fetches entity data via IPC, renders it as HTML with collapsible sections,
 * breadcrumb navigation, entity-link parsing, and keyboard shortcuts.
 *
 * Design spec: all_docs/graphics_ui/08-inspector-system.md
 */
import type { IpcClient } from '../ipc-client.js';
import type { InspectorQuery, InspectorResponse, InspectorSection } from '../../shared/types.js';
import type { FavoritesManager } from '../favorites-manager.js';
import { uiEvents } from '../ui-events.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

/**
 * Default number of sections to show expanded when a new entity is loaded.
 * Sections at index >= this value start collapsed.
 */
const DEFAULT_EXPANDED_COUNT = 2;

/** Entity type colors matching the design palette (08-inspector-system.md 8.2). */
const ENTITY_TYPE_COLORS: Record<string, string> = {
  character: '#6888c8',  // CS
  faction:   '#d4a832',  // CP
  site:      '#c9a84c',  // AU2
  artifact:  '#9040cc',  // FM
  event:     '#8a8a90',  // N2
  region:    '#3aad6a',  // CE
};

/** ASCII-style entity type icons. */
const ENTITY_TYPE_ICONS: Record<string, string> = {
  character: '@',
  faction:   '&',
  site:      '#',
  artifact:  '*',
  event:     '!',
  region:    '~',
};

/** Entity type display labels for the header. */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  character: 'CHARACTER',
  faction:   'FACTION',
  site:      'SETTLEMENT',
  artifact:  'ARTIFACT',
  event:     'EVENT',
  region:    'REGION',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface NavEntry {
  readonly query: InspectorQuery;
  readonly entityName: string;
}

// ── Panel ────────────────────────────────────────────────────────────────────

export class InspectorPanel {
  private history: NavEntry[] = [];
  private historyIndex = -1;
  private collapsedSections = new Set<string>();
  private currentResponse: InspectorResponse | null = null;
  private readonly ipc: IpcClient;
  private readonly contentEl: HTMLDivElement;
  private readonly favoritesManager: FavoritesManager;

  constructor(ipc: IpcClient, favoritesManager: FavoritesManager) {
    this.ipc = ipc;
    this.favoritesManager = favoritesManager;

    const el = document.querySelector('#inspector-panel .panel-content');
    if (!(el instanceof HTMLDivElement)) {
      throw new Error('InspectorPanel requires #inspector-panel .panel-content element');
    }
    this.contentEl = el;

    this.bindClicks();
    this.bindKeyboard();

    // Listen for favorite changes from other components
    uiEvents.on('favorite-changed', () => {
      // Re-render to update the star button if currently viewing a favorited entity
      if (this.currentResponse !== null) {
        this.render();
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Navigate to an entity. Pushes to history, fetches data, and renders.
   */
  async inspect(query: InspectorQuery): Promise<void> {
    const response = await this.ipc.queryInspector(query);
    this.currentResponse = response;

    // Reset collapsed state: first N sections expanded, rest collapsed
    this.collapsedSections.clear();
    for (let i = DEFAULT_EXPANDED_COUNT; i < response.sections.length; i++) {
      this.collapsedSections.add(`section-${i}`);
    }

    // Truncate forward history and push new entry
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push({ query, entityName: response.entityName });

    // Enforce max history
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY);
    }
    this.historyIndex = this.history.length - 1;

    this.render();
  }

  /**
   * Navigate backward in history.
   */
  back(): void {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    const entry = this.history[this.historyIndex];
    if (entry === undefined) return;

    // Re-fetch to get current data (entity may have changed)
    this.ipc.queryInspector(entry.query).then((response) => {
      this.currentResponse = response;
      this.collapsedSections.clear();
      for (let i = DEFAULT_EXPANDED_COUNT; i < response.sections.length; i++) {
        this.collapsedSections.add(`section-${i}`);
      }
      this.render();
    }).catch((err: unknown) => {
      console.error('[inspector] back() failed:', err);
    });
  }

  /**
   * Clear the inspector, returning to the empty state.
   */
  clear(): void {
    this.currentResponse = null;
    this.history = [];
    this.historyIndex = -1;
    this.collapsedSections.clear();
    this.render();
  }

  /**
   * If the current inspected entity is a site or region with coordinates,
   * return its location. Used by the map to center on the entity.
   */
  getCurrentLocation(): { x: number; y: number } | null {
    if (this.currentResponse === null) return null;

    // Look for coordinate data in sections
    for (const section of this.currentResponse.sections) {
      const coordMatch = section.content.match(/\bcoordinates?:\s*\((\d+),\s*(\d+)\)/i);
      if (coordMatch !== null) {
        const x = Number(coordMatch[1]);
        const y = Number(coordMatch[2]);
        if (!Number.isNaN(x) && !Number.isNaN(y)) {
          return { x, y };
        }
      }
    }

    return null;
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  private render(): void {
    if (this.currentResponse === null) {
      this.contentEl.innerHTML = '<div class="inspector-empty">Select an entity to inspect...</div>';
      return;
    }

    const response = this.currentResponse;
    const typeColor = ENTITY_TYPE_COLORS[response.entityType] ?? '#8a8a90';
    const typeIcon = ENTITY_TYPE_ICONS[response.entityType] ?? '?';
    const typeLabel = ENTITY_TYPE_LABELS[response.entityType] ?? response.entityType.toUpperCase();

    const parts: string[] = [];

    // Breadcrumbs
    parts.push(this.renderBreadcrumbs());

    // Entity type header
    parts.push(
      '<div class="inspector-type-header">',
      `  <span class="inspector-type-icon" style="color: ${typeColor}">${this.escapeHtml(typeIcon)}</span>`,
      `  <span class="inspector-type-label" style="color: ${typeColor}">${this.escapeHtml(typeLabel)}</span>`,
      `  <span class="inspector-type-line" style="background: linear-gradient(90deg, ${typeColor}, transparent)"></span>`,
      '</div>',
    );

    // Entity name header with favorite star button and "View in Legends" button
    const currentEntry = this.history[this.historyIndex];
    const entityId = currentEntry?.query.id;
    const isFavorite = entityId !== undefined && this.favoritesManager.isFavorite(entityId);
    const starIcon = isFavorite ? '\u2605' : '\u2606'; // ★ or ☆
    const starClass = isFavorite ? 'inspector-favorite-star inspector-favorite-star--active' : 'inspector-favorite-star';

    // Only show "View in Legends" button for entity types that appear in legends (not events/regions)
    const showLegendsButton = ['character', 'faction', 'site', 'artifact'].includes(response.entityType) && entityId !== undefined;

    parts.push('<div class="inspector-entity-header">');
    parts.push(`  <h2 class="inspector-entity-name">${this.escapeHtml(response.entityName)}</h2>`);
    parts.push('  <div class="inspector-entity-actions">');
    if (entityId !== undefined) {
      parts.push(`    <button class="${starClass}" data-entity-id="${entityId}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">${starIcon}</button>`);
    }
    if (showLegendsButton) {
      parts.push(
        `    <button class="inspector-legends-btn" data-entity-id="${entityId}" data-entity-type="${this.escapeHtml(response.entityType)}" title="View in Legends Viewer">`,
        '      <span class="inspector-legends-btn__icon">\u2726</span>',
        '      <span class="inspector-legends-btn__label">Legends</span>',
        '    </button>',
      );
    }
    parts.push('  </div>');
    parts.push('</div>');

    // Summary
    if (response.summary.length > 0) {
      parts.push(`<p class="inspector-entity-summary">${this.parseEntityMarkers(this.escapeHtml(response.summary))}</p>`);
    }

    // Sections
    if (response.sections.length > 0) {
      parts.push('<div class="inspector-sections">');
      for (let i = 0; i < response.sections.length; i++) {
        const section = response.sections[i];
        if (section === undefined) continue;
        const sectionId = `section-${i}`;
        const collapsed = this.collapsedSections.has(sectionId);
        parts.push(this.renderSection(section, i, collapsed));
      }
      parts.push('</div>');
    }

    // Prose
    if (response.prose.length > 0) {
      parts.push('<div class="inspector-prose">');
      for (const paragraph of response.prose) {
        parts.push(`<p class="inspector-prose__paragraph">${this.parseEntityMarkers(this.escapeHtml(paragraph))}</p>`);
      }
      parts.push('</div>');
    }

    // Related entities
    if (response.relatedEntities.length > 0) {
      parts.push('<div class="inspector-related">');
      parts.push('<div class="inspector-related__header">Related</div>');
      parts.push('<div class="inspector-related__list">');
      for (const ref of response.relatedEntities) {
        const refColor = ENTITY_TYPE_COLORS[ref.type] ?? '#8a8a90';
        const refIcon = ENTITY_TYPE_ICONS[ref.type] ?? '?';
        parts.push(
          `<span class="entity-link" data-entity-type="${this.escapeHtml(ref.type)}" data-entity-id="${ref.id}" style="color: ${refColor}">`,
          `  <span class="entity-link__icon">${this.escapeHtml(refIcon)}</span>`,
          `  ${this.escapeHtml(ref.name)}`,
          '</span>',
        );
      }
      parts.push('</div>');
      parts.push('</div>');
    }

    this.contentEl.innerHTML = parts.join('\n');

    // Scroll to top on new entity
    this.contentEl.scrollTop = 0;
  }

  private renderBreadcrumbs(): string {
    if (this.history.length <= 1) return '';

    const parts: string[] = ['<div class="inspector-breadcrumbs">'];

    // Back button
    if (this.historyIndex > 0) {
      parts.push('<span class="inspector-breadcrumbs__back" title="Back (Backspace)">&lt;</span>');
    }

    // Show up to last 4 history entries as breadcrumb trail
    const startIdx = Math.max(0, this.historyIndex - 3);
    for (let i = startIdx; i <= this.historyIndex; i++) {
      const entry = this.history[i];
      if (entry === undefined) continue;

      if (i > startIdx) {
        parts.push('<span class="inspector-breadcrumbs__sep">&gt;</span>');
      }

      const isCurrent = i === this.historyIndex;
      if (isCurrent) {
        parts.push(
          `<span class="inspector-breadcrumbs__item inspector-breadcrumbs__item--current">${this.escapeHtml(entry.entityName)}</span>`,
        );
      } else {
        parts.push(
          `<span class="inspector-breadcrumbs__item" data-history-index="${i}">${this.escapeHtml(entry.entityName)}</span>`,
        );
      }
    }

    parts.push('</div>');
    return parts.join('\n');
  }

  private renderSection(section: InspectorSection, index: number, collapsed: boolean): string {
    const sectionId = `section-${index}`;
    const arrowChar = collapsed ? '&gt;' : 'v';
    const arrowClass = collapsed ? ' inspector-section__arrow--collapsed' : '';
    const bodyDisplay = collapsed ? 'none' : 'block';
    const numberDisplay = index + 1;

    const parts: string[] = [
      '<div class="inspector-section">',
      `  <div class="inspector-section__header" data-section-id="${sectionId}">`,
      `    <span class="inspector-section__arrow${arrowClass}">${arrowChar}</span>`,
      `    <span class="inspector-section__number">[${numberDisplay}]</span>`,
      `    <span class="inspector-section__title">${this.escapeHtml(section.title)}</span>`,
      '    <span class="inspector-section__line"></span>',
      '  </div>',
      `  <div class="inspector-section__body" style="display: ${bodyDisplay}">`,
      `    ${this.parseEntityMarkers(this.escapeHtml(section.content))}`,
      '  </div>',
      '</div>',
    ];

    return parts.join('\n');
  }

  // ── Text Processing ──────────────────────────────────────────────────────

  /**
   * Convert `[[e:TYPE:ID:NAME]]` markers to clickable HTML spans.
   *
   * Entity markers are inserted by the main-process inspector serializer
   * to allow cross-entity navigation from within prose and section content.
   */
  private parseEntityMarkers(text: string): string {
    return text.replace(
      /\[\[e:(\w+):(\d+):([^\]]+)\]\]/g,
      (_match, type: string, id: string, name: string) => {
        const color = ENTITY_TYPE_COLORS[type] ?? '#8a8a90';
        return `<span class="entity-link" data-entity-type="${this.escapeHtml(type)}" data-entity-id="${id}" style="color: ${color}">${this.escapeHtml(name)}</span>`;
      },
    );
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Event Handling ───────────────────────────────────────────────────────

  private bindClicks(): void {
    // Entity link clicks (event delegation)
    this.contentEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Favorite star button
      const starBtn = target.closest('.inspector-favorite-star') as HTMLElement | null;
      if (starBtn !== null) {
        const idStr = starBtn.dataset.entityId;
        if (idStr !== undefined) {
          const id = Number(idStr);
          if (!Number.isNaN(id)) {
            this.favoritesManager.toggleFavorite(id);
            // Render will be triggered by the favorite-changed event listener
          }
        }
        return;
      }

      // "View in Legends" button
      const legendsBtn = target.closest('.inspector-legends-btn') as HTMLElement | null;
      if (legendsBtn !== null) {
        const idStr = legendsBtn.dataset.entityId;
        const typeStr = legendsBtn.dataset.entityType;
        if (idStr !== undefined && typeStr !== undefined) {
          const id = Number(idStr);
          if (!Number.isNaN(id)) {
            uiEvents.emit('view-in-legends', { entityId: id, entityType: typeStr });
          }
        }
        return;
      }

      // Entity link navigation
      const link = target.closest('.entity-link') as HTMLElement | null;
      if (link !== null) {
        const type = link.dataset.entityType as InspectorQuery['type'] | undefined;
        const idStr = link.dataset.entityId;
        if (type !== undefined && idStr !== undefined) {
          const id = Number(idStr);
          if (!Number.isNaN(id)) {
            void this.inspect({ type, id });
          }
        }
        return;
      }

      // Section header toggle
      const header = target.closest('.inspector-section__header') as HTMLElement | null;
      if (header !== null) {
        const sectionId = header.dataset.sectionId;
        if (sectionId !== undefined) {
          if (this.collapsedSections.has(sectionId)) {
            this.collapsedSections.delete(sectionId);
          } else {
            this.collapsedSections.add(sectionId);
          }
          this.render();
        }
        return;
      }

      // Back button
      const back = target.closest('.inspector-breadcrumbs__back') as HTMLElement | null;
      if (back !== null) {
        this.back();
        return;
      }

      // Breadcrumb item click (navigate to history entry)
      const breadcrumbItem = target.closest('.inspector-breadcrumbs__item') as HTMLElement | null;
      if (breadcrumbItem !== null && !breadcrumbItem.classList.contains('inspector-breadcrumbs__item--current')) {
        const indexStr = breadcrumbItem.dataset.historyIndex;
        if (indexStr !== undefined) {
          const idx = Number(indexStr);
          if (!Number.isNaN(idx) && idx >= 0 && idx < this.history.length) {
            this.historyIndex = idx;
            const entry = this.history[idx];
            if (entry !== undefined) {
              this.ipc.queryInspector(entry.query).then((response) => {
                this.currentResponse = response;
                this.collapsedSections.clear();
                for (let i = DEFAULT_EXPANDED_COUNT; i < response.sections.length; i++) {
                  this.collapsedSections.add(`section-${i}`);
                }
                this.render();
              }).catch((err: unknown) => {
                console.error('[inspector] breadcrumb navigation failed:', err);
              });
            }
          }
        }
        return;
      }

    });
  }

  private bindKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // Only handle if inspector has content
      if (this.currentResponse === null) return;

      // Backspace: navigate back
      if (e.code === 'Backspace') {
        // Do not intercept if user is typing in an input
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) return;

        e.preventDefault();
        this.back();
        return;
      }

      // 1-9: toggle sections
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        // Do not intercept if user is typing in an input
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) return;

        const sectionIndex = num - 1;
        const section = this.currentResponse.sections[sectionIndex];
        if (section !== undefined) {
          const id = `section-${sectionIndex}`;
          if (this.collapsedSections.has(id)) {
            this.collapsedSections.delete(id);
          } else {
            this.collapsedSections.add(id);
          }
          this.render();
        }
      }
    });
  }
}
