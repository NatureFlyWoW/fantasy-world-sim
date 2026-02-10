/**
 * Renderer process entry point.
 *
 * Initializes PixiJS, connects IPC, wires map rendering + controls,
 * and maintains an FPS counter.
 */
import { initPixiApp } from './pixi-app.js';
import { createIpcClient } from './ipc-client.js';
import { TilemapRenderer } from './map/tilemap-renderer.js';
import { MapTooltip } from './map/map-tooltip.js';
import { TileDataProvider } from './map/tile-data-provider.js';
import { OverlayManager } from './map/overlay-manager.js';
import { bindMapInput } from './map/input-handler.js';
import type { TickDelta, WorldSnapshot } from '../shared/types.js';

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

// ── IPC ──────────────────────────────────────────────────────────────────────

const ipc = createIpcClient();

function updateStatusBar(): void {
  tickEl.textContent = `Tick: ${totalTicks}`;
  entitiesEl.textContent = `Entities: ${totalEntities}`;
  eventsEl.textContent = `Events: ${totalEvents}`;
}

function updateSpeedButtons(): void {
  btnPause.classList.toggle('active', paused);
  btnPlay.classList.toggle('active', !paused && speed === 1);
  btnFast.classList.toggle('active', !paused && speed > 1);
}

function updateOverlayStatus(): void {
  if (overlayEl !== null) {
    overlayEl.textContent = `Overlay: ${overlayManager.activeOverlay}`;
  }
}

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

  // Rebuild overlay caches when entities change
  if (delta.entityUpdates.length > 0 || delta.removedEntities.length > 0) {
    const currentEntities = tilemap.getEntities();
    overlayManager.buildTerritoryCache(currentEntities, factionColorMap);
    overlayManager.buildTradeRouteCache(currentEntities);
    tileDataProvider.updateEntities(currentEntities);
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

// Keyboard: space to pause/resume
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (paused) {
      btnPlay.click();
    } else {
      btnPause.click();
    }
  }
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

  // Initialize map
  tilemap.init(snapshot);
  tilemap.resize(app.screen.width, app.screen.height);

  // Build trade route cache for Economic overlay
  overlayManager.buildTradeRouteCache(snapshot.entities);

  // Bind input
  bindMapInput(tilemap.getViewport(), canvas, {
    onDirty: () => tilemap.markDirty(),
    onCycleOverlay: () => {
      overlayManager.cycle();
      tilemap.markDirty();
      updateOverlayStatus();
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

  // Start render loop
  requestAnimationFrame(renderLoop);
}

init().catch((err) => {
  console.error('[renderer] Initialization failed:', err);
});
