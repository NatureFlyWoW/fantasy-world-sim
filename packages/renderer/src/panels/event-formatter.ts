/**
 * Event formatter for rendering WorldEvents as text.
 * Provides raw format, significance bar, and participant resolution.
 */

import { EventCategory, ticksToWorldTime } from '@fws/core';
import type { WorldEvent, World, WorldClock, EntityId } from '@fws/core';
import { CATEGORY_COLORS, getSignificanceColor } from '../theme.js';

/**
 * Category icons for display.
 */
export const CATEGORY_ICONS: Readonly<Record<EventCategory, string>> = {
  [EventCategory.Political]: '\u269C',    // ⚜
  [EventCategory.Military]: '\u2694',     // ⚔
  [EventCategory.Magical]: '\u2726',      // ✦
  [EventCategory.Cultural]: '\uD83C\uDFAD', // 🎭
  [EventCategory.Religious]: '\u271D',    // ✝
  [EventCategory.Economic]: '\uD83D\uDCB0', // 💰
  [EventCategory.Personal]: '\uD83D\uDC64', // 👤
  [EventCategory.Disaster]: '\uD83D\uDC80', // 💀
  [EventCategory.Scientific]: '\uD83D\uDD2C', // 🔬
  [EventCategory.Exploratory]: '\uD83D\uDDFA', // 🗺
} as const;

/**
 * Filled and empty block characters for significance bar.
 */
const FILLED_BLOCK = '\u2588'; // █
const EMPTY_BLOCK = '\u2591';  // ░

/**
 * Width of the significance bar in characters.
 */
const SIGNIFICANCE_BAR_WIDTH = 10;

/**
 * EventFormatter provides methods to format WorldEvents for display.
 */
export class EventFormatter {
  /**
   * Format an event as a raw log line.
   * Format: "Year 1247, Day 23: [icon] Event description"
   */
  formatRaw(event: WorldEvent, _clock: WorldClock): string {
    const time = ticksToWorldTime(event.timestamp);
    const icon = CATEGORY_ICONS[event.category];
    const description = this.getEventDescription(event);

    return `Year ${time.year}, Day ${time.day}: ${icon} ${description}`;
  }

  /**
   * Format an event as a raw log line with color codes for blessed.
   */
  formatRawColored(event: WorldEvent, _clock: WorldClock): string {
    const time = ticksToWorldTime(event.timestamp);
    const icon = CATEGORY_ICONS[event.category];
    const color = CATEGORY_COLORS[event.category];
    const description = this.getEventDescription(event);

    return `{${color}-fg}Year ${time.year}, Day ${time.day}: ${icon} ${description}{/}`;
  }

  /**
   * Format a significance bar.
   * Produces: "█████░░░░░ 50" with colored blocks.
   */
  formatSignificanceBar(significance: number): string {
    const clamped = Math.max(0, Math.min(100, significance));
    const filledCount = Math.round((clamped / 100) * SIGNIFICANCE_BAR_WIDTH);
    const emptyCount = SIGNIFICANCE_BAR_WIDTH - filledCount;

    const filled = FILLED_BLOCK.repeat(filledCount);
    const empty = EMPTY_BLOCK.repeat(emptyCount);

    return `${filled}${empty} ${Math.round(clamped)}`;
  }

  /**
   * Format a significance bar with color codes for blessed.
   */
  formatSignificanceBarColored(significance: number): string {
    const clamped = Math.max(0, Math.min(100, significance));
    const filledCount = Math.round((clamped / 100) * SIGNIFICANCE_BAR_WIDTH);
    const emptyCount = SIGNIFICANCE_BAR_WIDTH - filledCount;

    const color = getSignificanceColor(clamped);
    const filled = FILLED_BLOCK.repeat(filledCount);
    const empty = EMPTY_BLOCK.repeat(emptyCount);

    return `{${color}-fg}${filled}{/}{#666666-fg}${empty}{/} ${Math.round(clamped)}`;
  }

  /**
   * Format event participants as a string.
   * Resolves entity IDs to names using the World.
   */
  formatParticipants(event: WorldEvent, world: World): string {
    if (event.participants.length === 0) {
      return 'No participants';
    }

    const names = event.participants.map(id => this.resolveEntityName(id, world));

    if (names.length === 1) {
      return names[0] ?? 'Unknown';
    }

    if (names.length === 2) {
      return `${names[0] ?? 'Unknown'} and ${names[1] ?? 'Unknown'}`;
    }

    const allButLast = names.slice(0, -1).join(', ');
    const last = names[names.length - 1] ?? 'Unknown';
    return `${allButLast}, and ${last}`;
  }

  /**
   * Format the event location if available.
   */
  formatLocation(event: WorldEvent, world: World): string | null {
    if (event.location === undefined) {
      return null;
    }

    const name = this.resolveEntityName(event.location, world);
    return `at ${name}`;
  }

  /**
   * Get a human-readable description of an event.
   * Uses event.subtype and event.data to construct a description.
   */
  getEventDescription(event: WorldEvent): string {
    // Check if event.data has a description field
    const data = event.data as Record<string, unknown>;
    if (typeof data['description'] === 'string') {
      return data['description'];
    }

    // Build description from subtype
    const parts = event.subtype.split('.');
    if (parts.length >= 2) {
      const domain = parts[0];
      const action = parts.slice(1).join(' ').replace(/_/g, ' ');
      return `${this.capitalize(domain ?? '')}: ${action}`;
    }

    return event.subtype.replace(/_/g, ' ');
  }

  /**
   * Get the category color for an event.
   */
  getCategoryColor(event: WorldEvent): string {
    return CATEGORY_COLORS[event.category];
  }

  /**
   * Get the significance color for an event.
   */
  getSignificanceColor(event: WorldEvent): string {
    return getSignificanceColor(event.significance);
  }

  /**
   * Resolve an entity ID to a display name.
   */
  private resolveEntityName(entityId: EntityId | number, world: World): string {
    // Cast to EntityId for component lookup
    const id = entityId as EntityId;

    // Try to get a name from the Status component (titles)
    if (world.hasStore('Status')) {
      const status = world.getComponent(id, 'Status');
      if (status !== undefined) {
        const titles = (status as { titles?: string[] }).titles;
        if (titles !== undefined && titles.length > 0) {
          const title = titles[0];
          if (title !== undefined) {
            return title;
          }
        }
      }
    }

    // Try to get name from event data using entity ID pattern
    // Fallback to "Entity #ID"
    return `Entity #${entityId}`;
  }

  /**
   * Capitalize the first letter of a string.
   */
  private capitalize(str: string): string {
    if (str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Default formatter instance.
 */
export const defaultFormatter = new EventFormatter();
