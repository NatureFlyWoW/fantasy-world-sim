/**
 * InfluenceMenu — UI for player influence actions.
 *
 * Provides an overlay menu for selecting and executing influence actions.
 * Shows current IP, regeneration rate, available actions by category,
 * and handles target selection and parameter input.
 */

import type {
  EntityId,
  CharacterId,
  FactionId,
  SiteId,
  EventBus,
  WorldClock,
  InfluenceAction,
  InfluenceResult,
  InfluenceActionKind,
  InfluencePointState,
} from '@fws/core';
import {
  InfluenceSystem,
  InfluenceCategory,
  getActionsInCategory,
  getActionMeta,
} from '@fws/core';
import { toEntityId, toEventId } from '@fws/core';

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Menu state.
 */
export type InfluenceMenuState =
  | 'closed'
  | 'category_select'
  | 'action_select'
  | 'target_select'
  | 'parameter_input'
  | 'confirmation'
  | 'result';

/**
 * Action builder for constructing influence actions.
 */
export interface ActionBuilder {
  actionType: InfluenceActionKind | null;
  target1: EntityId | null;
  target2: EntityId | null;
  textParam: string;
  numericParam: number;
}

/**
 * Rendered menu item.
 */
export interface MenuItem {
  readonly label: string;
  readonly sublabel?: string;
  readonly enabled: boolean;
  readonly cost?: number;
  readonly cooldown?: number;
}

/**
 * Callback for when an action is executed.
 */
export type ActionExecutedCallback = (result: InfluenceResult) => void;

/**
 * Callback for when menu state changes.
 */
export type MenuStateCallback = (state: InfluenceMenuState) => void;

/**
 * Entity resolver for looking up entity names.
 */
export interface EntityResolver {
  getCharacterName(id: CharacterId): string | undefined;
  getFactionName(id: FactionId): string | undefined;
  getSiteName(id: SiteId): string | undefined;
}

// ════════════════════════════════════════════════════════════════════════════
// INFLUENCE MENU
// ════════════════════════════════════════════════════════════════════════════

/**
 * InfluenceMenu manages the UI state for influence actions.
 */
export class InfluenceMenu {
  private readonly influenceSystem: InfluenceSystem;
  private readonly entityResolver: EntityResolver | null;

  private state: InfluenceMenuState = 'closed';
  private selectedCategory: InfluenceCategory = InfluenceCategory.Divine;
  private selectedActionIndex: number = 0;
  private builder: ActionBuilder = this.createEmptyBuilder();
  private lastResult: InfluenceResult | null = null;

  private actionExecutedCallbacks: ActionExecutedCallback[] = [];
  private menuStateCallbacks: MenuStateCallback[] = [];

  constructor(
    influenceSystem: InfluenceSystem,
    entityResolver: EntityResolver | null = null
  ) {
    this.influenceSystem = influenceSystem;
    this.entityResolver = entityResolver;
  }

  // ── State Management ──────────────────────────────────────────────────────

  /**
   * Get the current menu state.
   */
  getState(): InfluenceMenuState {
    return this.state;
  }

  /**
   * Check if the menu is open.
   */
  isOpen(): boolean {
    return this.state !== 'closed';
  }

  /**
   * Open the menu.
   */
  open(): void {
    if (this.state === 'closed') {
      this.state = 'category_select';
      this.selectedCategory = InfluenceCategory.Divine;
      this.selectedActionIndex = 0;
      this.builder = this.createEmptyBuilder();
      this.notifyStateChange();
    }
  }

  /**
   * Close the menu.
   */
  close(): void {
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.builder = this.createEmptyBuilder();
      this.lastResult = null;
      this.notifyStateChange();
    }
  }

  /**
   * Toggle the menu open/closed.
   */
  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /**
   * Move to the next category tab.
   */
  nextCategory(): void {
    if (this.state !== 'category_select' && this.state !== 'action_select') {
      return;
    }

    const categories = Object.values(InfluenceCategory);
    const currentIndex = categories.indexOf(this.selectedCategory);
    this.selectedCategory = categories[(currentIndex + 1) % categories.length] ?? InfluenceCategory.Divine;
    this.selectedActionIndex = 0;
    this.notifyStateChange();
  }

  /**
   * Move to the previous category tab.
   */
  prevCategory(): void {
    if (this.state !== 'category_select' && this.state !== 'action_select') {
      return;
    }

    const categories = Object.values(InfluenceCategory);
    const currentIndex = categories.indexOf(this.selectedCategory);
    const newIndex = (currentIndex - 1 + categories.length) % categories.length;
    this.selectedCategory = categories[newIndex] ?? InfluenceCategory.Divine;
    this.selectedActionIndex = 0;
    this.notifyStateChange();
  }

  /**
   * Move selection up.
   */
  up(): void {
    if (this.state === 'action_select') {
      const actions = getActionsInCategory(this.selectedCategory);
      if (actions.length > 0) {
        this.selectedActionIndex =
          (this.selectedActionIndex - 1 + actions.length) % actions.length;
        this.notifyStateChange();
      }
    }
  }

  /**
   * Move selection down.
   */
  down(): void {
    if (this.state === 'action_select') {
      const actions = getActionsInCategory(this.selectedCategory);
      if (actions.length > 0) {
        this.selectedActionIndex =
          (this.selectedActionIndex + 1) % actions.length;
        this.notifyStateChange();
      }
    }
  }

  /**
   * Confirm current selection / advance to next step.
   */
  confirm(): void {
    switch (this.state) {
      case 'category_select':
        this.state = 'action_select';
        this.notifyStateChange();
        break;

      case 'action_select': {
        const actions = getActionsInCategory(this.selectedCategory);
        const actionType = actions[this.selectedActionIndex];
        if (actionType !== undefined) {
          const meta = getActionMeta(actionType);
          if (meta !== undefined && this.isActionAvailable(actionType)) {
            this.builder.actionType = actionType;

            // Determine next step based on action requirements
            if (meta.requiresTarget !== 'none') {
              this.state = 'target_select';
            } else if (this.actionNeedsTextParam(actionType)) {
              this.state = 'parameter_input';
            } else {
              this.state = 'confirmation';
            }
            this.notifyStateChange();
          }
        }
        break;
      }

      case 'target_select':
        // If target is set, move to parameter input or confirmation
        if (this.hasRequiredTargets()) {
          if (
            this.builder.actionType !== null &&
            this.actionNeedsTextParam(this.builder.actionType)
          ) {
            this.state = 'parameter_input';
          } else {
            this.state = 'confirmation';
          }
          this.notifyStateChange();
        }
        break;

      case 'parameter_input':
        // If parameter is set, move to confirmation
        if (this.hasRequiredParams()) {
          this.state = 'confirmation';
          this.notifyStateChange();
        }
        break;

      case 'confirmation':
        // Execute the action
        this.state = 'result';
        this.notifyStateChange();
        break;

      case 'result':
        // Close menu after viewing result
        this.close();
        break;
    }
  }

  /**
   * Go back to previous step.
   */
  back(): void {
    switch (this.state) {
      case 'category_select':
        this.close();
        break;
      case 'action_select':
        this.state = 'category_select';
        this.notifyStateChange();
        break;
      case 'target_select':
        this.state = 'action_select';
        this.builder.target1 = null;
        this.builder.target2 = null;
        this.notifyStateChange();
        break;
      case 'parameter_input':
        // Go back to target select if action requires target, else action select
        if (
          this.builder.actionType !== null &&
          getActionMeta(this.builder.actionType)?.requiresTarget !== 'none'
        ) {
          this.state = 'target_select';
        } else {
          this.state = 'action_select';
        }
        this.builder.textParam = '';
        this.builder.numericParam = 0;
        this.notifyStateChange();
        break;
      case 'confirmation':
        // Go back to parameter input if needed, else target select
        if (
          this.builder.actionType !== null &&
          this.actionNeedsTextParam(this.builder.actionType)
        ) {
          this.state = 'parameter_input';
        } else if (getActionMeta(this.builder.actionType ?? 'InspireIdea')?.requiresTarget !== 'none') {
          this.state = 'target_select';
        } else {
          this.state = 'action_select';
        }
        this.notifyStateChange();
        break;
      case 'result':
        this.close();
        break;
    }
  }

  // ── Target Selection ──────────────────────────────────────────────────────

  /**
   * Set a target entity (from map click or search).
   */
  setTarget(entityId: EntityId, isSecondTarget: boolean = false): void {
    if (this.state !== 'target_select') return;

    if (isSecondTarget) {
      this.builder.target2 = entityId;
    } else {
      this.builder.target1 = entityId;
    }

    this.notifyStateChange();
  }

  /**
   * Set character target by ID.
   */
  setCharacterTarget(characterId: CharacterId, isSecondTarget: boolean = false): void {
    this.setTarget(characterId, isSecondTarget);
  }

  /**
   * Set location target by ID.
   */
  setLocationTarget(siteId: SiteId): void {
    this.setTarget(siteId, false);
  }

  /**
   * Set faction target by ID.
   */
  setFactionTarget(factionId: FactionId): void {
    this.setTarget(factionId, false);
  }

  // ── Parameter Input ───────────────────────────────────────────────────────

  /**
   * Set the text parameter (concept, vision, tradition name, etc.).
   */
  setTextParam(text: string): void {
    this.builder.textParam = text;
    this.notifyStateChange();
  }

  /**
   * Set the numeric parameter (direction, modifier, duration, etc.).
   */
  setNumericParam(value: number): void {
    this.builder.numericParam = value;
    this.notifyStateChange();
  }

  // ── Rendering Data ────────────────────────────────────────────────────────

  /**
   * Get current influence point state.
   */
  getPointState(): InfluencePointState {
    return this.influenceSystem.getPointState();
  }

  /**
   * Get the currently selected category.
   */
  getSelectedCategory(): InfluenceCategory {
    return this.selectedCategory;
  }

  /**
   * Get menu items for current category.
   */
  getCategoryItems(): readonly MenuItem[] {
    const actions = getActionsInCategory(this.selectedCategory);
    return actions.map((actionType) => this.createMenuItem(actionType));
  }

  /**
   * Get the currently selected action index.
   */
  getSelectedActionIndex(): number {
    return this.selectedActionIndex;
  }

  /**
   * Get the selected action type.
   */
  getSelectedActionType(): InfluenceActionKind | null {
    const actions = getActionsInCategory(this.selectedCategory);
    return actions[this.selectedActionIndex] ?? null;
  }

  /**
   * Get the current action builder state.
   */
  getBuilder(): Readonly<ActionBuilder> {
    return this.builder;
  }

  /**
   * Get a preview string of the action being built.
   */
  getPreview(): string {
    if (this.builder.actionType === null) return '';

    const meta = getActionMeta(this.builder.actionType);
    if (meta === undefined) return '';

    const cost = this.getBuilderCost();
    let targetStr = '';

    if (this.builder.target1 !== null) {
      targetStr = this.resolveEntityName(this.builder.target1);
    }
    if (this.builder.target2 !== null) {
      targetStr += ` and ${this.resolveEntityName(this.builder.target2)}`;
    }

    let paramStr = '';
    if (this.builder.textParam.length > 0) {
      paramStr = ` "${this.builder.textParam}"`;
    }
    if (this.builder.numericParam !== 0) {
      paramStr += ` (${this.builder.numericParam > 0 ? '+' : ''}${this.builder.numericParam})`;
    }

    return `${meta.name}${targetStr.length > 0 ? ': ' + targetStr : ''}${paramStr} (${cost} IP)`;
  }

  /**
   * Get the last execution result.
   */
  getLastResult(): InfluenceResult | null {
    return this.lastResult;
  }

  /**
   * Get whether the current builder can be executed.
   */
  canExecute(): boolean {
    if (this.builder.actionType === null) return false;
    if (!this.hasRequiredTargets()) return false;
    if (!this.hasRequiredParams()) return false;

    const action = this.buildAction();
    if (action === null) return false;

    return this.influenceSystem.canAfford(action);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Execute the built action.
   */
  execute(eventBus: EventBus, clock: WorldClock): InfluenceResult | null {
    const action = this.buildAction();
    if (action === null) {
      return null;
    }

    const result = this.influenceSystem.execute(action, eventBus, clock);
    this.lastResult = result;

    for (const callback of this.actionExecutedCallbacks) {
      callback(result);
    }

    return result;
  }

  // ── Callbacks ─────────────────────────────────────────────────────────────

  /**
   * Register a callback for when an action is executed.
   */
  onActionExecuted(callback: ActionExecutedCallback): () => void {
    this.actionExecutedCallbacks.push(callback);
    return () => {
      const index = this.actionExecutedCallbacks.indexOf(callback);
      if (index >= 0) {
        this.actionExecutedCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register a callback for menu state changes.
   */
  onStateChange(callback: MenuStateCallback): () => void {
    this.menuStateCallbacks.push(callback);
    return () => {
      const index = this.menuStateCallbacks.indexOf(callback);
      if (index >= 0) {
        this.menuStateCallbacks.splice(index, 1);
      }
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private createEmptyBuilder(): ActionBuilder {
    return {
      actionType: null,
      target1: null,
      target2: null,
      textParam: '',
      numericParam: 0,
    };
  }

  private createMenuItem(actionType: InfluenceActionKind): MenuItem {
    const meta = getActionMeta(actionType);
    if (meta === undefined) {
      return { label: actionType, enabled: false };
    }

    const cooldown = this.influenceSystem.getRemainingCooldown(actionType);
    const cost = meta.baseCost;
    const canAfford = this.influenceSystem.getAvailablePoints() >= cost;
    const enabled = cooldown === 0 && canAfford;

    return {
      label: meta.name,
      sublabel: meta.description,
      enabled,
      cost,
      ...(cooldown > 0 ? { cooldown } : {}),
    };
  }

  private isActionAvailable(actionType: InfluenceActionKind): boolean {
    const meta = getActionMeta(actionType);
    if (meta === undefined) return false;

    const cooldown = this.influenceSystem.getRemainingCooldown(actionType);
    if (cooldown > 0) return false;

    const cost = meta.baseCost;
    return this.influenceSystem.getAvailablePoints() >= cost;
  }

  private actionNeedsTextParam(actionType: InfluenceActionKind): boolean {
    switch (actionType) {
      case 'InspireIdea':
      case 'PropheticDream':
      case 'AdjustWeather':
      case 'MinorGeology':
      case 'AnimalMigration': // species
      case 'ResourceDiscovery': // resource type
      case 'TriggerNaturalEvent': // event type
      case 'PromoteArt': // art form
      case 'EncourageResearch': // field
      case 'StrengthenTradition': // tradition
      case 'IntroduceForeignConcept': // concept
        return true;
      default:
        return false;
    }
  }

  private hasRequiredTargets(): boolean {
    if (this.builder.actionType === null) return false;

    const meta = getActionMeta(this.builder.actionType);
    if (meta === undefined) return false;

    switch (meta.requiresTarget) {
      case 'none':
        return true;
      case 'character':
      case 'location':
      case 'faction':
        return this.builder.target1 !== null;
      case 'dual-character':
      case 'dual-location':
        return this.builder.target1 !== null && this.builder.target2 !== null;
    }
  }

  private hasRequiredParams(): boolean {
    if (this.builder.actionType === null) return false;

    // Check text param requirement
    if (
      this.actionNeedsTextParam(this.builder.actionType) &&
      this.builder.textParam.trim().length === 0
    ) {
      return false;
    }

    // Check numeric param requirements
    switch (this.builder.actionType) {
      case 'PersonalityNudge':
        // Must have direction between -15 and +15, non-zero
        return (
          this.builder.numericParam !== 0 &&
          Math.abs(this.builder.numericParam) <= 15
        );
      case 'LuckModifier':
        // Must have modifier between -0.3 and +0.3
        return Math.abs(this.builder.numericParam) <= 0.3;
      case 'EmpowerChampion':
        // Must have boost amount > 0
        return this.builder.numericParam > 0;
      default:
        return true;
    }
  }

  private getBuilderCost(): number {
    const action = this.buildAction();
    if (action === null) {
      const meta = getActionMeta(this.builder.actionType ?? 'InspireIdea');
      return meta?.baseCost ?? 0;
    }
    return this.influenceSystem.getCost(action);
  }

  private buildAction(): InfluenceAction | null {
    if (this.builder.actionType === null) return null;

    // Build action based on type
    switch (this.builder.actionType) {
      case 'InspireIdea':
        if (this.builder.target1 === null) return null;
        return {
          type: 'InspireIdea',
          target: this.builder.target1 as CharacterId,
          concept: this.builder.textParam,
          cost: 5,
        };

      case 'PropheticDream':
        if (this.builder.target1 === null) return null;
        return {
          type: 'PropheticDream',
          target: this.builder.target1 as CharacterId,
          vision: this.builder.textParam,
          cost: 10,
        };

      case 'ArrangeMeeting':
        if (this.builder.target1 === null || this.builder.target2 === null) {
          return null;
        }
        return {
          type: 'ArrangeMeeting',
          character1: this.builder.target1 as CharacterId,
          character2: this.builder.target2 as CharacterId,
          cost: 15,
        };

      case 'PersonalityNudge':
        if (this.builder.target1 === null) return null;
        return {
          type: 'PersonalityNudge',
          target: this.builder.target1 as CharacterId,
          trait: this.builder.textParam,
          direction: this.builder.numericParam,
          cost: 20,
        };

      case 'RevealSecret':
        if (this.builder.target1 === null) return null;
        return {
          type: 'RevealSecret',
          target: this.builder.target1 as CharacterId,
          secretId: toEntityId(this.builder.numericParam),
          cost: 25,
        };

      case 'LuckModifier':
        if (this.builder.target1 === null) return null;
        return {
          type: 'LuckModifier',
          target: this.builder.target1 as CharacterId,
          actionType: this.builder.textParam,
          modifier: this.builder.numericParam,
          cost: 10,
        };

      case 'VisionOfFuture':
        if (this.builder.target1 === null) return null;
        return {
          type: 'VisionOfFuture',
          target: this.builder.target1 as CharacterId,
          futureEvent: toEventId(toEntityId(this.builder.numericParam)),
          cost: 30,
        };

      case 'EmpowerChampion':
        if (this.builder.target1 === null) return null;
        return {
          type: 'EmpowerChampion',
          target: this.builder.target1 as CharacterId,
          boostAmount: this.builder.numericParam,
          duration: 30, // Default 30 ticks
          cost: 50,
        };

      case 'AdjustWeather':
        if (this.builder.target1 === null) return null;
        return {
          type: 'AdjustWeather',
          location: this.builder.target1 as SiteId,
          change: this.builder.textParam,
          cost: 5,
        };

      case 'MinorGeology':
        if (this.builder.target1 === null) return null;
        return {
          type: 'MinorGeology',
          location: this.builder.target1 as SiteId,
          effect: this.builder.textParam,
          cost: 15,
        };

      case 'AnimalMigration':
        if (this.builder.target1 === null || this.builder.target2 === null) {
          return null;
        }
        return {
          type: 'AnimalMigration',
          species: this.builder.textParam,
          from: this.builder.target1 as SiteId,
          to: this.builder.target2 as SiteId,
          cost: 5,
        };

      case 'ResourceDiscovery':
        if (this.builder.target1 === null) return null;
        return {
          type: 'ResourceDiscovery',
          location: this.builder.target1 as SiteId,
          resource: this.builder.textParam,
          cost: 20,
        };

      case 'TriggerNaturalEvent':
        if (this.builder.target1 === null) return null;
        return {
          type: 'TriggerNaturalEvent',
          eventType: this.builder.textParam,
          location: this.builder.target1 as SiteId,
          cost: 30,
        };

      case 'PromoteArt':
        if (this.builder.target1 === null) return null;
        return {
          type: 'PromoteArt',
          culture: this.builder.target1 as FactionId,
          artForm: this.builder.textParam,
          cost: 10,
        };

      case 'EncourageResearch':
        if (this.builder.target1 === null) return null;
        return {
          type: 'EncourageResearch',
          target: this.builder.target1 as CharacterId,
          field: this.builder.textParam,
          cost: 15,
        };

      case 'StrengthenTradition':
        if (this.builder.target1 === null) return null;
        return {
          type: 'StrengthenTradition',
          faction: this.builder.target1 as FactionId,
          tradition: this.builder.textParam,
          cost: 10,
        };

      case 'IntroduceForeignConcept':
        if (this.builder.target1 === null) return null;
        return {
          type: 'IntroduceForeignConcept',
          target: this.builder.target1 as FactionId,
          concept: this.builder.textParam,
          cost: 20,
        };

      default:
        return null;
    }
  }

  private resolveEntityName(entityId: EntityId): string {
    if (this.entityResolver === null) {
      return `Entity #${entityId}`;
    }

    // Try each resolver
    const charName = this.entityResolver.getCharacterName(
      entityId as CharacterId
    );
    if (charName !== undefined) return charName;

    const factionName = this.entityResolver.getFactionName(
      entityId as FactionId
    );
    if (factionName !== undefined) return factionName;

    const siteName = this.entityResolver.getSiteName(entityId as SiteId);
    if (siteName !== undefined) return siteName;

    return `Entity #${entityId}`;
  }

  private notifyStateChange(): void {
    for (const callback of this.menuStateCallbacks) {
      callback(this.state);
    }
  }
}
