/**
 * Main application class for the terminal UI.
 * Orchestrates the screen, panels, and input handling.
 */

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);

import type * as blessed from 'blessed';
import type { WorldEvent, Unsubscribe } from '@fws/core';
import type { RenderContext, AppState, SelectedEntity, KeyBinding, LayoutPreset } from './types.js';
import { PanelId, SimulationSpeed, getSpeedDisplayName, formatWorldTime } from './types.js';
import { LayoutManager } from './layout-manager.js';
import type { BasePanel } from './panel.js';
import { THEME } from './theme.js';
import { MenuBar } from './menu-bar.js';
import type { MenuBarItemProvider } from './menu-bar.js';

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
  { key: 'click', action: 'select', description: 'Click to focus panel / select' },
  { key: 'scroll', action: 'zoom/scroll', description: 'Mouse wheel to zoom or scroll' },
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
  private menuBar: MenuBar | null = null;
  private panels: Map<PanelId, BasePanel> = new Map();

  private state: AppState;
  private running = false;
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private eventSubscription: Unsubscribe | null = null;
  private pendingEvents: WorldEvent[] = [];
  private lastRenderTime = 0;
  private lastTickTime = 0;
  private simulationStarted = false;

  // Factory functions for blessed elements (injected for testability)
  private screenFactory: (() => blessed.Widgets.Screen) | null = null;
  private boxFactory: ((opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement) | null = null;

  constructor(context: RenderContext, config: Partial<AppConfig> = {}) {
    this.context = context;
    this.config = { ...DEFAULT_APP_CONFIG, ...config };

    // Initialize with default screen size (will be updated on start)
    this.layoutManager = new LayoutManager({ width: 120, height: 40 });

    this.state = {
      speed: SimulationSpeed.Paused,
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
   * Note: Simulation does NOT start until player presses Space.
   * Call renderInitialFrame() after registering panels to show the initial state.
   * The render loop starts AFTER renderInitialFrame() to ensure the first frame
   * is fully painted before the loop begins.
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.simulationStarted = false;
    this.createScreen();
    this.createMenuBar();
    this.createStatusBar();
    this.setupKeyBindings();
    this.setupMouseHandling();
    this.subscribeToEvents();
    // Apply layout to update all registered panels with actual screen dimensions
    this.applyLayout();
    // NOTE: Render loop is NOT started here - it starts in renderInitialFrame()
    // NOTE: Simulation loop is NOT started here - it starts when player presses Space
  }

  /**
   * Force render all panels and the screen synchronously.
   * Call this after all panels are registered and have their initial data set.
   * This also starts the render loop after the initial frame is painted.
   */
  renderInitialFrame(): void {
    // Re-apply layout to guarantee every panel's dimensions (and viewport for
    // MapPanel) match the actual screen size.  This eliminates the race
    // condition where panels were constructed with dimensions from a separate
    // LayoutManager in the CLI — the Application's LayoutManager now has the
    // real screen size (set in createScreen()) and applyLayout() propagates it
    // to each panel via resize(), which MapPanel overrides to sync its viewport.
    this.applyLayout();

    // Render each registered panel with its initial content
    for (const [id, panel] of this.panels) {
      const layout = this.layoutManager.getCurrentLayout().panels.get(id);
      if (layout !== undefined && layout.width > 0 && layout.height > 0) {
        panel.render(this.context);
      }
    }

    // Force screen render - paint the complete initial frame
    if (this.screen !== null) {
      this.screen.render();
    }

    // NOW start the render loop, after the initial frame is fully painted
    this.startRenderLoop();
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

    if (this.simulationInterval !== null) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.eventSubscription !== null) {
      this.eventSubscription();
      this.eventSubscription = null;
    }

    if (this.menuBar !== null) {
      this.menuBar.destroy();
      this.menuBar = null;
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
    this.menuBar?.updateForPanel(panelId);
  }

  /**
   * Toggle simulation pause/play.
   * On first press, starts the simulation loop.
   */
  togglePause(): void {
    if (this.state.speed === SimulationSpeed.Paused) {
      this.state = { ...this.state, speed: SimulationSpeed.Normal };

      // Start simulation loop on first unpause
      if (!this.simulationStarted) {
        this.simulationStarted = true;
        this.startSimulationLoop();
      }
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
    this.applyLayout(true);
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
      this.applyLayout(true);
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
      this.applyLayout(true);
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

    // Render each visible panel (skip panels with 0 dimensions)
    for (const [id, panel] of this.panels) {
      const layout = this.layoutManager.getCurrentLayout().panels.get(id);
      if (layout !== undefined && layout.width > 0 && layout.height > 0) {
        panel.render(this.context);
      }
    }

    if (this.screen !== null) {
      this.screen.render();
    }
  }

  /**
   * Create the blessed screen.
   */
  private createScreen(): void {
    // Fix blessed's broken hex-to-256 color matching BEFORE creating the
    // screen so all widgets use the improved algorithm from the start.
    // Safe to call multiple times (patches a module-level function).
    patchBlessedColorMatching();

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
        mouse: true,
      });
    }

    // Detect terminal size from multiple sources.
    // On MINGW64/Windows, blessed screen.width can return 1, and
    // process.stdout.columns can be undefined (mintty PTY).
    // Values ≤ 1 are treated as invalid.
    const { cols, rows } = getTerminalDimensions(this.screen);

    // Force blessed's internal program dimensions to match the real terminal.
    // Without this, blessed's rendering buffer may be undersized (e.g. 1x1 on
    // MINGW64), causing content to render at wrong offsets even if our
    // LayoutManager has the correct dimensions.
    syncBlessedDimensions(this.screen, cols, rows);

    this.layoutManager.resize({ width: cols, height: rows });

    // Handle screen resize — listen on both blessed screen and stdout
    const handleResize = () => {
      if (this.screen !== null) {
        const dims = getTerminalDimensions(this.screen);
        syncBlessedDimensions(this.screen, dims.cols, dims.rows);
        this.layoutManager.resize({ width: dims.cols, height: dims.rows });
        this.applyLayout(true);
      }
    };
    this.screen.on('resize', handleResize);
    process.stdout.on('resize', handleResize);
  }

  /**
   * Create the top menu bar.
   */
  private createMenuBar(): void {
    if (this.screen === null) return;

    const itemProvider: MenuBarItemProvider = (_panelId: PanelId) => {
      return [
        { label: 'Map', key: '1', action: () => this.focusPanel(PanelId.Map) },
        { label: 'Events', key: '2', action: () => this.focusPanel(PanelId.EventLog) },
        { label: 'Inspector', key: '3', action: () => this.focusPanel(PanelId.Inspector) },
        { label: 'Relations', key: '4', action: () => this.focusPanel(PanelId.RelationshipGraph) },
        { label: 'Timeline', key: '5', action: () => this.focusPanel(PanelId.Timeline) },
        { label: 'Stats', key: '6', action: () => this.focusPanel(PanelId.Statistics) },
        { label: 'Fingerprint', key: '7', action: () => this.focusPanel(PanelId.Fingerprint) },
      ];
    };

    this.menuBar = new MenuBar(this.screen, this.boxFactory, itemProvider);
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

    // Show startup message if simulation hasn't started yet
    if (!this.simulationStarted) {
      const time = this.context.clock.currentTime;
      const dateStr = formatWorldTime(time.year, time.month, time.day);
      this.statusBar.setContent(` ${dateStr}  |  Speed: Paused  |  Press Space to begin  |  F1: Help  |  Q: Quit `);
      return;
    }

    const time = this.context.clock.currentTime;
    const dateStr = formatWorldTime(time.year, time.month, time.day);
    const speedStr = `Speed: ${getSpeedDisplayName(this.state.speed)}`;

    // Context-sensitive hints for the focused panel
    const hints = getContextHints(this.state.focusedPanel);

    const parts = [dateStr, speedStr, hints].filter((s) => s.length > 0);
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

    // Number keys: switch to panel (context-aware for Inspector section toggles)
    for (let i = 1; i <= 7; i++) {
      this.screen.key(String(i), () => {
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

    // Catch-all: delegate all other keys to the focused panel.
    // Global keys are handled above via screen.key(); everything else
    // goes to the currently focused panel's handleInput().
    this.screen.on('keypress', (ch: string | undefined, key: { name?: string; full?: string; ctrl?: boolean; shift?: boolean } | undefined) => {
      const globalKeys = new Set([
        'q', 'tab', 'space', 'escape', 'f1', 'm', 'l',
        '1', '2', '3', '4', '5', '6', '7',
        '+', '=', '-', '_',
        'f', 'b',
      ]);
      const keyName = key?.name ?? ch ?? '';
      const keyFull = key?.full ?? '';

      if (globalKeys.has(keyName) || globalKeys.has(keyFull)) return;
      if (key?.ctrl === true) return;
      if (keyName === '' && (ch === undefined || ch === '')) return;

      const panel = this.panels.get(this.state.focusedPanel);
      if (panel !== undefined) {
        const inputKey = keyName !== '' ? keyName : (ch ?? '');
        panel.handleInput(inputKey);
      }
    });
  }

  /**
   * Set up mouse click and wheel handlers.
   */
  private setupMouseHandling(): void {
    if (this.screen === null) return;

    // Cast screen to EventEmitter for mouse events not in blessed typings
    const emitter = this.screen as unknown as {
      on(event: string, handler: (...args: unknown[]) => void): void;
    };

    emitter.on('click', (...args: unknown[]) => {
      const mouse = args[1] as { x: number; y: number } | undefined;
      if (mouse === undefined) return;

      // Menu bar click (y=0)
      if (mouse.y === 0 && this.menuBar !== null) {
        this.menuBar.handleClick(mouse.x);
        return;
      }

      const layout = this.layoutManager.getCurrentLayout();

      for (const [id, panel] of this.panels) {
        const panelLayout = layout.panels.get(id);
        if (panelLayout === undefined || panelLayout.width === 0 || panelLayout.height === 0) continue;

        if (
          mouse.x >= panelLayout.x && mouse.x < panelLayout.x + panelLayout.width &&
          mouse.y >= panelLayout.y && mouse.y < panelLayout.y + panelLayout.height
        ) {
          if (this.state.focusedPanel !== id) {
            this.focusPanel(id);
          }

          const relX = mouse.x - panelLayout.x - 1;
          const relY = mouse.y - panelLayout.y - 1;

          if (relX >= 0 && relY >= 0) {
            panel.handleClick(relX, relY);
          }
          break;
        }
      }
    });

    emitter.on('wheelup', () => {
      const panel = this.panels.get(this.state.focusedPanel);
      if (panel !== undefined) {
        panel.handleInput('wheelup');
      }
    });

    emitter.on('wheeldown', () => {
      const panel = this.panels.get(this.state.focusedPanel);
      if (panel !== undefined) {
        panel.handleInput('wheeldown');
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
   * Start the simulation tick loop.
   * Ticks the engine based on current speed setting.
   */
  private startSimulationLoop(): void {
    // Base tick interval: 100ms = 10 ticks/second at Normal speed
    const baseInterval = 100;
    this.simulationInterval = setInterval(() => {
      if (this.context.engine === undefined) return;
      if (this.state.speed === SimulationSpeed.Paused) return;

      const now = Date.now();
      const elapsed = now - this.lastTickTime;

      // Calculate how many ticks to run based on speed
      // At Normal (1x), run 1 tick per interval
      // At Fast7 (7x), run 7 ticks per interval
      let ticksToRun = 0;
      if (this.state.speed === SimulationSpeed.SlowMotion) {
        // Slow motion: tick every 200ms
        if (elapsed >= 200) {
          ticksToRun = 1;
        }
      } else {
        // Normal and fast speeds: tick based on multiplier
        ticksToRun = Math.floor(this.state.speed);
      }

      if (ticksToRun > 0) {
        this.context.engine.run(ticksToRun);
        this.lastTickTime = now;
        this.updateStatusBar();
      }
    }, baseInterval);
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
   * @param forceRender - If true, re-render all panel content at new dimensions before painting.
   */
  private applyLayout(forceRender = false): void {
    const layout = this.layoutManager.getCurrentLayout();

    for (const [id, panelLayout] of layout.panels) {
      const panel = this.panels.get(id);
      if (panel !== undefined) {
        panel.moveTo(panelLayout.x, panelLayout.y);
        panel.resize(panelLayout.width, panelLayout.height);
      }
    }

    if (forceRender) {
      for (const [id, panel] of this.panels) {
        const pl = layout.panels.get(id);
        if (pl !== undefined && pl.width > 0 && pl.height > 0) {
          panel.render(this.context);
        }
      }
    }

    if (this.screen !== null) {
      this.screen.render();
    }
  }
}

/**
 * Detect terminal dimensions from multiple sources.
 * On MINGW64/Windows, blessed screen.width can return 1 and
 * process.stdout.columns can be undefined (mintty PTY doesn't
 * register as a Windows console handle, so Node's TTY layer
 * can't read dimensions). We try multiple sources and reject
 * any value ≤ 1 as invalid.
 */
function getTerminalDimensions(screen: blessed.Widgets.Screen): { cols: number; rows: number } {
  const DEFAULT_COLS = 120;
  const DEFAULT_ROWS = 40;

  // Helper: accept a value only if it's a number > 1
  const valid = (v: number | undefined): number | undefined =>
    typeof v === 'number' && v > 1 ? v : undefined;

  // Source 1: process.stdout (works in ConPTY / real TTYs)
  // Source 2: blessed screen dimensions (getters for program.cols/rows)
  // Source 3: shell command fallback (works in mintty / MSYS2 where
  //           process.stdout isn't recognized as a TTY by Node)
  // Source 4: hardcoded defaults

  const cols =
    valid(process.stdout.columns) ??
    valid(screen.width as number) ??
    valid(queryTerminalSize('cols')) ??
    DEFAULT_COLS;

  const rows =
    valid(process.stdout.rows) ??
    valid(screen.height as number) ??
    valid(queryTerminalSize('rows')) ??
    DEFAULT_ROWS;

  return { cols, rows };
}

/** Cache for shell-queried terminal dimensions (avoid repeated exec calls). */
let cachedShellDims: { cols: number; rows: number; timestamp: number } | undefined;

/**
 * Query terminal dimensions via shell commands.
 *
 * On MINGW64/Windows, process.stdout.columns is undefined because the
 * MSYS2 PTY doesn't register as a Windows console to Node.js. We try:
 *
 * 1. `mode con` — Windows command that reports console columns.
 *    Lines value is the scroll buffer (not visible rows), so we only
 *    use it for columns.
 *
 * 2. PowerShell `$Host.UI.RawUI.WindowSize` — returns actual visible
 *    window dimensions. Requires inheriting stdin (fd 0) so PowerShell
 *    can access the console handle. ~300ms startup cost.
 *
 * 3. `tput cols`/`tput lines` — Unix fallback. On MINGW64 with piped
 *    stdio, tput returns defaults (80×24) not actual size, so this is
 *    last resort.
 */
function queryTerminalSize(dimension: 'cols' | 'rows'): number | undefined {
  // Return cached value if fresh (< 2 seconds old)
  if (cachedShellDims !== undefined && Date.now() - cachedShellDims.timestamp < 2000) {
    return dimension === 'cols' ? cachedShellDims.cols : cachedShellDims.rows;
  }

  const valid = (v: number): boolean => !isNaN(v) && v > 1;

  // Strategy 1: PowerShell — most reliable on Windows, gets both dims
  if (process.platform === 'win32' || process.env['MSYSTEM'] !== undefined || process.env['TERM_PROGRAM'] === 'mintty') {
    try {
      const psCmd = 'powershell.exe -NoProfile -NonInteractive -Command "$s=$Host.UI.RawUI.WindowSize;Write-Host $s.Width $s.Height"';
      const result = execSync(psCmd, { encoding: 'utf8', timeout: 2000, stdio: [0, 'pipe', 'pipe'] }).trim();
      const parts = result.split(/\s+/);
      if (parts.length >= 2) {
        const c = parseInt(parts[0] ?? '', 10);
        const r = parseInt(parts[1] ?? '', 10);
        if (valid(c) && valid(r)) {
          cachedShellDims = { cols: c, rows: r, timestamp: Date.now() };
          return dimension === 'cols' ? c : r;
        }
      }
    } catch {
      // PowerShell not available or timed out
    }

    // Strategy 2: `mode con` for columns only (lines is scroll buffer)
    try {
      const modeResult = execSync('mode con', { encoding: 'utf8', timeout: 500, stdio: ['pipe', 'pipe', 'pipe'] });
      const colMatch = modeResult.match(/(?:Columns|Spalten)[:\s]+?(\d+)/i);
      if (colMatch !== null) {
        const c = parseInt(colMatch[1] ?? '', 10);
        if (valid(c)) {
          // Use mode con columns + reasonable default rows
          cachedShellDims = { cols: c, rows: cachedShellDims?.rows ?? 40, timestamp: Date.now() };
          return dimension === 'cols' ? c : cachedShellDims.rows;
        }
      }
    } catch {
      // mode con not available
    }
  }

  // Strategy 3: tput (Unix / MSYS2 last resort — may return defaults)
  try {
    const colsStr = execSync('tput cols', { encoding: 'utf8', timeout: 500, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const rowsStr = execSync('tput lines', { encoding: 'utf8', timeout: 500, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const c = parseInt(colsStr, 10);
    const r = parseInt(rowsStr, 10);
    if (valid(c) && valid(r)) {
      cachedShellDims = { cols: c, rows: r, timestamp: Date.now() };
      return dimension === 'cols' ? c : r;
    }
  } catch {
    // tput not available or timed out
  }

  return undefined;
}

/**
 * Force blessed's internal program dimensions and screen buffer to match
 * the actual terminal size. Without this, blessed may have a mismatched
 * rendering buffer (e.g. 1x1 on MINGW64) causing content to render at
 * wrong positions even when our LayoutManager has correct dimensions.
 *
 * blessed's Program initializes cols/rows as `output.columns || 1`.
 * On MINGW64/mintty, output.columns is undefined → cols = 1, rows = 1.
 * screen.width/height are getters that delegate to program.cols/rows.
 * screen.alloc() creates the 2D rendering buffer (lines/olines) sized
 * to rows × cols — so a 1×1 buffer means only 1 character renders.
 * realloc() calls alloc(dirty=true) to force a full repaint.
 */
function syncBlessedDimensions(screen: blessed.Widgets.Screen, cols: number, rows: number): void {
  const program = screen.program as { cols?: number; rows?: number } | undefined;
  if (program !== undefined) {
    program.cols = cols;
    program.rows = rows;
  }

  // Rebuild the 2D rendering buffer at the correct size, marking all
  // lines dirty so the next screen.render() repaints everything.
  if (typeof (screen as unknown as { realloc?: () => void }).realloc === 'function') {
    (screen as unknown as { realloc: () => void }).realloc();
  } else if (typeof (screen as unknown as { alloc?: () => void }).alloc === 'function') {
    (screen as unknown as { alloc: () => void }).alloc();
  }
}

/**
 * Fix blessed's broken hex-to-256 color matching.
 *
 * blessed 0.1.81 uses a luma-weighted Euclidean distance formula that maps
 * dark saturated colors (e.g. forest green `#2a5a2a`) to GREYSCALE palette
 * entries instead of the colored 6×6×6 cube. This makes terrain maps appear
 * entirely grey.
 *
 * Root cause: the distance weights (30, 59, 11 — luma coefficients) make
 * dark greens "closer" to greys than to the nearest green in the 256-color
 * cube. For example `#2a5a2a` maps to index 239 (grey 78,78,78) instead of
 * index 22 (green 0,95,0).
 *
 * Fix: Replace `colors.match()` with an algorithm that:
 * 1. Searches the full 6×6×6 cube (16-231) using unweighted Euclidean distance
 * 2. Separately tracks the best COLORED (non-grey) cube entry
 * 3. For saturated inputs (saturation > 10%), prefers the colored entry unless
 *    it's > 4× the distance of the best grey match
 * 4. Falls back to the standard greyscale ramp (232-255) for near-grey inputs
 */
function patchBlessedColorMatching(): void {
  let blessedModule: { colors: BlessedColors };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    blessedModule = require('blessed') as { colors: BlessedColors };
  } catch {
    // blessed not available (e.g. test environment) — skip patching
    return;
  }
  const colors = blessedModule.colors;

  const cache: Record<number, number> = {};

  colors.match = function patchedMatch(
    r1: number | string | number[],
    g1?: number,
    b1?: number
  ): number {
    if (typeof r1 === 'string') {
      if (r1[0] !== '#') return -1;
      const rgb = colors.hexToRGB(r1);
      r1 = rgb[0] ?? 0; g1 = rgb[1] ?? 0; b1 = rgb[2] ?? 0;
    } else if (Array.isArray(r1)) {
      b1 = r1[2] ?? 0; g1 = r1[1] ?? 0; r1 = r1[0] ?? 0;
    }

    const rr = r1 as number;
    const gg = (g1 ?? 0) as number;
    const bb = (b1 ?? 0) as number;

    const hash = (rr << 16) | (gg << 8) | bb;
    const cached = cache[hash];
    if (cached !== undefined) return cached;

    const maxCh = Math.max(rr, gg, bb);
    const minCh = Math.min(rr, gg, bb);
    const saturation = maxCh > 0 ? (maxCh - minCh) / maxCh : 0;

    // Distance from input color to a palette entry
    const distTo = (idx: number): number => {
      const c = colors.vcolors[idx];
      if (c === undefined) return Infinity;
      const cr = c[0] ?? 0;
      const cg = c[1] ?? 0;
      const cb = c[2] ?? 0;
      return (rr - cr) * (rr - cr) + (gg - cg) * (gg - cg) + (bb - cb) * (bb - cb);
    };

    // Search the 6×6×6 cube (indices 16-231)
    let cubeBestIdx = 16;
    let cubeBestDist = Infinity;
    let cubeColoredIdx = -1;
    let cubeColoredDist = Infinity;

    for (let i = 16; i <= 231; i++) {
      const d = distTo(i);
      if (d < cubeBestDist) { cubeBestDist = d; cubeBestIdx = i; }

      // Track best entry that isn't on the grey diagonal (r==g==b)
      const ci = i - 16;
      const cr = Math.floor(ci / 36);
      const cg = Math.floor((ci % 36) / 6);
      const cb = ci % 6;
      if (!(cr === cg && cg === cb)) {
        if (d < cubeColoredDist) { cubeColoredDist = d; cubeColoredIdx = i; }
      }
    }

    // Search greyscale ramp (indices 232-255)
    let greyBestIdx = 232;
    let greyBestDist = Infinity;
    for (let i = 232; i <= 255; i++) {
      const d = distTo(i);
      if (d < greyBestDist) { greyBestDist = d; greyBestIdx = i; }
    }

    // Search first 16 ANSI colors
    let baseBestIdx = 0;
    let baseBestDist = Infinity;
    for (let i = 0; i < 16; i++) {
      const d = distTo(i);
      if (d < baseBestDist) { baseBestDist = d; baseBestIdx = i; }
    }

    let result: number;

    if (saturation > 0.1 && cubeColoredIdx !== -1) {
      // Input has meaningful color — prefer a colored palette entry.
      // Only fall back to grey if the colored entry is > 4× the distance.
      const greyMin = Math.min(greyBestDist, cubeBestDist);
      if (cubeColoredDist < greyMin * 4) {
        result = cubeColoredDist <= baseBestDist ? cubeColoredIdx : baseBestIdx;
      } else {
        result = cubeBestIdx;
        if (greyBestDist < cubeBestDist) result = greyBestIdx;
        if (baseBestDist < Math.min(cubeBestDist, greyBestDist)) result = baseBestIdx;
      }
    } else {
      // Near-grey input: pick the closest entry overall
      result = cubeBestIdx;
      if (greyBestDist < cubeBestDist) result = greyBestIdx;
      if (baseBestDist < Math.min(cubeBestDist, greyBestDist)) result = baseBestIdx;
    }

    cache[hash] = result;
    return result;
  };
}

/** Minimal typing for blessed's colors module. */
interface BlessedColors {
  match: (r1: number | string | number[], g1?: number, b1?: number) => number;
  hexToRGB: (hex: string) => number[];
  vcolors: number[][];
}

/**
 * Get context-sensitive keyboard hints for the currently focused panel.
 */
export function getContextHints(panelId: PanelId): string {
  switch (panelId) {
    case PanelId.Map:
      return '[WASD] Pan  [Z/X] Zoom  [Enter] Inspect';
    case PanelId.EventLog:
      return '[j/k] Browse  [t] Tone  [h] Chronicler  [/] Search';
    case PanelId.Inspector:
      return '[1-9] Sections  [o/r/t/d] Mode  [Bksp] Back';
    case PanelId.RelationshipGraph:
      return '[1-3] Depth  [Tab] Filter  [Enter] Inspect';
    case PanelId.Timeline:
      return '[Z/X] Zoom  [</>] Scroll  [c] Category';
    case PanelId.Statistics:
      return '[1-5] View  [j/k] Scroll';
    case PanelId.Fingerprint:
      return '[R] Refresh  [Space] Pause/Play';
    default:
      return '';
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
