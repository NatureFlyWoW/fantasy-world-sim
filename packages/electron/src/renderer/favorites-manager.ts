/**
 * Shared favorites manager for entity bookmarking.
 *
 * Handles localStorage persistence keyed by world seed and emits
 * UIEventBus notifications when favorites change.
 */
import { uiEvents } from './ui-events.js';

export class FavoritesManager {
  private favorites = new Set<number>();
  private worldSeed = 0;

  /**
   * Set the world seed and load favorites from localStorage.
   */
  setSeed(seed: number): void {
    this.worldSeed = seed;
    this.loadFavorites();
  }

  /**
   * Check if an entity is favorited.
   */
  isFavorite(id: number): boolean {
    return this.favorites.has(id);
  }

  /**
   * Toggle favorite status for an entity.
   * Emits 'favorite-changed' event on UIEventBus.
   */
  toggleFavorite(id: number): void {
    const wasFavorite = this.favorites.has(id);
    if (wasFavorite) {
      this.favorites.delete(id);
    } else {
      this.favorites.add(id);
    }
    this.saveFavorites();
    uiEvents.emit('favorite-changed', { entityId: id, isFavorite: !wasFavorite });
  }

  /**
   * Get the set of all favorited entity IDs (for read-only access).
   */
  getFavorites(): ReadonlySet<number> {
    return this.favorites;
  }

  /**
   * Get count of favorited entities.
   */
  getCount(): number {
    return this.favorites.size;
  }

  private loadFavorites(): void {
    try {
      const stored = localStorage.getItem(`favorites-${this.worldSeed}`);
      if (stored !== null) {
        const ids = JSON.parse(stored) as number[];
        this.favorites = new Set(ids);
      }
    } catch {
      // Ignore parse errors
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(
        `favorites-${this.worldSeed}`,
        JSON.stringify([...this.favorites]),
      );
    } catch {
      // Ignore storage errors
    }
  }
}
