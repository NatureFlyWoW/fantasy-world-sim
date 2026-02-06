/**
 * NarrativeEngine transforms WorldEvents into prose.
 * Uses templates, applies tone-specific vocabulary, and adds literary devices.
 */

import type { WorldEvent } from '@fws/core';
import type {
  NarrativeTemplate,
  NarrativeOutput,
  NarrativeEngineConfig,
  TemplateContext,
  EntityResolver,
  ResolvedEntity,
  Gender,
} from '../templates/types.js';
import { NarrativeTone, DEFAULT_ENGINE_CONFIG } from '../templates/types.js';
import {
  TemplateParser,
  createDefaultResolver,
} from './template-parser.js';
import type { EvaluationContext } from './template-parser.js';
import { TONE_CONFIGS, applySubstitutions, getRandomPhrase } from '../styles/tones.js';

/**
 * Template registry organized by category and subtype.
 */
interface TemplateRegistry {
  /** Templates indexed by category -> subtype -> tone -> significance */
  readonly byCategory: Map<string, Map<string, NarrativeTemplate[]>>;
  /** Default fallback templates by category */
  readonly defaults: Map<string, NarrativeTemplate[]>;
  /** Global fallback template */
  readonly globalFallback: NarrativeTemplate;
}

/**
 * Result of template selection.
 */
interface TemplateMatch {
  readonly template: NarrativeTemplate;
  readonly matchQuality: 'exact' | 'category' | 'fallback';
}

/**
 * NarrativeEngine generates prose from events.
 */
export class NarrativeEngine {
  private readonly registry: TemplateRegistry;
  private readonly parser: TemplateParser;
  private readonly config: NarrativeEngineConfig;
  private readonly resolver: EntityResolver;

  /** Track first mentions for epithet insertion */
  private mentionedEntities: Set<string> = new Set();

  constructor(
    templates: readonly NarrativeTemplate[],
    config: Partial<NarrativeEngineConfig> = {},
    resolver?: EntityResolver
  ) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.parser = new TemplateParser();
    this.resolver = resolver ?? createDefaultResolver();
    this.registry = this.buildRegistry(templates);
  }

  /**
   * Build the template registry from a list of templates.
   */
  private buildRegistry(templates: readonly NarrativeTemplate[]): TemplateRegistry {
    const byCategory = new Map<string, Map<string, NarrativeTemplate[]>>();
    const defaults = new Map<string, NarrativeTemplate[]>();

    for (const template of templates) {
      // Index by category
      let categoryMap = byCategory.get(template.category);
      if (categoryMap === undefined) {
        categoryMap = new Map();
        byCategory.set(template.category, categoryMap);
      }

      // Index by subtype within category
      let subtypeTemplates = categoryMap.get(template.subtype);
      if (subtypeTemplates === undefined) {
        subtypeTemplates = [];
        categoryMap.set(template.subtype, subtypeTemplates);
      }
      subtypeTemplates.push(template);

      // Track default templates (subtype = 'default')
      if (template.subtype === 'default') {
        let categoryDefaults = defaults.get(template.category);
        if (categoryDefaults === undefined) {
          categoryDefaults = [];
          defaults.set(template.category, categoryDefaults);
        }
        categoryDefaults.push(template);
      }
    }

    // Create global fallback template - uses subtype for description since
    // event.data.description is not always available
    const globalFallback: NarrativeTemplate = {
      id: '__global_fallback__',
      category: 'Personal' as unknown as import('@fws/core').EventCategory,
      subtype: 'default',
      tone: NarrativeTone.EpicHistorical,
      significanceRange: { min: 0, max: 100 },
      template: '{#if character.name}{character.name} was involved in an event.{#else}An event of note occurred.{/if}',
      requiredContext: [],
    };

    return { byCategory, defaults, globalFallback };
  }

  /**
   * Normalize a subtype for template matching.
   * Handles prefixed subtypes like "culture.technology_invented" → "technology_invention".
   */
  private normalizeSubtype(subtype: string): string[] {
    const variants: string[] = [];

    // Add exact subtype first
    variants.push(subtype);

    // If subtype has a prefix (e.g., "culture.technology_invented"), try suffix
    const dotIndex = subtype.lastIndexOf('.');
    if (dotIndex >= 0) {
      const suffix = subtype.slice(dotIndex + 1);
      variants.push(suffix);

      // Try common transformations for past tense → noun form
      // technology_invented → technology_invention
      // movement_spread → movement
      if (suffix.endsWith('_invented')) {
        variants.push(suffix.replace('_invented', '_invention'));
      }
      if (suffix.endsWith('_created')) {
        variants.push(suffix.replace('_created', ''));
      }
      if (suffix.endsWith('_founded')) {
        variants.push(suffix.replace('_founded', '_school'));
      }
      if (suffix.endsWith('_born')) {
        variants.push(suffix.replace('_born', ''));
      }
      if (suffix.endsWith('_emerged')) {
        variants.push(suffix.replace('_emerged', '_change'));
      }
    }

    return variants;
  }

  /**
   * Find the best matching template for an event.
   */
  private findTemplate(
    event: WorldEvent,
    tone: NarrativeTone
  ): TemplateMatch {
    const categoryMap = this.registry.byCategory.get(event.category);

    // Try multiple subtype variations
    if (categoryMap !== undefined) {
      const subtypeVariants = this.normalizeSubtype(event.subtype);
      for (const variant of subtypeVariants) {
        const subtypeTemplates = categoryMap.get(variant);
        if (subtypeTemplates !== undefined) {
          const match = this.selectBestTemplate(subtypeTemplates, tone, event.significance);
          if (match !== undefined) {
            return { template: match, matchQuality: 'exact' };
          }
        }
      }
    }

    // Try category default
    const categoryDefaults = this.registry.defaults.get(event.category);
    if (categoryDefaults !== undefined) {
      const match = this.selectBestTemplate(categoryDefaults, tone, event.significance);
      if (match !== undefined) {
        return { template: match, matchQuality: 'category' };
      }
    }

    // Use global fallback
    return { template: this.registry.globalFallback, matchQuality: 'fallback' };
  }

  /**
   * Select the best template from a list based on tone and significance.
   */
  private selectBestTemplate(
    templates: readonly NarrativeTemplate[],
    tone: NarrativeTone,
    significance: number
  ): NarrativeTemplate | undefined {
    // Filter by significance range
    const inRange = templates.filter(
      (t) => significance >= t.significanceRange.min && significance <= t.significanceRange.max
    );

    if (inRange.length === 0) {
      // If nothing in range, use any template as fallback
      if (templates.length === 0) return undefined;
      return templates[0];
    }

    // Prefer exact tone match
    const toneMatch = inRange.filter((t) => t.tone === tone);
    if (toneMatch.length > 0) {
      // Return a random one from matching templates
      return toneMatch[Math.floor(Math.random() * toneMatch.length)];
    }

    // Fall back to any template in range
    return inRange[Math.floor(Math.random() * inRange.length)];
  }

  /**
   * Generate narrative for an event.
   */
  generateNarrative(context: TemplateContext, tone?: NarrativeTone): NarrativeOutput {
    const activeTone = tone ?? this.config.defaultTone;

    // Reset mention tracking for this narrative
    this.mentionedEntities.clear();

    // Find matching template
    const { template } = this.findTemplate(context.event, activeTone);

    // Build evaluation context
    const evalContext = this.buildEvaluationContext(context);

    // Render the template
    let body = this.parser.render(template.template, evalContext);

    // Apply tone substitutions
    body = applySubstitutions(body, activeTone);

    // Apply literary devices if enabled
    if (this.config.applyLiteraryDevices) {
      body = this.applyLiteraryDevices(body, context, activeTone);
    }

    // Generate title
    const title = this.generateTitle(context, activeTone);

    return {
      title,
      body,
      tone: activeTone,
      templateId: template.id,
    };
  }

  /**
   * Build evaluation context for template rendering.
   */
  private buildEvaluationContext(context: TemplateContext): EvaluationContext {
    const entities = new Map<string, ResolvedEntity>();

    // Track which indexed slots are filled for each entity type
    let characterIndex = 0;
    let factionIndex = 0;
    let siteIndex = 0;

    // Resolve participants - try ALL types and add with appropriate prefixes
    // This ensures templates can use {character.name} or {faction.name} based on what's resolved
    for (let i = 0; i < context.event.participants.length; i++) {
      const participantId = context.event.participants[i];
      if (participantId === undefined) continue;

      const idNum = participantId as unknown as number;

      // Try each entity type and populate the appropriate slot
      const character = this.resolver.resolveCharacter(idNum);
      if (character !== undefined) {
        entities.set(`character${characterIndex}`, character);
        // Also set as character (no index) for templates using simple {character.name}
        if (characterIndex === 0 && !entities.has('character')) {
          entities.set('character', character);
        }
        characterIndex++;
      }

      const faction = this.resolver.resolveFaction(idNum);
      if (faction !== undefined) {
        entities.set(`faction${factionIndex}`, faction);
        if (factionIndex === 0 && !entities.has('faction')) {
          entities.set('faction', faction);
        }
        factionIndex++;
      }

      const site = this.resolver.resolveSite(idNum);
      if (site !== undefined) {
        entities.set(`site${siteIndex}`, site);
        // Don't set 'site' here as location takes priority
        siteIndex++;
      }
    }

    // Resolve location - this takes priority for {site.name} without index
    if (context.event.location !== undefined) {
      const locationId = context.event.location as unknown as number;
      const location = this.resolver.resolveSite(locationId);
      if (location !== undefined) {
        // Set as both 'site' (no index) and 'location' for flexibility
        entities.set('site', location);
        entities.set('location', location);
        // If no participant site was found, also set site0
        if (!entities.has('site0')) {
          entities.set('site0', location);
        }
      }
    }

    return {
      entities,
      currentGender: 'neutral' as Gender,
      eventData: context.event.data,
      eventSignificance: context.event.significance,
      ...(context.narrativeArc !== undefined ? { arcPhase: context.narrativeArc.phase } : {}),
      resolver: this.resolver,
      participants: context.event.participants.map((p) => p as unknown as number),
    };
  }

  /**
   * Generate a title for the narrative.
   */
  private generateTitle(context: TemplateContext, _tone: NarrativeTone): string {
    const { event } = context;

    // Use description from event data if available
    const description = event.data['description'];
    if (typeof description === 'string' && description.length > 0) {
      // Truncate long descriptions
      if (description.length <= 50) {
        return description;
      }
      return description.slice(0, 47) + '...';
    }

    // Generate from subtype
    const parts = event.subtype.split('.');
    const action = parts[parts.length - 1] ?? 'event';

    // Capitalize and format
    const formatted = action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Add significance indicator for high-significance events
    if (event.significance >= 80) {
      return `The Great ${formatted}`;
    }

    return formatted;
  }

  /**
   * Apply literary devices to the narrative body.
   */
  private applyLiteraryDevices(
    body: string,
    context: TemplateContext,
    tone: NarrativeTone
  ): string {
    let result = body;

    // Apply epithet insertion on first character mentions
    result = this.applyEpithetInsertion(result, context);

    // Apply foreshadowing if in rising action
    if (context.narrativeArc !== undefined) {
      result = this.applyArcAwareness(result, context, tone);
    }

    // Apply retrospective if event resolves a cascade
    if (this.config.includeRetrospectives && context.event.causes.length > 2) {
      result = this.applyRetrospective(result, context, tone);
    }

    // Apply dramatic irony for secrets
    if (this.config.includeDramaticIrony) {
      result = this.applyDramaticIrony(result, context, tone);
    }

    return result;
  }

  /**
   * Insert epithets on first mention of important characters.
   */
  private applyEpithetInsertion(body: string, context: TemplateContext): string {
    let result = body;

    for (const participantId of context.event.participants) {
      const idNum = participantId as unknown as number;
      const character = this.resolver.resolveCharacter(idNum);

      if (character?.epithet !== undefined && !this.mentionedEntities.has(`char_${idNum}`)) {
        // Find first mention of the character's name
        const nameIndex = result.indexOf(character.name);
        if (nameIndex >= 0) {
          // Insert epithet after name on first mention
          const nameEnd = nameIndex + character.name.length;
          const before = result.slice(0, nameEnd);
          const after = result.slice(nameEnd);

          result = `${before} ${character.epithet}${after}`;
          this.mentionedEntities.add(`char_${idNum}`);
        }
      }
    }

    return result;
  }

  /**
   * Apply arc-aware foreshadowing or climax emphasis.
   */
  private applyArcAwareness(
    body: string,
    context: TemplateContext,
    tone: NarrativeTone
  ): string {
    const arc = context.narrativeArc;
    if (arc === undefined) return body;

    const phase = arc.phase;

    // Add foreshadowing for setup and rising action
    if (phase === 'Setup' || phase === 'RisingAction') {
      const foreshadowPhrase = getRandomPhrase(tone, 'foreshadowing');
      if (foreshadowPhrase.length > 0) {
        return `${body} ${foreshadowPhrase}`;
      }
    }

    // Add emphasis for climax
    if (phase === 'Climax') {
      const config = TONE_CONFIGS[tone];
      if (config.characteristics.emotionalLanguage) {
        return body.replace(/\.\s*$/, '!');
      }
    }

    return body;
  }

  /**
   * Add retrospective reference for cascade resolutions.
   */
  private applyRetrospective(
    body: string,
    _context: TemplateContext,
    tone: NarrativeTone
  ): string {
    const retroPhrase = getRandomPhrase(tone, 'retrospectives');
    if (retroPhrase.length > 0) {
      return `${retroPhrase} ${body}`;
    }
    return body;
  }

  /**
   * Add dramatic irony asides for events involving secrets.
   */
  private applyDramaticIrony(
    body: string,
    context: TemplateContext,
    tone: NarrativeTone
  ): string {
    // Check if event data indicates a secret is involved
    const hasSecret = context.event.data['secretInvolved'] === true ||
      context.event.subtype.includes('secret') ||
      context.event.subtype.includes('revelation');

    if (!hasSecret) return body;

    // Add a dramatic irony aside based on tone
    let aside: string;
    switch (tone) {
      case NarrativeTone.EpicHistorical:
        aside = '(Though the truth would remain hidden for a time.)';
        break;
      case NarrativeTone.PersonalCharacterFocus:
        aside = '(If only they had known...)';
        break;
      case NarrativeTone.Mythological:
        aside = '(The gods alone knew the truth of it.)';
        break;
      case NarrativeTone.PoliticalIntrigue:
        aside = '(The full picture would only emerge later.)';
        break;
      case NarrativeTone.Scholarly:
        aside = '(Contemporary sources were unaware of this development.)';
        break;
    }

    return `${body} ${aside}`;
  }

  /**
   * Get statistics about the template registry.
   */
  getStats(): {
    totalTemplates: number;
    byCategory: Record<string, number>;
    byTone: Record<string, number>;
  } {
    let totalTemplates = 0;
    const byCategory: Record<string, number> = {};
    const byTone: Record<string, number> = {};

    for (const [category, subtypeMap] of this.registry.byCategory) {
      let categoryCount = 0;
      for (const templates of subtypeMap.values()) {
        categoryCount += templates.length;
        for (const template of templates) {
          const toneName = template.tone;
          byTone[toneName] = (byTone[toneName] ?? 0) + 1;
        }
      }
      byCategory[category] = categoryCount;
      totalTemplates += categoryCount;
    }

    return { totalTemplates, byCategory, byTone };
  }

  /**
   * Reset mention tracking (call between narratives if needed).
   */
  resetMentions(): void {
    this.mentionedEntities.clear();
  }
}

/**
 * Create a narrative engine with the provided templates.
 */
export function createNarrativeEngine(
  templates: readonly NarrativeTemplate[],
  config?: Partial<NarrativeEngineConfig>,
  resolver?: EntityResolver
): NarrativeEngine {
  return new NarrativeEngine(templates, config, resolver);
}
