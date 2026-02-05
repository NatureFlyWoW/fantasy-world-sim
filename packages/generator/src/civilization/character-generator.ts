/**
 * Character generation — creates rulers and notable characters for factions
 * with a full ECS-compatible component set.
 */

import type { SeededRNG } from '../rng.js';
import type { WorldConfig } from '../config/types.js';
import type { NameGenerator, PersonName } from '../character/name-generator.js';
import type { Faction } from './faction-initializer.js';
import type { Settlement } from './settlement-placer.js';

// ── Component types ──────────────────────────────────────────────────────

/**
 * Personality trait names. Each is on a -100 to +100 scale.
 */
export type PersonalityTraitName =
  | 'ambitious'
  | 'loyal'
  | 'cruel'
  | 'scholarly'
  | 'curious'
  | 'amoral'
  | 'paranoid'
  | 'patient'
  | 'impulsive'
  | 'brave'
  | 'cautious'
  | 'empathetic'
  | 'selfAbsorbed'
  | 'vengeful'
  | 'forgiving'
  | 'creative'
  | 'pragmatic'
  | 'idealistic';

const ALL_TRAIT_NAMES: readonly PersonalityTraitName[] = [
  'ambitious', 'loyal', 'cruel', 'scholarly', 'curious', 'amoral',
  'paranoid', 'patient', 'impulsive', 'brave', 'cautious', 'empathetic',
  'selfAbsorbed', 'vengeful', 'forgiving', 'creative', 'pragmatic', 'idealistic',
];

/**
 * Position component — where the character is.
 */
export interface PositionComponent {
  readonly x: number;
  readonly y: number;
  readonly settlementName: string | undefined;
}

/**
 * Attribute component — base stats.
 */
export interface AttributeComponent {
  readonly strength: number;
  readonly agility: number;
  readonly endurance: number;
  readonly intelligence: number;
  readonly wisdom: number;
  readonly charisma: number;
}

/**
 * Skill type.
 */
export type SkillName =
  | 'combat'
  | 'leadership'
  | 'diplomacy'
  | 'stealth'
  | 'magic'
  | 'crafting'
  | 'medicine'
  | 'lore'
  | 'trade'
  | 'survival';

/**
 * Skill component — trained abilities.
 */
export interface SkillComponent {
  readonly skills: ReadonlyMap<SkillName, number>;
}

/**
 * Personality component — trait values -100 to +100.
 */
export interface PersonalityComponent {
  readonly traits: ReadonlyMap<PersonalityTraitName, number>;
}

/**
 * Relationship type.
 */
export type RelationshipKind =
  | 'ally'
  | 'rival'
  | 'spouse'
  | 'parent'
  | 'child'
  | 'liege'
  | 'vassal'
  | 'friend'
  | 'enemy';

/**
 * Relationship component — connection to another character.
 */
export interface RelationshipComponent {
  readonly targetName: string;
  readonly kind: RelationshipKind;
  readonly strength: number; // -100 to +100
}

/**
 * Goal component.
 */
export interface GoalComponent {
  readonly description: string;
  readonly priority: number; // 1-10
}

/**
 * Memory component.
 */
export interface MemoryComponent {
  readonly description: string;
  readonly year: number;
  readonly emotionalWeight: number; // -100 to +100
}

/**
 * Belief component.
 */
export interface BeliefComponent {
  readonly description: string;
  readonly strength: number; // 0-100
}

/**
 * Possession component.
 */
export interface PossessionComponent {
  readonly name: string;
  readonly type: 'weapon' | 'armor' | 'jewelry' | 'artifact' | 'land' | 'gold';
  readonly value: number;
}

/**
 * Reputation component.
 */
export interface ReputationComponent {
  readonly factionName: string;
  readonly standing: number; // -100 to +100
}

/**
 * Status type.
 */
export type StatusType =
  | 'ruler'
  | 'noble'
  | 'advisor'
  | 'general'
  | 'merchant'
  | 'priest'
  | 'mage'
  | 'outlaw'
  | 'commoner';

/**
 * Status component.
 */
export interface StatusComponent {
  readonly type: StatusType;
  readonly title: string;
}

/**
 * Health component.
 */
export interface HealthComponent {
  readonly current: number;
  readonly max: number;
  readonly conditions: readonly string[];
}

/**
 * A fully realized character with all components.
 */
export interface GeneratedCharacter {
  readonly name: string;
  readonly fullName: PersonName;
  readonly gender: 'male' | 'female';
  readonly age: number;
  readonly raceName: string;
  readonly factionName: string;
  readonly position: PositionComponent;
  readonly attributes: AttributeComponent;
  readonly skills: SkillComponent;
  readonly personality: PersonalityComponent;
  readonly relationships: readonly RelationshipComponent[];
  readonly goals: readonly GoalComponent[];
  readonly memories: readonly MemoryComponent[];
  readonly beliefs: readonly BeliefComponent[];
  readonly possessions: readonly PossessionComponent[];
  readonly reputations: readonly ReputationComponent[];
  readonly status: StatusComponent;
  readonly health: HealthComponent;
}

// ── Goal templates ───────────────────────────────────────────────────────

const RULER_GOALS: readonly string[] = [
  'Expand the borders of my realm',
  'Ensure the prosperity of my people',
  'Secure the succession',
  'Crush all rivals to my throne',
  'Build a legacy that will outlast me',
  'Unite the fractured lands under one banner',
];

const NOBLE_GOALS: readonly string[] = [
  'Increase my family\'s influence',
  'Secure a favorable marriage alliance',
  'Accumulate wealth and land',
  'Win the favor of the ruler',
  'Protect my holdings from encroachment',
];

const ADVISOR_GOALS: readonly string[] = [
  'Guide the ruler toward wise decisions',
  'Maintain the balance of power',
  'Advance the cause of knowledge',
  'Protect the realm from hidden threats',
];

const GENERAL_GOALS: readonly string[] = [
  'Strengthen the military',
  'Win glory in battle',
  'Defend the realm against all threats',
  'Train the next generation of warriors',
];

const MERCHANT_GOALS: readonly string[] = [
  'Build a trade empire',
  'Discover new markets and routes',
  'Accumulate vast wealth',
  'Establish a merchant dynasty',
];

const PRIEST_GOALS: readonly string[] = [
  'Spread the faith to all corners of the world',
  'Build a great temple',
  'Root out heresy',
  'Achieve communion with the divine',
];

const MAGE_GOALS: readonly string[] = [
  'Uncover the deepest mysteries of magic',
  'Create a masterwork of arcane power',
  'Protect the world from magical threats',
  'Establish a school of magic',
];

const GOALS_BY_STATUS: Record<StatusType, readonly string[]> = {
  ruler: RULER_GOALS,
  noble: NOBLE_GOALS,
  advisor: ADVISOR_GOALS,
  general: GENERAL_GOALS,
  merchant: MERCHANT_GOALS,
  priest: PRIEST_GOALS,
  mage: MAGE_GOALS,
  outlaw: ['Evade capture', 'Build a network of loyal followers', 'Take revenge on those who wronged me'],
  commoner: ['Provide for my family', 'Find a better life', 'Earn enough to live well'],
};

// ── Belief templates ─────────────────────────────────────────────────────

const BELIEFS: readonly string[] = [
  'The strong should rule the weak',
  'All people deserve justice and fairness',
  'Knowledge is the greatest power',
  'The gods watch over the faithful',
  'Wealth brings freedom and security',
  'Honor above all else',
  'The old ways are the best ways',
  'Change is necessary for progress',
  'Magic is a gift to be cherished',
  'Magic is a danger to be controlled',
  'Trust must be earned, never given',
  'Family bonds are sacred above all',
  'The world belongs to the bold',
  'Patience and cunning outlast brute force',
];

// ── Title patterns ───────────────────────────────────────────────────────

const RULER_TITLES: Record<string, readonly string[]> = {
  monarchy: ['King', 'Queen', 'High King', 'High Queen'],
  republic: ['Consul', 'Chancellor', 'First Speaker'],
  theocracy: ['High Priest', 'High Priestess', 'Pontiff', 'Oracle'],
  tribal_confederation: ['Great Chief', 'Warlord', 'Elder'],
  oligarchy: ['Archon', 'Primarch', 'Grand Master'],
  magocracy: ['Archmage', 'Magister Supreme', 'High Sorcerer'],
};

export class CharacterGenerator {
  private readonly nameGen: NameGenerator;

  constructor(nameGen: NameGenerator) {
    this.nameGen = nameGen;
  }

  /**
   * Generate rulers for all factions.
   */
  generateRulers(
    factions: readonly Faction[],
    settlements: readonly Settlement[],
    rng: SeededRNG
  ): GeneratedCharacter[] {
    const charRng = rng.fork('rulers');
    const characters: GeneratedCharacter[] = [];

    for (const faction of factions) {
      const capital = settlements[faction.capitalIndex];
      if (capital === undefined) continue;

      const gender = charRng.next() < 0.5 ? 'male' as const : 'female' as const;
      const titles = RULER_TITLES[faction.governmentType] ?? ['Leader'];
      const genderTitles = gender === 'female'
        ? titles.map(t => t.replace('King', 'Queen').replace('Priest', 'Priestess'))
        : titles;
      const title = charRng.pick(genderTitles);

      const ruler = this.generateCharacter(
        faction, capital, 'ruler', title, gender, charRng
      );
      characters.push(ruler);
    }

    return characters;
  }

  /**
   * Generate notable characters for all factions.
   */
  generateNotables(
    factions: readonly Faction[],
    settlements: readonly Settlement[],
    config: WorldConfig,
    rng: SeededRNG
  ): GeneratedCharacter[] {
    const charRng = rng.fork('notables');
    const characters: GeneratedCharacter[] = [];

    for (const faction of factions) {
      // Each faction gets 2-5 notable characters
      const count = charRng.nextInt(2, 5);

      const statusPool: StatusType[] = ['noble', 'advisor', 'general', 'merchant'];
      if (config.pantheonComplexity !== 'atheistic') statusPool.push('priest');
      if (config.magicPrevalence !== 'mundane') statusPool.push('mage');

      for (let i = 0; i < count; i++) {
        const status = charRng.pick(statusPool);
        const settlement = this.pickSettlement(faction, settlements, charRng);
        if (settlement === undefined) continue;

        const gender = charRng.next() < 0.5 ? 'male' as const : 'female' as const;
        const title = this.generateTitle(status, gender, charRng);

        const character = this.generateCharacter(
          faction, settlement, status, title, gender, charRng
        );
        characters.push(character);
      }
    }

    return characters;
  }

  private generateCharacter(
    faction: Faction,
    settlement: Settlement,
    statusType: StatusType,
    title: string,
    gender: 'male' | 'female',
    rng: SeededRNG
  ): GeneratedCharacter {
    const race = faction.primaryRace;
    const fullName = this.nameGen.generatePersonName(race.namingConvention, gender, rng);
    const name = `${fullName.first} ${fullName.family}`;

    const age = rng.nextInt(
      Math.max(18, Math.round(race.lifespan.min * 0.3)),
      Math.round(race.lifespan.max * 0.7)
    );

    const position: PositionComponent = {
      x: settlement.x,
      y: settlement.y,
      settlementName: settlement.name,
    };

    const attributes = this.generateAttributes(statusType, rng);
    const skills = this.generateSkills(statusType, rng);
    const personality = this.generatePersonality(rng);
    const goals = this.generateGoals(statusType, rng);
    const memories = this.generateMemories(faction, rng);
    const beliefs = this.generateBeliefs(rng);
    const possessions = this.generatePossessions(statusType, rng);
    const reputations = this.generateReputations(faction, rng);
    const health = this.generateHealth(age, race.lifespan.max, rng);

    const status: StatusComponent = { type: statusType, title };

    return {
      name,
      fullName,
      gender,
      age,
      raceName: race.name,
      factionName: faction.name,
      position,
      attributes,
      skills,
      personality,
      relationships: [],
      goals,
      memories,
      beliefs,
      possessions,
      reputations,
      status,
      health,
    };
  }

  private generateAttributes(statusType: StatusType, rng: SeededRNG): AttributeComponent {
    // Base attributes 30-70 with status-based bonuses
    const roll = (): number => Math.min(100, Math.max(1, Math.round(rng.nextGaussian(50, 15))));

    const base = {
      strength: roll(),
      agility: roll(),
      endurance: roll(),
      intelligence: roll(),
      wisdom: roll(),
      charisma: roll(),
    };

    // Apply status bonuses
    switch (statusType) {
      case 'ruler':
        base.charisma = Math.min(100, base.charisma + 15);
        base.wisdom = Math.min(100, base.wisdom + 10);
        break;
      case 'general':
        base.strength = Math.min(100, base.strength + 15);
        base.endurance = Math.min(100, base.endurance + 10);
        break;
      case 'mage':
        base.intelligence = Math.min(100, base.intelligence + 20);
        base.wisdom = Math.min(100, base.wisdom + 10);
        break;
      case 'priest':
        base.wisdom = Math.min(100, base.wisdom + 15);
        base.charisma = Math.min(100, base.charisma + 10);
        break;
      case 'merchant':
        base.charisma = Math.min(100, base.charisma + 10);
        base.intelligence = Math.min(100, base.intelligence + 10);
        break;
      case 'advisor':
        base.intelligence = Math.min(100, base.intelligence + 15);
        base.wisdom = Math.min(100, base.wisdom + 15);
        break;
    }

    return base;
  }

  private generateSkills(statusType: StatusType, rng: SeededRNG): SkillComponent {
    const skills = new Map<SkillName, number>();
    const allSkills: SkillName[] = [
      'combat', 'leadership', 'diplomacy', 'stealth', 'magic',
      'crafting', 'medicine', 'lore', 'trade', 'survival',
    ];

    // Base skill values: 0-30
    for (const skill of allSkills) {
      skills.set(skill, rng.nextInt(0, 30));
    }

    // Boost skills based on status
    const boosts: Partial<Record<StatusType, SkillName[]>> = {
      ruler: ['leadership', 'diplomacy'],
      general: ['combat', 'leadership'],
      mage: ['magic', 'lore'],
      priest: ['lore', 'medicine'],
      merchant: ['trade', 'diplomacy'],
      advisor: ['diplomacy', 'lore'],
      noble: ['diplomacy', 'leadership'],
      outlaw: ['stealth', 'combat'],
    };

    const statusBoosts = boosts[statusType];
    if (statusBoosts !== undefined) {
      for (const skill of statusBoosts) {
        const current = skills.get(skill) ?? 0;
        skills.set(skill, Math.min(100, current + rng.nextInt(20, 50)));
      }
    }

    return { skills };
  }

  private generatePersonality(rng: SeededRNG): PersonalityComponent {
    const traits = new Map<PersonalityTraitName, number>();
    for (const trait of ALL_TRAIT_NAMES) {
      traits.set(trait, Math.round(rng.nextGaussian(0, 40)));
    }

    // Clamp values to -100..+100
    for (const [trait, value] of traits) {
      traits.set(trait, Math.max(-100, Math.min(100, value)));
    }

    return { traits };
  }

  private generateGoals(statusType: StatusType, rng: SeededRNG): GoalComponent[] {
    const pool = GOALS_BY_STATUS[statusType];
    const goalCount = rng.nextInt(1, 3);
    const shuffled = [...pool];
    rng.shuffle(shuffled);

    return shuffled.slice(0, goalCount).map(description => ({
      description,
      priority: rng.nextInt(3, 10),
    }));
  }

  private generateMemories(faction: Faction, rng: SeededRNG): MemoryComponent[] {
    const memories: MemoryComponent[] = [];

    // Everyone has a founding memory
    memories.push({
      description: `Grew up in the lands of ${faction.name}`,
      year: 0,
      emotionalWeight: rng.nextInt(10, 50),
    });

    // Maybe one or two additional memories
    if (rng.next() < 0.6) {
      memories.push({
        description: rng.pick([
          'Witnessed a great battle',
          'Survived a terrible plague',
          'Saw a comet cross the sky',
          'Attended the coronation of a ruler',
          'Lost someone dear in a conflict',
          'Made a vow that shaped my life',
        ]),
        year: 0,
        emotionalWeight: rng.nextInt(-50, 80),
      });
    }

    return memories;
  }

  private generateBeliefs(rng: SeededRNG): BeliefComponent[] {
    const count = rng.nextInt(1, 3);
    const shuffled = [...BELIEFS];
    rng.shuffle(shuffled);
    return shuffled.slice(0, count).map(description => ({
      description,
      strength: rng.nextInt(30, 100),
    }));
  }

  private generatePossessions(statusType: StatusType, rng: SeededRNG): PossessionComponent[] {
    const possessions: PossessionComponent[] = [];

    // Gold based on status
    const goldRanges: Partial<Record<StatusType, [number, number]>> = {
      ruler: [500, 5000],
      noble: [200, 2000],
      merchant: [300, 3000],
      advisor: [100, 800],
      general: [100, 1000],
      priest: [50, 500],
      mage: [100, 1000],
    };
    const goldRange = goldRanges[statusType] ?? [10, 100];
    possessions.push({
      name: 'Gold coins',
      type: 'gold',
      value: rng.nextInt(goldRange[0], goldRange[1]),
    });

    // Status-specific items
    if (statusType === 'ruler' || statusType === 'general') {
      possessions.push({
        name: rng.pick(['Ancestral Sword', 'War Hammer', 'Battle Axe', 'Royal Blade']),
        type: 'weapon',
        value: rng.nextInt(100, 500),
      });
    }
    if (statusType === 'ruler' || statusType === 'noble') {
      possessions.push({
        name: rng.pick(['Signet Ring', 'Family Pendant', 'Jeweled Brooch']),
        type: 'jewelry',
        value: rng.nextInt(50, 300),
      });
    }
    if (statusType === 'mage') {
      possessions.push({
        name: rng.pick(['Enchanted Staff', 'Spell Tome', 'Crystal Focus']),
        type: 'artifact',
        value: rng.nextInt(100, 800),
      });
    }

    return possessions;
  }

  private generateReputations(faction: Faction, rng: SeededRNG): ReputationComponent[] {
    return [{
      factionName: faction.name,
      standing: rng.nextInt(30, 100),
    }];
  }

  private generateHealth(age: number, maxLifespan: number, rng: SeededRNG): HealthComponent {
    // Health decreases with relative age
    const ageRatio = age / maxLifespan;
    const maxHp = 100;
    let current = maxHp;

    if (ageRatio > 0.7) {
      current = Math.max(30, maxHp - Math.round(rng.nextGaussian(20, 10)));
    } else if (ageRatio > 0.5) {
      current = Math.max(50, maxHp - Math.round(rng.nextGaussian(10, 5)));
    }

    const conditions: string[] = [];
    if (ageRatio > 0.8 && rng.next() < 0.3) {
      conditions.push(rng.pick(['frail', 'poor eyesight', 'chronic pain', 'weak constitution']));
    }

    return { current, max: maxHp, conditions };
  }

  private pickSettlement(
    faction: Faction,
    settlements: readonly Settlement[],
    rng: SeededRNG
  ): Settlement | undefined {
    if (faction.settlementIndices.length === 0) return undefined;
    const idx = rng.pick(faction.settlementIndices);
    return settlements[idx];
  }

  private generateTitle(status: StatusType, gender: 'male' | 'female', rng: SeededRNG): string {
    const titles: Record<StatusType, readonly string[]> = {
      ruler: ['Ruler'],
      noble: gender === 'male'
        ? ['Lord', 'Baron', 'Count', 'Duke']
        : ['Lady', 'Baroness', 'Countess', 'Duchess'],
      advisor: ['Royal Advisor', 'Counselor', 'Sage', 'Vizier'],
      general: ['General', 'Marshal', 'Commander', 'Warden'],
      merchant: ['Master Trader', 'Guildmaster', 'Merchant Prince'],
      priest: gender === 'male'
        ? ['Priest', 'Bishop', 'Abbot', 'Father']
        : ['Priestess', 'Mother Superior', 'Abbess', 'Sister'],
      mage: ['Archmage', 'Wizard', 'Enchanter', 'Sorcerer'],
      outlaw: ['Bandit Chief', 'Rogue', 'Shadowmaster'],
      commoner: ['Citizen', 'Farmer', 'Craftsman'],
    };

    return rng.pick(titles[status]);
  }
}
