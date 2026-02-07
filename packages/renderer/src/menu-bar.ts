/**
 * Top menu bar for the terminal UI.
 * Displays panel navigation items and contextual actions.
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import type * as blessed from 'blessed';
import { PanelId } from './types.js';
import { THEME } from './theme.js';

/**
 * A single item in the menu bar.
 */
export interface MenuBarItem {
  readonly label: string;
  readonly key?: string;
  readonly panelId?: PanelId;
  readonly action: () => void;
}

/**
 * Function that provides menu items for a given panel.
 */
export type MenuBarItemProvider = (panelId: PanelId) => readonly MenuBarItem[];

/**
 * Top menu bar widget that displays panel navigation items.
 * Mirrors the status bar pattern (blessed box appended to screen).
 */
export class MenuBar {
  private readonly box: blessed.Widgets.BoxElement;
  private items: readonly MenuBarItem[] = [];
  private selectedIndex = 0;
  private activePanelId: PanelId = PanelId.Map;
  private currentPanelId: PanelId = PanelId.Map;
  private readonly itemProvider: MenuBarItemProvider;

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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blessedModule = require('blessed') as typeof blessed;
      this.box = blessedModule.box(opts);
    }

    screen.append(this.box);
    this.updateForPanel(PanelId.Map);
  }

  /**
   * Update menu items for the given panel.
   */
  updateForPanel(panelId: PanelId): void {
    this.currentPanelId = panelId;
    this.activePanelId = panelId;
    this.items = this.itemProvider(panelId);
    // Set selectedIndex to match the active panel item
    let activeIdx = 0;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item !== undefined && item.panelId === panelId) {
        activeIdx = i;
        break;
      }
    }
    this.selectedIndex = activeIdx;
    this.render();
  }

  /**
   * Get the active panel ID (the focused panel, not the keyboard-selected item).
   */
  getActivePanelId(): PanelId {
    return this.activePanelId;
  }

  /**
   * Select the next item in the menu bar.
   */
  selectNext(): void {
    if (this.items.length > 0) {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
      this.render();
    }
  }

  /**
   * Select the previous item in the menu bar.
   */
  selectPrevious(): void {
    if (this.items.length > 0) {
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
      this.render();
    }
  }

  /**
   * Activate (invoke) the currently selected item.
   */
  activateSelected(): void {
    const item = this.items[this.selectedIndex];
    if (item !== undefined) {
      item.action();
    }
  }

  /**
   * Get the currently selected item index.
   */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /**
   * Get the current menu items.
   */
  getItems(): readonly MenuBarItem[] {
    return this.items;
  }

  /**
   * Get the panel ID the menu is currently displaying for.
   */
  getCurrentPanelId(): PanelId {
    return this.currentPanelId;
  }

  /**
   * Handle a click at the given x coordinate.
   * Maps x position to the menu item at that position and activates it.
   * Returns true if a menu item was clicked.
   */
  handleClick(x: number): boolean {
    let offset = 0;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      // Each item renders as " Label " (label.length + 2)
      const itemWidth = item.label.length + 2;
      if (x >= offset && x < offset + itemWidth) {
        this.selectedIndex = i;
        this.render();
        item.action();
        return true;
      }
      offset += itemWidth;
      // Separator "|" takes 1 char
      if (i < this.items.length - 1) {
        offset += 1;
      }
    }
    return false;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.box.destroy();
  }

  /**
   * Render the menu bar content.
   * Active panel item gets inverse style; keyboard-selected gets bold highlight.
   */
  private render(): void {
    const parts: string[] = [];
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i]!;
      const isActive = item.panelId !== undefined && item.panelId === this.activePanelId;
      const isSelected = i === this.selectedIndex;

      if (isActive) {
        // Active panel: inverse colors (light bg, dark fg)
        parts.push(`{${THEME.ui.menuItemActive}-bg}{#000000-fg}{bold} ${item.label} {/bold}{/}`);
      } else if (isSelected) {
        // Keyboard cursor: bold + active color
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
