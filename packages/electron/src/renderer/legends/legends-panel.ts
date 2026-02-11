/**
 * Legends Panel — controller for the Legends Viewer.
 *
 * Wires category tabs, search input, IPC data loading, and the virtual-scroll
 * renderer. Follows the same panel pattern as ChroniclePanel.
 */
import type { IpcClient } from '../ipc-client.js';
import type { LegendsSummary, InspectorQuery } from '../../shared/types.js';
import { LegendsStore } from './legends-store.js';
import type { LegendsCategory } from './legends-store.js';
import { LegendsRenderer } from './legends-renderer.js';
import { uiEvents } from '../ui-events.js';
import type { FavoritesManager } from '../favorites-manager.js';

const CATEGORIES: readonly LegendsCategory[] = [
  'favorites', 'characters', 'factions', 'sites', 'artifacts', 'deities',
];

const CATEGORY_LABELS: Record<LegendsCategory, string> = {
  favorites: 'Favorites',
  characters: 'Characters',
  factions: 'Factions',
  sites: 'Sites',
  artifacts: 'Artifacts',
  deities: 'Deities',
};

const CATEGORY_ICONS: Record<LegendsCategory, string> = {
  favorites: '\u2605',
  characters: '\u2694',
  factions: '\u2690',
  sites: '\u2302',
  artifacts: '\u2726',
  deities: '\u2727',
};

/**
 * Map entity type strings from the store to InspectorQuery types.
 */
function entityTypeToInspectorType(type: string): InspectorQuery['type'] | undefined {
  switch (type) {
    case 'character': return 'character';
    case 'faction': return 'faction';
    case 'site': return 'site';
    case 'artifact': return 'artifact';
    default: return undefined;
  }
}

export class LegendsPanel {
  private readonly ipc: IpcClient;
  private readonly store: LegendsStore;
  private readonly renderer: LegendsRenderer;
  private readonly container: HTMLElement;
  private readonly tabBar: HTMLElement;
  private readonly searchInput: HTMLInputElement;
  private readonly listContainer: HTMLElement;
  private readonly countLabel: HTMLElement;
  private readonly favoritesManager: FavoritesManager;

  private refreshPending = false;
  private initialized = false;

  constructor(container: HTMLElement, ipc: IpcClient, favoritesManager: FavoritesManager) {
    this.ipc = ipc;
    this.container = container;
    this.favoritesManager = favoritesManager;
    this.store = new LegendsStore(
      (id) => favoritesManager.isFavorite(id),
      () => favoritesManager.getCount(),
    );

    // ── Build DOM structure ──────────────────────────────────────────────

    // Category tabs
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'legends-tabs';

    for (const category of CATEGORIES) {
      const tab = document.createElement('button');
      tab.className = category === 'characters'
        ? 'legends-tab legends-tab--active'
        : 'legends-tab';
      tab.setAttribute('data-category', category);
      tab.innerHTML = `<span class="legends-tab__icon">${CATEGORY_ICONS[category]}</span><span class="legends-tab__label">${CATEGORY_LABELS[category]}</span>`;
      tab.addEventListener('click', () => this.setCategory(category));
      this.tabBar.appendChild(tab);
    }

    container.appendChild(this.tabBar);

    // Search bar
    const searchBar = document.createElement('div');
    searchBar.className = 'legends-search';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'legends-search__input';
    this.searchInput.placeholder = 'Search by name...';
    this.searchInput.addEventListener('input', () => {
      this.store.setSearchQuery(this.searchInput.value);
      this.scheduleRefresh();
    });

    this.countLabel = document.createElement('span');
    this.countLabel.className = 'legends-search__count';
    this.countLabel.textContent = '';

    searchBar.appendChild(this.searchInput);
    searchBar.appendChild(this.countLabel);
    container.appendChild(searchBar);

    // List container for virtual scroll
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'legends-list';
    container.appendChild(this.listContainer);

    // Renderer
    this.renderer = new LegendsRenderer(this.listContainer);

    this.renderer.onEntityClick = (id: number, type: string) => {
      const inspectorType = entityTypeToInspectorType(type);
      if (inspectorType !== undefined) {
        uiEvents.emit('inspect-entity', { type: inspectorType, id });
      }
    };

    this.renderer.onFavoriteToggle = (id: number) => {
      this.favoritesManager.toggleFavorite(id);
      this.scheduleRefresh();
    };

    // Listen for favorite changes from other components
    uiEvents.on('favorite-changed', () => {
      this.scheduleRefresh();
    });
  }

  /**
   * Initialize with world seed and load initial data.
   */
  async init(seed: number): Promise<void> {
    await this.loadData();
    this.initialized = true;
    this.executeRefresh();
  }

  /**
   * Called on each tick delta to incrementally update data.
   * Throttled to avoid excessive IPC calls.
   */
  onTick(): void {
    if (!this.initialized) return;
    // Refresh data periodically (not every tick for performance)
    // The panel will re-query on tab switch or search change
  }

  /**
   * Force a data refresh from the main process.
   */
  async refresh(): Promise<void> {
    await this.loadData();
    this.executeRefresh();
  }

  destroy(): void {
    this.renderer.destroy();
  }

  /**
   * Navigate to a specific entity in the legends viewer.
   * Switches to the correct category tab and scrolls to the entity.
   */
  navigateToEntity(id: number, type: string): void {
    // Map entity type to category
    let category: LegendsCategory;
    switch (type) {
      case 'character':
        category = 'characters';
        break;
      case 'faction':
        category = 'factions';
        break;
      case 'site':
        category = 'sites';
        break;
      case 'artifact':
        category = 'artifacts';
        break;
      case 'deity':
        category = 'deities';
        break;
      default:
        console.warn(`[legends] Unknown entity type for navigation: ${type}`);
        return;
    }

    // Switch to the category
    this.setCategory(category);

    // TODO: Scroll to the entity after render completes
    // This would require the renderer to expose a scrollToEntity method
    // For now, switching to the category is sufficient
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private setCategory(category: LegendsCategory): void {
    this.store.setActiveCategory(category);
    this.updateTabStates();
    this.renderer.scrollToTop();
    // Re-fetch data when switching to ensure freshness
    void this.loadData().then(() => this.executeRefresh());
  }

  private updateTabStates(): void {
    const active = this.store.getActiveCategory();
    const tabs = this.tabBar.querySelectorAll('.legends-tab');
    tabs.forEach((tab) => {
      if (!(tab instanceof HTMLElement)) return;
      const cat = tab.getAttribute('data-category');
      if (cat === active) {
        tab.classList.add('legends-tab--active');
      } else {
        tab.classList.remove('legends-tab--active');
      }
    });
  }

  private async loadData(): Promise<void> {
    try {
      const data: LegendsSummary = await this.ipc.queryLegends();
      this.store.setData(data);
    } catch (err) {
      console.error('[legends] Failed to load data:', err);
    }
  }

  private scheduleRefresh(): void {
    if (this.refreshPending) return;
    this.refreshPending = true;
    requestAnimationFrame(() => {
      this.refreshPending = false;
      this.executeRefresh();
    });
  }

  private executeRefresh(): void {
    const entries = this.store.getEntries();
    const category = this.store.getActiveCategory();

    // Update count label
    const totalCount = this.store.getCategoryCount(category);
    const displayCount = entries.length;
    if (this.store.getSearchQuery().length > 0) {
      this.countLabel.textContent = `${displayCount} / ${totalCount}`;
    } else {
      this.countLabel.textContent = `${totalCount}`;
    }

    // Show favorites separator only when not in favorites tab and favorites exist
    const showSeparator = category !== 'favorites' && this.store.getFavoriteCount() > 0;

    if (entries.length === 0) {
      if (this.store.getSearchQuery().length > 0) {
        this.renderer.renderEmpty('No matching entities.');
      } else if (category === 'favorites') {
        this.renderer.renderEmpty('No favorites yet. Star entities to track them here.');
      } else {
        this.renderer.renderEmpty('No entities in this category.');
      }
    } else {
      this.renderer.render(entries, showSeparator);
    }
  }

}
