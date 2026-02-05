/**
 * Layout manager for panel arrangement and resizing.
 * Handles layout presets and panel visibility toggling.
 */

import { PanelId } from './types.js';
import type { PanelLayout, LayoutPreset } from './types.js';

/**
 * Screen dimensions.
 */
export interface ScreenDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Layout configuration for all panels.
 */
export interface LayoutConfiguration {
  readonly panels: Map<PanelId, PanelLayout>;
  readonly statusBarHeight: number;
}

/**
 * Default status bar height.
 */
const STATUS_BAR_HEIGHT = 1;

/**
 * Calculate the default layout.
 * Left 60%: Map panel
 * Right top 50%: Event log
 * Right bottom 50%: Inspector
 * Bottom strip: Status bar
 */
export function calculateDefaultLayout(screen: ScreenDimensions): LayoutConfiguration {
  const panels = new Map<PanelId, PanelLayout>();

  const usableHeight = screen.height - STATUS_BAR_HEIGHT;
  const leftWidth = Math.floor(screen.width * 0.6);
  const rightWidth = screen.width - leftWidth;
  const rightTopHeight = Math.floor(usableHeight * 0.5);
  const rightBottomHeight = usableHeight - rightTopHeight;

  panels.set(PanelId.Map, {
    id: PanelId.Map,
    x: 0,
    y: 0,
    width: leftWidth,
    height: usableHeight,
    focused: true,
  });

  panels.set(PanelId.EventLog, {
    id: PanelId.EventLog,
    x: leftWidth,
    y: 0,
    width: rightWidth,
    height: rightTopHeight,
    focused: false,
  });

  panels.set(PanelId.Inspector, {
    id: PanelId.Inspector,
    x: leftWidth,
    y: rightTopHeight,
    width: rightWidth,
    height: rightBottomHeight,
    focused: false,
  });

  // Hidden panels (not visible in default layout)
  panels.set(PanelId.RelationshipGraph, {
    id: PanelId.RelationshipGraph,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Timeline, {
    id: PanelId.Timeline,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Statistics, {
    id: PanelId.Statistics,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Fingerprint, {
    id: PanelId.Fingerprint,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  return {
    panels,
    statusBarHeight: STATUS_BAR_HEIGHT,
  };
}

/**
 * Calculate the map-focus layout.
 * Map 85%, small event log strip at bottom.
 */
export function calculateMapFocusLayout(screen: ScreenDimensions): LayoutConfiguration {
  const panels = new Map<PanelId, PanelLayout>();

  const usableHeight = screen.height - STATUS_BAR_HEIGHT;
  const mapHeight = Math.floor(usableHeight * 0.85);
  const logHeight = usableHeight - mapHeight;

  panels.set(PanelId.Map, {
    id: PanelId.Map,
    x: 0,
    y: 0,
    width: screen.width,
    height: mapHeight,
    focused: true,
  });

  panels.set(PanelId.EventLog, {
    id: PanelId.EventLog,
    x: 0,
    y: mapHeight,
    width: screen.width,
    height: logHeight,
    focused: false,
  });

  // Hidden panels
  panels.set(PanelId.Inspector, {
    id: PanelId.Inspector,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.RelationshipGraph, {
    id: PanelId.RelationshipGraph,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Timeline, {
    id: PanelId.Timeline,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Statistics, {
    id: PanelId.Statistics,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Fingerprint, {
    id: PanelId.Fingerprint,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  return {
    panels,
    statusBarHeight: STATUS_BAR_HEIGHT,
  };
}

/**
 * Calculate the log-focus layout.
 * Event log 60%, map 40%.
 */
export function calculateLogFocusLayout(screen: ScreenDimensions): LayoutConfiguration {
  const panels = new Map<PanelId, PanelLayout>();

  const usableHeight = screen.height - STATUS_BAR_HEIGHT;
  const logWidth = Math.floor(screen.width * 0.6);
  const mapWidth = screen.width - logWidth;

  panels.set(PanelId.EventLog, {
    id: PanelId.EventLog,
    x: 0,
    y: 0,
    width: logWidth,
    height: usableHeight,
    focused: true,
  });

  panels.set(PanelId.Map, {
    id: PanelId.Map,
    x: logWidth,
    y: 0,
    width: mapWidth,
    height: usableHeight,
    focused: false,
  });

  // Hidden panels
  panels.set(PanelId.Inspector, {
    id: PanelId.Inspector,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.RelationshipGraph, {
    id: PanelId.RelationshipGraph,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Timeline, {
    id: PanelId.Timeline,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Statistics, {
    id: PanelId.Statistics,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Fingerprint, {
    id: PanelId.Fingerprint,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  return {
    panels,
    statusBarHeight: STATUS_BAR_HEIGHT,
  };
}

/**
 * Calculate the split layout.
 * Map top 50%, log bottom 50%.
 */
export function calculateSplitLayout(screen: ScreenDimensions): LayoutConfiguration {
  const panels = new Map<PanelId, PanelLayout>();

  const usableHeight = screen.height - STATUS_BAR_HEIGHT;
  const topHeight = Math.floor(usableHeight * 0.5);
  const bottomHeight = usableHeight - topHeight;

  panels.set(PanelId.Map, {
    id: PanelId.Map,
    x: 0,
    y: 0,
    width: screen.width,
    height: topHeight,
    focused: true,
  });

  panels.set(PanelId.EventLog, {
    id: PanelId.EventLog,
    x: 0,
    y: topHeight,
    width: screen.width,
    height: bottomHeight,
    focused: false,
  });

  // Hidden panels
  panels.set(PanelId.Inspector, {
    id: PanelId.Inspector,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.RelationshipGraph, {
    id: PanelId.RelationshipGraph,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Timeline, {
    id: PanelId.Timeline,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Statistics, {
    id: PanelId.Statistics,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  panels.set(PanelId.Fingerprint, {
    id: PanelId.Fingerprint,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    focused: false,
  });

  return {
    panels,
    statusBarHeight: STATUS_BAR_HEIGHT,
  };
}

/**
 * Calculate a maximized layout where one panel fills the screen.
 */
export function calculateMaximizedLayout(
  screen: ScreenDimensions,
  maximizedPanel: PanelId
): LayoutConfiguration {
  const panels = new Map<PanelId, PanelLayout>();
  const usableHeight = screen.height - STATUS_BAR_HEIGHT;

  // All panels start hidden
  for (const id of Object.values(PanelId)) {
    panels.set(id, {
      id,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      focused: false,
    });
  }

  // Maximized panel takes full space
  panels.set(maximizedPanel, {
    id: maximizedPanel,
    x: 0,
    y: 0,
    width: screen.width,
    height: usableHeight,
    focused: true,
  });

  return {
    panels,
    statusBarHeight: STATUS_BAR_HEIGHT,
  };
}

/**
 * Get layout for a preset.
 */
export function getLayoutForPreset(
  preset: LayoutPreset,
  screen: ScreenDimensions
): LayoutConfiguration {
  switch (preset) {
    case 'default':
      return calculateDefaultLayout(screen);
    case 'map-focus':
      return calculateMapFocusLayout(screen);
    case 'log-focus':
      return calculateLogFocusLayout(screen);
    case 'split':
      return calculateSplitLayout(screen);
  }
}

/**
 * Layout manager class for managing panel layouts.
 */
export class LayoutManager {
  private screen: ScreenDimensions;
  private currentPreset: LayoutPreset = 'default';
  private currentLayout: LayoutConfiguration;
  private previousLayout: LayoutConfiguration | null = null;
  private maximizedPanel: PanelId | null = null;
  private hiddenPanels: Set<PanelId> = new Set();

  constructor(screen: ScreenDimensions) {
    this.screen = screen;
    this.currentLayout = calculateDefaultLayout(screen);
  }

  /**
   * Set the layout to a preset.
   */
  setLayout(preset: LayoutPreset): LayoutConfiguration {
    this.previousLayout = this.currentLayout;
    this.currentPreset = preset;
    this.maximizedPanel = null;
    this.currentLayout = getLayoutForPreset(preset, this.screen);
    return this.currentLayout;
  }

  /**
   * Toggle visibility of a specific panel.
   */
  togglePanel(panelId: PanelId): LayoutConfiguration {
    if (this.hiddenPanels.has(panelId)) {
      this.hiddenPanels.delete(panelId);
    } else {
      this.hiddenPanels.add(panelId);
    }

    // Recalculate layout with hidden panels
    this.currentLayout = this.applyHiddenPanels(
      getLayoutForPreset(this.currentPreset, this.screen)
    );
    return this.currentLayout;
  }

  /**
   * Maximize a single panel to fill the screen.
   */
  maximizePanel(panelId: PanelId): LayoutConfiguration {
    this.previousLayout = this.currentLayout;
    this.maximizedPanel = panelId;
    this.currentLayout = calculateMaximizedLayout(this.screen, panelId);
    return this.currentLayout;
  }

  /**
   * Restore the previous layout (after maximizing).
   */
  restoreLayout(): LayoutConfiguration {
    if (this.previousLayout !== null) {
      this.currentLayout = this.previousLayout;
      this.previousLayout = null;
      this.maximizedPanel = null;
    }
    return this.currentLayout;
  }

  /**
   * Get the current layout configuration.
   */
  getCurrentLayout(): LayoutConfiguration {
    return this.currentLayout;
  }

  /**
   * Get the current preset name.
   */
  getCurrentPreset(): LayoutPreset {
    return this.currentPreset;
  }

  /**
   * Check if a panel is currently maximized.
   */
  isMaximized(): boolean {
    return this.maximizedPanel !== null;
  }

  /**
   * Get the maximized panel ID, if any.
   */
  getMaximizedPanel(): PanelId | null {
    return this.maximizedPanel;
  }

  /**
   * Update screen dimensions and recalculate layout.
   */
  resize(newScreen: ScreenDimensions): LayoutConfiguration {
    this.screen = newScreen;

    if (this.maximizedPanel !== null) {
      this.currentLayout = calculateMaximizedLayout(this.screen, this.maximizedPanel);
    } else {
      this.currentLayout = this.applyHiddenPanels(
        getLayoutForPreset(this.currentPreset, this.screen)
      );
    }

    return this.currentLayout;
  }

  /**
   * Get visible panels (panels with non-zero dimensions).
   */
  getVisiblePanels(): PanelId[] {
    const visible: PanelId[] = [];
    for (const [id, layout] of this.currentLayout.panels) {
      if (layout.width > 0 && layout.height > 0) {
        visible.push(id);
      }
    }
    return visible;
  }

  /**
   * Get the layout for a specific panel.
   */
  getPanelLayout(panelId: PanelId): PanelLayout | undefined {
    return this.currentLayout.panels.get(panelId);
  }

  /**
   * Check if panels overlap (useful for validation).
   */
  hasOverlappingPanels(): boolean {
    const layouts = Array.from(this.currentLayout.panels.values())
      .filter(l => l.width > 0 && l.height > 0);

    for (let i = 0; i < layouts.length; i++) {
      for (let j = i + 1; j < layouts.length; j++) {
        const a = layouts[i];
        const b = layouts[j];
        if (a === undefined || b === undefined) continue;

        // Check for overlap
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;

        if (overlapX && overlapY) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Apply hidden panels to a layout configuration.
   */
  private applyHiddenPanels(layout: LayoutConfiguration): LayoutConfiguration {
    const newPanels = new Map<PanelId, PanelLayout>();

    for (const [id, panelLayout] of layout.panels) {
      if (this.hiddenPanels.has(id)) {
        newPanels.set(id, {
          ...panelLayout,
          width: 0,
          height: 0,
        });
      } else {
        newPanels.set(id, panelLayout);
      }
    }

    return {
      panels: newPanels,
      statusBarHeight: layout.statusBarHeight,
    };
  }
}
