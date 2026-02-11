/**
 * Renderer process entry point.
 *
 * Initializes PixiJS, connects IPC, wires map rendering + controls,
 * inspector, chronicle, layout presets, help overlay, notifications,
 * and maintains an FPS counter.
 */
import { initPixiApp } from './pixi-app.js';
import { createIpcClient } from './ipc-client.js';
import { TilemapRenderer } from './map/tilemap-renderer.js';
import { MapTooltip } from './map/map-tooltip.js';
import { TileDataProvider } from './map/tile-data-provider.js';
import { OverlayManager } from './map/overlay-manager.js';
import { bindMapInput } from './map/input-handler.js';
import { InspectorPanel } from './inspector/inspector-panel.js';
import { LayoutManager } from './layout-manager.js';
import { HelpOverlay } from './help-overlay.js';
import { NotificationManager } from './notification-toast.js';
import { initPanelDivider } from './panel-divider.js';
import { uiEvents } from './ui-events.js';
import { ChroniclePanel } from './chronicle/chronicle-panel.js';
import { LegendsPanel } from './legends/legends-panel.js';
import { initChargeAtlas } from './procgen/charge-atlas.js';
import { generateIconAtlas } from './procgen/icon-atlas.js';
import { WelcomeScreen } from './welcome-screen.js';
import { ContextMenu } from './context-menu.js';
import type { ContextMenuItem } from './context-menu.js';
import { FavoritesManager } from './favorites-manager.js';
import type { EntitySnapshot, EntityType, FactionSnapshot, InspectorQuery, TickDelta, WorldSnapshot, LegendsSummary } from '../shared/types.js';

// ── State ────────────────────────────────────────────────────────────────────

let totalTicks = 0;
let totalEntities = 0;
let totalEvents = 0;
let paused = true;
let speed = 1;

// FPS tracking
let frameCount = 0;
let lastFpsTime = performance.now();

// Entity type resolution for chronicle clicks
const entityTypeMap = new Map<number, InspectorQuery['type']>();

// Map
const tilemap = new TilemapRenderer();
const tooltip = new MapTooltip();
const tileDataProvider = new TileDataProvider();
const overlayManager = new OverlayManager();
const factionColorMap = new Map<number, string>();

// Favorites manager (shared across components)
const favoritesManager = new FavoritesManager();

// Chronicle
const chronicleContainer = document.getElementById('event-log-panel')!;
const chronicle = new ChroniclePanel(chronicleContainer, favoritesManager);

// Legends
const legendsContainer = document.getElementById('legends-container')!;
let legendsPanel: LegendsPanel | null = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const tickEl = document.getElementById('status-tick')!;
const entitiesEl = document.getElementById('status-entities')!;
const eventsEl = document.getElementById('status-events')!;
const fpsEl = document.getElementById('status-fps')!;
const dateEl = document.getElementById('date-display')!;
const btnPause = document.getElementById('btn-pause')!;
const btnSpeed1 = document.getElementById('btn-speed-1')!;
const btnSpeed7 = document.getElementById('btn-speed-7')!;
const btnSpeed30 = document.getElementById('btn-speed-30')!;
const btnSpeed365 = document.getElementById('btn-speed-365')!;
const overlayEl = document.getElementById('status-overlay');
const layoutEl = document.getElementById('status-layout');
const speedEl = document.getElementById('status-speed');

// Restore scale mode from localStorage
const savedScale = localStorage.getItem('aeternum-scale-mode');
if (savedScale === '2') {
  document.getElementById('app')?.classList.add('scale-2x');
}

// Colorblind mode state
type ColorblindMode = 'none' | 'deuteranopia' | 'protanopia' | 'achromatopsia';
const COLORBLIND_MODES: ColorblindMode[] = ['none', 'deuteranopia', 'protanopia', 'achromatopsia'];
let colorblindMode: ColorblindMode = 'none';

// Restore colorblind mode from localStorage
const savedColorblind = localStorage.getItem('aeternum-colorblind-mode') as ColorblindMode | null;
if (savedColorblind !== null && COLORBLIND_MODES.includes(savedColorblind)) {
  colorblindMode = savedColorblind;
  if (colorblindMode !== 'none') {
    document.documentElement.classList.add(`colorblind-${colorblindMode}`);
  }
}

// ── IPC ──────────────────────────────────────────────────────────────────────

const ipc = createIpcClient();

// ── Modules ──────────────────────────────────────────────────────────────────

const layoutManager = new LayoutManager();
const helpOverlay = new HelpOverlay();
const notifications = new NotificationManager();
const contextMenu = new ContextMenu();

function updateStatusBar(): void {
  tickEl.textContent = `Tick: ${totalTicks}`;
  entitiesEl.textContent = `Entities: ${totalEntities}`;
  eventsEl.textContent = `Events: ${totalEvents}`;
}

function updateSpeedButtons(): void {
  // Remove active class from all buttons
  btnPause.classList.remove('speed-btn--active');
  btnSpeed1.classList.remove('speed-btn--active');
  btnSpeed7.classList.remove('speed-btn--active');
  btnSpeed30.classList.remove('speed-btn--active');
  btnSpeed365.classList.remove('speed-btn--active');

  // Add active class to current button
  if (paused) {
    btnPause.classList.add('speed-btn--active');
  } else {
    switch (speed) {
      case 1:
        btnSpeed1.classList.add('speed-btn--active');
        break;
      case 7:
        btnSpeed7.classList.add('speed-btn--active');
        break;
      case 30:
        btnSpeed30.classList.add('speed-btn--active');
        break;
      case 365:
        btnSpeed365.classList.add('speed-btn--active');
        break;
    }
  }

  if (speedEl !== null) {
    speedEl.textContent = paused ? 'Speed: Paused' : `Speed: ${speed}×`;
  }
}

function updateOverlayStatus(): void {
  if (overlayEl !== null) {
    overlayEl.textContent = `Overlay: ${overlayManager.activeOverlay}`;
  }
}

function updateLayoutStatus(): void {
  if (layoutEl !== null) {
    const name = layoutManager.getCurrent();
    layoutEl.textContent = `Layout: ${name.charAt(0).toUpperCase() + name.slice(1)}`;
  }
}

// ── Entity type mapping ──────────────────────────────────────────────────────

function mapEntityTypeToInspectorType(type: EntityType): InspectorQuery['type'] | null {
  switch (type) {
    case 'village': case 'town': case 'city': case 'capital':
    case 'ruin': case 'temple': case 'academy': case 'settlement':
      return 'site';
    case 'army':
      return 'faction';
    case 'character':
      return 'character';
    default:
      return null;
  }
}

/**
 * Populate the entityTypeMap from entity and faction snapshots.
 * This allows the chronicle to resolve entity IDs to inspector types.
 */
function buildEntityTypeMap(
  entities: readonly EntitySnapshot[],
  factions: readonly FactionSnapshot[],
): void {
  for (const entity of entities) {
    const inspectorType = mapEntityTypeToInspectorType(entity.type);
    if (inspectorType !== null) {
      entityTypeMap.set(entity.id, inspectorType);
    }
  }
  for (const faction of factions) {
    entityTypeMap.set(faction.id, 'faction');
  }
}

/**
 * Resolve an entity ID to an inspector type.
 * Falls back to 'character' for unknown IDs (most event participants are characters).
 */
function resolveEntityType(id: number): InspectorQuery['type'] {
  return entityTypeMap.get(id) ?? 'character';
}

// ── Tick handling ─────────────────────────────────────────────────────────────

/**
 * Format month number as ordinal (1 → "1st", 2 → "2nd", etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function handleTickDelta(delta: TickDelta): void {
  totalTicks = delta.tick;
  totalEvents += delta.events.length;
  dateEl.textContent = `Year ${delta.time.year}, ${getOrdinalSuffix(delta.time.month)} Moon`;
  updateStatusBar();
  tilemap.handleTickDelta(delta);

  // Feed events to tile data provider
  if (delta.events.length > 0) {
    tileDataProvider.addEvents(delta.events, tilemap.getEntities());
  }

  // Feed events to chronicle panel
  if (delta.events.length > 0) {
    chronicle.addEvents(delta.events);
  }

  // Rebuild overlay caches when entities change
  if (delta.entityUpdates.length > 0 || delta.removedEntities.length > 0) {
    const currentEntities = tilemap.getEntities();
    overlayManager.buildTerritoryCache(currentEntities, factionColorMap);
    overlayManager.buildTradeRouteCache(currentEntities);
    tileDataProvider.updateEntities(currentEntities);
    chronicle.updateEntityNames(delta.entityUpdates);

    // Keep entity type map current for chronicle click resolution
    for (const entity of delta.entityUpdates) {
      const inspectorType = mapEntityTypeToInspectorType(entity.type);
      if (inspectorType !== null) {
        entityTypeMap.set(entity.id, inspectorType);
      }
    }
  }

  // Notify high-significance events
  for (const event of delta.events) {
    if (event.significance >= 80) {
      notifications.show(event.subtype.replace(/[._]/g, ' '), 'event');
    }
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────

/**
 * Set simulation speed and update button states
 */
function setSpeed(newSpeed: 'pause' | 1 | 7 | 30 | 365): void {
  if (newSpeed === 'pause') {
    paused = true;
    ipc.sendCommand({ type: 'pause' });
  } else {
    paused = false;
    speed = newSpeed;
    ipc.sendCommand({ type: 'resume' });
    ipc.sendCommand({ type: 'set-speed', ticksPerSecond: newSpeed });
  }
  updateSpeedButtons();
}

btnPause.addEventListener('click', () => {
  setSpeed('pause');
});

btnSpeed1.addEventListener('click', () => {
  setSpeed(1);
});

btnSpeed7.addEventListener('click', () => {
  setSpeed(7);
});

btnSpeed30.addEventListener('click', () => {
  setSpeed(30);
});

btnSpeed365.addEventListener('click', () => {
  setSpeed(365);
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // Don't intercept when typing in inputs
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

  // Scale mode toggle (Ctrl+= / Ctrl+-)
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    document.getElementById('app')?.classList.add('scale-2x');
    localStorage.setItem('aeternum-scale-mode', '2');
    window.dispatchEvent(new Event('resize'));
    return;
  }
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault();
    document.getElementById('app')?.classList.remove('scale-2x');
    localStorage.setItem('aeternum-scale-mode', '1');
    window.dispatchEvent(new Event('resize'));
    return;
  }

  // Colorblind mode toggle (Ctrl+B)
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault();
    if (colorblindMode !== 'none') {
      document.documentElement.classList.remove(`colorblind-${colorblindMode}`);
    }
    const currentIndex = COLORBLIND_MODES.indexOf(colorblindMode);
    colorblindMode = COLORBLIND_MODES[(currentIndex + 1) % COLORBLIND_MODES.length]!;
    if (colorblindMode !== 'none') {
      document.documentElement.classList.add(`colorblind-${colorblindMode}`);
    }
    localStorage.setItem('aeternum-colorblind-mode', colorblindMode);
    notifications.show(`Color mode: ${colorblindMode === 'none' ? 'Default' : colorblindMode.charAt(0).toUpperCase() + colorblindMode.slice(1)}`, 'info');
    return;
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (paused) {
        // Resume at last known speed (default to 1 if paused from start)
        setSpeed(speed === 1 || speed === 7 || speed === 30 || speed === 365 ? speed : 1);
      } else {
        setSpeed('pause');
      }
      break;

    case 'KeyN': {
      // Toggle between map and legends views
      const appEl = document.getElementById('app');
      if (appEl?.classList.contains('view--legends')) {
        setViewFocus('map');
      } else {
        setViewFocus('legends');
      }
      break;
    }

    case 'KeyR':
      chronicle.toggleRegionFilter({
        x: tilemap.getViewport().centerX,
        y: tilemap.getViewport().centerY,
      });
      break;

    case 'KeyL':
      layoutManager.cycle();
      updateLayoutStatus();
      // Trigger PixiJS resize after layout change
      requestAnimationFrame(() => {
        const container = document.getElementById('map-container')!;
        tilemap.resize(container.clientWidth, container.clientHeight);
      });
      break;

    case 'F1':
      e.preventDefault();
      helpOverlay.toggle();
      break;

    case 'Escape':
      if (helpOverlay.isVisible()) {
        helpOverlay.hide();
      } else {
        inspector.clear();
        tilemap.clearSelectedTile();
      }
      break;

    case 'KeyG':
      // Center map on currently inspected entity
      {
        const loc = inspector.getCurrentLocation();
        if (loc !== null) {
          tilemap.getViewport().centerOn(loc.x, loc.y);
          tilemap.markDirty();
        }
      }
      break;
  }
});

// ============================================
// PANEL FOCUS TRACKING
// ============================================

let currentFocusedPanel: string | null = null;

/**
 * Set which panel has focus
 */
function setPanelFocus(panelId: 'chronicle' | 'inspector' | 'map' | null): void {
  // Remove focus from all panels
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.remove('panel--focused');
  });

  // Add focus to target panel
  if (panelId !== null) {
    let targetPanel: Element | null = null;
    if (panelId === 'chronicle') {
      targetPanel = document.getElementById('event-log-panel');
    } else if (panelId === 'inspector') {
      targetPanel = document.getElementById('inspector-panel');
    }
    // Map doesn't use .panel class, so no focus styling

    if (targetPanel !== null) {
      targetPanel.classList.add('panel--focused');
      currentFocusedPanel = panelId;
    }
  } else {
    currentFocusedPanel = null;
  }
}

/**
 * Initialize panel focus handlers
 */
function initializePanelFocus(): void {
  // Chronicle panel title bar click
  const chronicleTitleBar = document.querySelector('#event-log-panel .panel-titlebar');
  chronicleTitleBar?.addEventListener('click', () => {
    setPanelFocus('chronicle');
  });

  // Inspector panel title bar click
  const inspectorTitleBar = document.querySelector('#inspector-panel .panel-titlebar');
  inspectorTitleBar?.addEventListener('click', () => {
    setPanelFocus('inspector');
  });

  // Map panel canvas click
  const mapCanvas = document.getElementById('pixi-canvas');
  mapCanvas?.addEventListener('click', () => {
    setPanelFocus('map');
  });

  // Set initial focus to Chronicle
  setPanelFocus('chronicle');
}

// ============================================
// VIEW NAVIGATION TABS
// ============================================

/**
 * Switch between Map, Chronicle, and Legends view focus.
 */
function setViewFocus(view: 'map' | 'chronicle' | 'legends'): void {
  const appEl = document.getElementById('app');

  // Update tab states
  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.classList.remove('view-tab--active');
  });
  document.querySelector(`.view-tab[data-view="${view}"]`)?.classList.add('view-tab--active');

  // Remove all view classes
  appEl?.classList.remove('view--chronicle', 'view--legends');

  // Apply the requested view class
  if (view === 'chronicle') {
    appEl?.classList.add('view--chronicle');
  } else if (view === 'legends') {
    appEl?.classList.add('view--legends');
    // Refresh legends data when switching to legends view
    if (legendsPanel !== null) {
      void legendsPanel.refresh();
    }
  }

  // Set panel focus
  setPanelFocus(view === 'legends' ? 'inspector' : view);
}

/**
 * Initialize view navigation handlers
 */
function initializeViewNavigation(): void {
  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const view = target.dataset.view as 'map' | 'chronicle' | 'legends' | undefined;
      if (view !== undefined) {
        setViewFocus(view);
      }
    });
  });
}

// ── UI Event Bus ─────────────────────────────────────────────────────────────

// Inspector placeholder (set in init)
let inspector: InspectorPanel;

uiEvents.on('inspect-entity', (data) => {
  if (inspector !== undefined) {
    void inspector.inspect({ type: data.type, id: data.id });
  }
});

uiEvents.on('center-map', (data) => {
  tilemap.getViewport().centerOn(data.x, data.y);
  tilemap.markDirty();
});

uiEvents.on('view-in-legends', (data) => {
  // Switch to legends view
  setViewFocus('legends');
  // Navigate to the entity
  if (legendsPanel !== null) {
    legendsPanel.navigateToEntity(data.entityId, data.entityType);
  }
});

// ── Render loop ──────────────────────────────────────────────────────────────

function renderLoop(): void {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    const fps = frameCount;
    fpsEl.textContent = `FPS: ${fps}`;

    // Color based on performance tier
    if (fps >= 30) {
      fpsEl.style.color = 'var(--cg)'; // Green
    } else if (fps >= 15) {
      fpsEl.style.color = 'var(--cy)'; // Yellow
    } else {
      fpsEl.style.color = 'var(--cm)'; // Red
    }

    frameCount = 0;
    lastFpsTime = now;
  }

  tilemap.render();

  requestAnimationFrame(renderLoop);
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const welcomeScreen = new WelcomeScreen();
  welcomeScreen.show();

  const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
  const container = document.getElementById('map-container')!;

  // Initialize PixiJS
  const app = await initPixiApp(canvas, container);

  // Add tilemap to stage
  app.stage.addChild(tilemap.getContainer());

  // Initialize inspector panel
  inspector = new InspectorPanel(ipc, favoritesManager);

  // Initialize panel divider (drag resize)
  initPanelDivider();

  // Subscribe to tick deltas
  ipc.onTickDelta(handleTickDelta);

  // Load initial world snapshot
  const snapshot: WorldSnapshot = await ipc.requestSnapshot();
  totalTicks = snapshot.events.length > 0
    ? snapshot.events[snapshot.events.length - 1]!.tick
    : 0;
  totalEntities = snapshot.entities.length;
  totalEvents = snapshot.events.length;

  console.log(`[renderer] World loaded: ${snapshot.mapWidth}x${snapshot.mapHeight}, ${snapshot.entities.length} entities`);

  // Initialize procedural art atlases
  initChargeAtlas();
  generateIconAtlas(); // Pre-generate (could cache texture if needed)

  // Build faction color map for overlays
  for (const f of snapshot.factions) {
    factionColorMap.set(f.id, f.color);
  }

  // Initialize overlay manager
  overlayManager.buildTerritoryCache(snapshot.entities, factionColorMap);
  tilemap.setOverlayManager(overlayManager);

  // Initialize chronicle with snapshot data
  chronicle.updateEntityNames(snapshot.entities);
  // Faction entities lack Position components so they never appear in entity
  // snapshots, but events reference them by ID. Register their names directly
  // so the chronicle can resolve faction IDs to readable names.
  for (const faction of snapshot.factions) {
    chronicle.registerEntityName(faction.id, faction.name);
  }
  if (snapshot.events.length > 0) {
    chronicle.addEvents(snapshot.events);
  }

  // Build entity type map for chronicle click resolution
  buildEntityTypeMap(snapshot.entities, snapshot.factions);

  // Initialize favorites manager with world seed
  favoritesManager.setSeed(snapshot.seed);

  // Initialize legends panel
  legendsPanel = new LegendsPanel(legendsContainer, ipc, favoritesManager);
  void legendsPanel.init(snapshot.seed);

  // Wire chronicle click handlers to inspector
  chronicle.onEntityClick = (entityId: number) => {
    const type = resolveEntityType(entityId);
    void inspector.inspect({ type, id: entityId });
  };
  chronicle.onEventClick = (eventId: number) => {
    void inspector.inspect({ type: 'event', id: eventId });
  };

  // Initialize map
  tilemap.init(snapshot);
  tilemap.resize(app.screen.width, app.screen.height);

  // Build trade route cache for Economic overlay
  overlayManager.buildTradeRouteCache(snapshot.entities);

  // Bind input with click-to-inspect
  bindMapInput(tilemap.getViewport(), canvas, {
    onDirty: () => tilemap.markDirty(),
    onCycleOverlay: () => {
      overlayManager.cycle();
      tilemap.markDirty();
      updateOverlayStatus();
    },
    onTileClick: (wx, wy) => {
      tilemap.setSelectedTile(wx, wy);
      const entities = tilemap.getEntitiesAt(wx, wy);
      if (entities.length > 0) {
        const entity = entities[0]!;
        const type = mapEntityTypeToInspectorType(entity.type);
        if (type !== null) {
          void inspector.inspect({ type, id: entity.id });
        }
      }
    },
    onRightClick: (wx, wy, screenX, screenY) => {
      const items: ContextMenuItem[] = [];

      const entities = tilemap.getEntitiesAt(wx, wy);
      if (entities.length > 0) {
        const entity = entities[0]!;
        const type = mapEntityTypeToInspectorType(entity.type);
        if (type !== null) {
          items.push({
            label: `Inspect ${entity.name}`,
            onClick: () => {
              void inspector.inspect({ type, id: entity.id });
            },
          });
        }
      }

      items.push({
        label: 'Center Map Here',
        onClick: () => {
          tilemap.getViewport().centerOn(wx, wy);
          tilemap.markDirty();
        },
      });

      if (items.length > 0) {
        contextMenu.show(screenX, screenY, items);
      }
    },
  });

  // Initialize tile data provider
  tileDataProvider.init(
    snapshot.tiles, [...snapshot.entities],
    [...snapshot.factions], snapshot.mapWidth, snapshot.mapHeight,
  );

  // Bind tooltip with provider
  tooltip.setProvider(
    tilemap.getViewport(), tileDataProvider,
    snapshot.mapWidth, snapshot.mapHeight,
  );
  tooltip.bind(canvas);

  // Handle canvas resize
  const resizeObserver = new ResizeObserver(() => {
    tilemap.resize(app.screen.width, app.screen.height);
  });
  resizeObserver.observe(container);

  updateStatusBar();
  updateSpeedButtons();
  updateOverlayStatus();
  updateLayoutStatus();

  // Initialize panel focus and view navigation
  initializePanelFocus();
  initializeViewNavigation();

  // Hide welcome screen now that everything is initialized
  welcomeScreen.hide();
  setTimeout(() => welcomeScreen.destroy(), 200);

  // Start render loop
  requestAnimationFrame(renderLoop);
}

init().catch((err) => {
  console.error('[renderer] Initialization failed:', err);
});
