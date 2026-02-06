/**
 * ExportManager — generates human-readable exports from world state.
 *
 * Five export types:
 *   1. World Encyclopedia — comprehensive reference document
 *   2. Character Chronicle — biography of a single character
 *   3. Historical Timeline — chronological event list
 *   4. Genealogy — ASCII family tree
 *   5. Faction History — political history of one faction
 *
 * Three output formats: .txt (ASCII), .md (Markdown), .json (structured)
 * Export location: ~/.aeternum/exports/
 */

import type { EntityId } from '../ecs/types.js';
import type {
  Component,
  ComponentType,
  PositionComponent,
  PopulationComponent,
  EconomyComponent,
  GovernmentComponent,
  TerritoryComponent,
  AttributeComponent,
  StatusComponent,
  GenealogyComponent,
  TraitsComponent,
  MembershipComponent,
  CultureComponent,
} from '../ecs/component.js';
import type { World } from '../ecs/world.js';
import type { EventLog } from '../events/event-log.js';
import { ticksToWorldTime, formatTime } from '../time/types.js';
import type { SaveStorage } from './save-manager.js';

// ─── Public types ──────────────────────────────────────────────────────────

export type ExportFormat = 'txt' | 'md' | 'json';

export interface ExportOptions {
  readonly format: ExportFormat;
  readonly significanceThreshold?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function tickToDateStr(tick: number): string {
  const wt = ticksToWorldTime(tick);
  return formatTime(wt);
}

function significanceStars(sig: number): string {
  if (sig >= 90) return '★★★';
  if (sig >= 70) return '★★';
  if (sig >= 50) return '★';
  return '·';
}

function safeGet<T extends Component>(
  world: World,
  entityId: EntityId,
  type: ComponentType,
): T | undefined {
  if (!world.hasStore(type)) return undefined;
  return world.getComponent<T>(entityId, type);
}

function getEntityName(world: World, entityId: EntityId): string {
  // Try common name sources
  const attr = safeGet<AttributeComponent>(world, entityId, 'Attribute');
  if (attr !== undefined) {
    const data = attr as unknown as Record<string, unknown>;
    if (typeof data['name'] === 'string') return data['name'];
  }
  const status = safeGet<StatusComponent>(world, entityId, 'Status');
  if (status !== undefined) {
    const data = status as unknown as Record<string, unknown>;
    if (typeof data['name'] === 'string') return data['name'];
  }
  // Fallback
  return `Entity #${entityId as number}`;
}

function separatorLine(char = '─', len = 60): string {
  return char.repeat(len);
}

// ─── Export Manager ────────────────────────────────────────────────────────

export class ExportManager {
  constructor(
    private readonly storage: SaveStorage,
    private readonly exportsDir: string,
  ) {}

  // ── World Encyclopedia ─────────────────────────────────────────────────

  exportWorldEncyclopedia(
    world: World,
    eventLog: EventLog,
    options: ExportOptions,
  ): string {
    if (options.format === 'json') {
      return this.encyclopediaAsJson(world, eventLog);
    }
    const md = options.format === 'md';
    return this.encyclopediaAsText(world, eventLog, md);
  }

  private encyclopediaAsText(world: World, eventLog: EventLog, md: boolean): string {
    const lines: string[] = [];
    const h1 = (text: string) => md ? `# ${text}\n` : `${text}\n${'='.repeat(text.length)}`;
    const h2 = (text: string) => md ? `## ${text}\n` : `${text}\n${'-'.repeat(text.length)}`;
    const h3 = (text: string) => md ? `### ${text}\n` : `  ${text}`;
    const bullet = (text: string) => md ? `- ${text}` : `  • ${text}`;

    lines.push(h1('World Encyclopedia'));
    lines.push('');

    // ── Factions ──
    const factions = this.queryFactions(world);
    if (factions.length > 0) {
      lines.push(h2('Factions'));
      lines.push('');
      for (const f of factions) {
        lines.push(h3(f.name));
        if (f.governmentType !== undefined) lines.push(bullet(`Government: ${f.governmentType}`));
        if (f.stability !== undefined) lines.push(bullet(`Stability: ${f.stability}`));
        if (f.regions > 0) lines.push(bullet(`Regions controlled: ${f.regions}`));
        lines.push('');
      }
    }

    // ── Settlements ──
    const settlements = this.querySettlements(world);
    if (settlements.length > 0) {
      lines.push(h2('Settlements'));
      lines.push('');
      for (const s of settlements) {
        lines.push(h3(s.name));
        if (s.position !== undefined) lines.push(bullet(`Location: (${s.position.x}, ${s.position.y})`));
        if (s.population !== undefined) lines.push(bullet(`Population: ${s.population}`));
        if (s.wealth !== undefined) lines.push(bullet(`Wealth: ${s.wealth}`));
        lines.push('');
      }
    }

    // ── Characters ──
    const characters = this.queryCharacters(world);
    if (characters.length > 0) {
      lines.push(h2('Notable Characters'));
      lines.push('');
      for (const c of characters) {
        lines.push(h3(c.name));
        if (c.socialClass !== undefined) lines.push(bullet(`Class: ${c.socialClass}`));
        if (c.factionRank !== undefined) lines.push(bullet(`Rank: ${c.factionRank}`));
        if (c.traits.length > 0) lines.push(bullet(`Traits: ${c.traits.join(', ')}`));
        lines.push('');
      }
    }

    // ── Event Summary ──
    const total = eventLog.getCount();
    const significant = eventLog.getBySignificanceAbove(70);
    lines.push(h2('Historical Overview'));
    lines.push(bullet(`Total events recorded: ${total}`));
    lines.push(bullet(`Significant events (>70): ${significant.length}`));
    lines.push('');

    // Category breakdown
    const categories = this.categoryCounts(eventLog);
    for (const [cat, count] of categories) {
      lines.push(bullet(`${cat}: ${count} events`));
    }

    return lines.join('\n');
  }

  private encyclopediaAsJson(world: World, eventLog: EventLog): string {
    return JSON.stringify({
      type: 'world_encyclopedia',
      factions: this.queryFactions(world),
      settlements: this.querySettlements(world),
      characters: this.queryCharacters(world),
      eventSummary: {
        total: eventLog.getCount(),
        significantCount: eventLog.getBySignificanceAbove(70).length,
        byCategory: Object.fromEntries(this.categoryCounts(eventLog)),
      },
    }, null, 2);
  }

  // ── Character Chronicle ────────────────────────────────────────────────

  exportCharacterChronicle(
    characterId: EntityId,
    world: World,
    eventLog: EventLog,
    options: ExportOptions,
  ): string {
    if (options.format === 'json') {
      return this.chronicleAsJson(characterId, world, eventLog);
    }
    const md = options.format === 'md';
    return this.chronicleAsText(characterId, world, eventLog, md);
  }

  private chronicleAsText(
    characterId: EntityId,
    world: World,
    eventLog: EventLog,
    md: boolean,
  ): string {
    const lines: string[] = [];
    const h1 = (text: string) => md ? `# ${text}\n` : `${text}\n${'='.repeat(text.length)}`;
    const h2 = (text: string) => md ? `## ${text}\n` : `${text}\n${'-'.repeat(text.length)}`;
    const bullet = (text: string) => md ? `- ${text}` : `  • ${text}`;

    const name = getEntityName(world, characterId);
    lines.push(h1(`Chronicle of ${name}`));
    lines.push('');

    // ── Attributes ──
    const attr = safeGet<AttributeComponent>(world, characterId, 'Attribute');
    if (attr !== undefined) {
      lines.push(h2('Attributes'));
      lines.push(bullet(`Strength: ${attr.strength}`));
      lines.push(bullet(`Agility: ${attr.agility}`));
      lines.push(bullet(`Endurance: ${attr.endurance}`));
      lines.push(bullet(`Intelligence: ${attr.intelligence}`));
      lines.push(bullet(`Wisdom: ${attr.wisdom}`));
      lines.push(bullet(`Charisma: ${attr.charisma}`));
      lines.push('');
    }

    // ── Status ──
    const status = safeGet<StatusComponent>(world, characterId, 'Status');
    if (status !== undefined) {
      lines.push(h2('Status'));
      if (status.titles.length > 0) lines.push(bullet(`Titles: ${status.titles.join(', ')}`));
      lines.push(bullet(`Social Class: ${status.socialClass}`));
      if (status.conditions.length > 0) lines.push(bullet(`Conditions: ${status.conditions.join(', ')}`));
      lines.push('');
    }

    // ── Traits ──
    const traits = safeGet<TraitsComponent>(world, characterId, 'Traits');
    if (traits !== undefined && traits.traits.length > 0) {
      lines.push(h2('Personality'));
      lines.push(bullet(`Traits: ${traits.traits.join(', ')}`));
      lines.push('');
    }

    // ── Family ──
    const geneal = safeGet<GenealogyComponent>(world, characterId, 'Genealogy');
    if (geneal !== undefined) {
      lines.push(h2('Family'));
      if (geneal.parentIds.length > 0) {
        const parentNames = geneal.parentIds.map((id) => getEntityName(world, id as EntityId));
        lines.push(bullet(`Parents: ${parentNames.join(', ')}`));
      }
      if (geneal.spouseIds.length > 0) {
        const spouseNames = geneal.spouseIds.map((id) => getEntityName(world, id as EntityId));
        lines.push(bullet(`Spouse(s): ${spouseNames.join(', ')}`));
      }
      if (geneal.childIds.length > 0) {
        const childNames = geneal.childIds.map((id) => getEntityName(world, id as EntityId));
        lines.push(bullet(`Children: ${childNames.join(', ')}`));
      }
      lines.push('');
    }

    // ── Life Events ──
    const events = eventLog.getByEntity(characterId);
    if (events.length > 0) {
      lines.push(h2('Life Events'));
      const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
      for (const evt of sorted) {
        const date = tickToDateStr(evt.timestamp);
        const stars = significanceStars(evt.significance);
        lines.push(bullet(`[${date}] ${evt.subtype} ${stars}`));
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private chronicleAsJson(
    characterId: EntityId,
    world: World,
    eventLog: EventLog,
  ): string {
    const events = eventLog.getByEntity(characterId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => ({
        date: tickToDateStr(e.timestamp),
        category: e.category,
        subtype: e.subtype,
        significance: e.significance,
      }));

    const geneal = safeGet<GenealogyComponent>(world, characterId, 'Genealogy');
    const attr = safeGet<AttributeComponent>(world, characterId, 'Attribute');
    const status = safeGet<StatusComponent>(world, characterId, 'Status');
    const traits = safeGet<TraitsComponent>(world, characterId, 'Traits');

    return JSON.stringify({
      type: 'character_chronicle',
      characterId: characterId as number,
      name: getEntityName(world, characterId),
      ...(attr !== undefined ? {
        attributes: {
          strength: attr.strength, agility: attr.agility,
          endurance: attr.endurance, intelligence: attr.intelligence,
          wisdom: attr.wisdom, charisma: attr.charisma,
        },
      } : {}),
      ...(status !== undefined ? {
        status: { titles: status.titles, socialClass: status.socialClass },
      } : {}),
      ...(traits !== undefined ? { traits: traits.traits } : {}),
      ...(geneal !== undefined ? {
        family: {
          parents: geneal.parentIds,
          spouses: geneal.spouseIds,
          children: geneal.childIds,
        },
      } : {}),
      events,
    }, null, 2);
  }

  // ── Historical Timeline ────────────────────────────────────────────────

  exportHistoricalTimeline(
    _world: World,
    eventLog: EventLog,
    options: ExportOptions,
  ): string {
    const threshold = options.significanceThreshold ?? 0;
    if (options.format === 'json') {
      return this.timelineAsJson(eventLog, threshold);
    }
    const md = options.format === 'md';
    return this.timelineAsText(eventLog, threshold, md);
  }

  private timelineAsText(eventLog: EventLog, threshold: number, md: boolean): string {
    const lines: string[] = [];
    const h1 = (text: string) => md ? `# ${text}\n` : `${text}\n${'='.repeat(text.length)}`;

    lines.push(h1('Historical Timeline'));
    lines.push('');

    const events = eventLog.getAll()
      .filter((e) => e.significance >= threshold)
      .sort((a, b) => a.timestamp - b.timestamp);

    let lastYear = -1;
    for (const evt of events) {
      const wt = ticksToWorldTime(evt.timestamp);
      if (wt.year !== lastYear) {
        lines.push('');
        if (md) {
          lines.push(`## Year ${wt.year}`);
        } else {
          lines.push(`──── Year ${wt.year} ────`);
        }
        lastYear = wt.year;
      }

      const date = formatTime(wt);
      const stars = significanceStars(evt.significance);
      const category = evt.category as string;
      if (md) {
        lines.push(`- **[${date}]** \`${category}\` ${evt.subtype} ${stars}`);
      } else {
        lines.push(`  [${date}] [${category}] ${evt.subtype} ${stars}`);
      }
    }

    return lines.join('\n');
  }

  private timelineAsJson(eventLog: EventLog, threshold: number): string {
    const events = eventLog.getAll()
      .filter((e) => e.significance >= threshold)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => ({
        tick: e.timestamp,
        date: tickToDateStr(e.timestamp),
        category: e.category,
        subtype: e.subtype,
        significance: e.significance,
        participants: e.participants.map((p) => p as number),
      }));

    return JSON.stringify({ type: 'historical_timeline', events }, null, 2);
  }

  // ── Genealogy (ASCII family tree) ──────────────────────────────────────

  exportGenealogy(
    characterId: EntityId,
    world: World,
    options: ExportOptions,
  ): string {
    if (options.format === 'json') {
      return this.genealogyAsJson(characterId, world);
    }
    const md = options.format === 'md';
    return this.genealogyAsText(characterId, world, md);
  }

  private genealogyAsText(characterId: EntityId, world: World, md: boolean): string {
    const lines: string[] = [];
    const name = getEntityName(world, characterId);

    if (md) {
      lines.push(`# Family Tree: ${name}`);
      lines.push('');
      lines.push('```');
    } else {
      lines.push(`Family Tree: ${name}`);
      lines.push(separatorLine());
    }

    const geneal = safeGet<GenealogyComponent>(world, characterId, 'Genealogy');
    if (geneal === undefined) {
      lines.push(`  ${name} (no genealogy data)`);
      if (md) lines.push('```');
      return lines.join('\n');
    }

    // Render parents
    if (geneal.parentIds.length > 0) {
      const parentNames = geneal.parentIds.map((id) => getEntityName(world, id as EntityId));
      if (parentNames.length === 2) {
        const p1 = parentNames[0]!;
        const p2 = parentNames[1]!;
        const totalWidth = p1.length + p2.length + 7;
        const midpoint = Math.floor(totalWidth / 2);
        lines.push(`  ${p1}   ×   ${p2}`);
        lines.push(`  ${' '.repeat(Math.floor(p1.length / 2))}└──┬──┘${' '.repeat(Math.floor(p2.length / 2))}`);
        lines.push(`  ${' '.repeat(midpoint)}│`);
      } else if (parentNames.length === 1) {
        lines.push(`  ${parentNames[0]!}`);
        lines.push(`  ${' '.repeat(Math.floor(parentNames[0]!.length / 2))}│`);
      }
    }

    // Render subject + spouse
    const spouseNames = (geneal.spouseIds ?? []).map((id) => getEntityName(world, id as EntityId));
    if (spouseNames.length > 0) {
      lines.push(`  [${name}]   ×   ${spouseNames[0]!}`);
    } else {
      lines.push(`  [${name}]`);
    }

    // Render children
    if (geneal.childIds.length > 0) {
      const childNames = geneal.childIds.map((id) => getEntityName(world, id as EntityId));
      const nameOffset = Math.floor(name.length / 2) + 1; // center under subject
      lines.push(`  ${' '.repeat(nameOffset)}│`);

      if (childNames.length === 1) {
        lines.push(`  ${' '.repeat(nameOffset)}└── ${childNames[0]!}`);
      } else {
        // Multiple children: branching
        const branchParts: string[] = [];
        for (let i = 0; i < childNames.length; i++) {
          if (i === 0) {
            branchParts.push(`┌──${childNames[i]!}`);
          } else if (i === childNames.length - 1) {
            branchParts.push(`└──${childNames[i]!}`);
          } else {
            branchParts.push(`├──${childNames[i]!}`);
          }
        }
        // Draw connector line
        lines.push(`  ${' '.repeat(nameOffset)}┤`);
        for (const part of branchParts) {
          lines.push(`  ${' '.repeat(nameOffset)}${part}`);
        }
      }
    }

    if (md) lines.push('```');

    return lines.join('\n');
  }

  private genealogyAsJson(characterId: EntityId, world: World): string {
    const geneal = safeGet<GenealogyComponent>(world, characterId, 'Genealogy');
    const buildNode = (id: EntityId, depth: number): Record<string, unknown> => {
      const node: Record<string, unknown> = {
        id: id as number,
        name: getEntityName(world, id),
      };
      if (depth < 2) {
        const g = safeGet<GenealogyComponent>(world, id, 'Genealogy');
        if (g !== undefined) {
          node['children'] = g.childIds.map((cid) => buildNode(cid as EntityId, depth + 1));
        }
      }
      return node;
    };

    return JSON.stringify({
      type: 'genealogy',
      subject: characterId as number,
      name: getEntityName(world, characterId),
      parents: geneal?.parentIds.map((id) => ({
        id,
        name: getEntityName(world, id as EntityId),
      })) ?? [],
      spouses: geneal?.spouseIds.map((id) => ({
        id,
        name: getEntityName(world, id as EntityId),
      })) ?? [],
      children: geneal?.childIds.map((id) => buildNode(id as EntityId, 0)) ?? [],
    }, null, 2);
  }

  // ── Faction History ────────────────────────────────────────────────────

  exportFactionHistory(
    factionId: EntityId,
    world: World,
    eventLog: EventLog,
    options: ExportOptions,
  ): string {
    if (options.format === 'json') {
      return this.factionHistoryAsJson(factionId, world, eventLog);
    }
    const md = options.format === 'md';
    return this.factionHistoryAsText(factionId, world, eventLog, md);
  }

  private factionHistoryAsText(
    factionId: EntityId,
    world: World,
    eventLog: EventLog,
    md: boolean,
  ): string {
    const lines: string[] = [];
    const h1 = (text: string) => md ? `# ${text}\n` : `${text}\n${'='.repeat(text.length)}`;
    const h2 = (text: string) => md ? `## ${text}\n` : `${text}\n${'-'.repeat(text.length)}`;
    const bullet = (text: string) => md ? `- ${text}` : `  • ${text}`;

    const name = getEntityName(world, factionId);
    lines.push(h1(`History of ${name}`));
    lines.push('');

    // ── Current state ──
    const gov = safeGet<GovernmentComponent>(world, factionId, 'Government');
    const terr = safeGet<TerritoryComponent>(world, factionId, 'Territory');
    const culture = safeGet<CultureComponent>(world, factionId, 'Culture');

    lines.push(h2('Current State'));
    if (gov !== undefined) {
      lines.push(bullet(`Government: ${gov.governmentType}`));
      lines.push(bullet(`Stability: ${gov.stability}`));
      lines.push(bullet(`Legitimacy: ${gov.legitimacy}`));
    }
    if (terr !== undefined) {
      lines.push(bullet(`Regions: ${terr.controlledRegions.length}`));
      if (terr.capitalId !== null) lines.push(bullet(`Capital: Entity #${terr.capitalId}`));
    }
    if (culture !== undefined && culture.traditions.length > 0) {
      lines.push(bullet(`Traditions: ${culture.traditions.join(', ')}`));
    }
    lines.push('');

    // ── Key Events ──
    const events = eventLog.getByEntity(factionId);
    if (events.length > 0) {
      lines.push(h2('Key Events'));
      const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
      let lastYear = -1;
      for (const evt of sorted) {
        const wt = ticksToWorldTime(evt.timestamp);
        if (wt.year !== lastYear) {
          lines.push('');
          if (md) lines.push(`### Year ${wt.year}`);
          else lines.push(`  ── Year ${wt.year} ──`);
          lastYear = wt.year;
        }
        const date = formatTime(wt);
        const stars = significanceStars(evt.significance);
        lines.push(bullet(`[${date}] ${evt.subtype} ${stars}`));
      }
    }

    return lines.join('\n');
  }

  private factionHistoryAsJson(
    factionId: EntityId,
    world: World,
    eventLog: EventLog,
  ): string {
    const gov = safeGet<GovernmentComponent>(world, factionId, 'Government');
    const terr = safeGet<TerritoryComponent>(world, factionId, 'Territory');

    const events = eventLog.getByEntity(factionId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e) => ({
        date: tickToDateStr(e.timestamp),
        category: e.category,
        subtype: e.subtype,
        significance: e.significance,
      }));

    return JSON.stringify({
      type: 'faction_history',
      factionId: factionId as number,
      name: getEntityName(world, factionId),
      ...(gov !== undefined ? {
        government: {
          type: gov.governmentType,
          stability: gov.stability,
          legitimacy: gov.legitimacy,
        },
      } : {}),
      ...(terr !== undefined ? {
        territory: {
          regions: terr.controlledRegions.length,
          capitalId: terr.capitalId,
        },
      } : {}),
      events,
    }, null, 2);
  }

  // ── File output ────────────────────────────────────────────────────────

  writeExport(filename: string, content: string): void {
    this.storage.ensureDir(this.exportsDir);
    const path = `${this.exportsDir}/${filename}`;
    this.storage.writeFile(path, new TextEncoder().encode(content));
  }

  // ── Internal query helpers ─────────────────────────────────────────────

  private queryFactions(world: World): Array<{
    id: number;
    name: string;
    governmentType?: string;
    stability?: number;
    regions: number;
  }> {
    if (!world.hasStore('Territory')) return [];
    const results: Array<{
      id: number;
      name: string;
      governmentType?: string;
      stability?: number;
      regions: number;
    }> = [];

    for (const { entity, component } of world.queryWith<TerritoryComponent>('Territory')) {
      const gov = safeGet<GovernmentComponent>(world, entity, 'Government');
      results.push({
        id: entity as number,
        name: getEntityName(world, entity),
        ...(gov !== undefined ? { governmentType: gov.governmentType, stability: gov.stability } : {}),
        regions: component.controlledRegions.length,
      });
    }

    return results;
  }

  private querySettlements(world: World): Array<{
    id: number;
    name: string;
    position?: { x: number; y: number };
    population?: number;
    wealth?: number;
  }> {
    if (!world.hasStore('Population')) return [];
    // Settlements have both Position and Population
    const entities = world.query('Position', 'Population');
    const results: Array<{
      id: number;
      name: string;
      position?: { x: number; y: number };
      population?: number;
      wealth?: number;
    }> = [];

    for (const entity of entities) {
      const pos = safeGet<PositionComponent>(world, entity, 'Position');
      const pop = safeGet<PopulationComponent>(world, entity, 'Population');
      const econ = safeGet<EconomyComponent>(world, entity, 'Economy');
      results.push({
        id: entity as number,
        name: getEntityName(world, entity),
        ...(pos !== undefined ? { position: { x: pos.x, y: pos.y } } : {}),
        ...(pop !== undefined ? { population: pop.count } : {}),
        ...(econ !== undefined ? { wealth: econ.wealth } : {}),
      });
    }

    return results;
  }

  private queryCharacters(world: World): Array<{
    id: number;
    name: string;
    socialClass?: string;
    factionRank?: string;
    traits: string[];
  }> {
    if (!world.hasStore('Attribute')) return [];
    const results: Array<{
      id: number;
      name: string;
      socialClass?: string;
      factionRank?: string;
      traits: string[];
    }> = [];

    for (const { entity } of world.queryWith<AttributeComponent>('Attribute')) {
      const status = safeGet<StatusComponent>(world, entity, 'Status');
      const membership = safeGet<MembershipComponent>(world, entity, 'Membership');
      const traitsComp = safeGet<TraitsComponent>(world, entity, 'Traits');
      results.push({
        id: entity as number,
        name: getEntityName(world, entity),
        ...(status !== undefined ? { socialClass: status.socialClass } : {}),
        ...(membership !== undefined ? { factionRank: membership.rank } : {}),
        traits: traitsComp?.traits ?? [],
      });
    }

    return results;
  }

  private categoryCounts(eventLog: EventLog): Map<string, number> {
    const counts = new Map<string, number>();
    for (const event of eventLog.getAll()) {
      const cat = event.category as string;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }
}
