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
    this.items = this.itemProvider(panelId);
    this.selectedIndex = 0;
    this.render();
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
   * Clean up resources.
   */
  destroy(): void {
    this.box.destroy();
  }

  /**
   * Render the menu bar content.
   */
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
