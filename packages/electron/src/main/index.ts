// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.
// The code runs correctly through electron which has runtime module resolution.

/**
 * Electron main process entry point.
 *
 * Creates the browser window, initializes the simulation, and
 * bridges IPC between main (simulation) and renderer (UI).
 */
import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SimulationRunner } from './simulation-runner.js';
import { registerIpcHandlers } from './ipc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let simulationRunner: SimulationRunner | null = null;

function parseSeedFromArgs(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      const next = args[i + 1];
      if (next !== undefined) {
        const seed = parseInt(next, 10);
        if (!isNaN(seed)) return seed;
      }
    }
  }
  return Math.floor(Math.random() * 2147483647);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'AETERNUM',
    backgroundColor: '#0c0c14', // --bg0
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Initialize simulation
  const seed = parseSeedFromArgs();
  simulationRunner = new SimulationRunner(seed);
  simulationRunner.initialize();

  // Register IPC handlers before loading the page
  registerIpcHandlers(simulationRunner, mainWindow);

  // Load the renderer HTML
  const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
  await mainWindow.loadFile(rendererPath);

  // Start simulation warmup (30 ticks)
  simulationRunner.warmup(30);

  // Wire tick deltas to renderer
  simulationRunner.onTickDelta((delta) => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('simulation:tick-delta', delta);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (simulationRunner !== null) {
      simulationRunner.stop();
      simulationRunner = null;
    }
  });
}

app.whenReady().then(createWindow).catch((err) => {
  console.error('Failed to create window:', err);
  process.exit(1);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(console.error);
  }
});
