/**
 * Tests for FocusManager.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FocusManager } from './focus.js';
import {
  World,
  EventBus,
  EventCategory,
  LevelOfDetailManager,
  toEntityId,
  toEventId,
} from '@fws/core';
import type { WorldEvent, PositionComponent } from '@fws/core';

/**
 * Create a test event with given participants.
 */
function createEvent(participants: number[]): WorldEvent {
  return {
    id: toEventId(toEntityId(100)),
    category: EventCategory.Personal,
    subtype: 'test.event',
    timestamp: 0,
    participants: participants.map(toEntityId),
    causes: [],
    consequences: [],
    data: {},
    significance: 50,
    consequencePotential: [],
  };
}

describe('FocusManager', () => {
  let world: World;
  let eventBus: EventBus;
  let lodManager: LevelOfDetailManager;
  let focusManager: FocusManager;

  beforeEach(() => {
    world = new World();
    world.registerComponent<PositionComponent>('Position');
    eventBus = new EventBus();
    lodManager = new LevelOfDetailManager();
    focusManager = new FocusManager(world, eventBus, lodManager);
  });

  describe('initial state', () => {
    it('starts with no focus', () => {
      expect(focusManager.focusEntity).toBeNull();
      expect(focusManager.focusPosition).toBeNull();
      expect(focusManager.hasFocus()).toBe(false);
    });

    it('returns empty events when not focused', () => {
      expect(focusManager.getFocusedEntityEvents()).toEqual([]);
    });
  });

  describe('setting focus', () => {
    it('can focus on an entity with position', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);

      expect(focusManager.focusEntity).toBe(entityId);
      expect(focusManager.focusPosition).toEqual({ x: 10, y: 20 });
      expect(focusManager.hasFocus()).toBe(true);
    });

    it('does not focus on entity without position', () => {
      const entityId = world.createEntity();
      // No position component

      focusManager.setFocus(entityId);

      expect(focusManager.focusEntity).toBeNull();
      expect(focusManager.hasFocus()).toBe(false);
    });

    it('updates LoD manager when focus is set', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 50,
        y: 75,
      });

      focusManager.setFocus(entityId);

      expect(lodManager.getFocus()).toEqual({ x: 50, y: 75 });
    });

    it('clears previous events when setting new focus', () => {
      const entity1 = world.createEntity();
      world.addComponent<PositionComponent>(entity1, {
        type: 'Position',
        x: 0,
        y: 0,
      });

      focusManager.setFocus(entity1);

      // Emit an event for entity1
      eventBus.emit(createEvent([entity1 as number]));
      expect(focusManager.getFocusedEntityEvents().length).toBe(1);

      // Focus on new entity
      const entity2 = world.createEntity();
      world.addComponent<PositionComponent>(entity2, {
        type: 'Position',
        x: 10,
        y: 10,
      });
      focusManager.setFocus(entity2);

      expect(focusManager.getFocusedEntityEvents().length).toBe(0);
    });
  });

  describe('clearing focus', () => {
    it('can clear focus', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);
      expect(focusManager.hasFocus()).toBe(true);

      focusManager.clearFocus();

      expect(focusManager.focusEntity).toBeNull();
      expect(focusManager.focusPosition).toBeNull();
      expect(focusManager.hasFocus()).toBe(false);
    });

    it('clears events when focus is cleared', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);
      eventBus.emit(createEvent([entityId as number]));
      expect(focusManager.getFocusedEntityEvents().length).toBe(1);

      focusManager.clearFocus();

      expect(focusManager.getFocusedEntityEvents()).toEqual([]);
    });
  });

  describe('isFocused', () => {
    it('returns true for focused entity', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 0,
        y: 0,
      });

      focusManager.setFocus(entityId);

      expect(focusManager.isFocused(entityId)).toBe(true);
    });

    it('returns false for non-focused entity', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      world.addComponent<PositionComponent>(entity1, {
        type: 'Position',
        x: 0,
        y: 0,
      });
      world.addComponent<PositionComponent>(entity2, {
        type: 'Position',
        x: 10,
        y: 10,
      });

      focusManager.setFocus(entity1);

      expect(focusManager.isFocused(entity2)).toBe(false);
    });
  });

  describe('event tracking', () => {
    it('tracks events involving focused entity', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 0,
        y: 0,
      });

      focusManager.setFocus(entityId);

      const event = createEvent([entityId as number]);
      eventBus.emit(event);

      const events = focusManager.getFocusedEntityEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBe(event);
    });

    it('does not track events for other entities', () => {
      const entity1 = world.createEntity();
      const entity2 = world.createEntity();
      world.addComponent<PositionComponent>(entity1, {
        type: 'Position',
        x: 0,
        y: 0,
      });

      focusManager.setFocus(entity1);

      // Event for entity2
      eventBus.emit(createEvent([entity2 as number]));

      expect(focusManager.getFocusedEntityEvents().length).toBe(0);
    });

    it('limits stored events to maximum', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 0,
        y: 0,
      });

      focusManager.setFocus(entityId);

      // Emit more than MAX_FOCUSED_EVENTS (100)
      for (let i = 0; i < 120; i++) {
        eventBus.emit(createEvent([entityId as number]));
      }

      expect(focusManager.getFocusedEntityEvents().length).toBe(100);
    });
  });

  describe('focus updates', () => {
    it('updates position when entity moves (followFocus enabled)', () => {
      const entityId = world.createEntity();
      const positionComponent: PositionComponent = {
        type: 'Position',
        x: 10,
        y: 20,
      };
      world.addComponent<PositionComponent>(entityId, positionComponent);

      focusManager.setFocus(entityId);
      expect(focusManager.focusPosition).toEqual({ x: 10, y: 20 });

      // Move entity
      positionComponent.x = 30;
      positionComponent.y = 40;

      focusManager.updateFocusPosition();

      expect(focusManager.focusPosition).toEqual({ x: 30, y: 40 });
      expect(lodManager.getFocus()).toEqual({ x: 30, y: 40 });
    });

    it('does not update position when followFocus is disabled', () => {
      const noFollowManager = new FocusManager(world, eventBus, lodManager, {
        followFocus: false,
      });

      const entityId = world.createEntity();
      const positionComponent: PositionComponent = {
        type: 'Position',
        x: 10,
        y: 20,
      };
      world.addComponent<PositionComponent>(entityId, positionComponent);

      noFollowManager.setFocus(entityId);

      // Move entity
      positionComponent.x = 30;
      positionComponent.y = 40;

      noFollowManager.updateFocusPosition();

      // Position should not have changed
      expect(noFollowManager.focusPosition).toEqual({ x: 10, y: 20 });

      noFollowManager.destroy();
    });

    it('clears focus if entity loses position component', () => {
      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);
      expect(focusManager.hasFocus()).toBe(true);

      // Remove position component
      world.removeComponent(entityId, 'Position');

      focusManager.updateFocusPosition();

      expect(focusManager.hasFocus()).toBe(false);
    });
  });

  describe('focus change callbacks', () => {
    it('notifies on focus set', () => {
      const callback = vi.fn();
      focusManager.onFocusChange(callback);

      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);

      expect(callback).toHaveBeenCalledWith(entityId, { x: 10, y: 20 });
    });

    it('notifies on focus clear', () => {
      const callback = vi.fn();
      focusManager.onFocusChange(callback);

      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);
      callback.mockClear();

      focusManager.clearFocus();

      expect(callback).toHaveBeenCalledWith(null, null);
    });

    it('can unsubscribe from callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = focusManager.onFocusChange(callback);

      unsubscribe();

      const entityId = world.createEntity();
      world.addComponent<PositionComponent>(entityId, {
        type: 'Position',
        x: 10,
        y: 20,
      });

      focusManager.setFocus(entityId);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('unsubscribes from EventBus on destroy', () => {
      expect(eventBus.anyHandlerCount()).toBe(1);

      focusManager.destroy();

      expect(eventBus.anyHandlerCount()).toBe(0);
    });
  });
});
