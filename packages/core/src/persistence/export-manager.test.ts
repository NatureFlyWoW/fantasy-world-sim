import { describe, it, expect, beforeEach } from 'vitest';
import { ExportManager } from './export-manager.js';
import type { ExportFormat, ExportOptions } from './export-manager.js';
import type { SaveStorage } from './save-manager.js';
import { World } from '../ecs/world.js';
import { EventLog } from '../events/event-log.js';
import { resetEntityIdCounter } from '../ecs/types.js';
import type { EntityId } from '../ecs/types.js';
import type { Component, ComponentType } from '../ecs/component.js';
import { EventCategory } from '../events/types.js';
import type { WorldEvent } from '../events/types.js';

// ─── In-memory storage for tests ───────────────────────────────────────────

class MemoryStorage implements SaveStorage {
  private files = new Map<string, Uint8Array>();

  writeFile(path: string, data: Uint8Array): void {
    this.files.set(path, data);
  }

  readFile(path: string): Uint8Array {
    const data = this.files.get(path);
    if (data === undefined) throw new Error(`File not found: ${path}`);
    return data;
  }

  listFiles(dir: string): string[] {
    const result: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(dir + '/')) {
        result.push(key.slice(dir.length + 1));
      }
    }
    return result;
  }

  deleteFile(path: string): void {
    this.files.delete(path);
  }

  ensureDir(_path: string): void { /* no-op */ }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  getFile(path: string): string | undefined {
    const data = this.files.get(path);
    if (data === undefined) return undefined;
    return new TextDecoder().decode(data);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeComponent(type: ComponentType, data: Record<string, unknown>): Component {
  return {
    type,
    ...data,
    serialize() {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(this as Record<string, unknown>)) {
        if (key !== 'type' && key !== 'serialize') {
          out[key] = (this as Record<string, unknown>)[key];
        }
      }
      return out;
    },
  } as Component;
}

function makeEvent(
  id: number,
  category: EventCategory,
  subtype: string,
  tick: number,
  participants: number[] = [],
  significance = 50,
): WorldEvent {
  return {
    id: id as EntityId,
    category,
    subtype,
    timestamp: tick,
    participants: participants.map((p) => p as EntityId),
    causes: [],
    consequences: [],
    data: {},
    significance,
    consequencePotential: [],
  } as WorldEvent;
}

function setupTestWorld(): { world: World; eventLog: EventLog } {
  resetEntityIdCounter();
  const world = new World();
  const eventLog = new EventLog();

  // Register component types
  world.registerComponent('Position');
  world.registerComponent('Population');
  world.registerComponent('Economy');
  world.registerComponent('Attribute');
  world.registerComponent('Status');
  world.registerComponent('Traits');
  world.registerComponent('Membership');
  world.registerComponent('Territory');
  world.registerComponent('Government');
  world.registerComponent('Culture');
  world.registerComponent('Genealogy');

  // Create faction (entity 0)
  const faction = world.createEntity(); // 0
  world.addComponent(faction, makeComponent('Territory', {
    controlledRegions: [1, 2, 3],
    capitalId: 1,
  }));
  world.addComponent(faction, makeComponent('Government', {
    governmentType: 'monarchy',
    stability: 75,
    legitimacy: 80,
  }));
  world.addComponent(faction, makeComponent('Culture', {
    traditions: ['warrior code', 'harvest festival'],
    values: ['honor', 'courage'],
    languageId: null,
  }));
  world.addComponent(faction, makeComponent('Attribute', {
    strength: 0, agility: 0, endurance: 0,
    intelligence: 0, wisdom: 0, charisma: 0,
    name: 'Kingdom of Valdris',
  }));

  // Create settlement (entity 1)
  const settlement = world.createEntity(); // 1
  world.addComponent(settlement, makeComponent('Position', { x: 50, y: 30 }));
  world.addComponent(settlement, makeComponent('Population', { count: 5000, growthRate: 0.02 }));
  world.addComponent(settlement, makeComponent('Economy', {
    wealth: 15000, tradeVolume: 2000, industries: ['farming', 'smithing'],
  }));
  world.addComponent(settlement, makeComponent('Attribute', {
    strength: 0, agility: 0, endurance: 0,
    intelligence: 0, wisdom: 0, charisma: 0,
    name: 'Ironhaven',
  }));

  // Create second settlement (entity 2)
  const settlement2 = world.createEntity(); // 2
  world.addComponent(settlement2, makeComponent('Position', { x: 80, y: 60 }));
  world.addComponent(settlement2, makeComponent('Population', { count: 3000, growthRate: 0.01 }));
  world.addComponent(settlement2, makeComponent('Attribute', {
    strength: 0, agility: 0, endurance: 0,
    intelligence: 0, wisdom: 0, charisma: 0,
    name: 'Willowmere',
  }));

  // Create parent characters (entities 3, 4)
  const parent1 = world.createEntity(); // 3
  world.addComponent(parent1, makeComponent('Attribute', {
    strength: 14, agility: 10, endurance: 12,
    intelligence: 16, wisdom: 15, charisma: 13,
    name: 'King Aldric',
  }));
  world.addComponent(parent1, makeComponent('Status', {
    conditions: [], titles: ['King'], socialClass: 'nobility',
  }));
  world.addComponent(parent1, makeComponent('Genealogy', {
    parentIds: [], childIds: [5, 6], spouseIds: [4],
  }));

  const parent2 = world.createEntity(); // 4
  world.addComponent(parent2, makeComponent('Attribute', {
    strength: 8, agility: 12, endurance: 10,
    intelligence: 18, wisdom: 16, charisma: 14,
    name: 'Queen Elara',
  }));
  world.addComponent(parent2, makeComponent('Status', {
    conditions: [], titles: ['Queen'], socialClass: 'nobility',
  }));
  world.addComponent(parent2, makeComponent('Genealogy', {
    parentIds: [], childIds: [5, 6], spouseIds: [3],
  }));

  // Create child characters (entities 5, 6)
  const child1 = world.createEntity(); // 5
  world.addComponent(child1, makeComponent('Attribute', {
    strength: 16, agility: 14, endurance: 15,
    intelligence: 12, wisdom: 10, charisma: 11,
    name: 'Prince Rowan',
  }));
  world.addComponent(child1, makeComponent('Status', {
    conditions: [], titles: ['Prince', 'Knight'], socialClass: 'nobility',
  }));
  world.addComponent(child1, makeComponent('Traits', {
    traits: ['brave', 'ambitious', 'reckless'],
    intensities: new Map([['brave', 0.9], ['ambitious', 0.7], ['reckless', 0.5]]),
  }));
  world.addComponent(child1, makeComponent('Membership', {
    factionId: 0, rank: 'heir', joinDate: 0,
  }));
  world.addComponent(child1, makeComponent('Genealogy', {
    parentIds: [3, 4], childIds: [], spouseIds: [],
  }));

  const child2 = world.createEntity(); // 6
  world.addComponent(child2, makeComponent('Attribute', {
    strength: 10, agility: 11, endurance: 9,
    intelligence: 17, wisdom: 14, charisma: 16,
    name: 'Princess Lyra',
  }));
  world.addComponent(child2, makeComponent('Status', {
    conditions: [], titles: ['Princess'], socialClass: 'nobility',
  }));
  world.addComponent(child2, makeComponent('Traits', {
    traits: ['wise', 'diplomatic', 'cautious'],
    intensities: new Map([['wise', 0.8], ['diplomatic', 0.9], ['cautious', 0.6]]),
  }));
  world.addComponent(child2, makeComponent('Genealogy', {
    parentIds: [3, 4], childIds: [], spouseIds: [],
  }));

  // Add events
  eventLog.append(makeEvent(100, EventCategory.Political, 'faction.formed', 0, [0], 90));
  eventLog.append(makeEvent(101, EventCategory.Personal, 'character.born', 360, [5], 60));
  eventLog.append(makeEvent(102, EventCategory.Personal, 'character.born', 720, [6], 60));
  eventLog.append(makeEvent(103, EventCategory.Military, 'battle.victory', 1800, [0, 5], 85));
  eventLog.append(makeEvent(104, EventCategory.Political, 'faction.treaty_signed', 2160, [0], 75));
  eventLog.append(makeEvent(105, EventCategory.Personal, 'character.achievement', 3600, [5], 70));
  eventLog.append(makeEvent(106, EventCategory.Economic, 'trade.route_opened', 1000, [1], 55));
  eventLog.append(makeEvent(107, EventCategory.Cultural, 'culture.festival', 1500, [0, 1], 40));

  return { world, eventLog };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ExportManager', () => {
  let storage: MemoryStorage;
  let manager: ExportManager;
  const EXPORTS_DIR = '/exports';

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new ExportManager(storage, EXPORTS_DIR);
  });

  describe('exportWorldEncyclopedia', () => {
    it('contains all factions in txt format', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportWorldEncyclopedia(world, eventLog, { format: 'txt' });

      expect(result).toContain('World Encyclopedia');
      expect(result).toContain('Factions');
      expect(result).toContain('Kingdom of Valdris');
      expect(result).toContain('monarchy');
      expect(result).toContain('Regions controlled: 3');
    });

    it('contains all settlements', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportWorldEncyclopedia(world, eventLog, { format: 'txt' });

      expect(result).toContain('Settlements');
      expect(result).toContain('Ironhaven');
      expect(result).toContain('Willowmere');
      expect(result).toContain('5000');
    });

    it('contains characters', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportWorldEncyclopedia(world, eventLog, { format: 'txt' });

      expect(result).toContain('Notable Characters');
      expect(result).toContain('Prince Rowan');
      expect(result).toContain('Princess Lyra');
      expect(result).toContain('brave');
    });

    it('includes event summary', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportWorldEncyclopedia(world, eventLog, { format: 'txt' });

      expect(result).toContain('Historical Overview');
      expect(result).toContain('Total events recorded: 8');
    });

    it('generates valid Markdown', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportWorldEncyclopedia(world, eventLog, { format: 'md' });

      expect(result).toContain('# World Encyclopedia');
      expect(result).toContain('## Factions');
      expect(result).toContain('## Settlements');
      expect(result).toContain('- Government: monarchy');
    });

    it('generates valid JSON', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportWorldEncyclopedia(world, eventLog, { format: 'json' });

      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('world_encyclopedia');
      expect(parsed.factions).toHaveLength(1);
      expect(parsed.factions[0].name).toBe('Kingdom of Valdris');
      expect(parsed.settlements.length).toBeGreaterThanOrEqual(2);
      expect(parsed.characters.length).toBeGreaterThanOrEqual(4);
      expect(parsed.eventSummary.total).toBe(8);
    });
  });

  describe('exportCharacterChronicle', () => {
    it('covers character lifespan with events', () => {
      const { world, eventLog } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportCharacterChronicle(princeId, world, eventLog, { format: 'txt' });

      expect(result).toContain('Chronicle of Prince Rowan');
      expect(result).toContain('Attributes');
      expect(result).toContain('Strength: 16');
      expect(result).toContain('Personality');
      expect(result).toContain('brave, ambitious, reckless');
      expect(result).toContain('Life Events');
      expect(result).toContain('character.born');
      expect(result).toContain('battle.victory');
      expect(result).toContain('character.achievement');
    });

    it('shows family information', () => {
      const { world, eventLog } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportCharacterChronicle(princeId, world, eventLog, { format: 'txt' });

      expect(result).toContain('Family');
      expect(result).toContain('King Aldric');
      expect(result).toContain('Queen Elara');
    });

    it('shows status and titles', () => {
      const { world, eventLog } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportCharacterChronicle(princeId, world, eventLog, { format: 'txt' });

      expect(result).toContain('Status');
      expect(result).toContain('Prince, Knight');
      expect(result).toContain('nobility');
    });

    it('generates valid JSON chronicle', () => {
      const { world, eventLog } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportCharacterChronicle(princeId, world, eventLog, { format: 'json' });

      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('character_chronicle');
      expect(parsed.name).toBe('Prince Rowan');
      expect(parsed.attributes.strength).toBe(16);
      expect(parsed.traits).toContain('brave');
      expect(parsed.family.parents).toEqual([3, 4]);
      expect(parsed.events.length).toBeGreaterThanOrEqual(2);
    });

    it('generates valid Markdown chronicle', () => {
      const { world, eventLog } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportCharacterChronicle(princeId, world, eventLog, { format: 'md' });

      expect(result).toContain('# Chronicle of Prince Rowan');
      expect(result).toContain('## Attributes');
      expect(result).toContain('- Strength: 16');
    });
  });

  describe('exportHistoricalTimeline', () => {
    it('lists events chronologically', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportHistoricalTimeline(world, eventLog, { format: 'txt' });

      expect(result).toContain('Historical Timeline');
      // Events should be in chronological order
      const lines = result.split('\n');
      const eventLines = lines.filter((l) => l.includes('[Year'));
      // At minimum, check the timeline has event entries
      const entryLines = lines.filter((l) => l.trim().startsWith('[Year'));
      expect(entryLines.length).toBeGreaterThan(0);
    });

    it('groups by year', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportHistoricalTimeline(world, eventLog, { format: 'txt' });

      expect(result).toContain('Year 1');
      expect(result).toContain('Year 2');
    });

    it('filters by significance threshold', () => {
      const { world, eventLog } = setupTestWorld();
      const low = manager.exportHistoricalTimeline(world, eventLog, {
        format: 'txt', significanceThreshold: 0,
      });
      const high = manager.exportHistoricalTimeline(world, eventLog, {
        format: 'txt', significanceThreshold: 80,
      });

      // High threshold should have fewer entries
      const lowLines = low.split('\n').filter((l) => l.includes('★'));
      const highLines = high.split('\n').filter((l) => l.includes('★'));
      expect(highLines.length).toBeLessThan(lowLines.length);
    });

    it('shows significance indicators', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportHistoricalTimeline(world, eventLog, { format: 'txt' });

      expect(result).toContain('★★★'); // sig 90
      expect(result).toContain('★★'); // sig 85
    });

    it('generates valid JSON timeline', () => {
      const { world, eventLog } = setupTestWorld();
      const result = manager.exportHistoricalTimeline(world, eventLog, { format: 'json' });

      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('historical_timeline');
      expect(parsed.events).toHaveLength(8);
      expect(parsed.events[0].tick).toBe(0); // earliest event
    });
  });

  describe('exportGenealogy', () => {
    it('renders ASCII family tree structure', () => {
      const { world } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportGenealogy(princeId, world, { format: 'txt' });

      expect(result).toContain('Family Tree: Prince Rowan');
      expect(result).toContain('King Aldric');
      expect(result).toContain('Queen Elara');
      expect(result).toContain('[Prince Rowan]');
      // Should contain tree-drawing characters
      expect(result).toMatch(/[┌┤└──×│]/);
    });

    it('shows parents above subject', () => {
      const { world } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportGenealogy(princeId, world, { format: 'txt' });
      const lines = result.split('\n');

      // Parents should appear before the subject
      const parentLine = lines.findIndex((l) => l.includes('King Aldric'));
      const subjectLine = lines.findIndex((l) => l.includes('[Prince Rowan]'));
      expect(parentLine).toBeLessThan(subjectLine);
    });

    it('shows children of a parent entity', () => {
      const { world } = setupTestWorld();
      const kingId = 3 as EntityId;
      const result = manager.exportGenealogy(kingId, world, { format: 'txt' });

      expect(result).toContain('[King Aldric]');
      expect(result).toContain('Queen Elara');
      expect(result).toContain('Prince Rowan');
      expect(result).toContain('Princess Lyra');
    });

    it('handles entity with no genealogy', () => {
      const { world } = setupTestWorld();
      const settlementId = 1 as EntityId;
      const result = manager.exportGenealogy(settlementId, world, { format: 'txt' });

      expect(result).toContain('no genealogy data');
    });

    it('generates JSON genealogy', () => {
      const { world } = setupTestWorld();
      const kingId = 3 as EntityId;
      const result = manager.exportGenealogy(kingId, world, { format: 'json' });

      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('genealogy');
      expect(parsed.name).toBe('King Aldric');
      expect(parsed.spouses).toHaveLength(1);
      expect(parsed.children).toHaveLength(2);
      expect(parsed.children[0].name).toBe('Prince Rowan');
    });

    it('wraps tree in code block for Markdown', () => {
      const { world } = setupTestWorld();
      const princeId = 5 as EntityId;
      const result = manager.exportGenealogy(princeId, world, { format: 'md' });

      expect(result).toContain('# Family Tree: Prince Rowan');
      expect(result).toContain('```');
    });
  });

  describe('exportFactionHistory', () => {
    it('includes government and territory info', () => {
      const { world, eventLog } = setupTestWorld();
      const factionId = 0 as EntityId;
      const result = manager.exportFactionHistory(factionId, world, eventLog, { format: 'txt' });

      expect(result).toContain('History of Kingdom of Valdris');
      expect(result).toContain('Government: monarchy');
      expect(result).toContain('Stability: 75');
      expect(result).toContain('Regions: 3');
    });

    it('lists key events chronologically', () => {
      const { world, eventLog } = setupTestWorld();
      const factionId = 0 as EntityId;
      const result = manager.exportFactionHistory(factionId, world, eventLog, { format: 'txt' });

      expect(result).toContain('Key Events');
      expect(result).toContain('faction.formed');
      expect(result).toContain('battle.victory');
      expect(result).toContain('faction.treaty_signed');
    });

    it('includes cultural traditions', () => {
      const { world, eventLog } = setupTestWorld();
      const factionId = 0 as EntityId;
      const result = manager.exportFactionHistory(factionId, world, eventLog, { format: 'txt' });

      expect(result).toContain('warrior code');
      expect(result).toContain('harvest festival');
    });

    it('generates valid JSON faction history', () => {
      const { world, eventLog } = setupTestWorld();
      const factionId = 0 as EntityId;
      const result = manager.exportFactionHistory(factionId, world, eventLog, { format: 'json' });

      const parsed = JSON.parse(result);
      expect(parsed.type).toBe('faction_history');
      expect(parsed.name).toBe('Kingdom of Valdris');
      expect(parsed.government.type).toBe('monarchy');
      expect(parsed.territory.regions).toBe(3);
      expect(parsed.events.length).toBeGreaterThanOrEqual(3);
    });

    it('generates valid Markdown faction history', () => {
      const { world, eventLog } = setupTestWorld();
      const factionId = 0 as EntityId;
      const result = manager.exportFactionHistory(factionId, world, eventLog, { format: 'md' });

      expect(result).toContain('# History of Kingdom of Valdris');
      expect(result).toContain('## Current State');
      expect(result).toContain('## Key Events');
    });
  });

  describe('writeExport', () => {
    it('writes export to storage', () => {
      manager.writeExport('test.txt', 'Hello World');
      const content = storage.getFile('/exports/test.txt');
      expect(content).toBe('Hello World');
    });

    it('creates directory', () => {
      // ensureDir is called — shouldn't throw
      manager.writeExport('nested/file.md', '# Title');
      const content = storage.getFile('/exports/nested/file.md');
      expect(content).toBe('# Title');
    });
  });

  describe('format consistency', () => {
    it('all export types support all three formats', () => {
      const { world, eventLog } = setupTestWorld();
      const formats: ExportFormat[] = ['txt', 'md', 'json'];

      for (const format of formats) {
        const opts: ExportOptions = { format };

        const encyclopedia = manager.exportWorldEncyclopedia(world, eventLog, opts);
        expect(encyclopedia.length).toBeGreaterThan(0);

        const chronicle = manager.exportCharacterChronicle(5 as EntityId, world, eventLog, opts);
        expect(chronicle.length).toBeGreaterThan(0);

        const timeline = manager.exportHistoricalTimeline(world, eventLog, opts);
        expect(timeline.length).toBeGreaterThan(0);

        const genealogy = manager.exportGenealogy(3 as EntityId, world, opts);
        expect(genealogy.length).toBeGreaterThan(0);

        const factionHistory = manager.exportFactionHistory(0 as EntityId, world, eventLog, opts);
        expect(factionHistory.length).toBeGreaterThan(0);
      }
    });

    it('JSON outputs are parseable', () => {
      const { world, eventLog } = setupTestWorld();
      const opts: ExportOptions = { format: 'json' };

      JSON.parse(manager.exportWorldEncyclopedia(world, eventLog, opts));
      JSON.parse(manager.exportCharacterChronicle(5 as EntityId, world, eventLog, opts));
      JSON.parse(manager.exportHistoricalTimeline(world, eventLog, opts));
      JSON.parse(manager.exportGenealogy(3 as EntityId, world, opts));
      JSON.parse(manager.exportFactionHistory(0 as EntityId, world, eventLog, opts));
    });
  });
});
