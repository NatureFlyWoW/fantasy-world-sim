# UI Overhaul Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four UI issues: event log spam filtering, broken panel keybindings, garbled initial map render, and add a top menu bar.

**Architecture:** Four independent fixes to the renderer and CLI packages. Event log gets a default significance filter. Key delegation gets a catch-all handler. Map initialization eliminates the double-screen race condition. A blessed listbar element is added at the top of the screen with context-sensitive items.

**Tech Stack:** TypeScript, blessed (terminal UI), Vitest

---

## Task 1: Raise Default Event Log Significance Filter

The event log shows every event (minSignificance: 0). CharacterAI emits dozens of sig-20 events per tick (befriend, craft item, study lore). The log is drowned in noise.

**Files:**
- Modify: `packages/renderer/src/panels/event-log-panel.ts:211`
- Test: `packages/renderer/src/panels/event-log-panel.test.ts`

**Step 1: Write the failing test**

Add a test that verifies the default filter has a reasonable minimum significance threshold:

```typescript
it('should default to minSignificance 40', () => {
  const panel = new EventLogPanel(mockScreen, layout, boxFactory);
  // Access the filter via the panel's public or testable API
  // The panel should not display events below significance 40 by default
  const lowSigEvent = createTestEvent({ significance: 20, category: EventCategory.Personal, subtype: 'character.befriend' });
  const highSigEvent = createTestEvent({ significance: 50, category: EventCategory.Personal, subtype: 'character.befriend' });

  // passesFilter is private, so test via addEvent + getDisplayedEvents behavior
  // or test the createDefaultFilter output directly if accessible
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter verbose packages/renderer/src/panels/event-log-panel.test.ts`
Expected: FAIL — current default is 0, not 40.

**Step 3: Change the default filter**

In `packages/renderer/src/panels/event-log-panel.ts`, line 211, change:

```typescript
// BEFORE:
minSignificance: 0,

// AFTER:
minSignificance: 40,
```

This single-line change filters out all trivial character actions (sig 20-39) while keeping moderate and above events visible. Users can still press `f` to open the filter panel and lower the threshold manually if desired.

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter verbose packages/renderer/src/panels/event-log-panel.test.ts`
Expected: PASS. Also check that no existing tests break (some tests may create events with low significance and expect them to appear — those tests need their event significance raised to 40+, or they need to explicitly set the filter to 0).

**Step 5: Fix any broken tests**

If existing tests create events with significance below 40 and expect them to display, update those test events to have significance >= 40. Do NOT lower the default back to 0.

**Step 6: Commit**

```bash
git add packages/renderer/src/panels/event-log-panel.ts packages/renderer/src/panels/event-log-panel.test.ts
git commit -m "fix(renderer): raise default event log significance filter to 40

Filters out low-significance CharacterAI noise (befriend, craft, study lore
at sig ~20). Users can still lower threshold via filter panel (f key)."
```

---

## Task 2: Fix Broken Panel Keybindings

Panel-specific keys (Inspector: O/R/T/D/1-8, EventLog: B/G/V/H//) are never delegated to focused panels. The `setupKeyBindings()` method in `app.ts` only registers arrows, WASD, hjk, f/z/t/c/[/]/home/end, and enter. All other keys are silently dropped by blessed.

Additionally, number keys 1-7 are globally registered for panel switching, which conflicts with Inspector's section toggle (1-8).

**Files:**
- Modify: `packages/renderer/src/app.ts:562-634`
- Test: `packages/renderer/src/app.test.ts`

**Step 1: Write the failing test**

```typescript
it('should delegate panel-specific keys to focused panel', () => {
  // Focus the inspector panel
  app.focusPanel(PanelId.Inspector);

  // Simulate pressing 'o' (inspector mode: overview)
  simulateKeyPress('o');

  // Verify the inspector received the key
  expect(mockInspectorPanel.handleInput).toHaveBeenCalledWith('o');
});

it('should delegate slash key to event log for search', () => {
  app.focusPanel(PanelId.EventLog);
  simulateKeyPress('/');
  expect(mockEventLogPanel.handleInput).toHaveBeenCalledWith('/');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter verbose packages/renderer/src/app.test.ts`
Expected: FAIL — 'o' and '/' are not in the delegation list.

**Step 3: Replace hardcoded key delegation with catch-all**

In `packages/renderer/src/app.ts`, in the `setupKeyBindings()` method (line 562), **replace** the three separate delegation blocks (lines 604-633) with a single catch-all approach.

**Remove** these three blocks:
```typescript
// Lines 604-609: Arrow/WASD delegation
// Lines 612-617: Vim key delegation
// Lines 620-625: Panel-specific action key delegation
// Lines 628-633: Enter delegation
```

**Replace with** a single `keypress` handler that delegates ALL unhandled keys to the focused panel. Place it AFTER all global handlers (q, tab, number keys, space, +/-, escape, F1, m, l):

```typescript
// Catch-all: delegate all other keys to the focused panel.
// This runs AFTER global handlers (which use screen.key()),
// so global bindings take priority.
this.screen.on('keypress', (ch: string | undefined, key: { name?: string; full?: string; ctrl?: boolean; shift?: boolean } | undefined) => {
  // Skip if a global binding already handled this key.
  // Global bindings: q, C-c, tab, 1-7, space, +/=/-/_, escape, F1, m, l
  const globalKeys = new Set([
    'q', 'tab', 'space', 'escape', 'f1', 'm', 'l',
    '1', '2', '3', '4', '5', '6', '7',
  ]);
  const keyName = key?.name ?? ch ?? '';
  const keyFull = key?.full ?? '';

  // Skip global keys and ctrl combos (except ones panels might want)
  if (globalKeys.has(keyName) || globalKeys.has(keyFull)) return;
  if (key?.ctrl === true && keyName !== 'c') return; // Let Ctrl+C through to quit handler
  if (keyName === '' && (ch === undefined || ch === '')) return;

  const panel = this.panels.get(this.state.focusedPanel);
  if (panel !== undefined) {
    const inputKey = keyName !== '' ? keyName : (ch ?? '');
    panel.handleInput(inputKey);
  }
});
```

**Important:** This also fixes the number key conflict. Number keys 1-7 are in `globalKeys`, so they switch panels globally. But when Inspector is focused, users can press Shift+1 through Shift+8 (which produce `!`, `@`, etc.) or we can add a modifier.

**Alternative for number key conflict:** Instead of the globalKeys set approach, make number keys context-aware:

```typescript
// Number keys: switch to panel, BUT delegate to inspector if inspector is focused
for (let i = 1; i <= 7; i++) {
  this.screen.key(String(i), () => {
    // If inspector is focused, delegate to inspector for section toggles
    if (this.state.focusedPanel === PanelId.Inspector) {
      const panel = this.panels.get(PanelId.Inspector);
      if (panel !== undefined) {
        panel.handleInput(String(i));
        return;
      }
    }
    const panelId = PANEL_INDEX[i - 1];
    if (panelId !== undefined) {
      this.focusPanel(panelId);
    }
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter verbose packages/renderer/src/app.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass. The catch-all handler should not interfere with existing global bindings because `screen.key()` handlers fire first in blessed's event pipeline.

**Step 6: Commit**

```bash
git add packages/renderer/src/app.ts packages/renderer/src/app.test.ts
git commit -m "fix(renderer): delegate all keys to focused panel via catch-all handler

Replaces hardcoded key delegation lists with a keypress catch-all that
forwards unhandled keys to the focused panel. Fixes Inspector O/R/T/D
mode switching, EventLog B/G/V/H/ actions, and number key section
toggles when Inspector is focused."
```

---

## Task 3: Fix Initial Map Rendering

The map appears garbled on first load because of a double-screen race condition. The CLI creates a blessed screen (line 477), creates panels with layouts based on that screen's dimensions, then calls `app.start()` which creates a SECOND screen (via `createScreen()`) and recalculates layout. The MapPanel's viewport was initialized with the first screen's dimensions and isn't synced before the first render.

**Files:**
- Modify: `packages/renderer/src/app.ts:143-156` (start method)
- Modify: `packages/renderer/src/app.ts:424-442` (createScreen method)
- Modify: `packages/cli/src/index.ts:477-534`
- Test: `packages/renderer/src/app.test.ts`

**Step 1: Write the failing test**

```typescript
it('should use injected screen factory instead of creating a new screen', () => {
  const mockScreen = createMockScreen();
  const screenFactory = vi.fn(() => mockScreen);
  app.setFactories(screenFactory, boxFactory);

  app.start();

  // Screen factory should be called exactly once
  expect(screenFactory).toHaveBeenCalledTimes(1);

  // The screen should be the injected one, not a new one
  // Verify by checking that no second blessed.screen() call was made
});

it('should render map correctly on initial frame', () => {
  app.setFactories(() => mockScreen, boxFactory);
  app.registerPanel(mapPanel, PanelId.Map);
  app.start();
  app.renderInitialFrame();

  // Verify the map panel was rendered with correct dimensions
  expect(mapPanel.render).toHaveBeenCalled();
  // The map panel's viewport should match the layout dimensions
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter verbose packages/renderer/src/app.test.ts`
Expected: FAIL or at least confirms the double-screen creation.

**Step 3: Fix the createScreen method**

In `packages/renderer/src/app.ts`, modify `createScreen()` (line 424) to NOT create a new blessed screen when a screen factory has been injected. The screen factory in CLI already provides the correct screen.

The actual issue: `createScreen()` IS using the factory (`screenFactory()` at line 426), but it creates a NEW LayoutManager sizing (lines 439-442) based on the new screen dimensions. This is correct behavior — the problem is that panels were already created with a DIFFERENT LayoutManager in the CLI.

**The real fix** is in CLI `index.ts`: Stop creating panels with a local LayoutManager. Instead, let Application own the layout entirely.

In `packages/cli/src/index.ts`, change the initialization flow:

```typescript
// BEFORE (current broken flow):
// 1. Create screen
// 2. Create local LayoutManager
// 3. Create panels with local layouts
// 4. Create app
// 5. app.start() creates screen again, recalculates layout
// 6. app.renderInitialFrame() renders with mismatched viewport

// AFTER (fixed flow):
// 1. Create screen
// 2. Create app with screen factory
// 3. app.start() → uses factory screen, creates LayoutManager
// 4. Get layout from app's LayoutManager
// 5. Create panels with those layouts
// 6. Register panels
// 7. app.renderInitialFrame()
```

This requires adding a method to Application to expose its layout after start:

```typescript
// Add to Application class:
getLayout(panelId: PanelId): PanelLayout {
  const layout = this.layoutManager.getCurrentLayout().panels.get(panelId);
  if (layout !== undefined) return layout;
  return { id: panelId, x: 0, y: 0, width: 40, height: 20, focused: false };
}
```

**Alternative simpler fix:** Keep the CLI flow but force a viewport resize on MapPanel after `app.start()` and before `renderInitialFrame()`. Add a call in the CLI:

```typescript
// After app.start() but before renderInitialFrame():
app.start();

// Force all panels to sync with the actual layout dimensions
app.syncPanelDimensions(); // New method that calls resize() on each panel

app.renderInitialFrame();
```

Or even simpler — in `app.ts`'s `applyLayout()` method, ensure it calls `panel.resize()` for every panel:

```typescript
// In applyLayout() — currently just updates positions
// Add explicit resize call:
private applyLayout(): void {
  const layout = this.layoutManager.getCurrentLayout();
  for (const [id, panel] of this.panels) {
    const panelLayout = layout.panels.get(id);
    if (panelLayout !== undefined) {
      panel.moveTo(panelLayout.x, panelLayout.y);
      panel.resize(panelLayout.width, panelLayout.height);
    }
  }
}
```

Check if `applyLayout()` already does this. If it does, the issue might be that MapPanel's `resize()` doesn't update the viewport. Check MapPanel.resize() implementation.

**Step 4: Verify the fix**

Run: `pnpm run test -- --reporter verbose packages/renderer/src/app.test.ts`
Then run the full app: `pnpm run start -- --seed 42` and verify the map renders correctly on first frame.

**Step 5: Commit**

```bash
git add packages/renderer/src/app.ts packages/cli/src/index.ts packages/renderer/src/app.test.ts
git commit -m "fix(renderer): eliminate double-screen race condition in map initialization

Ensures MapPanel viewport dimensions match actual screen dimensions on
first render by syncing panel dimensions in applyLayout() after the
screen is created."
```

---

## Task 4: Add Top Menu Bar

Add a 1-row blessed listbar at the top of the screen. Context-sensitive items change based on which panel is focused. Mirrors the existing status bar pattern.

**Files:**
- Create: `packages/renderer/src/menu-bar.ts`
- Modify: `packages/renderer/src/layout-manager.ts` (all 5 layout functions)
- Modify: `packages/renderer/src/app.ts` (create + wire menu bar)
- Modify: `packages/renderer/src/theme.ts` (menu bar colors)
- Test: `packages/renderer/src/menu-bar.test.ts`
- Test: `packages/renderer/src/layout-manager.test.ts` (update expectations)

### Step 1: Add MENU_BAR_HEIGHT to layout-manager

**File:** `packages/renderer/src/layout-manager.ts`

Add constant at line 28:

```typescript
const MENU_BAR_HEIGHT = 1;
```

Update `LayoutConfiguration` interface to include it:

```typescript
export interface LayoutConfiguration {
  readonly panels: Map<PanelId, PanelLayout>;
  readonly statusBarHeight: number;
  readonly menuBarHeight: number;
}
```

### Step 2: Update all 5 layout functions

In each layout function, change:
- `usableHeight = screen.height - STATUS_BAR_HEIGHT` → `usableHeight = screen.height - STATUS_BAR_HEIGHT - MENU_BAR_HEIGHT`
- All visible panel `y:` values: add `MENU_BAR_HEIGHT` offset (panels start at y=1 instead of y=0)
- Return `menuBarHeight: MENU_BAR_HEIGHT`

**Example for `calculateDefaultLayout` (line 37):**

```typescript
export function calculateDefaultLayout(screen: ScreenDimensions): LayoutConfiguration {
  const panels = new Map<PanelId, PanelLayout>();

  const usableHeight = screen.height - STATUS_BAR_HEIGHT - MENU_BAR_HEIGHT;
  const leftWidth = Math.floor(screen.width * 0.6);
  const rightWidth = screen.width - leftWidth;
  const rightTopHeight = Math.floor(usableHeight * 0.5);
  const rightBottomHeight = usableHeight - rightTopHeight;

  panels.set(PanelId.Map, {
    id: PanelId.Map,
    x: 0,
    y: MENU_BAR_HEIGHT,  // ← was 0
    width: leftWidth,
    height: usableHeight,
    focused: true,
  });

  panels.set(PanelId.EventLog, {
    id: PanelId.EventLog,
    x: leftWidth,
    y: MENU_BAR_HEIGHT,  // ← was 0
    width: rightWidth,
    height: rightTopHeight,
    focused: false,
  });

  panels.set(PanelId.Inspector, {
    id: PanelId.Inspector,
    x: leftWidth,
    y: MENU_BAR_HEIGHT + rightTopHeight,  // ← was rightTopHeight
    width: rightWidth,
    height: rightBottomHeight,
    focused: false,
  });

  // Hidden panels stay at x:0, y:0, width:0, height:0
  // ...

  return {
    panels,
    statusBarHeight: STATUS_BAR_HEIGHT,
    menuBarHeight: MENU_BAR_HEIGHT,
  };
}
```

Apply the same pattern to `calculateMapFocusLayout`, `calculateLogFocusLayout`, `calculateSplitLayout`, and `calculateMaximizedLayout`. For maximized layout, the maximized panel should also start at `y: MENU_BAR_HEIGHT`.

### Step 3: Update layout-manager tests

Update test expectations: panel y coordinates shift by 1, usable heights shrink by 1, `menuBarHeight` property expected in return.

### Step 4: Add menu bar theme colors

**File:** `packages/renderer/src/theme.ts`

Add to the UI colors section:

```typescript
menuBar: '#1a1a3a',
menuItemActive: '#4488FF',
menuItemText: '#888899',
menuItemSeparator: '#333355',
```

### Step 5: Create MenuBar class

**File:** `packages/renderer/src/menu-bar.ts`

```typescript
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import type * as blessed from 'blessed';
import { PanelId } from './types.js';
import { THEME } from './theme.js';

export interface MenuBarItem {
  readonly label: string;
  readonly key?: string;
  readonly action: () => void;
}

export type MenuBarItemProvider = (panelId: PanelId) => readonly MenuBarItem[];

export class MenuBar {
  private box: blessed.Widgets.BoxElement;
  private items: readonly MenuBarItem[] = [];
  private selectedIndex = 0;
  private currentPanelId: PanelId = PanelId.Map;
  private itemProvider: MenuBarItemProvider;

  constructor(
    screen: blessed.Widgets.Screen,
    boxFactory: ((opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement) | null,
    itemProvider: MenuBarItemProvider
  ) {
    this.itemProvider = itemProvider;

    const opts: blessed.Widgets.BoxOptions = {
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: THEME.ui.menuBar,
        fg: THEME.ui.menuItemText,
      },
      tags: true,
    };

    if (boxFactory !== null) {
      this.box = boxFactory(opts);
    } else {
      const blessedModule = require('blessed') as typeof blessed;
      this.box = blessedModule.box(opts);
    }

    screen.append(this.box);
    this.updateForPanel(PanelId.Map);
  }

  updateForPanel(panelId: PanelId): void {
    this.currentPanelId = panelId;
    this.items = this.itemProvider(panelId);
    this.selectedIndex = 0;
    this.render();
  }

  selectNext(): void {
    if (this.items.length > 0) {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
      this.render();
    }
  }

  selectPrevious(): void {
    if (this.items.length > 0) {
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
      this.render();
    }
  }

  activateSelected(): void {
    const item = this.items[this.selectedIndex];
    if (item !== undefined) {
      item.action();
    }
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  getItems(): readonly MenuBarItem[] {
    return this.items;
  }

  destroy(): void {
    this.box.destroy();
  }

  private render(): void {
    const parts: string[] = [];
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      if (i === this.selectedIndex) {
        parts.push(`{${THEME.ui.menuItemActive}-fg}{bold} ${item.label} {/bold}{/}`);
      } else {
        parts.push(` ${item.label} `);
      }
      if (i < this.items.length - 1) {
        parts.push(`{${THEME.ui.menuItemSeparator}-fg}|{/}`);
      }
    }
    this.box.setContent(parts.join(''));
  }
}
```

### Step 6: Write menu bar tests

**File:** `packages/renderer/src/menu-bar.test.ts`

Test: creation, updateForPanel changes items, selectNext/Previous cycles, activateSelected calls action callback, render produces expected content string.

### Step 7: Wire menu bar into Application

**File:** `packages/renderer/src/app.ts`

Add property:
```typescript
private menuBar: MenuBar | null = null;
```

Add `createMenuBar()` method called from `start()` after `createScreen()` and before `createStatusBar()`:

```typescript
private createMenuBar(): void {
  if (this.screen === null) return;

  const defaultItems: MenuBarItemProvider = (panelId) => {
    const items: MenuBarItem[] = [
      { label: 'Map', key: '1', action: () => this.focusPanel(PanelId.Map) },
      { label: 'Events', key: '2', action: () => this.focusPanel(PanelId.EventLog) },
      { label: 'Inspector', key: '3', action: () => this.focusPanel(PanelId.Inspector) },
      { label: 'Relations', key: '4', action: () => this.focusPanel(PanelId.RelationshipGraph) },
      { label: 'Timeline', key: '5', action: () => this.focusPanel(PanelId.Timeline) },
      { label: 'Stats', key: '6', action: () => this.focusPanel(PanelId.Statistics) },
      { label: 'Fingerprint', key: '7', action: () => this.focusPanel(PanelId.Fingerprint) },
    ];
    return items;
  };

  this.menuBar = new MenuBar(this.screen, this.boxFactory, defaultItems);
}
```

Update `focusPanel()` to call `this.menuBar?.updateForPanel(panelId)`.

### Step 8: Update Application tests

Update app.test.ts expectations for layout y-offsets and menuBar existence.

### Step 9: Run full test suite

Run: `pnpm run test`
Expected: All tests pass.

### Step 10: Manual verification

Run: `pnpm run start -- --seed 42`
Verify: Menu bar visible at top, panels shifted down 1 row, status bar at bottom.

### Step 11: Commit

```bash
git add packages/renderer/src/menu-bar.ts packages/renderer/src/menu-bar.test.ts packages/renderer/src/layout-manager.ts packages/renderer/src/layout-manager.test.ts packages/renderer/src/app.ts packages/renderer/src/app.test.ts packages/renderer/src/theme.ts
git commit -m "feat(renderer): add top menu bar with panel navigation

Adds a 1-row menu bar at the top of the screen with panel switcher items.
Mirrors the status bar pattern. All layout functions updated to reserve
space for the menu bar (panels shift down 1 row). Menu bar highlights
the currently focused panel."
```

---

## Task 5: Integration Verification

**Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass.

**Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

**Step 3: Manual smoke test**

Run: `pnpm run start -- --seed 42`

Verify:
- [ ] Menu bar visible at top with panel names
- [ ] Map renders correctly on first frame (no garbled lines)
- [ ] Event log shows only significance >= 40 events (no befriend/craft spam)
- [ ] Press `3` to focus Inspector, then press `o`, `r`, `t`, `d` — modes switch
- [ ] In Inspector, press `1`-`8` to toggle sections
- [ ] Press `2` to focus Event Log, press `b` to bookmark, `/` to search, `v` for vignette
- [ ] Press Space to start simulation — events flow at reasonable pace
- [ ] Menu bar highlights current panel

**Step 4: Final commit**

If any integration issues found, fix and commit individually.

---

## Execution Order Summary

| Task | Priority | Independence | Estimated Steps |
|------|----------|-------------|-----------------|
| 1. Event log filter | P1 | Fully independent | 6 |
| 2. Keybindings fix | P2 | Fully independent | 6 |
| 3. Map init fix | P3 | Fully independent | 5 |
| 4. Top menu bar | P4 | Depends on Task 3 (layout changes) | 11 |
| 5. Integration test | Last | Depends on all above | 4 |

Tasks 1, 2, and 3 can be done in parallel. Task 4 should come after Task 3 since both touch the layout system. Task 5 is final integration verification.
