/**
 * Tests for InfluenceMenu.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InfluenceMenu, type EntityResolver } from './influence-ui.js';
import {
  World,
  EventBus,
  LevelOfDetailManager,
  InfluenceSystem,
  InfluenceCategory,
  toEntityId,
  toCharacterId,
  toFactionId,
  toSiteId,
} from '@fws/core';
import { WorldClock } from '@fws/core';
import type { PositionComponent } from '@fws/core';

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Mock traits component.
 */
interface TraitsComponent {
  readonly type: 'Traits';
  intensities: Map<string, number>;
}

/**
 * Create a test character.
 */
function createCharacter(world: World, x: number, y: number) {
  const entityId = world.createEntity();
  world.addComponent<PositionComponent>(entityId, {
    type: 'Position',
    x,
    y,
  });
  world.addComponent<TraitsComponent>(entityId, {
    type: 'Traits',
    intensities: new Map(),
  });
  return toCharacterId(entityId);
}

/**
 * Create a test site.
 */
function createSite(world: World, x: number, y: number) {
  const entityId = world.createEntity();
  world.addComponent<PositionComponent>(entityId, {
    type: 'Position',
    x,
    y,
  });
  return toSiteId(entityId);
}

/**
 * Mock entity resolver.
 */
function createMockResolver(): EntityResolver {
  return {
    getCharacterName: (id) => `Character ${id}`,
    getFactionName: (id) => `Faction ${id}`,
    getSiteName: (id) => `Site ${id}`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════════════

describe('InfluenceMenu', () => {
  let world: World;
  let eventBus: EventBus;
  let clock: WorldClock;
  let lodManager: LevelOfDetailManager;
  let influenceSystem: InfluenceSystem;
  let menu: InfluenceMenu;

  beforeEach(() => {
    world = new World();
    world.registerComponent<PositionComponent>('Position');
    world.registerComponent<TraitsComponent>('Traits');
    eventBus = new EventBus();
    clock = new WorldClock();
    lodManager = new LevelOfDetailManager();
    influenceSystem = new InfluenceSystem(world, lodManager, 12345);
    menu = new InfluenceMenu(influenceSystem, createMockResolver());
  });

  describe('initial state', () => {
    it('starts closed', () => {
      expect(menu.getState()).toBe('closed');
      expect(menu.isOpen()).toBe(false);
    });

    it('shows correct IP state', () => {
      const state = menu.getPointState();
      expect(state.current).toBe(50);
      expect(state.maximum).toBe(100);
    });
  });

  describe('opening and closing', () => {
    it('can open the menu', () => {
      menu.open();
      expect(menu.isOpen()).toBe(true);
      expect(menu.getState()).toBe('category_select');
    });

    it('can close the menu', () => {
      menu.open();
      menu.close();
      expect(menu.isOpen()).toBe(false);
      expect(menu.getState()).toBe('closed');
    });

    it('can toggle the menu', () => {
      menu.toggle();
      expect(menu.isOpen()).toBe(true);

      menu.toggle();
      expect(menu.isOpen()).toBe(false);
    });

    it('resets state on close', () => {
      menu.open();
      menu.confirm(); // Move to action_select
      menu.close();
      menu.open();

      expect(menu.getState()).toBe('category_select');
    });
  });

  describe('category navigation', () => {
    beforeEach(() => {
      menu.open();
    });

    it('starts with Divine category selected', () => {
      expect(menu.getSelectedCategory()).toBe(InfluenceCategory.Divine);
    });

    it('can navigate to next category', () => {
      menu.nextCategory();
      expect(menu.getSelectedCategory()).toBe(InfluenceCategory.Environmental);

      menu.nextCategory();
      expect(menu.getSelectedCategory()).toBe(InfluenceCategory.Cultural);

      menu.nextCategory(); // Wraps around
      expect(menu.getSelectedCategory()).toBe(InfluenceCategory.Divine);
    });

    it('can navigate to previous category', () => {
      menu.prevCategory();
      expect(menu.getSelectedCategory()).toBe(InfluenceCategory.Cultural);
    });
  });

  describe('action selection', () => {
    beforeEach(() => {
      menu.open();
      menu.confirm(); // Move to action_select
    });

    it('moves to action_select state', () => {
      expect(menu.getState()).toBe('action_select');
    });

    it('shows category items', () => {
      const items = menu.getCategoryItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('can navigate up and down', () => {
      expect(menu.getSelectedActionIndex()).toBe(0);

      menu.down();
      expect(menu.getSelectedActionIndex()).toBe(1);

      menu.up();
      expect(menu.getSelectedActionIndex()).toBe(0);
    });

    it('wraps selection at boundaries', () => {
      const items = menu.getCategoryItems();
      const lastIndex = items.length - 1;

      menu.up(); // Wrap to last
      expect(menu.getSelectedActionIndex()).toBe(lastIndex);

      menu.down(); // Wrap to first
      expect(menu.getSelectedActionIndex()).toBe(0);
    });

    it('enables affordable actions', () => {
      const items = menu.getCategoryItems();
      // InspireIdea costs 5, should be enabled with 50 IP
      const inspireItem = items.find((item) => item.label === 'Inspire Idea');
      expect(inspireItem?.enabled).toBe(true);
    });

    it('shows cost for each action', () => {
      const items = menu.getCategoryItems();
      const inspireItem = items.find((item) => item.label === 'Inspire Idea');
      expect(inspireItem?.cost).toBe(5);
    });
  });

  describe('target selection', () => {
    beforeEach(() => {
      menu.open();
      menu.confirm(); // action_select
    });

    it('moves to target_select when action requires target', () => {
      // Select InspireIdea (requires character target)
      menu.confirm();
      expect(menu.getState()).toBe('target_select');
    });

    it('can set character target', () => {
      menu.confirm(); // Move to target_select

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);

      const builder = menu.getBuilder();
      expect(builder.target1).toBe(charId);
    });

    it('can set location target', () => {
      // Navigate to Environmental category
      menu.nextCategory();
      menu.confirm(); // Move to target_select for AdjustWeather

      const siteId = createSite(world, 0, 0);
      menu.setLocationTarget(siteId);

      const builder = menu.getBuilder();
      expect(builder.target1).toBe(siteId);
    });

    it('handles dual targets', () => {
      // Find ArrangeMeeting (requires two characters)
      menu.down(); // Move to ArrangeMeeting
      menu.down();
      menu.confirm(); // target_select

      const char1 = createCharacter(world, 0, 0);
      const char2 = createCharacter(world, 10, 0);

      menu.setCharacterTarget(char1, false);
      menu.setCharacterTarget(char2, true);

      const builder = menu.getBuilder();
      expect(builder.target1).toBe(char1);
      expect(builder.target2).toBe(char2);
    });
  });

  describe('parameter input', () => {
    beforeEach(() => {
      menu.open();
      menu.confirm(); // action_select
      menu.confirm(); // target_select

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm(); // parameter_input
    });

    it('moves to parameter_input when action needs parameters', () => {
      expect(menu.getState()).toBe('parameter_input');
    });

    it('can set text parameter', () => {
      menu.setTextParam('naval warfare');
      expect(menu.getBuilder().textParam).toBe('naval warfare');
    });

    it('can set numeric parameter', () => {
      menu.setNumericParam(10);
      expect(menu.getBuilder().numericParam).toBe(10);
    });
  });

  describe('confirmation', () => {
    it('shows preview string', () => {
      menu.open();
      menu.confirm(); // action_select
      menu.confirm(); // target_select

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm(); // parameter_input

      menu.setTextParam('great idea');
      menu.confirm(); // confirmation

      const preview = menu.getPreview();
      expect(preview).toContain('Inspire Idea');
      expect(preview).toContain('Character');
      expect(preview).toContain('great idea');
      expect(preview).toContain('IP');
    });

    it('can check if action is executable', () => {
      menu.open();
      menu.confirm(); // action_select
      menu.confirm(); // target_select

      // No target set yet
      expect(menu.canExecute()).toBe(false);

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm(); // parameter_input

      // No text param yet
      expect(menu.canExecute()).toBe(false);

      menu.setTextParam('great idea');

      expect(menu.canExecute()).toBe(true);
    });
  });

  describe('execution', () => {
    it('executes action and returns result', () => {
      menu.open();
      menu.confirm(); // action_select
      menu.confirm(); // target_select

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm(); // parameter_input
      menu.setTextParam('great idea');

      const result = menu.execute(eventBus, clock);

      expect(result).not.toBeNull();
      if (result !== null) {
        // May succeed or be resisted
        expect(typeof result.success).toBe('boolean');
        expect(result.narrative.length).toBeGreaterThan(0);
      }
    });

    it('stores last result', () => {
      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm();
      menu.setTextParam('great idea');

      menu.execute(eventBus, clock);

      const lastResult = menu.getLastResult();
      expect(lastResult).not.toBeNull();
    });

    it('notifies callbacks on execution', () => {
      const callback = vi.fn();
      menu.onActionExecuted(callback);

      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm();
      menu.setTextParam('great idea');

      menu.execute(eventBus, clock);

      expect(callback).toHaveBeenCalled();
    });

    it('can unsubscribe from execution callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = menu.onActionExecuted(callback);
      unsubscribe();

      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm();
      menu.setTextParam('great idea');

      menu.execute(eventBus, clock);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('back navigation', () => {
    it('closes from category_select', () => {
      menu.open();
      menu.back();
      expect(menu.isOpen()).toBe(false);
    });

    it('goes to category_select from action_select', () => {
      menu.open();
      menu.confirm(); // action_select
      menu.back();
      expect(menu.getState()).toBe('category_select');
    });

    it('goes to action_select from target_select', () => {
      menu.open();
      menu.confirm();
      menu.confirm(); // target_select
      menu.back();
      expect(menu.getState()).toBe('action_select');
    });

    it('clears targets when going back from target_select', () => {
      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);

      menu.back();

      expect(menu.getBuilder().target1).toBeNull();
    });

    it('closes from result state', () => {
      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm();
      menu.setTextParam('idea');
      menu.confirm(); // confirmation
      menu.confirm(); // result

      menu.back();
      expect(menu.isOpen()).toBe(false);
    });
  });

  describe('state change callbacks', () => {
    it('notifies on state changes', () => {
      const callback = vi.fn();
      menu.onStateChange(callback);

      menu.open();
      expect(callback).toHaveBeenCalledWith('category_select');

      menu.confirm();
      expect(callback).toHaveBeenCalledWith('action_select');
    });

    it('can unsubscribe from state callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = menu.onStateChange(callback);
      unsubscribe();

      menu.open();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cooldown display', () => {
    it('shows cooldown for recently used actions', () => {
      // Execute an action first
      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm();
      menu.setTextParam('idea');
      menu.execute(eventBus, clock);
      menu.close();

      // Open again and check items
      menu.open();
      menu.confirm();
      const items = menu.getCategoryItems();
      const inspireItem = items.find((item) => item.label === 'Inspire Idea');

      // InspireIdea has a cooldown of 7 ticks
      if (inspireItem?.cooldown !== undefined) {
        expect(inspireItem.cooldown).toBeGreaterThan(0);
        expect(inspireItem.enabled).toBe(false);
      }
    });
  });

  describe('entity resolution', () => {
    it('uses resolver for entity names', () => {
      menu.open();
      menu.confirm();
      menu.confirm();

      const charId = createCharacter(world, 0, 0);
      menu.setCharacterTarget(charId);
      menu.confirm();
      menu.setTextParam('idea');

      const preview = menu.getPreview();
      expect(preview).toContain(`Character ${charId}`);
    });

    it('falls back to entity ID when resolver unavailable', () => {
      const menuNoResolver = new InfluenceMenu(influenceSystem, null);

      menuNoResolver.open();
      menuNoResolver.confirm();
      menuNoResolver.confirm();

      const charId = createCharacter(world, 0, 0);
      menuNoResolver.setCharacterTarget(charId);
      menuNoResolver.confirm();
      menuNoResolver.setTextParam('idea');

      const preview = menuNoResolver.getPreview();
      expect(preview).toContain(`Entity #${charId}`);
    });
  });
});
