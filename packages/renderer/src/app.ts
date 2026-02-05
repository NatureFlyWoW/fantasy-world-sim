/**
 * Main application class for the terminal UI.
 * Orchestrates the screen, panels, and input handling.
 */

import type * as blessed from 'blessed';
import type { WorldEvent, Unsubscribe } from '@fws/core';
import type { RenderContext, AppState, SelectedEntity, KeyBinding, LayoutPreset } from './types.js';
import { PanelId, SimulationSpeed, getSpeedDisplayName, formatWorldTime } from './types.js';
import { LayoutManager } from './layout-manager.js';
import type { BasePanel } from './panel.js';
import { THEME } from './theme.js';

/**
 * Panel index mapping for number key shortcuts.
 */
const PANEL_INDEX: readonly PanelId[] = [
  PanelId.Map,
  PanelId.EventLog,
  PanelId.Inspector,
  PanelId.RelationshipGraph,
  PanelId.Timeline,
  PanelId.Statistics,
  PanelId.Fingerprint,
];

/**
 * Key bindings for the application.
 */
export const KEY_BINDINGS: readonly KeyBinding[] = [
  { key: 'tab', action: 'cycleFocus', description: 'Cycle focus between panels' },
  { key: '1-7', action: 'switchPanel', description: 'Switch to panel by number' },
  { key: 'space', action: 'togglePause', description: 'Toggle simulation pause/play' },
  { key: '+', action: 'speedUp', description: 'Increase simulation speed' },
  { key: '-', action: 'speedDown', description: 'Decrease simulation speed' },
  { key: 'enter', action: 'inspect', description: 'Inspect selected entity' },
  { key: 'escape', action: 'back', description: 'Deselect / go back' },
  { key: 'q', action: 'quit', description: 'Quit application' },
  { key: 'arrows/wasd', action: 'pan', description: 'Pan map (when Map focused)' },
  { key: 'f1', action: 'help', description: 'Toggle help overlay' },
  { key: 'm', action: 'maximize', description: 'Maximize current panel' },
  { key: 'l', action: 'cycleLayout', description: 'Cycle layout presets' },
];

/**
 * Speed progression for speed up/down.
 */
const SPEED_ORDER: readonly SimulationSpeed[] = [
  SimulationSpeed.Paused,
  SimulationSpeed.SlowMotion,
  SimulationSpeed.Normal,
  SimulationSpeed.Fast7,
  SimulationSpeed.Fast30,
  SimulationSpeed.Fast365,
  SimulationSpeed.UltraFast3650,
];

/**
 * Layout preset order for cycling.
 */
const LAYOUT_ORDER: readonly LayoutPreset[] = ['default', 'map-focus', 'log-focus', 'split'];

/**
 * Application configuration.
 */
export interface AppConfig {
  readonly targetFps: number;
  readonly batchEvents: boolean;
}

/**
 * Default application configuration.
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  targetFps: 30,
  batchEvents: true,
};

/**
 * Main application class.
 */
export class Application {
  private readonly context: RenderContext;
  private readonly config: AppConfig;
  private readonly layoutManager: LayoutManager;

  private screen: blessed.Widgets.Screen | null = null;
  private statusBar: blessed.Widgets.BoxElement | null = null;
  private helpOverlay: blessed.Widgets.BoxElement | null = null;
  private panels: Map<PanelId, BasePanel> = new Map();

  private state: AppState;
  private running = false;
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private eventSubscription: Unsubscribe | null = null;
  private pendingEvents: WorldEvent[] = [];
  private lastRenderTime = 0;

  // Factory functions for blessed elements (injected for testability)
  private screenFactory: (() => blessed.Widgets.Screen) | null = null;
  private boxFactory: ((opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement) | null = null;

  constructor(context: RenderContext, config: Partial<AppConfig> = {}) {
    this.context = context;
    this.config = { ...DEFAULT_APP_CONFIG, ...config };

    // Initialize with default screen size (will be updated on start)
    this.layoutManager = new LayoutManager({ width: 120, height: 40 });

    this.state = {
      speed: SimulationSpeed.Normal,
      selectedEntity: null,
      focusedPanel: PanelId.Map,
      focusLocation: null,
      helpVisible: false,
    };
  }

  /**
   * Set factory functions for blessed elements (for testing).
   */
  setFactories(
    screenFactory: () => blessed.Widgets.Screen,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ): void {
    this.screenFactory = screenFactory;
    this.boxFactory = boxFactory;
  }

  /**
   * Start the application.
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.createScreen();
    this.createStatusBar();
    this.setupKeyBindings();
    this.subscribeToEvents();
    this.startRenderLoop();

    if (this.screen !== null) {
      this.screen.render();
    }
  }

  /**
   * Stop the application and clean up.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.renderInterval !== null) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }

    if (this.eventSubscription !== null) {
      this.eventSubscription();
      this.eventSubscription = null;
    }

    for (const panel of this.panels.values()) {
      panel.destroy();
    }
    this.panels.clear();

    if (this.screen !== null) {
      this.screen.destroy();
      this.screen = null;
    }
  }

  /**
   * Get the current application state.
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get the layout manager.
   */
  getLayoutManager(): LayoutManager {
    return this.layoutManager;
  }

  /**
   * Register a panel.
   */
  registerPanel(panel: BasePanel, id: PanelId): void {
    this.panels.set(id, panel);
  }

  /**
   * Set the selected entity.
   */
  setSelectedEntity(entity: SelectedEntity | null): void {
    this.state = { ...this.state, selectedEntity: entity };
    this.updateStatusBar();
  }

  /**
   * Set the focus location on the map.
   */
  setFocusLocation(location: { x: number; y: number } | null): void {
    this.state = { ...this.state, focusLocation: location };
    this.updateStatusBar();
  }

  /**
   * Cycle focus to the next visible panel.
   */
  cycleFocus(): void {
    const visible = this.layoutManager.getVisiblePanels();
    if (visible.length === 0) return;

    const currentIndex = visible.indexOf(this.state.focusedPanel);
    const nextIndex = (currentIndex + 1) % visible.length;
    const nextPanel = visible[nextIndex];
    if (nextPanel !== undefined) {
      this.focusPanel(nextPanel);
    }
  }

  /**
   * Focus a specific panel.
   */
  focusPanel(panelId: PanelId): void {
    // Blur current panel
    const currentPanel = this.panels.get(this.state.focusedPanel);
    if (currentPanel !== undefined) {
      currentPanel.blur();
    }

    // Focus new panel
    const newPanel = this.panels.get(panelId);
    if (newPanel !== undefined) {
      newPanel.focus();
    }

    this.state = { ...this.state, focusedPanel: panelId };
  }

  /**
   * Toggle simulation pause/play.
   */
  togglePause(): void {
    if (this.state.speed === SimulationSpeed.Paused) {
      this.state = { ...this.state, speed: SimulationSpeed.Normal };
    } else {
      this.state = { ...this.state, speed: SimulationSpeed.Paused };
    }
    this.updateStatusBar();
  }

  /**
   * Increase simulation speed.
   */
  speedUp(): void {
    const currentIndex = SPEED_ORDER.indexOf(this.state.speed);
    if (currentIndex < SPEED_ORDER.length - 1) {
      const newSpeed = SPEED_ORDER[currentIndex + 1];
      if (newSpeed !== undefined) {
        this.state = { ...this.state, speed: newSpeed };
        this.updateStatusBar();
      }
    }
  }

  /**
   * Decrease simulation speed.
   */
  speedDown(): void {
    const currentIndex = SPEED_ORDER.indexOf(this.state.speed);
    if (currentIndex > 0) {
      const newSpeed = SPEED_ORDER[currentIndex - 1];
      if (newSpeed !== undefined) {
        this.state = { ...this.state, speed: newSpeed };
        this.updateStatusBar();
      }
    }
  }

  /**
   * Toggle help overlay visibility.
   */
  toggleHelp(): void {
    this.state = { ...this.state, helpVisible: !this.state.helpVisible };

    if (this.helpOverlay !== null && this.screen !== null) {
      if (this.state.helpVisible) {
        this.helpOverlay.show();
      } else {
        this.helpOverlay.hide();
      }
      this.screen.render();
    }
  }

  /**
   * Maximize the currently focused panel.
   */
  maximizeCurrentPanel(): void {
    if (this.layoutManager.isMaximized()) {
      this.layoutManager.restoreLayout();
    } else {
      this.layoutManager.maximizePanel(this.state.focusedPanel);
    }
    this.applyLayout();
  }

  /**
   * Cycle through layout presets.
   */
  cycleLayout(): void {
    const currentIndex = LAYOUT_ORDER.indexOf(this.layoutManager.getCurrentPreset());
    const nextIndex = (currentIndex + 1) % LAYOUT_ORDER.length;
    const nextPreset = LAYOUT_ORDER[nextIndex];
    if (nextPreset !== undefined) {
      this.layoutManager.setLayout(nextPreset);
      this.applyLayout();
    }
  }

  /**
   * Handle escape key (deselect / go back).
   */
  handleEscape(): void {
    if (this.state.helpVisible) {
      this.toggleHelp();
    } else if (this.layoutManager.isMaximized()) {
      this.layoutManager.restoreLayout();
      this.applyLayout();
    } else if (this.state.selectedEntity !== null) {
      this.setSelectedEntity(null);
    }
  }

  /**
   * Render all panels.
   */
  render(): void {
    if (!this.running) return;

    const now = Date.now();
    const frameTime = 1000 / this.config.targetFps;

    // Throttle rendering
    if (now - this.lastRenderTime < frameTime) {
      return;
    }
    this.lastRenderTime = now;

    // Process pending events in batch
    if (this.config.batchEvents && this.pendingEvents.length > 0) {
      this.processPendingEvents();
    }

    // Render each panel
    for (const panel of this.panels.values()) {
      panel.render(this.context);
    }

    if (this.screen !== null) {
      this.screen.render();
    }
  }

  /**
   * Create the blessed screen.
   */
  private createScreen(): void {
    if (this.screenFactory !== null) {
      this.screen = this.screenFactory();
    } else {
      // Dynamic import to avoid issues in test environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blessedModule = require('blessed') as typeof blessed;
      this.screen = blessedModule.screen({
        smartCSR: true,
        title: 'Æternum - Fantasy World Simulator',
        fullUnicode: true,
      });
    }

    // Update layout manager with actual screen size
    this.layoutManager.resize({
      width: this.screen.width as number,
      height: this.screen.height as number,
    });

    // Handle screen resize
    this.screen.on('resize', () => {
      if (this.screen !== null) {
        this.layoutManager.resize({
          width: this.screen.width as number,
          height: this.screen.height as number,
        });
        this.applyLayout();
      }
    });
  }

  /**
   * Create the status bar.
   */
  private createStatusBar(): void {
    if (this.screen === null) return;

    const boxOpts: blessed.Widgets.BoxOptions = {
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: THEME.ui.statusBar,
        fg: THEME.ui.text,
      },
      tags: true,
    };

    if (this.boxFactory !== null) {
      this.statusBar = this.boxFactory(boxOpts);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blessedModule = require('blessed') as typeof blessed;
      this.statusBar = blessedModule.box(boxOpts);
    }

    this.screen.append(this.statusBar);
    this.updateStatusBar();

    // Create help overlay (hidden by default)
    this.createHelpOverlay();
  }

  /**
   * Create the help overlay.
   */
  private createHelpOverlay(): void {
    if (this.screen === null) return;

    const helpContent = KEY_BINDINGS.map(
      (b) => `  ${b.key.padEnd(12)} ${b.description}`
    ).join('\n');

    const boxOpts: blessed.Widgets.BoxOptions = {
      top: 'center',
      left: 'center',
      width: 50,
      height: KEY_BINDINGS.length + 4,
      border: { type: 'line' },
      style: {
        border: { fg: THEME.ui.borderFocused },
        bg: THEME.ui.background,
        fg: THEME.ui.text,
      },
      label: ' Help (F1 to close) ',
      content: helpContent,
      hidden: true,
      tags: true,
    };

    if (this.boxFactory !== null) {
      this.helpOverlay = this.boxFactory(boxOpts);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const blessedModule = require('blessed') as typeof blessed;
      this.helpOverlay = blessedModule.box(boxOpts);
    }

    this.screen.append(this.helpOverlay);
  }

  /**
   * Update the status bar content.
   */
  private updateStatusBar(): void {
    if (this.statusBar === null) return;

    const time = this.context.clock.currentTime;
    const dateStr = formatWorldTime(time.year, time.month, time.day);
    const speedStr = `Speed: ${getSpeedDisplayName(this.state.speed)}`;

    const entityStr =
      this.state.selectedEntity !== null
        ? `Selected: ${this.state.selectedEntity.name} [${this.state.selectedEntity.type} #${this.state.selectedEntity.id}]`
        : 'No selection';

    const focusStr =
      this.state.focusLocation !== null
        ? `Focus: (${this.state.focusLocation.x}, ${this.state.focusLocation.y})`
        : '';

    const parts = [dateStr, speedStr, entityStr, focusStr].filter((s) => s.length > 0);
    this.statusBar.setContent(` ${parts.join('  |  ')} `);
  }

  /**
   * Set up keyboard bindings.
   */
  private setupKeyBindings(): void {
    if (this.screen === null) return;

    // Quit
    this.screen.key(['q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });

    // Tab: cycle focus
    this.screen.key('tab', () => this.cycleFocus());

    // Number keys: switch to panel
    for (let i = 1; i <= 7; i++) {
      this.screen.key(String(i), () => {
        const panelId = PANEL_INDEX[i - 1];
        if (panelId !== undefined) {
          this.focusPanel(panelId);
        }
      });
    }

    // Space: toggle pause
    this.screen.key('space', () => this.togglePause());

    // +/-: speed control
    this.screen.key(['+', '='], () => this.speedUp());
    this.screen.key(['-', '_'], () => this.speedDown());

    // Escape: back/deselect
    this.screen.key('escape', () => this.handleEscape());

    // F1: help
    this.screen.key('f1', () => this.toggleHelp());

    // M: maximize
    this.screen.key('m', () => this.maximizeCurrentPanel());

    // L: cycle layout
    this.screen.key('l', () => this.cycleLayout());

    // Arrow keys and WASD for map panning (delegated to focused panel)
    this.screen.key(['up', 'down', 'left', 'right', 'w', 'a', 's', 'd'], (ch, key) => {
      const panel = this.panels.get(this.state.focusedPanel);
      if (panel !== undefined) {
        panel.handleInput(key.name ?? ch ?? '');
      }
    });

    // Enter: inspect (delegated to focused panel)
    this.screen.key('enter', () => {
      const panel = this.panels.get(this.state.focusedPanel);
      if (panel !== undefined) {
        panel.handleInput('enter');
      }
    });
  }

  /**
   * Subscribe to simulation events.
   */
  private subscribeToEvents(): void {
    this.eventSubscription = this.context.eventBus.onAny((event) => {
      if (this.config.batchEvents) {
        this.pendingEvents.push(event);
      }
    });
  }

  /**
   * Start the render loop.
   */
  private startRenderLoop(): void {
    const interval = Math.floor(1000 / this.config.targetFps);
    this.renderInterval = setInterval(() => {
      this.render();
    }, interval);
  }

  /**
   * Process batched events.
   */
  private processPendingEvents(): void {
    // For now, just clear the queue
    // Panels can access events through the eventLog
    this.pendingEvents = [];
  }

  /**
   * Apply the current layout to all panels.
   */
  private applyLayout(): void {
    const layout = this.layoutManager.getCurrentLayout();

    for (const [id, panelLayout] of layout.panels) {
      const panel = this.panels.get(id);
      if (panel !== undefined) {
        panel.moveTo(panelLayout.x, panelLayout.y);
        panel.resize(panelLayout.width, panelLayout.height);
      }
    }

    if (this.screen !== null) {
      this.screen.render();
    }
  }
}

/**
 * Format status bar text with consistent spacing.
 */
export function formatStatusBarText(
  dateStr: string,
  speedStr: string,
  entityStr: string,
  focusStr: string
): string {
  const parts = [dateStr, speedStr, entityStr, focusStr].filter((s) => s.length > 0);
  return ` ${parts.join('  |  ')} `;
}

/**
 * Get the next speed in the progression.
 */
export function getNextSpeed(current: SimulationSpeed, direction: 'up' | 'down'): SimulationSpeed {
  const currentIndex = SPEED_ORDER.indexOf(current);

  if (direction === 'up' && currentIndex < SPEED_ORDER.length - 1) {
    return SPEED_ORDER[currentIndex + 1] ?? current;
  }

  if (direction === 'down' && currentIndex > 0) {
    return SPEED_ORDER[currentIndex - 1] ?? current;
  }

  return current;
}

/**
 * Get the panel ID for a number key (1-7).
 */
export function getPanelForKey(key: number): PanelId | undefined {
  if (key >= 1 && key <= 7) {
    return PANEL_INDEX[key - 1];
  }
  return undefined;
}
