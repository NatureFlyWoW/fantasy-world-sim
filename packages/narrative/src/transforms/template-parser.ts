/**
 * TemplateParser parses and evaluates template strings.
 * Templates support entity references, pronouns, and conditionals.
 *
 * Syntax:
 * - Entity references: {character.name}, {faction.name}, {site.name}
 * - Pronouns: {pronoun.subject}, {pronoun.object}, {pronoun.possessive}
 * - Data access: {event.data.fieldName}, {event.significance}
 * - Conditionals: {#if condition}...{/if}, {#unless condition}...{/unless}
 * - If-else: {#if condition}...{#else}...{/if}
 * - Arc awareness: {#if arc.phase == 'RisingAction'}...{/if}
 */

import type {
  EntityResolver,
  Gender,
  ResolvedEntity,
  PronounSet,
} from '../templates/types.js';
import { PRONOUNS } from '../templates/types.js';
import type { ArcPhase } from '@fws/core';

/**
 * Token types for the template lexer.
 */
export type TokenType =
  | 'text'
  | 'reference'
  | 'if_start'
  | 'unless_start'
  | 'else'
  | 'if_end'
  | 'unless_end';

/**
 * A token from the template lexer.
 */
export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly condition?: string;
}

/**
 * Parsed reference from a template placeholder.
 */
export interface ParsedReference {
  readonly entityType: 'character' | 'faction' | 'site' | 'artifact' | 'deity' | 'target' | 'pronoun' | 'event' | 'arc';
  readonly entityIndex?: number;
  readonly property: string;
}

/**
 * Context for template evaluation.
 */
export interface EvaluationContext {
  /** Resolved entities keyed by type and index (e.g., "character0") */
  readonly entities: Map<string, ResolvedEntity>;
  /** Current gender for pronoun resolution */
  currentGender: Gender;
  /** Event data for data access */
  readonly eventData: Readonly<Record<string, unknown>>;
  /** Event significance */
  readonly eventSignificance: number;
  /** Narrative arc phase if present */
  readonly arcPhase?: ArcPhase;
  /** Entity resolver for dynamic lookups */
  readonly resolver: EntityResolver;
  /** Participant entity IDs from the event */
  readonly participants: readonly number[];
}

/**
 * Regular expressions for template parsing.
 */
const PLACEHOLDER_REGEX = /\{([^{}]+)\}/g;
const IF_START_REGEX = /^#if\s+(.+)$/;
const UNLESS_START_REGEX = /^#unless\s+(.+)$/;
const ELSE_REGEX = /^#else$/;
const IF_END_REGEX = /^\/if$/;
const UNLESS_END_REGEX = /^\/unless$/;

/**
 * TemplateParser handles template tokenization and evaluation.
 */
export class TemplateParser {
  /**
   * Tokenize a template string into tokens.
   */
  tokenize(template: string): Token[] {
    const tokens: Token[] = [];
    let lastIndex = 0;

    // Reset regex state
    PLACEHOLDER_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = PLACEHOLDER_REGEX.exec(template)) !== null) {
      // Add text before this placeholder
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          value: template.slice(lastIndex, match.index),
        });
      }

      const content = match[1]?.trim() ?? '';

      // Classify the placeholder
      const ifMatch = IF_START_REGEX.exec(content);
      if (ifMatch?.[1] !== undefined) {
        tokens.push({
          type: 'if_start',
          value: content,
          condition: ifMatch[1].trim(),
        });
      } else if (UNLESS_START_REGEX.exec(content)?.[1] !== undefined) {
        const unlessMatch = UNLESS_START_REGEX.exec(content);
        tokens.push({
          type: 'unless_start',
          value: content,
          condition: unlessMatch?.[1]?.trim() ?? '',
        });
      } else if (ELSE_REGEX.test(content)) {
        tokens.push({
          type: 'else',
          value: content,
        });
      } else if (IF_END_REGEX.test(content)) {
        tokens.push({
          type: 'if_end',
          value: content,
        });
      } else if (UNLESS_END_REGEX.test(content)) {
        tokens.push({
          type: 'unless_end',
          value: content,
        });
      } else {
        // Regular reference
        tokens.push({
          type: 'reference',
          value: content,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < template.length) {
      tokens.push({
        type: 'text',
        value: template.slice(lastIndex),
      });
    }

    return tokens;
  }

  /**
   * Parse a reference string like "character.name" or "character0.title".
   */
  parseReference(reference: string): ParsedReference | undefined {
    const parts = reference.split('.');
    if (parts.length < 2) {
      return undefined;
    }

    const entityPart = parts[0] ?? '';
    const property = parts.slice(1).join('.');

    // Check for indexed entity (e.g., "character0", "faction1")
    // Check for target (special entity resolved from event.data.targetId)
    if (entityPart === 'target') {
      return {
        entityType: 'target',
        property,
      };
    }

    const indexMatch = /^(character|faction|site|artifact|deity)(\d+)?$/.exec(entityPart);
    if (indexMatch?.[1] !== undefined) {
      return {
        entityType: indexMatch[1] as 'character' | 'faction' | 'site' | 'artifact' | 'deity',
        entityIndex: indexMatch[2] !== undefined ? parseInt(indexMatch[2], 10) : 0,
        property,
      };
    }

    // Check for pronoun
    if (entityPart === 'pronoun') {
      return {
        entityType: 'pronoun',
        property,
      };
    }

    // Check for event data
    if (entityPart === 'event') {
      return {
        entityType: 'event',
        property,
      };
    }

    // Check for arc
    if (entityPart === 'arc') {
      return {
        entityType: 'arc',
        property,
      };
    }

    return undefined;
  }

  /**
   * Resolve a reference against the evaluation context.
   */
  resolveReference(reference: string, context: EvaluationContext): string {
    const parsed = this.parseReference(reference);
    if (parsed === undefined) {
      return `{${reference}}`;
    }

    switch (parsed.entityType) {
      case 'character':
      case 'faction':
      case 'site':
      case 'artifact':
      case 'deity':
      case 'target':
        return this.resolveEntityReference(parsed, context);

      case 'pronoun':
        return this.resolvePronounReference(parsed.property, context);

      case 'event':
        return this.resolveEventReference(parsed.property, context);

      case 'arc':
        return this.resolveArcReference(parsed.property, context);

      default:
        return `{${reference}}`;
    }
  }

  /**
   * Resolve an entity reference like character.name.
   */
  private resolveEntityReference(
    parsed: ParsedReference,
    context: EvaluationContext
  ): string {
    // Target is stored under just 'target' (no index); regular entities use type+index
    const key = parsed.entityType === 'target'
      ? 'target'
      : `${parsed.entityType}${parsed.entityIndex ?? 0}`;
    let entity = context.entities.get(key);

    // Try dynamic resolution if not cached (not applicable for target — it's pre-resolved)
    if (entity === undefined && parsed.entityType !== 'target') {
      const participantId = context.participants[parsed.entityIndex ?? 0];
      if (participantId !== undefined) {
        switch (parsed.entityType) {
          case 'character':
            entity = context.resolver.resolveCharacter(participantId);
            break;
          case 'faction':
            entity = context.resolver.resolveFaction(participantId);
            break;
          case 'site':
            entity = context.resolver.resolveSite(participantId);
            break;
          case 'artifact':
            entity = context.resolver.resolveArtifact(participantId);
            break;
          case 'deity':
            entity = context.resolver.resolveDeity(participantId);
            break;
        }
      }
    }

    if (entity === undefined) {
      // Return readable placeholder based on entity type instead of raw template
      switch (parsed.entityType) {
        case 'character':
          return parsed.property === 'name' ? 'someone' : '';
        case 'faction':
          return parsed.property === 'name' ? 'a faction' : '';
        case 'site':
          return parsed.property === 'name' ? 'a place' : '';
        case 'artifact':
          return parsed.property === 'name' ? 'an artifact' : '';
        case 'deity':
          return parsed.property === 'name' ? 'a god' : '';
        case 'target':
          return parsed.property === 'name' ? 'another' : '';
        default:
          return '';
      }
    }

    // Update current gender if this is a character
    if (parsed.entityType === 'character' && entity.gender !== undefined) {
      context.currentGender = entity.gender;
    }

    switch (parsed.property) {
      case 'name':
        return entity.name;
      case 'title':
        return entity.title ?? '';
      case 'epithet':
        return entity.epithet ?? '';
      case 'fullTitle':
        if (entity.title !== undefined) {
          return `${entity.title} ${entity.name}`;
        }
        return entity.name;
      case 'withEpithet':
        if (entity.epithet !== undefined) {
          return `${entity.name} ${entity.epithet}`;
        }
        return entity.name;
      default:
        return `{${parsed.entityType}.${parsed.property}}`;
    }
  }

  /**
   * Resolve a pronoun reference.
   */
  private resolvePronounReference(property: string, context: EvaluationContext): string {
    const pronouns: PronounSet = PRONOUNS[context.currentGender];

    switch (property) {
      case 'subject':
        return pronouns.subject;
      case 'object':
        return pronouns.object;
      case 'possessive':
        return pronouns.possessive;
      case 'reflexive':
        return pronouns.reflexive;
      default:
        return `{pronoun.${property}}`;
    }
  }

  /**
   * Resolve an event data reference.
   */
  private resolveEventReference(property: string, context: EvaluationContext): string {
    if (property === 'significance') {
      return String(context.eventSignificance);
    }

    if (property.startsWith('data.')) {
      const dataPath = property.slice(5);
      const value = this.getNestedValue(context.eventData, dataPath);
      if (value !== undefined) {
        return String(value);
      }
    }

    return `{event.${property}}`;
  }

  /**
   * Resolve an arc reference.
   */
  private resolveArcReference(property: string, context: EvaluationContext): string {
    if (property === 'phase') {
      return context.arcPhase ?? 'none';
    }
    return `{arc.${property}}`;
  }

  /**
   * Get a nested value from an object using dot notation.
   */
  private getNestedValue(obj: Readonly<Record<string, unknown>>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Evaluate a condition string against the context.
   */
  evaluateCondition(condition: string, context: EvaluationContext): boolean {
    // Handle comparison operators
    const comparisonMatch = /^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(condition.trim());

    if (comparisonMatch?.[1] !== undefined && comparisonMatch?.[2] !== undefined && comparisonMatch?.[3] !== undefined) {
      const left = this.evaluateValue(comparisonMatch[1].trim(), context);
      const operator = comparisonMatch[2].trim();
      const right = this.evaluateValue(comparisonMatch[3].trim(), context);

      return this.compare(left, operator, right);
    }

    // Handle simple truthiness check
    const value = this.evaluateValue(condition.trim(), context);
    return this.isTruthy(value);
  }

  /**
   * Evaluate a value expression (reference or literal).
   */
  private evaluateValue(expression: string, context: EvaluationContext): unknown {
    // Check for string literal
    const stringMatch = /^['"](.*)['"]$/.exec(expression);
    if (stringMatch?.[1] !== undefined) {
      return stringMatch[1];
    }

    // Check for number literal
    const num = parseFloat(expression);
    if (!isNaN(num)) {
      return num;
    }

    // Check for boolean literals
    if (expression === 'true') return true;
    if (expression === 'false') return false;

    // Resolve as reference
    const parsed = this.parseReference(expression);
    if (parsed === undefined) {
      return undefined;
    }

    switch (parsed.entityType) {
      case 'event':
        if (parsed.property === 'significance') {
          return context.eventSignificance;
        }
        if (parsed.property.startsWith('data.')) {
          return this.getNestedValue(context.eventData, parsed.property.slice(5));
        }
        return undefined;

      case 'arc':
        if (parsed.property === 'phase') {
          return context.arcPhase;
        }
        return undefined;

      case 'character':
      case 'faction':
      case 'site':
      case 'artifact':
      case 'deity':
      case 'target': {
        const key = parsed.entityType === 'target'
          ? 'target'
          : `${parsed.entityType}${parsed.entityIndex ?? 0}`;
        const entity = context.entities.get(key);
        if (entity === undefined) return undefined;

        if (parsed.property === 'name') return entity.name;
        if (parsed.property === 'title') return entity.title;
        if (parsed.property === 'epithet') return entity.epithet;

        // Check for traits (e.g., character.traits.patient)
        if (parsed.property.startsWith('traits.')) {
          // Would need trait data in entity, return undefined for now
          return undefined;
        }
        return undefined;
      }

      default:
        return undefined;
    }
  }

  /**
   * Compare two values with an operator.
   */
  private compare(left: unknown, operator: string, right: unknown): boolean {
    switch (operator) {
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '>':
        return typeof left === 'number' && typeof right === 'number' && left > right;
      case '<':
        return typeof left === 'number' && typeof right === 'number' && left < right;
      case '>=':
        return typeof left === 'number' && typeof right === 'number' && left >= right;
      case '<=':
        return typeof left === 'number' && typeof right === 'number' && left <= right;
      default:
        return false;
    }
  }

  /**
   * Check if a value is truthy.
   */
  private isTruthy(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }

  /**
   * Evaluate a tokenized template against the context.
   */
  evaluate(tokens: readonly Token[], context: EvaluationContext): string {
    const result: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      if (token === undefined) {
        i++;
        continue;
      }

      switch (token.type) {
        case 'text':
          result.push(token.value);
          i++;
          break;

        case 'reference':
          result.push(this.resolveReference(token.value, context));
          i++;
          break;

        case 'if_start': {
          const { content, endIndex } = this.evaluateConditional(
            tokens,
            i,
            'if',
            token.condition ?? '',
            context
          );
          result.push(content);
          i = endIndex + 1;
          break;
        }

        case 'unless_start': {
          const { content, endIndex } = this.evaluateConditional(
            tokens,
            i,
            'unless',
            token.condition ?? '',
            context
          );
          result.push(content);
          i = endIndex + 1;
          break;
        }

        default:
          i++;
          break;
      }
    }

    return result.join('');
  }

  /**
   * Evaluate a conditional block.
   */
  private evaluateConditional(
    tokens: readonly Token[],
    startIndex: number,
    type: 'if' | 'unless',
    condition: string,
    context: EvaluationContext
  ): { content: string; endIndex: number } {
    const endType = type === 'if' ? 'if_end' : 'unless_end';
    const startType = type === 'if' ? 'if_start' : 'unless_start';

    // Find the matching end token and any else token
    let depth = 1;
    let elseIndex = -1;
    let endIndex = startIndex;

    for (let i = startIndex + 1; i < tokens.length && depth > 0; i++) {
      const token = tokens[i];
      if (token === undefined) continue;

      if (token.type === startType || token.type === (type === 'if' ? 'unless_start' : 'if_start')) {
        depth++;
      } else if (token.type === endType || token.type === (type === 'if' ? 'unless_end' : 'if_end')) {
        depth--;
        if (depth === 0) {
          endIndex = i;
        }
      } else if (token.type === 'else' && depth === 1) {
        elseIndex = i;
      }
    }

    // Evaluate the condition
    let conditionResult = this.evaluateCondition(condition, context);
    if (type === 'unless') {
      conditionResult = !conditionResult;
    }

    // Get the appropriate tokens to evaluate
    let contentTokens: readonly Token[];
    if (conditionResult) {
      if (elseIndex > 0) {
        contentTokens = tokens.slice(startIndex + 1, elseIndex);
      } else {
        contentTokens = tokens.slice(startIndex + 1, endIndex);
      }
    } else {
      if (elseIndex > 0) {
        contentTokens = tokens.slice(elseIndex + 1, endIndex);
      } else {
        contentTokens = [];
      }
    }

    // Recursively evaluate the content
    const content = this.evaluate(contentTokens, context);

    return { content, endIndex };
  }

  /**
   * Parse and evaluate a template in one step.
   */
  render(template: string, context: EvaluationContext): string {
    const tokens = this.tokenize(template);
    return this.evaluate(tokens, context);
  }
}

/**
 * Create a default entity resolver that returns undefined for all lookups.
 * Used as a fallback when no resolver is provided.
 */
export function createDefaultResolver(): EntityResolver {
  return {
    resolveCharacter: () => undefined,
    resolveFaction: () => undefined,
    resolveSite: () => undefined,
    resolveArtifact: () => undefined,
    resolveDeity: () => undefined,
  };
}
