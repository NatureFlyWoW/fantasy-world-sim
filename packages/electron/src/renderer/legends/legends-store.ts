/**
 * Legends data store.
 *
 * Holds the current LegendsSummary, favorites set, search/filter state,
 * and provides sorted/filtered entity lists for rendering.
 */
import type {
  LegendsSummary,
  CharacterSummary,
  FactionSummary,
  SiteSummary,
  ArtifactSummary,
  DeitySummary,
} from '../../shared/types.js';

export type LegendsCategory = 'favorites' | 'characters' | 'factions' | 'sites' | 'artifacts' | 'deities';

export interface LegendsEntry {
  readonly id: number;
  readonly name: string;
  readonly detail1: string;
  readonly detail2: string;
  readonly isFavorite: boolean;
  /** Entity type for inspector dispatch */
  readonly entityType: 'character' | 'faction' | 'site' | 'artifact' | 'deity';
}

export class LegendsStore {
  private data: LegendsSummary = {
    characters: [],
    factions: [],
    sites: [],
    artifacts: [],
    deities: [],
  };

  private searchQuery = '';
  private activeCategory: LegendsCategory = 'characters';
  private readonly isFavoriteFn: (id: number) => boolean;
  private readonly getFavoriteCountFn: () => number;

  constructor(isFavorite: (id: number) => boolean, getFavoriteCount: () => number) {
    this.isFavoriteFn = isFavorite;
    this.getFavoriteCountFn = getFavoriteCount;
  }

  /**
   * Update with fresh legends data from the main process.
   */
  setData(data: LegendsSummary): void {
    this.data = data;
  }

  getData(): LegendsSummary {
    return this.data;
  }

  getActiveCategory(): LegendsCategory {
    return this.activeCategory;
  }

  setActiveCategory(category: LegendsCategory): void {
    this.activeCategory = category;
  }

  getSearchQuery(): string {
    return this.searchQuery;
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
  }

  isFavorite(id: number): boolean {
    return this.isFavoriteFn(id);
  }

  getFavoriteCount(): number {
    return this.getFavoriteCountFn();
  }

  /**
   * Get filtered + sorted entries for the current category.
   *
   * Filtering: case-insensitive substring match on name.
   * Sorting: favorites first, then alphabetical by name.
   */
  getEntries(): LegendsEntry[] {
    const query = this.searchQuery.toLowerCase();

    if (this.activeCategory === 'favorites') {
      return this.getAllFavoriteEntries(query);
    }

    const raw = this.getRawEntries(this.activeCategory);
    return this.filterAndSort(raw, query);
  }

  /**
   * Get a count label for the current category (total matching items).
   */
  getCategoryCount(category: LegendsCategory): number {
    if (category === 'favorites') return this.getFavoriteCountFn();
    switch (category) {
      case 'characters': return this.data.characters.length;
      case 'factions': return this.data.factions.length;
      case 'sites': return this.data.sites.length;
      case 'artifacts': return this.data.artifacts.length;
      case 'deities': return this.data.deities.length;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private getRawEntries(category: LegendsCategory): LegendsEntry[] {
    switch (category) {
      case 'characters':
        return this.data.characters.map((c: CharacterSummary) => ({
          id: c.id,
          name: c.name,
          detail1: c.race,
          detail2: c.faction,
          isFavorite: this.isFavoriteFn(c.id),
          entityType: 'character' as const,
        }));
      case 'factions':
        return this.data.factions.map((f: FactionSummary) => ({
          id: f.id,
          name: f.name,
          detail1: f.governmentType,
          detail2: `${f.memberCount} members`,
          isFavorite: this.isFavoriteFn(f.id),
          entityType: 'faction' as const,
        }));
      case 'sites':
        return this.data.sites.map((s: SiteSummary) => ({
          id: s.id,
          name: s.name,
          detail1: s.siteType,
          detail2: s.ownerFaction,
          isFavorite: this.isFavoriteFn(s.id),
          entityType: 'site' as const,
        }));
      case 'artifacts':
        return this.data.artifacts.map((a: ArtifactSummary) => ({
          id: a.id,
          name: a.name,
          detail1: a.artifactType,
          detail2: a.currentOwner,
          isFavorite: this.isFavoriteFn(a.id),
          entityType: 'artifact' as const,
        }));
      case 'deities':
        return this.data.deities.map((d: DeitySummary) => ({
          id: d.id,
          name: d.name,
          detail1: d.domain,
          detail2: `${d.followerCount} followers`,
          isFavorite: this.isFavoriteFn(d.id),
          entityType: 'deity' as const,
        }));
      default:
        return [];
    }
  }

  /**
   * Build entries for all favorited entities across all categories.
   */
  private getAllFavoriteEntries(query: string): LegendsEntry[] {
    const all: LegendsEntry[] = [];

    for (const category of ['characters', 'factions', 'sites', 'artifacts', 'deities'] as const) {
      const entries = this.getRawEntries(category);
      for (const entry of entries) {
        if (entry.isFavorite) {
          all.push(entry);
        }
      }
    }

    const filtered = query.length > 0
      ? all.filter(e => e.name.toLowerCase().includes(query))
      : all;

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  private filterAndSort(entries: LegendsEntry[], query: string): LegendsEntry[] {
    const filtered = query.length > 0
      ? entries.filter(e => e.name.toLowerCase().includes(query))
      : entries;

    // Sort: favorites first, then alphabetical
    return filtered.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

}
