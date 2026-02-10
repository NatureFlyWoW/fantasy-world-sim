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
import type { EntityType, InspectorQuery, TickDelta, WorldSnapshot } from '../shared/types.js';

// ── State ────────────────────────────────────────────────────────────────────

let totalTicks = 0;
let totalEntities = 0;
let totalEvents = 0;
let paused = true;
let speed = 1;

// FPS tracking
let frameCount = 0;
let lastFpsTime = performance.now();

// Map
const tilemap = new TilemapRenderer();
const tooltip = new MapTooltip();
const tileDataProvider = new TileDataProvider();
const overlayManager = new OverlayManager();
const factionColorMap = new Map<number, string>();

// Chronicle
const chronicleContainer = document.getElementById('event-log-panel')!;
const chronicle = new ChroniclePanel(chronicleContainer);

// ── DOM refs ─────────────────────────────────────────────────────────────────

const tickEl = document.getElementById('status-tick')!;
const entitiesEl = document.getElementById('status-entities')!;
const eventsEl = document.getElementById('status-events')!;
const fpsEl = document.getElementById('status-fps')!;
const dateEl = document.getElementById('date-display')!;
const btnPause = document.getElementById('btn-pause')!;
const btnPlay = document.getElementById('btn-play')!;
const btnFast = document.getElementById('btn-fast')!;
const overlayEl = document.getElementById('status-overlay');
const layoutEl = document.getElementById('status-layout');
const speedEl = document.getElementById('status-speed');

// ── IPC ──────────────────────────────────────────────────────────────────────

const ipc = createIpcClient();

// ── Modules ──────────────────────────────────────────────────────────────────

const layoutManager = new LayoutManager();
const helpOverlay = new HelpOverlay();
const notifications = new NotificationManager();

function updateStatusBar(): void {
  tickEl.textContent = `Tick: ${totalTicks}`;
  entitiesEl.textContent = `Entities: ${totalEntities}`;
  eventsEl.textContent = `Events: ${totalEvents}`;
}

function updateSpeedButtons(): void {
  btnPause.classList.toggle('active', paused);
  btnPlay.classList.toggle('active', !paused && speed === 1);
  btnFast.classList.toggle('active', !paused && speed > 1);
  if (speedEl !== null) {
    speedEl.textContent = paused ? 'Speed: Paused' : `Speed: ${speed}x`;
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

// ── Tick handling ─────────────────────────────────────────────────────────────

function handleTickDelta(delta: TickDelta): void {
  totalTicks = delta.tick;
  totalEvents += delta.events.length;
  dateEl.textContent = `Year ${delta.time.year}, Month ${delta.time.month}, Day ${delta.time.day}`;
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
  }

  // Notify high-significance events
  for (const event of delta.events) {
    if (event.significance >= 80) {
      notifications.show(event.subtype.replace(/[._]/g, ' '), 'event');
    }
  }
}

// ── Controls ─────────────────────────────────────────────────────────────────

btnPause.addEventListener('click', () => {
  paused = true;
  ipc.sendCommand({ type: 'pause' });
  updateSpeedButtons();
});

btnPlay.addEventListener('click', () => {
  paused = false;
  speed = 1;
  ipc.sendCommand({ type: 'resume' });
  ipc.sendCommand({ type: 'set-speed', ticksPerSecond: 1 });
  updateSpeedButtons();
});

btnFast.addEventListener('click', () => {
  paused = false;
  speed = 7;
  ipc.sendCommand({ type: 'resume' });
  ipc.sendCommand({ type: 'set-speed', ticksPerSecond: 7 });
  updateSpeedButtons();
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // Don't intercept when typing in inputs
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (paused) {
        btnPlay.click();
      } else {
        btnPause.click();
      }
      break;

    case 'KeyN':
      chronicle.cycleMode();
      break;

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

// ── Render loop ──────────────────────────────────────────────────────────────

function renderLoop(): void {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsEl.textContent = `FPS: ${frameCount}`;
    frameCount = 0;
    lastFpsTime = now;
  }

  tilemap.render();

  requestAnimationFrame(renderLoop);
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const canvas = document.getElementById('pixi-canvas') as HTMLCanvasElement;
  const container = document.getElementById('map-container')!;

  // Initialize PixiJS
  const app = await initPixiApp(canvas, container);

  // Add tilemap to stage
  app.stage.addChild(tilemap.getContainer());

  // Initialize inspector panel
  inspector = new InspectorPanel(ipc);

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

  // Build faction color map for overlays
  for (const f of snapshot.factions) {
    factionColorMap.set(f.id, f.color);
  }

  // Initialize overlay manager
  overlayManager.buildTerritoryCache(snapshot.entities, factionColorMap);
  tilemap.setOverlayManager(overlayManager);

  // Initialize chronicle with snapshot data
  chronicle.updateEntityNames(snapshot.entities);
  if (snapshot.events.length > 0) {
    chronicle.addEvents(snapshot.events);
  }

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

  // Start render loop
  requestAnimationFrame(renderLoop);
}

init().catch((err) => {
  console.error('[renderer] Initialization failed:', err);
});
