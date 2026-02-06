/**
 * Abstract base class for all UI panels.
 * Provides common functionality for rendering, input handling, and layout.
 */

import type * as blessed from 'blessed';
import type { PanelLayout, RenderContext } from './types.js';
import { THEME } from './theme.js';

/**
 * Border style options.
 */
export type BorderStyle = 'single' | 'double';

/**
 * Abstract base panel that all concrete panels extend.
 */
export abstract class BasePanel {
  protected readonly screen: blessed.Widgets.Screen;
  protected readonly box: blessed.Widgets.BoxElement;
  protected layout: PanelLayout;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    this.screen = screen;
    this.layout = { ...layout };

    this.box = boxFactory({
      top: layout.y,
      left: layout.x,
      width: layout.width,
      height: layout.height,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: layout.focused ? THEME.ui.borderFocused : THEME.ui.borderBlurred,
        },
      },
      scrollable: true,
      mouse: true,
      keys: true,
      tags: true,
    });

    screen.append(this.box);
  }

  /**
   * Render the panel content with the current context.
   * Must be implemented by subclasses.
   */
  abstract render(context: RenderContext): void;

  /**
   * Handle keyboard input.
   * @returns true if the input was consumed, false to propagate
   */
  abstract handleInput(key: string): boolean;

  /**
   * Focus this panel (visual indicator).
   */
  focus(): void {
    this.layout.focused = true;
    this.box.style.border = { fg: THEME.ui.borderFocused };
    this.box.focus();
    this.screen.render();
  }

  /**
   * Remove focus from this panel.
   */
  blur(): void {
    this.layout.focused = false;
    this.box.style.border = { fg: THEME.ui.borderBlurred };
    this.screen.render();
  }

  /**
   * Resize the panel.
   */
  resize(width: number, height: number): void {
    this.layout.width = width;
    this.layout.height = height;
    this.box.width = width;
    this.box.height = height;
    this.screen.render();
  }

  /**
   * Move the panel to a new position.
   */
  moveTo(x: number, y: number): void {
    this.layout.x = x;
    this.layout.y = y;
    this.box.top = y;
    this.box.left = x;
    this.screen.render();
  }

  /**
   * Get the underlying blessed box element.
   */
  getBox(): blessed.Widgets.BoxElement {
    return this.box;
  }

  /**
   * Get the current layout.
   */
  getLayout(): PanelLayout {
    return { ...this.layout };
  }

  /**
   * Check if this panel is focused.
   */
  isFocused(): boolean {
    return this.layout.focused;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.box.destroy();
  }

  /**
   * Set the panel title in the border.
   */
  protected setTitle(title: string): void {
    this.box.setLabel(` ${title} `);
  }

  /**
   * Write text at a specific position within the panel.
   * Coordinates are relative to the panel's content area.
   */
  protected writeAt(x: number, y: number, text: string, fg?: string, bg?: string): void {
    const content = this.box.getContent();
    const lines = content.split('\n');

    // Ensure we have enough lines
    while (lines.length <= y) {
      lines.push('');
    }

    // Get the line and ensure it's long enough
    let line = lines[y] ?? '';
    while (line.length < x) {
      line += ' ';
    }

    // Build the styled text
    let styledText = text;
    if (fg !== undefined || bg !== undefined) {
      const fgCode = fg !== undefined ? `{${fg}-fg}` : '';
      const bgCode = bg !== undefined ? `{${bg}-bg}` : '';
      const resetFg = fg !== undefined ? '{/}' : '';
      const resetBg = bg !== undefined ? '{/}' : '';
      styledText = `${fgCode}${bgCode}${text}${resetBg}${resetFg}`;
    }

    // Insert the text at position
    lines[y] = line.slice(0, x) + styledText + line.slice(x + text.length);

    this.box.setContent(lines.join('\n'));
  }

  /**
   * Clear the panel content area.
   */
  protected clearArea(): void {
    this.box.setContent('');
  }

  /**
   * Append a line of text to the panel.
   */
  protected appendLine(text: string): void {
    const content = this.box.getContent();
    this.box.setContent(content + (content.length > 0 ? '\n' : '') + text);
  }

  /**
   * Set the full content of the panel.
   */
  protected setContent(content: string): void {
    this.box.setContent(content);
  }

  /**
   * Scroll the panel content.
   */
  protected scroll(lines: number): void {
    this.box.scroll(lines);
  }

  /**
   * Get inner dimensions (excluding border).
   */
  protected getInnerDimensions(): { width: number; height: number } {
    // Account for borders (1 char each side)
    return {
      width: Math.max(0, this.layout.width - 2),
      height: Math.max(0, this.layout.height - 2),
    };
  }
}

/**
 * Mock screen for testing purposes.
 * Provides a minimal implementation that doesn't require a real terminal.
 */
export class MockScreen {
  private elements: MockBox[] = [];
  private keyHandlers: Map<string, Array<() => void>> = new Map();
  private rendered = false;

  append(element: MockBox): void {
    this.elements.push(element);
  }

  render(): void {
    this.rendered = true;
  }

  key(keys: string | string[], handler: () => void): void {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      const handlers = this.keyHandlers.get(k) ?? [];
      handlers.push(handler);
      this.keyHandlers.set(k, handlers);
    }
  }

  simulateKey(key: string): void {
    const handlers = this.keyHandlers.get(key);
    if (handlers !== undefined) {
      for (const h of handlers) {
        h();
      }
    }
  }

  destroy(): void {
    this.elements = [];
    this.keyHandlers.clear();
  }

  isRendered(): boolean {
    return this.rendered;
  }

  getElements(): MockBox[] {
    return [...this.elements];
  }
}

/**
 * Mock box element for testing purposes.
 */
export class MockBox {
  top: number;
  left: number;
  width: number;
  height: number;
  content = '';
  label = '';
  style: { border?: { fg?: string } } = {};
  private focused = false;
  private destroyed = false;

  constructor(opts: {
    top?: number;
    left?: number;
    width?: number;
    height?: number;
  }) {
    this.top = opts.top ?? 0;
    this.left = opts.left ?? 0;
    this.width = opts.width ?? 10;
    this.height = opts.height ?? 10;
  }

  setLabel(label: string): void {
    this.label = label;
  }

  setContent(content: string): void {
    this.content = content;
  }

  getContent(): string {
    return this.content;
  }

  focus(): void {
    this.focused = true;
  }

  blur(): void {
    this.focused = false;
  }

  isFocused(): boolean {
    return this.focused;
  }

  scroll(_lines: number): void {
    // No-op for mock
  }

  destroy(): void {
    this.destroyed = true;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

/**
 * Create a mock box factory for testing.
 */
export function createMockBoxFactory(screen: MockScreen): (opts: blessed.Widgets.BoxOptions) => MockBox {
  return (opts: blessed.Widgets.BoxOptions): MockBox => {
    const box = new MockBox({
      top: typeof opts.top === 'number' ? opts.top : 0,
      left: typeof opts.left === 'number' ? opts.left : 0,
      width: typeof opts.width === 'number' ? opts.width : 10,
      height: typeof opts.height === 'number' ? opts.height : 10,
    });
    screen.append(box);
    return box;
  };
}
