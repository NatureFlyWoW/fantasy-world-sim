/**
 * Economic System — handles resource production, trade networks, and market simulation.
 * Integrates with Treaty System for TradeExclusivity enforcement.
 * Runs MONTHLY (TickFrequency.Monthly = 30).
 */

import type { EntityId, FactionId, SiteId } from '../ecs/types.js';
import { toFactionId, toEntityId } from '../ecs/types.js';
import type { World } from '../ecs/world.js';
import type { WorldTime } from '../time/types.js';
import { TickFrequency } from '../time/types.js';
import type { WorldClock } from '../time/world-clock.js';
import { EventCategory } from '../events/types.js';
import type { EventBus } from '../events/event-bus.js';
import { createEvent } from '../events/event-factory.js';
import { BaseSystem, ExecutionOrder } from '../engine/system.js';
import type {
  EconomyComponent,
  PopulationComponent,
  OwnershipComponent,
  BiomeComponent,
  PositionComponent,
  MilitaryComponent,
} from '../ecs/component.js';
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

export class EconomicSystem extends BaseSystem {
  readonly name = 'EconomicSystem';
  readonly frequency = TickFrequency.Monthly;
  readonly executionOrder = ExecutionOrder.ECONOMY;

  private markets: Map<number, SettlementMarket> = new Map();
  private tradeRoutes: Map<number, TradeRoute> = new Map();
  private activeEvents: EconomicEvent[] = [];
  private treatyEnforcement: TreatyEnforcement | null = null;

  constructor(treatyEnforcement?: TreatyEnforcement) {
    super();
    this.treatyEnforcement = treatyEnforcement ?? null;
  }

  /**
   * Set the treaty enforcement reference (for integration).
   */
  setTreatyEnforcement(enforcement: TreatyEnforcement): void {
    this.treatyEnforcement = enforcement;
  }

  /**
   * Get the treaty enforcement reference.
   */
  getTreatyEnforcement(): TreatyEnforcement | null {
    return this.treatyEnforcement;
  }

  override initialize(world: World): void {
    super.initialize(world);
    this.initializeMarkets(world);
  }

  /**
   * Initialize markets for all settlements.
   */
  private initializeMarkets(world: World): void {
    const settlements = this.getSettlements(world);

    for (const settlementId of settlements) {
      const market = this.createMarket(settlementId, world);
      this.markets.set(settlementId as number, market);
    }
  }

  /**
   * Create a market for a settlement.
   */
  private createMarket(settlementId: SiteId, world: World): SettlementMarket {
    const economy = world.getComponent<EconomyComponent>(settlementId, 'Economy');
    const population = world.getComponent<PopulationComponent>(settlementId, 'Population');
    const biome = world.getComponent<BiomeComponent>(settlementId, 'Biome');

    const pop = population?.count ?? 100;
    const industries = economy?.industries ?? [];
    const biomeType = biome?.biomeType ?? 'plains';

    // Initialize prices for all resources
    const prices = new Map<ResourceType, MarketPrice>();
    const stockpile = new Map<ResourceType, number>();

    for (const resource of ALL_RESOURCE_TYPES) {
      const supply = this.calculateInitialSupply(resource, biomeType, pop);
      const demand = calculateDemand(resource, pop, industries);
      const price = calculatePrice(resource, supply, demand);

      prices.set(resource, {
        resource,
        price,
        supply,
        demand,
        trend: 'stable',
      });

      stockpile.set(resource, supply);
    }

    // Determine specialization based on terrain
    const specialization = this.determineSpecialization(biomeType);

    return {
      settlementId,
      prices,
      stockpile,
      specialization,
      techLevel: 3, // Default tech level
      tradeOpenness: 50,
    };
  }

  /**
   * Calculate initial supply based on terrain.
   */
  private calculateInitialSupply(
    resource: ResourceType,
    biomeType: string,
    population: number,
  ): number {
    const terrainBonuses = TERRAIN_RESOURCE_BONUSES[biomeType];
    const terrainMultiplier = terrainBonuses?.[resource] ?? 0.3;

    // Base supply scales with population and terrain
    return Math.round((population / 50) * terrainMultiplier * 10) / 10;
  }

  /**
   * Determine settlement specialization based on terrain.
   */
  private determineSpecialization(biomeType: string): ResourceType | null {
    const bonuses = TERRAIN_RESOURCE_BONUSES[biomeType];
    if (bonuses === undefined) return null;

    // Find the resource with highest bonus
    let best: ResourceType | null = null;
    let bestBonus = 0;

    for (const [resource, bonus] of Object.entries(bonuses)) {
      if (bonus > bestBonus) {
        bestBonus = bonus;
        best = resource as ResourceType;
      }
    }

    return best;
  }

  /**
   * Main execution loop.
   */
  execute(world: World, clock: WorldClock, events: EventBus): void {
    // 1. Update production for all settlements
    this.updateProduction(world, clock);

    // 2. Update markets (supply/demand/prices)
    this.updateMarkets(world, clock);

    // 3. Process trade routes
    this.processTradeRoutes(world, clock, events);

    // 4. Evaluate new trade opportunities
    this.evaluateTradeOpportunities(world, clock);

    // 5. Process economic events
    this.processEconomicEvents(world, clock, events);

    // 6. Expire old events
    this.expireEvents(clock);

    // 7. Check for new economic events
    this.checkForNewEvents(world, clock, events);
  }

  /**
   * Update production for all settlements.
   */
  private updateProduction(world: World, _clock: WorldClock): void {
    for (const [settlementIdNum, market] of this.markets) {
      const settlementId = settlementIdNum as SiteId;
      const biome = world.getComponent<BiomeComponent>(settlementId, 'Biome');
      const population = world.getComponent<PopulationComponent>(settlementId, 'Population');

      const biomeType = biome?.biomeType ?? 'plains';
      const pop = population?.count ?? 100;

      // Produce raw resources
      for (const resource of RAW_RESOURCES) {
        const { amount } = calculateProduction(
          resource,
          biomeType,
          pop,
          market.techLevel,
          market.specialization,
        );

        const currentStock = market.stockpile.get(resource) ?? 0;
        market.stockpile.set(resource, currentStock + amount);
      }

      // Produce manufactured goods if we have raw materials
      this.produceManufacturedGoods(market);
    }
  }

  /**
   * Produce manufactured goods from raw materials.
   */
  private produceManufacturedGoods(market: SettlementMarket): void {
    // Weapons require Iron and Coal
    const iron = market.stockpile.get(ResourceType.Iron) ?? 0;
    const coal = market.stockpile.get(ResourceType.Coal) ?? 0;
    if (iron >= 2 && coal >= 1) {
      const weaponsProduced = Math.min(iron / 2, coal);
      market.stockpile.set(ResourceType.Iron, iron - weaponsProduced * 2);
      market.stockpile.set(ResourceType.Coal, coal - weaponsProduced);
      const currentWeapons = market.stockpile.get(ResourceType.Weapons) ?? 0;
      market.stockpile.set(ResourceType.Weapons, currentWeapons + weaponsProduced);
    }

    // Tools require Iron and Timber
    const timber = market.stockpile.get(ResourceType.Timber) ?? 0;
    if (iron >= 1 && timber >= 1) {
      const toolsProduced = Math.min(iron, timber);
      market.stockpile.set(ResourceType.Iron, (market.stockpile.get(ResourceType.Iron) ?? 0) - toolsProduced);
      market.stockpile.set(ResourceType.Timber, timber - toolsProduced);
      const currentTools = market.stockpile.get(ResourceType.Tools) ?? 0;
      market.stockpile.set(ResourceType.Tools, currentTools + toolsProduced);
    }

    // Luxury goods require Gems and Gold
    const gems = market.stockpile.get(ResourceType.Gems) ?? 0;
    const gold = market.stockpile.get(ResourceType.Gold) ?? 0;
    if (gems >= 1 && gold >= 1) {
      const luxuryProduced = Math.min(gems, gold);
      market.stockpile.set(ResourceType.Gems, gems - luxuryProduced);
      market.stockpile.set(ResourceType.Gold, gold - luxuryProduced);
      const currentLuxury = market.stockpile.get(ResourceType.LuxuryGoods) ?? 0;
      market.stockpile.set(ResourceType.LuxuryGoods, currentLuxury + luxuryProduced);
    }
  }

  /**
   * Update market prices based on supply and demand.
   */
  private updateMarkets(world: World, _clock: WorldClock): void {
    for (const [settlementIdNum, market] of this.markets) {
      const settlementId = settlementIdNum as SiteId;
      const population = world.getComponent<PopulationComponent>(settlementId, 'Population');
      const economy = world.getComponent<EconomyComponent>(settlementId, 'Economy');

      const pop = population?.count ?? 100;
      const industries = economy?.industries ?? [];

      for (const resource of ALL_RESOURCE_TYPES) {
        const currentPrice = market.prices.get(resource);
        if (currentPrice === undefined) continue;

        const previousPrice = currentPrice.price;
        const supply = market.stockpile.get(resource) ?? 0;
        const demand = calculateDemand(resource, pop, industries);

        // Check for active events affecting this resource
        const eventModifier = this.getEventModifier(market.settlementId, resource);

        const newPrice = calculatePrice(resource, supply, demand, eventModifier);
        const trend = determineTrend(previousPrice, newPrice);

        market.prices.set(resource, {
          resource,
          price: newPrice,
          supply,
          demand,
          trend,
        });

        // Consume resources based on demand
        const consumed = Math.min(supply, demand * 0.8);
        market.stockpile.set(resource, Math.max(0, supply - consumed));
      }
    }
  }

  /**
   * Get event modifier for a resource in a settlement.
   */
  private getEventModifier(settlementId: SiteId, resource: ResourceType): number {
    let modifier = 1.0;

    for (const event of this.activeEvents) {
      if (event.settlementId !== settlementId) continue;
      if (event.resource !== undefined && event.resource !== resource) continue;

      switch (event.type) {
        case EconomicEventType.Boom:
          modifier *= 0.8; // Prices drop during boom
          break;
        case EconomicEventType.Bust:
          modifier *= 1.3; // Prices rise during bust
          break;
        case EconomicEventType.Shortage:
          modifier *= 1.5 + (event.magnitude / 100);
          break;
        case EconomicEventType.Surplus:
          modifier *= 0.5;
          break;
        case EconomicEventType.PriceSpike:
          modifier *= 2.0;
          break;
        case EconomicEventType.MarketCrash:
          modifier *= 0.3;
          break;
        default:
          break;
      }
    }

    return modifier;
  }

  /**
   * Process existing trade routes.
   */
  private processTradeRoutes(world: World, clock: WorldClock, events: EventBus): void {
    const routesToRemove: EntityId[] = [];

    for (const [routeIdNum, route] of this.tradeRoutes) {
      const sourceMarket = this.markets.get(route.sourceId as number);
      const targetMarket = this.markets.get(route.targetId as number);

      if (sourceMarket === undefined || targetMarket === undefined) {
        routesToRemove.push(routeIdNum as EntityId);
        continue;
      }

      // Check if trade is still allowed (treaty restrictions)
      for (const resource of route.resources) {
        const allowed = checkTradeAllowed(
          route.sourceFactionId,
          route.targetFactionId,
          resource,
          this.treatyEnforcement,
        );

        if (!allowed.allowed) {
          // Emit treaty violation event
          events.emit(createEvent({
            category: EventCategory.Economic,
            subtype: 'economy.trade_exclusivity_violated',
            timestamp: clock.currentTick,
            participants: [route.sourceFactionId, route.targetFactionId],
            significance: 60,
            data: {
              routeId: routeIdNum,
              resource,
              violatedTreatyId: allowed.violatedTreatyId,
            },
          }));

          // Remove route due to treaty violation
          routesToRemove.push(routeIdNum as EntityId);
          continue;
        }
      }

      // Calculate profitability for main traded resource
      const mainResource = route.resources[0];
      if (mainResource !== undefined) {
        route.profitability = calculateTradeProfitability(sourceMarket, targetMarket, mainResource);
      }

      // Update volume based on conditions
      const baseDemand = targetMarket.prices.get(route.resources[0] ?? ResourceType.Food)?.demand ?? 10;
      route.volume = calculateTradeVolume(baseDemand, route.safetyRating, route.profitability, route.isNew);

      // Transfer goods
      for (const resource of route.resources) {
        const sourceStock = sourceMarket.stockpile.get(resource) ?? 0;
        const transferAmount = Math.min(sourceStock, route.volume);

        if (transferAmount > 0) {
          sourceMarket.stockpile.set(resource, sourceStock - transferAmount);
          const targetStock = targetMarket.stockpile.get(resource) ?? 0;
          targetMarket.stockpile.set(resource, targetStock + transferAmount);

          // Update economy components
          this.updateTradeVolume(world, route.sourceId, transferAmount);
          this.updateTradeVolume(world, route.targetId, transferAmount);
        }
      }

      // Route matures after 3 months
      if (route.isNew) {
        const monthsSinceEstablished = Math.floor(
          (clock.currentTick - this.worldTimeToTicks(route.establishedAt)) / 30
        );
        if (monthsSinceEstablished >= 3) {
          route.isNew = false;
        }
      }

      // Remove unprofitable routes
      if (route.profitability < -50 && !route.isNew) {
        routesToRemove.push(routeIdNum as EntityId);
      }
    }

    // Clean up routes
    for (const routeId of routesToRemove) {
      this.tradeRoutes.delete(routeId as number);
    }
  }

  /**
   * Convert WorldTime to ticks.
   */
  private worldTimeToTicks(time: WorldTime): number {
    return (time.year - 1) * 360 + (time.month - 1) * 30 + (time.day - 1);
  }

  /**
   * Update trade volume in economy component.
   */
  private updateTradeVolume(world: World, settlementId: SiteId, amount: number): void {
    const economy = world.getComponent<EconomyComponent>(settlementId, 'Economy');
    if (economy !== undefined) {
      economy.tradeVolume += amount;
    }
  }

  /**
   * Evaluate and create new trade opportunities.
   */
  private evaluateTradeOpportunities(world: World, clock: WorldClock): void {
    const settlements = Array.from(this.markets.keys());

    // Limit evaluation to prevent O(n²) explosion
    const maxEvaluations = 50;
    let evaluations = 0;

    for (let i = 0; i < settlements.length && evaluations < maxEvaluations; i++) {
      const sourceIdNum = settlements[i];
      if (sourceIdNum === undefined) continue;
      const sourceId = sourceIdNum as SiteId;
      const sourceMarket = this.markets.get(sourceIdNum);
      if (sourceMarket === undefined) continue;

      const sourceFactionId = this.getSettlementFaction(world, sourceId);
      if (sourceFactionId === null) continue;

      for (let j = i + 1; j < settlements.length && evaluations < maxEvaluations; j++) {
        const targetIdNum = settlements[j];
        if (targetIdNum === undefined) continue;
        const targetId = targetIdNum as SiteId;
        const targetMarket = this.markets.get(targetIdNum);
        if (targetMarket === undefined) continue;

        const targetFactionId = this.getSettlementFaction(world, targetId);
        if (targetFactionId === null) continue;

        evaluations++;

        // Check if route already exists
        if (this.routeExists(sourceId, targetId)) continue;

        // Find profitable trade opportunities
        const opportunities = this.findTradeOpportunities(
          sourceMarket,
          targetMarket,
          sourceFactionId,
          targetFactionId,
        );

        // Create route if profitable enough
        if (opportunities.length > 0 && opportunities[0]!.profit > 20) {
          this.createTradeRoute(
            sourceId,
            targetId,
            sourceFactionId,
            targetFactionId,
            opportunities.map(o => o.resource),
            clock.currentTime,
            world,
          );
        }
      }
    }
  }

  /**
   * Find trade opportunities between two markets.
   */
  private findTradeOpportunities(
    sourceMarket: SettlementMarket,
    targetMarket: SettlementMarket,
    sourceFactionId: FactionId,
    targetFactionId: FactionId,
  ): { resource: ResourceType; profit: number }[] {
    const opportunities: { resource: ResourceType; profit: number }[] = [];

    for (const resource of ALL_RESOURCE_TYPES) {
      // Check treaty restrictions
      const allowed = checkTradeAllowed(sourceFactionId, targetFactionId, resource, this.treatyEnforcement);
      if (!allowed.allowed) continue;

      const profit = calculateTradeProfitability(sourceMarket, targetMarket, resource);

      if (profit > 10) {
        opportunities.push({ resource, profit });
      }
    }

    // Sort by profit descending
    return opportunities.sort((a, b) => b.profit - a.profit);
  }

  /**
   * Check if a trade route already exists between two settlements.
   */
  private routeExists(sourceId: SiteId, targetId: SiteId): boolean {
    for (const route of this.tradeRoutes.values()) {
      if (
        (route.sourceId === sourceId && route.targetId === targetId) ||
        (route.sourceId === targetId && route.targetId === sourceId)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a new trade route.
   */
  private createTradeRoute(
    sourceId: SiteId,
    targetId: SiteId,
    sourceFactionId: FactionId,
    targetFactionId: FactionId,
    resources: ResourceType[],
    establishedAt: WorldTime,
    world: World,
  ): TradeRoute {
    const routeId = createTradeRouteId();

    // Calculate safety based on distance and faction relations
    const safetyRating = this.calculateRouteSafety(world, sourceId, targetId, sourceFactionId, targetFactionId);

    const route: TradeRoute = {
      id: routeId,
      sourceId,
      targetId,
      sourceFactionId,
      targetFactionId,
      resources,
      volume: 0,
      safetyRating,
      profitability: 0,
      establishedAt,
      isNew: true,
    };

    this.tradeRoutes.set(routeId as number, route);
    return route;
  }

  /**
   * Calculate route safety based on various factors.
   */
  private calculateRouteSafety(
    world: World,
    sourceId: SiteId,
    targetId: SiteId,
    sourceFactionId: FactionId,
    targetFactionId: FactionId,
  ): number {
    let safety = 70; // Base safety

    // Same faction = safer
    if (sourceFactionId === targetFactionId) {
      safety += 20;
    }

    // Check for military presence (simplified)
    const sourceMilitary = world.getComponent<MilitaryComponent>(sourceFactionId, 'Military');
    const targetMilitary = world.getComponent<MilitaryComponent>(targetFactionId, 'Military');

    const avgMilitary = ((sourceMilitary?.strength ?? 0) + (targetMilitary?.strength ?? 0)) / 2;
    safety += Math.min(10, avgMilitary / 10);

    // Distance penalty (simplified - use positions if available)
    const sourcePos = world.getComponent<PositionComponent>(sourceId, 'Position');
    const targetPos = world.getComponent<PositionComponent>(targetId, 'Position');

    if (sourcePos !== undefined && targetPos !== undefined) {
      const distance = Math.sqrt(
        Math.pow(targetPos.x - sourcePos.x, 2) + Math.pow(targetPos.y - sourcePos.y, 2)
      );
      safety -= Math.min(20, distance / 10);
    }

    return Math.max(10, Math.min(100, safety));
  }

  /**
   * Get the faction that owns a settlement.
   */
  private getSettlementFaction(world: World, settlementId: SiteId): FactionId | null {
    const ownership = world.getComponent<OwnershipComponent>(settlementId, 'Ownership');
    if (ownership === undefined || ownership.ownerId === null) return null;
    return toFactionId(toEntityId(ownership.ownerId));
  }

  /**
   * Process active economic events.
   */
  private processEconomicEvents(_world: World, _clock: WorldClock, _events: EventBus): void {
    for (const event of this.activeEvents) {
      const market = this.markets.get(event.settlementId as number);
      if (market === undefined) continue;

      switch (event.type) {
        case EconomicEventType.Innovation:
          // Increase tech level temporarily
          market.techLevel = Math.min(10, market.techLevel + 0.1);
          break;
        case EconomicEventType.TradeDisruption:
          // Reduce trade openness
          market.tradeOpenness = Math.max(0, market.tradeOpenness - 5);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Expire old economic events.
   */
  private expireEvents(clock: WorldClock): void {
    this.activeEvents = this.activeEvents.filter(event => {
      const monthsElapsed = Math.floor((clock.currentTick - event.startTick) / 30);
      return monthsElapsed < event.duration;
    });
  }

  /**
   * Check for new economic events based on market conditions.
   */
  private checkForNewEvents(world: World, clock: WorldClock, events: EventBus): void {
    for (const [settlementIdNum, market] of this.markets) {
      const settlementId = settlementIdNum as SiteId;

      // Check for shortages
      for (const resource of ALL_RESOURCE_TYPES) {
        const priceInfo = market.prices.get(resource);
        if (priceInfo === undefined) continue;

        const stock = market.stockpile.get(resource) ?? 0;

        // Shortage: very low supply with high demand
        if (stock < 1 && priceInfo.demand > 5) {
          this.triggerEconomicEvent(
            EconomicEventType.Shortage,
            settlementId,
            resource,
            70,
            3,
            clock,
            events,
          );
        }

        // Surplus: very high supply with low demand
        if (stock > priceInfo.demand * 5 && stock > 20) {
          this.triggerEconomicEvent(
            EconomicEventType.Surplus,
            settlementId,
            resource,
            50,
            2,
            clock,
            events,
          );
        }

        // Price spike: rapid price increase
        if (priceInfo.trend === 'rising' && priceInfo.price > BASE_PRICES[resource] * 3) {
          this.triggerEconomicEvent(
            EconomicEventType.PriceSpike,
            settlementId,
            resource,
            60,
            2,
            clock,
            events,
          );
        }
      }

      // Check for boom/bust based on overall wealth
      const economy = world.getComponent<EconomyComponent>(settlementId, 'Economy');
      if (economy !== undefined) {
        if (economy.wealth > 1000 && economy.tradeVolume > 500) {
          this.triggerEconomicEvent(
            EconomicEventType.Boom,
            settlementId,
            undefined,
            60,
            6,
            clock,
            events,
          );
        }

        if (economy.wealth < 100 && economy.tradeVolume < 50) {
          this.triggerEconomicEvent(
            EconomicEventType.Bust,
            settlementId,
            undefined,
            70,
            6,
            clock,
            events,
          );
        }
      }
    }
  }

  /**
   * Trigger a new economic event.
   */
  private triggerEconomicEvent(
    type: EconomicEventType,
    settlementId: SiteId,
    resource: ResourceType | undefined,
    magnitude: number,
    duration: number,
    clock: WorldClock,
    events: EventBus,
  ): void {
    // Check if similar event already active
    const alreadyActive = this.activeEvents.some(
      e => e.settlementId === settlementId && e.type === type && e.resource === resource
    );
    if (alreadyActive) return;

    const economicEvent: EconomicEvent = {
      type,
      settlementId,
      magnitude,
      duration,
      startTick: clock.currentTick,
    };
    if (resource !== undefined) {
      (economicEvent as { resource: ResourceType }).resource = resource;
    }

    this.activeEvents.push(economicEvent);

    // Emit world event
    events.emit(createEvent({
      category: EventCategory.Economic,
      subtype: `economy.${type}`,
      timestamp: clock.currentTick,
      participants: [settlementId],
      significance: magnitude,
      data: {
        eventType: type,
        resource,
        magnitude,
        duration,
      },
    }));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get market data for a settlement.
   */
  getMarket(settlementId: SiteId): SettlementMarket | undefined {
    return this.markets.get(settlementId as number);
  }

  /**
   * Get all markets.
   */
  getAllMarkets(): ReadonlyMap<number, SettlementMarket> {
    return this.markets;
  }

  /**
   * Get all trade routes.
   */
  getAllTradeRoutes(): ReadonlyMap<number, TradeRoute> {
    return this.tradeRoutes;
  }

  /**
   * Get trade routes for a settlement.
   */
  getTradeRoutesForSettlement(settlementId: SiteId): readonly TradeRoute[] {
    const routes: TradeRoute[] = [];
    for (const route of this.tradeRoutes.values()) {
      if (route.sourceId === settlementId || route.targetId === settlementId) {
        routes.push(route);
      }
    }
    return routes;
  }

  /**
   * Get active economic events.
   */
  getActiveEvents(): readonly EconomicEvent[] {
    return this.activeEvents;
  }

  /**
   * Get events affecting a settlement.
   */
  getEventsForSettlement(settlementId: SiteId): readonly EconomicEvent[] {
    return this.activeEvents.filter(e => e.settlementId === settlementId);
  }

  /**
   * Manually add a trade route (for testing or initialization).
   */
  addTradeRoute(route: TradeRoute): void {
    this.tradeRoutes.set(route.id as number, route);
  }

  /**
   * Manually add a market (for testing).
   */
  addMarket(market: SettlementMarket): void {
    this.markets.set(market.settlementId as number, market);
  }

  /**
   * Get number of active trade routes.
   */
  get tradeRouteCount(): number {
    return this.tradeRoutes.size;
  }

  /**
   * Get number of markets.
   */
  get marketCount(): number {
    return this.markets.size;
  }

  /**
   * Clear all data (for testing).
   */
  clear(): void {
    this.markets.clear();
    this.tradeRoutes.clear();
    this.activeEvents = [];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Get all settlements (entities with Economy component).
   */
  private getSettlements(world: World): SiteId[] {
    return world.query('Economy', 'Population').map(id => id as SiteId);
  }
}
