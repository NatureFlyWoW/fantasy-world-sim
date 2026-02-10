/**
 * Economic System types — resources, markets, trade routes, and economic events.
 * All type definitions, enums, interfaces, tables, and helper functions for the economic system.
 */

import type { EntityId, FactionId, SiteId } from '../ecs/types.js';
import type { WorldTime } from '../time/types.js';
import type { TreatyEnforcement } from './treaty-enforcement.js';
import { TreatyTermType } from './treaty-types.js';

// ── Resource types ───────────────────────────────────────────────────────────

export enum ResourceType {
  Food = 'food',
  Timber = 'timber',
  Stone = 'stone',
  Iron = 'iron',
  Gold = 'gold',
  Gems = 'gems',
  MagicalComponents = 'magical_components',
  LuxuryGoods = 'luxury_goods',
  Weapons = 'weapons',
  Tools = 'tools',
  Fish = 'fish',
  Copper = 'copper',
  Tin = 'tin',
  Coal = 'coal',
  Herbs = 'herbs',
}

export const ALL_RESOURCE_TYPES: readonly ResourceType[] = Object.values(ResourceType);

// Raw resources that can be harvested from terrain
export const RAW_RESOURCES: readonly ResourceType[] = [
  ResourceType.Food,
  ResourceType.Timber,
  ResourceType.Stone,
  ResourceType.Iron,
  ResourceType.Gold,
  ResourceType.Gems,
  ResourceType.Fish,
  ResourceType.Copper,
  ResourceType.Tin,
  ResourceType.Coal,
  ResourceType.Herbs,
  ResourceType.MagicalComponents,
];

// Manufactured goods that require raw resources
export const MANUFACTURED_GOODS: readonly ResourceType[] = [
  ResourceType.Weapons,
  ResourceType.Tools,
  ResourceType.LuxuryGoods,
];

// ── Terrain resource bonuses ─────────────────────────────────────────────────

/**
 * Maps biome types to resource production bonuses (0-1 multiplier, >1 for abundant).
 */
export const TERRAIN_RESOURCE_BONUSES: Readonly<Record<string, Partial<Record<ResourceType, number>>>> = {
  forest: {
    [ResourceType.Timber]: 1.5,
    [ResourceType.Herbs]: 1.2,
    [ResourceType.Food]: 0.7,
  },
  plains: {
    [ResourceType.Food]: 1.5,
    [ResourceType.Herbs]: 0.8,
  },
  mountain: {
    [ResourceType.Stone]: 1.5,
    [ResourceType.Iron]: 1.3,
    [ResourceType.Gold]: 1.2,
    [ResourceType.Gems]: 1.3,
    [ResourceType.Copper]: 1.2,
    [ResourceType.Tin]: 1.1,
    [ResourceType.Coal]: 1.4,
    [ResourceType.Food]: 0.3,
  },
  desert: {
    [ResourceType.Gems]: 1.1,
    [ResourceType.Gold]: 1.0,
    [ResourceType.Food]: 0.2,
  },
  coastal: {
    [ResourceType.Fish]: 1.8,
    [ResourceType.Food]: 1.0,
  },
  swamp: {
    [ResourceType.Herbs]: 1.4,
    [ResourceType.MagicalComponents]: 1.2,
    [ResourceType.Food]: 0.5,
  },
  tundra: {
    [ResourceType.Food]: 0.2,
    [ResourceType.Timber]: 0.3,
  },
  jungle: {
    [ResourceType.Herbs]: 1.5,
    [ResourceType.MagicalComponents]: 1.3,
    [ResourceType.Timber]: 1.2,
    [ResourceType.Food]: 0.8,
  },
  grassland: {
    [ResourceType.Food]: 1.3,
  },
  hills: {
    [ResourceType.Stone]: 1.2,
    [ResourceType.Iron]: 1.0,
    [ResourceType.Copper]: 1.1,
    [ResourceType.Food]: 0.8,
  },
};

// ── Base prices ──────────────────────────────────────────────────────────────

/**
 * Base prices for each resource type.
 */
export const BASE_PRICES: Readonly<Record<ResourceType, number>> = {
  [ResourceType.Food]: 1,
  [ResourceType.Timber]: 3,
  [ResourceType.Stone]: 2,
  [ResourceType.Iron]: 8,
  [ResourceType.Gold]: 50,
  [ResourceType.Gems]: 40,
  [ResourceType.MagicalComponents]: 30,
  [ResourceType.LuxuryGoods]: 25,
  [ResourceType.Weapons]: 15,
  [ResourceType.Tools]: 10,
  [ResourceType.Fish]: 2,
  [ResourceType.Copper]: 5,
  [ResourceType.Tin]: 6,
  [ResourceType.Coal]: 4,
  [ResourceType.Herbs]: 5,
};

// ── Market interface ─────────────────────────────────────────────────────────

export interface MarketPrice {
  readonly resource: ResourceType;
  price: number;
  supply: number;
  demand: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface SettlementMarket {
  readonly settlementId: SiteId;
  readonly prices: Map<ResourceType, MarketPrice>;
  readonly stockpile: Map<ResourceType, number>;
  specialization: ResourceType | null;
  techLevel: number; // 1-10
  tradeOpenness: number; // 0-100, willingness to trade
}

// ── Trade route interface ────────────────────────────────────────────────────

export interface TradeRoute {
  readonly id: EntityId;
  readonly sourceId: SiteId;
  readonly targetId: SiteId;
  readonly sourceFactionId: FactionId;
  readonly targetFactionId: FactionId;
  resources: readonly ResourceType[];
  volume: number; // Units traded per month
  safetyRating: number; // 0-100, affects volume
  profitability: number; // -100 to 100
  establishedAt: WorldTime;
  isNew: boolean; // True for first 3 months
}

// ── Economic event types ─────────────────────────────────────────────────────

export enum EconomicEventType {
  Boom = 'boom',
  Bust = 'bust',
  Monopoly = 'monopoly',
  Innovation = 'innovation',
  Shortage = 'shortage',
  Surplus = 'surplus',
  TradeDisruption = 'trade_disruption',
  PriceSpike = 'price_spike',
  MarketCrash = 'market_crash',
}

export interface EconomicEvent {
  readonly type: EconomicEventType;
  readonly settlementId: SiteId;
  readonly resource?: ResourceType;
  readonly magnitude: number; // 0-100
  readonly duration: number; // Months
  startTick: number;
}

// ── Production calculation ───────────────────────────────────────────────────

export interface ProductionFactors {
  terrain: number;
  techLevel: number;
  workforce: number;
  specialization: number;
}

/**
 * Calculate resource production for a settlement.
 * Production = terrain × techLevel × workforce × specialization
 */
export function calculateProduction(
  resource: ResourceType,
  biomeType: string,
  population: number,
  techLevel: number,
  specialization: ResourceType | null,
): { amount: number; factors: ProductionFactors } {
  // Base production per 100 population
  const baseProduction = 10;

  // Terrain bonus (default 0.5 for unspecified combos)
  const terrainBonuses = TERRAIN_RESOURCE_BONUSES[biomeType];
  const terrain = terrainBonuses?.[resource] ?? 0.5;

  // Tech level multiplier (1.0 at level 1, up to 2.5 at level 10)
  const techMultiplier = 0.5 + (techLevel / 10) * 2.0;

  // Workforce scales with sqrt of population (diminishing returns)
  const workforce = Math.sqrt(population / 100);

  // Specialization bonus (50% more if specialized in this resource)
  const specializationBonus = specialization === resource ? 1.5 : 1.0;

  const amount = baseProduction * terrain * techMultiplier * workforce * specializationBonus;

  return {
    amount: Math.round(amount * 10) / 10,
    factors: {
      terrain,
      techLevel: techMultiplier,
      workforce,
      specialization: specializationBonus,
    },
  };
}

// ── Market simulation ────────────────────────────────────────────────────────

/**
 * Calculate market price based on supply and demand.
 * Price = basePrice × (demand / supply) × eventModifier
 */
export function calculatePrice(
  resource: ResourceType,
  supply: number,
  demand: number,
  eventModifier = 1.0,
): number {
  const basePrice = BASE_PRICES[resource];

  // Avoid division by zero
  const adjustedSupply = Math.max(supply, 0.1);

  // Price responds to supply/demand ratio
  const ratio = demand / adjustedSupply;

  // Clamp the ratio effect between 0.25x and 4x
  const clampedRatio = Math.max(0.25, Math.min(4.0, ratio));

  const price = basePrice * clampedRatio * eventModifier;

  return Math.round(price * 100) / 100;
}

/**
 * Determine price trend based on recent changes.
 */
export function determineTrend(
  previousPrice: number,
  currentPrice: number,
): 'rising' | 'falling' | 'stable' {
  const change = (currentPrice - previousPrice) / previousPrice;
  if (change > 0.05) return 'rising';
  if (change < -0.05) return 'falling';
  return 'stable';
}

/**
 * Calculate settlement demand for a resource based on population and industry.
 */
export function calculateDemand(
  resource: ResourceType,
  population: number,
  industries: readonly string[],
): number {
  // Base demand scales with population
  let demand = population / 50;

  // Food is always in high demand
  if (resource === ResourceType.Food) {
    demand = population / 20;
  }

  // Industry-specific demand
  if (industries.includes('smithing') && (resource === ResourceType.Iron || resource === ResourceType.Coal)) {
    demand *= 2;
  }
  if (industries.includes('construction') && (resource === ResourceType.Stone || resource === ResourceType.Timber)) {
    demand *= 1.5;
  }
  if (industries.includes('jewelcraft') && (resource === ResourceType.Gems || resource === ResourceType.Gold)) {
    demand *= 2;
  }
  if (industries.includes('magic') && resource === ResourceType.MagicalComponents) {
    demand *= 2.5;
  }
  if (industries.includes('herbalism') && resource === ResourceType.Herbs) {
    demand *= 1.8;
  }

  return Math.round(demand * 10) / 10;
}

// ── Trade network helpers ────────────────────────────────────────────────────

/**
 * Calculate potential profit for a trade route.
 */
export function calculateTradeProfitability(
  sourceMarket: SettlementMarket,
  targetMarket: SettlementMarket,
  resource: ResourceType,
): number {
  const sourcePrice = sourceMarket.prices.get(resource)?.price ?? BASE_PRICES[resource];
  const targetPrice = targetMarket.prices.get(resource)?.price ?? BASE_PRICES[resource];

  // Profit margin as percentage
  const margin = ((targetPrice - sourcePrice) / sourcePrice) * 100;

  return Math.round(margin);
}

/**
 * Check if two settlements can trade based on treaty restrictions.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export function checkTradeAllowed(
  sourceFactionId: FactionId,
  targetFactionId: FactionId,
  resource: ResourceType,
  treatyEnforcement: TreatyEnforcement | null,
): { allowed: true } | { allowed: false; reason: string; violatedTreatyId?: EntityId } {
  if (treatyEnforcement === null) {
    return { allowed: true };
  }

  // Check for trade exclusivity terms
  const treaties = treatyEnforcement.getTreatiesForFaction(sourceFactionId);

  for (const treaty of treaties) {
    for (const term of treaty.terms) {
      if (term.type === TreatyTermType.TradeExclusivity) {
        const params = term.parameters as { resources?: readonly string[] };
        const restrictedResources = params.resources ?? [];

        // If this resource is restricted, check if target is allowed
        if (restrictedResources.includes(resource)) {
          // Trade exclusivity means only trading with treaty partners
          if (!term.parties.includes(targetFactionId)) {
            return {
              allowed: false,
              reason: `Trade exclusivity treaty restricts ${resource} trade to treaty partners`,
              violatedTreatyId: treaty.id,
            };
          }
        }
      }
    }
  }

  return { allowed: true };
}

/**
 * Calculate trade volume based on safety and profitability.
 */
export function calculateTradeVolume(
  baseDemand: number,
  safetyRating: number,
  profitability: number,
  isNew: boolean,
): number {
  // Safety affects volume (bandits, war, etc.)
  const safetyMultiplier = safetyRating / 100;

  // Profitability affects volume (merchants won't trade unprofitable routes)
  const profitMultiplier = profitability > 0 ? 1 + (profitability / 100) : Math.max(0.1, 1 + (profitability / 200));

  // New routes start at 50% capacity
  const newRouteMultiplier = isNew ? 0.5 : 1.0;

  const volume = baseDemand * safetyMultiplier * profitMultiplier * newRouteMultiplier;

  return Math.round(volume * 10) / 10;
}

// ── Economic System ──────────────────────────────────────────────────────────

let nextTradeRouteId = 20000; // Start high to avoid collision

export function createTradeRouteId(): EntityId {
  return nextTradeRouteId++ as EntityId;
}

export function resetTradeRouteIdCounter(): void {
  nextTradeRouteId = 20000;
}

