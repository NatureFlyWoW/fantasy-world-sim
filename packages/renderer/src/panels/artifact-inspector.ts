/**
 * Artifact Inspector - renders detailed artifact information.
 * Provides sections: overview, creation, powers, consciousness, ownership chain, curses, significance, history.
 */

import type { EntityId } from '@fws/core';
import type { RenderContext } from '../types.js';
import type { InspectorSection, InspectorMode } from './inspector-panel.js';

/**
 * Bar rendering constants.
 */
const BAR_WIDTH = 20;
const FILLED_BLOCK = '█';
const EMPTY_BLOCK = '░';

/**
 * Artifact inspector sub-component.
 */
export class ArtifactInspector {
  /**
   * Get available sections for artifact inspection.
   */
  getSections(): InspectorSection[] {
    return [
      { id: 'overview', title: 'Overview', collapsed: false },
      { id: 'creation', title: 'Creation', collapsed: false },
      { id: 'powers', title: 'Powers', collapsed: false },
      { id: 'consciousness', title: 'Consciousness', collapsed: true },
      { id: 'ownership', title: 'Ownership Chain', collapsed: true },
      { id: 'curses', title: 'Curses', collapsed: true },
      { id: 'significance', title: 'Significance', collapsed: true },
      { id: 'history', title: 'History', collapsed: true },
    ];
  }

  /**
   * Render artifact information.
   */
  render(
    entityId: EntityId,
    context: RenderContext,
    sections: readonly InspectorSection[],
    mode: InspectorMode
  ): string[] {
    const lines: string[] = [];

    switch (mode) {
      case 'overview':
        lines.push(...this.renderOverview(entityId, context, sections));
        break;
      case 'relationships':
        lines.push(...this.renderOwnershipMode(entityId, context));
        break;
      case 'timeline':
        lines.push(...this.renderTimelineMode(entityId, context));
        break;
      case 'details':
        lines.push(...this.renderDetailsMode(entityId, context));
        break;
    }

    return lines;
  }

  /**
   * Render overview mode with collapsible sections.
   */
  private renderOverview(
    entityId: EntityId,
    context: RenderContext,
    sections: readonly InspectorSection[]
  ): string[] {
    const lines: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (section === undefined) continue;

      const indicator = section.collapsed ? '▶' : '▼';
      const num = i + 1;
      lines.push(`${indicator} [${num}] ${section.title}`);

      if (!section.collapsed) {
        const content = this.renderSection(section.id, entityId, context);
        lines.push(...content.map(line => `  ${line}`));
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Render a specific section.
   */
  private renderSection(sectionId: string, entityId: EntityId, context: RenderContext): string[] {
    switch (sectionId) {
      case 'overview':
        return this.renderOverviewSection(entityId, context);
      case 'creation':
        return this.renderCreation(entityId, context);
      case 'powers':
        return this.renderPowers(entityId, context);
      case 'consciousness':
        return this.renderConsciousness(entityId, context);
      case 'ownership':
        return this.renderOwnershipChain(entityId, context);
      case 'curses':
        return this.renderCurses(entityId, context);
      case 'significance':
        return this.renderSignificance(entityId, context);
      case 'history':
        return this.renderHistory(entityId, context);
      default:
        return ['Unknown section'];
    }
  }

  /**
   * Render overview section with basic info.
   */
  private renderOverviewSection(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Get status for name
    const status = world.hasStore('Status')
      ? world.getComponent(entityId, 'Status') as { titles?: string[] } | undefined
      : undefined;

    // Get value
    const value = world.hasStore('Value')
      ? world.getComponent(entityId, 'Value') as {
          monetaryValue?: number;
          sentimentalValue?: number;
          magicalValue?: number;
        } | undefined
      : undefined;

    // Get current location
    const location = world.hasStore('Location')
      ? world.getComponent(entityId, 'Location') as { currentLocationId?: number | null } | undefined
      : undefined;

    // Name
    if (status?.titles !== undefined && status.titles.length > 0) {
      lines.push(`Name: ${status.titles[0] ?? 'Unknown Artifact'}`);
      if (status.titles.length > 1) {
        lines.push(`Also known as: ${status.titles.slice(1).join(', ')}`);
      }
    } else {
      lines.push(`Artifact #${entityId}`);
    }

    // Current location
    if (location?.currentLocationId !== undefined && location.currentLocationId !== null) {
      lines.push(`Location: #${location.currentLocationId}`);
    } else {
      lines.push('Location: Unknown');
    }

    // Value summary
    if (value !== undefined) {
      const totalValue = (value.monetaryValue ?? 0) + (value.magicalValue ?? 0);
      if (totalValue > 0) {
        const rarity = this.getRarityLabel(totalValue);
        lines.push(`Rarity: ${rarity}`);
      }
    }

    return lines;
  }

  /**
   * Get rarity label based on value.
   */
  private getRarityLabel(value: number): string {
    if (value >= 10000) return 'Legendary';
    if (value >= 5000) return 'Epic';
    if (value >= 1000) return 'Rare';
    if (value >= 500) return 'Uncommon';
    return 'Common';
  }

  /**
   * Render creation section.
   */
  private renderCreation(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const creation = world.hasStore('CreationHistory')
      ? world.getComponent(entityId, 'CreationHistory') as {
          creatorId?: number;
          creationTick?: number;
          method?: string;
        } | undefined
      : undefined;

    const origin = world.hasStore('Origin')
      ? world.getComponent(entityId, 'Origin') as {
          founderId?: number | null;
          foundingTick?: number;
          foundingLocation?: number | null;
        } | undefined
      : undefined;

    if (creation !== undefined) {
      if (creation.creatorId !== undefined) {
        lines.push(`Creator: Character #${creation.creatorId}`);
      }
      if (creation.creationTick !== undefined) {
        const year = Math.floor(creation.creationTick / 360) + 1;
        lines.push(`Created: Year ${year}`);
      }
      if (creation.method !== undefined) {
        lines.push(`Method: ${creation.method}`);
      }
    } else if (origin !== undefined) {
      if (origin.founderId !== undefined && origin.founderId !== null) {
        lines.push(`Creator: Character #${origin.founderId}`);
      }
      if (origin.foundingTick !== undefined) {
        const year = Math.floor(origin.foundingTick / 360) + 1;
        lines.push(`Created: Year ${year}`);
      }
      if (origin.foundingLocation !== undefined && origin.foundingLocation !== null) {
        lines.push(`Place of Creation: Location #${origin.foundingLocation}`);
      }
    } else {
      lines.push('Origin unknown');
    }

    return lines;
  }

  /**
   * Render powers section.
   */
  private renderPowers(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const magical = world.hasStore('MagicalProperty')
      ? world.getComponent(entityId, 'MagicalProperty') as {
          enchantments?: string[];
          powerLevel?: number;
        } | undefined
      : undefined;

    const power = world.hasStore('Power')
      ? world.getComponent(entityId, 'Power') as {
          abilities?: string[];
          manaPool?: number;
          rechargeRate?: number;
        } | undefined
      : undefined;

    const powerLevel = world.hasStore('PowerLevel')
      ? world.getComponent(entityId, 'PowerLevel') as { tier?: number; potency?: number } | undefined
      : undefined;

    if (powerLevel !== undefined) {
      if (powerLevel.tier !== undefined) {
        const tierName = this.getPowerTierName(powerLevel.tier);
        lines.push(`Power Tier: ${tierName} (${powerLevel.tier})`);
      }
      if (powerLevel.potency !== undefined) {
        const bar = this.renderBar(powerLevel.potency, 100);
        lines.push(`Potency: ${bar} ${powerLevel.potency}%`);
      }
    }

    if (magical !== undefined) {
      if (magical.powerLevel !== undefined && powerLevel === undefined) {
        const bar = this.renderBar(magical.powerLevel, 100);
        lines.push(`Power Level: ${bar} ${magical.powerLevel}%`);
      }

      if (magical.enchantments !== undefined && magical.enchantments.length > 0) {
        lines.push('');
        lines.push('Enchantments:');
        for (const enchant of magical.enchantments) {
          lines.push(`  ✦ ${enchant}`);
        }
      }
    }

    if (power !== undefined) {
      if (power.abilities !== undefined && power.abilities.length > 0) {
        lines.push('');
        lines.push('Abilities:');
        for (const ability of power.abilities) {
          lines.push(`  ★ ${ability}`);
        }
      }

      if (power.manaPool !== undefined) {
        lines.push('');
        lines.push(`Mana Pool: ${power.manaPool}`);
        if (power.rechargeRate !== undefined) {
          lines.push(`Recharge Rate: ${power.rechargeRate}/day`);
        }
      }
    }

    if (lines.length === 0) {
      lines.push('No magical properties detected');
    }

    return lines;
  }

  /**
   * Get power tier name.
   */
  private getPowerTierName(tier: number): string {
    switch (tier) {
      case 1:
        return 'Minor';
      case 2:
        return 'Lesser';
      case 3:
        return 'Moderate';
      case 4:
        return 'Greater';
      case 5:
        return 'Major';
      case 6:
        return 'Supreme';
      default:
        return tier > 6 ? 'Divine' : 'Mundane';
    }
  }

  /**
   * Render consciousness section (for sentient artifacts).
   */
  private renderConsciousness(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    // Check for personality (indicates consciousness)
    const personality = world.hasStore('Personality')
      ? world.getComponent(entityId, 'Personality') as {
          openness?: number;
          conscientiousness?: number;
          extraversion?: number;
          agreeableness?: number;
          neuroticism?: number;
        } | undefined
      : undefined;

    const goals = world.hasStore('Goal')
      ? world.getComponent(entityId, 'Goal') as { objectives?: string[] } | undefined
      : undefined;

    const traits = world.hasStore('Traits')
      ? world.getComponent(entityId, 'Traits') as { traits?: string[] } | undefined
      : undefined;

    if (personality !== undefined) {
      lines.push('Status: SENTIENT');
      lines.push('');
      lines.push('Personality:');

      const bigFive: Array<[string, number | undefined]> = [
        ['Openness', personality.openness],
        ['Conscientiousness', personality.conscientiousness],
        ['Extraversion', personality.extraversion],
        ['Agreeableness', personality.agreeableness],
        ['Neuroticism', personality.neuroticism],
      ];

      for (const [name, value] of bigFive) {
        const v = value ?? 50;
        const bar = this.renderBar(v, 100);
        lines.push(`  ${name.slice(0, 4)}: ${bar} ${v}`);
      }

      if (traits?.traits !== undefined && traits.traits.length > 0) {
        lines.push('');
        lines.push('Traits:');
        for (const trait of traits.traits) {
          lines.push(`  • ${trait}`);
        }
      }

      if (goals?.objectives !== undefined && goals.objectives.length > 0) {
        lines.push('');
        lines.push('Goals:');
        for (const objective of goals.objectives) {
          lines.push(`  → ${objective}`);
        }
      }
    } else {
      lines.push('Status: Non-sentient');
      lines.push('');
      lines.push('This artifact does not possess consciousness.');
    }

    return lines;
  }

  /**
   * Render ownership chain section.
   */
  private renderOwnershipChain(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const ownershipChain = world.hasStore('OwnershipChain')
      ? world.getComponent(entityId, 'OwnershipChain') as {
          owners?: Array<{ ownerId: number; fromTick: number; toTick: number | null }>;
        } | undefined
      : undefined;

    const guardian = world.hasStore('Guardian')
      ? world.getComponent(entityId, 'Guardian') as { guardianId?: number | null; protectionLevel?: number } | undefined
      : undefined;

    if (guardian !== undefined) {
      if (guardian.guardianId !== undefined && guardian.guardianId !== null) {
        lines.push(`Current Guardian: Character #${guardian.guardianId}`);
        if (guardian.protectionLevel !== undefined) {
          const bar = this.renderBar(guardian.protectionLevel, 100);
          lines.push(`Protection Level: ${bar} ${guardian.protectionLevel}%`);
        }
        lines.push('');
      }
    }

    if (ownershipChain?.owners !== undefined && ownershipChain.owners.length > 0) {
      lines.push('Ownership History:');

      // Sort by fromTick descending (most recent first)
      const sorted = [...ownershipChain.owners].sort((a, b) => b.fromTick - a.fromTick);

      for (const owner of sorted) {
        const fromYear = Math.floor(owner.fromTick / 360) + 1;
        const toYear = owner.toTick !== null ? Math.floor(owner.toTick / 360) + 1 : 'present';
        lines.push(`  Y${fromYear}-${toYear}: Character #${owner.ownerId}`);
      }
    } else {
      lines.push('No ownership records');
    }

    return lines;
  }

  /**
   * Render curses section.
   */
  private renderCurses(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const curse = world.hasStore('Curse')
      ? world.getComponent(entityId, 'Curse') as {
          curseType?: string;
          severity?: number;
          breakCondition?: string | null;
        } | undefined
      : undefined;

    if (curse !== undefined && curse.curseType !== undefined) {
      lines.push('⚠ CURSED ⚠');
      lines.push('');
      lines.push(`Curse Type: ${curse.curseType}`);

      if (curse.severity !== undefined) {
        const bar = this.renderBar(curse.severity, 100);
        const label = curse.severity >= 75 ? 'SEVERE' : curse.severity >= 50 ? 'Moderate' : 'Minor';
        lines.push(`Severity: ${bar} ${label}`);
      }

      if (curse.breakCondition !== undefined && curse.breakCondition !== null) {
        lines.push('');
        lines.push('Breaking Condition:');
        lines.push(`  ${curse.breakCondition}`);
      } else {
        lines.push('');
        lines.push('Breaking Condition: Unknown');
      }
    } else {
      lines.push('No curses detected');
    }

    return lines;
  }

  /**
   * Render significance section.
   */
  private renderSignificance(entityId: EntityId, context: RenderContext): string[] {
    const { world } = context;
    const lines: string[] = [];

    const significance = world.hasStore('Significance')
      ? world.getComponent(entityId, 'Significance') as {
          historicalValue?: number;
          legendaryStatus?: boolean;
          associatedEvents?: number[];
        } | undefined
      : undefined;

    const value = world.hasStore('Value')
      ? world.getComponent(entityId, 'Value') as {
          monetaryValue?: number;
          sentimentalValue?: number;
          magicalValue?: number;
        } | undefined
      : undefined;

    if (significance !== undefined) {
      if (significance.legendaryStatus === true) {
        lines.push('★★★ LEGENDARY ARTIFACT ★★★');
        lines.push('');
      }

      if (significance.historicalValue !== undefined) {
        const bar = this.renderBar(significance.historicalValue, 100);
        lines.push(`Historical Value: ${bar} ${significance.historicalValue}%`);
      }

      if (significance.associatedEvents !== undefined && significance.associatedEvents.length > 0) {
        lines.push('');
        lines.push(`Associated with ${significance.associatedEvents.length} historical events`);
      }
    }

    if (value !== undefined) {
      lines.push('');
      lines.push('Value Assessment:');
      if (value.monetaryValue !== undefined) {
        lines.push(`  Monetary: ${value.monetaryValue.toLocaleString()} gold`);
      }
      if (value.magicalValue !== undefined) {
        lines.push(`  Magical: ${value.magicalValue.toLocaleString()}`);
      }
      if (value.sentimentalValue !== undefined && value.sentimentalValue > 0) {
        lines.push(`  Sentimental: ${value.sentimentalValue.toLocaleString()}`);
      }
    }

    if (lines.length === 0) {
      lines.push('Significance unknown');
    }

    return lines;
  }

  /**
   * Render history section.
   */
  private renderHistory(entityId: EntityId, context: RenderContext): string[] {
    const { eventLog } = context;
    const lines: string[] = [];

    const events = eventLog.getByEntity(entityId);

    if (events.length > 0) {
      lines.push('Event History:');

      const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
      const toShow = sorted.slice(0, 15);

      for (const event of toShow) {
        const year = Math.floor(event.timestamp / 360) + 1;
        const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
        lines.push(`  Y${year}: ${desc}`);
      }

      if (sorted.length > 15) {
        lines.push(`  ... and ${sorted.length - 15} more events`);
      }
    } else {
      lines.push('No recorded events');
    }

    return lines;
  }

  /**
   * Render an ASCII bar.
   */
  private renderBar(value: number, maxValue: number): string {
    const normalized = Math.max(0, Math.min(1, value / maxValue));
    const filledCount = Math.round(normalized * BAR_WIDTH);
    const emptyCount = BAR_WIDTH - filledCount;

    return FILLED_BLOCK.repeat(filledCount) + EMPTY_BLOCK.repeat(emptyCount);
  }

  /**
   * Render ownership mode (full ownership chain).
   */
  private renderOwnershipMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Ownership History ═══');
    lines.push('');
    lines.push(...this.renderOwnershipChain(entityId, context));
    return lines;
  }

  /**
   * Render full timeline mode.
   */
  private renderTimelineMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Artifact Timeline ═══');
    lines.push('');

    const { eventLog } = context;
    const events = eventLog.getByEntity(entityId);

    if (events.length === 0) {
      lines.push('No events recorded');
      return lines;
    }

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sorted) {
      const year = Math.floor(event.timestamp / 360) + 1;
      const day = (event.timestamp % 360) + 1;
      const desc = (event.data as Record<string, unknown>)['description'] ?? event.subtype;
      lines.push(`Y${year}D${day}: ${desc}`);
      lines.push(`  Category: ${event.category}, Significance: ${event.significance}`);
      lines.push('');
    }

    return lines;
  }

  /**
   * Render full details mode.
   */
  private renderDetailsMode(entityId: EntityId, context: RenderContext): string[] {
    const lines: string[] = [];
    lines.push('═══ Full Details ═══');
    lines.push('');

    const allSections = ['overview', 'creation', 'powers', 'consciousness', 'ownership', 'curses', 'significance', 'history'];

    for (const sectionId of allSections) {
      const title = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      lines.push(`─── ${title} ───`);
      lines.push(...this.renderSection(sectionId, entityId, context));
      lines.push('');
    }

    return lines;
  }
}
