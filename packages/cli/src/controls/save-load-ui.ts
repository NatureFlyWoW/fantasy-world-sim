// @ts-nocheck
// Note: Uses @ts-nocheck due to cross-package imports requiring built declarations.

/**
 * SaveLoadController — CLI integration for save/load/export.
 *
 * Keybindings:
 *   Ctrl+S  — Quick save
 *   F5      — Load game menu
 *   F6      — Export menu
 *
 * Uses Node.js fs for file I/O via NodeSaveStorage.
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { World } from '@fws/core';
import type { WorldClock } from '@fws/core';
import type { EventLog } from '@fws/core';
import type { EntityId } from '@fws/core';

// Persistence imports (direct, not through barrel to avoid browser deps)
import type {
  SaveStorage,
  SaveMetadata,
  ExportFormat,
} from '../../../core/src/persistence/index.js';
import { SaveManager, ExportManager } from '../../../core/src/persistence/index.js';

// ─── Node.js file system implementation ────────────────────────────────────

export class NodeSaveStorage implements SaveStorage {
  writeFile(path: string, data: Uint8Array): void {
    const dir = path.replace(/[/\\][^/\\]*$/, '');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, data);
  }

  readFile(path: string): Uint8Array {
    return new Uint8Array(readFileSync(path));
  }

  listFiles(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir);
  }

  deleteFile(path: string): void {
    if (existsSync(path)) unlinkSync(path);
  }

  ensureDir(path: string): void {
    mkdirSync(path, { recursive: true });
  }

  exists(path: string): boolean {
    return existsSync(path);
  }
}

// ─── Menu states ───────────────────────────────────────────────────────────

export type SaveLoadMenuState =
  | 'idle'
  | 'save_confirm'
  | 'load_list'
  | 'export_type'
  | 'export_format'
  | 'export_target'
  | 'result';

export type ExportType =
  | 'encyclopedia'
  | 'chronicle'
  | 'timeline'
  | 'genealogy'
  | 'faction_history';

export interface SaveLoadUIState {
  readonly menuState: SaveLoadMenuState;
  readonly statusMessage: string | null;
  readonly saves: readonly SaveMetadata[];
  readonly selectedSaveIndex: number;
  readonly exportType: ExportType | null;
  readonly exportFormat: ExportFormat | null;
  readonly exportTargetId: EntityId | null;
}

export type StatusCallback = (message: string) => void;

// ─── SaveLoadController ────────────────────────────────────────────────────

export class SaveLoadController {
  private readonly saveManager: SaveManager;
  private readonly exportManager: ExportManager;
  private readonly savesDir: string;
  private readonly exportsDir: string;

  private state: SaveLoadUIState = {
    menuState: 'idle',
    statusMessage: null,
    saves: [],
    selectedSaveIndex: 0,
    exportType: null,
    exportFormat: null,
    exportTargetId: null,
  };

  private statusCallback: StatusCallback | null = null;
  private seed = 0;

  constructor(storage?: SaveStorage) {
    const baseDir = join(homedir(), '.aeternum');
    this.savesDir = join(baseDir, 'saves');
    this.exportsDir = join(baseDir, 'exports');

    const saveStorage = storage ?? new NodeSaveStorage();
    this.saveManager = new SaveManager(saveStorage, this.savesDir);
    this.exportManager = new ExportManager(saveStorage, this.exportsDir);
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  onStatus(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  getState(): SaveLoadUIState {
    return this.state;
  }

  getSaveManager(): SaveManager {
    return this.saveManager;
  }

  getExportManager(): ExportManager {
    return this.exportManager;
  }

  // ── Quick save (Ctrl+S) ─────────────────────────────────────────────

  quickSave(world: World, clock: WorldClock, eventLog: EventLog): void {
    try {
      const name = `quicksave-${Date.now()}`;
      const saveFile = this.saveManager.save(world, clock, eventLog, {
        name,
        description: `Quick save at Year ${clock.getElapsedYears()}`,
        worldAge: clock.currentTick,
        seed: this.seed,
        createdAt: Date.now(),
      });
      this.saveManager.writeSave(saveFile);
      this.emitStatus(`Saved: ${name}`);
    } catch (err) {
      this.emitStatus(`Save failed: ${(err as Error).message}`);
    }
  }

  // ── Load menu (F5) ──────────────────────────────────────────────────

  openLoadMenu(): void {
    const saves = this.saveManager.listSaves();
    this.state = {
      ...this.state,
      menuState: 'load_list',
      saves,
      selectedSaveIndex: 0,
    };
  }

  selectLoadEntry(index: number): void {
    if (index >= 0 && index < this.state.saves.length) {
      this.state = { ...this.state, selectedSaveIndex: index };
    }
  }

  /**
   * Confirm load and return deserialized state.
   * Returns null if no saves or out of bounds.
   */
  confirmLoad(
    WorldClass: new () => World,
    ClockClass: new () => WorldClock,
    EventLogClass: new () => EventLog,
  ): { world: World; clock: WorldClock; eventLog: EventLog } | null {
    const meta = this.state.saves[this.state.selectedSaveIndex];
    if (meta === undefined) return null;

    try {
      const saveFile = this.saveManager.readSave(meta.name);
      const result = this.saveManager.load(saveFile, WorldClass, ClockClass, EventLogClass);
      this.emitStatus(`Loaded: ${meta.name}`);
      this.closeMenu();
      return result;
    } catch (err) {
      this.emitStatus(`Load failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ── Export menu (F6) ────────────────────────────────────────────────

  openExportMenu(): void {
    this.state = {
      ...this.state,
      menuState: 'export_type',
      exportType: null,
      exportFormat: null,
      exportTargetId: null,
    };
  }

  selectExportType(type: ExportType): void {
    // Types that need a target entity go to target selection
    const needsTarget = type === 'chronicle' || type === 'genealogy' || type === 'faction_history';
    this.state = {
      ...this.state,
      exportType: type,
      menuState: needsTarget ? 'export_target' : 'export_format',
    };
  }

  selectExportTarget(entityId: EntityId): void {
    this.state = {
      ...this.state,
      exportTargetId: entityId,
      menuState: 'export_format',
    };
  }

  selectExportFormat(format: ExportFormat): void {
    this.state = { ...this.state, exportFormat: format };
  }

  confirmExport(world: World, eventLog: EventLog): string | null {
    const { exportType, exportFormat, exportTargetId } = this.state;
    if (exportType === null || exportFormat === null) return null;

    try {
      let content: string;
      const opts = { format: exportFormat };

      switch (exportType) {
        case 'encyclopedia':
          content = this.exportManager.exportWorldEncyclopedia(world, eventLog, opts);
          break;
        case 'chronicle':
          if (exportTargetId === null) return null;
          content = this.exportManager.exportCharacterChronicle(exportTargetId, world, eventLog, opts);
          break;
        case 'timeline':
          content = this.exportManager.exportHistoricalTimeline(world, eventLog, opts);
          break;
        case 'genealogy':
          if (exportTargetId === null) return null;
          content = this.exportManager.exportGenealogy(exportTargetId, world, opts);
          break;
        case 'faction_history':
          if (exportTargetId === null) return null;
          content = this.exportManager.exportFactionHistory(exportTargetId, world, eventLog, opts);
          break;
      }

      const ext = exportFormat === 'json' ? 'json' : exportFormat === 'md' ? 'md' : 'txt';
      const filename = `${exportType}-${Date.now()}.${ext}`;
      this.exportManager.writeExport(filename, content);
      this.emitStatus(`Exported: ${filename}`);
      this.closeMenu();
      return content;
    } catch (err) {
      this.emitStatus(`Export failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ── Auto-save hook ──────────────────────────────────────────────────

  tickAutoSave(clock: WorldClock, world: World, eventLog: EventLog): void {
    this.saveManager.checkAutoSave(clock, world, eventLog, this.seed);
  }

  // ── Menu navigation ─────────────────────────────────────────────────

  closeMenu(): void {
    this.state = {
      ...this.state,
      menuState: 'idle',
      statusMessage: null,
    };
  }

  isMenuOpen(): boolean {
    return this.state.menuState !== 'idle' && this.state.menuState !== 'result';
  }

  // ── Render menu content ─────────────────────────────────────────────

  renderMenu(): string[] {
    const lines: string[] = [];

    switch (this.state.menuState) {
      case 'load_list': {
        lines.push('=== Load Game ===');
        lines.push('');
        if (this.state.saves.length === 0) {
          lines.push('  No saves found.');
        } else {
          for (let i = 0; i < this.state.saves.length; i++) {
            const save = this.state.saves[i]!;
            const marker = i === this.state.selectedSaveIndex ? '>' : ' ';
            lines.push(`${marker} ${save.name} — ${save.description}`);
          }
        }
        lines.push('');
        lines.push('Enter: Load | Esc: Cancel');
        break;
      }

      case 'export_type': {
        lines.push('=== Export ===');
        lines.push('');
        lines.push('  1. World Encyclopedia');
        lines.push('  2. Character Chronicle');
        lines.push('  3. Historical Timeline');
        lines.push('  4. Genealogy');
        lines.push('  5. Faction History');
        lines.push('');
        lines.push('Press 1-5 | Esc: Cancel');
        break;
      }

      case 'export_format': {
        lines.push(`=== Export: ${this.state.exportType} ===`);
        lines.push('');
        lines.push('  1. Plain Text (.txt)');
        lines.push('  2. Markdown (.md)');
        lines.push('  3. JSON (.json)');
        lines.push('');
        lines.push('Press 1-3 | Esc: Cancel');
        break;
      }

      case 'export_target': {
        lines.push(`=== Export: ${this.state.exportType} ===`);
        lines.push('');
        lines.push('  Select target entity (use inspector)');
        lines.push('  Press Enter to confirm selection');
        lines.push('');
        lines.push('Enter: Confirm | Esc: Cancel');
        break;
      }

      default:
        break;
    }

    return lines;
  }

  private emitStatus(message: string): void {
    this.state = { ...this.state, statusMessage: message };
    if (this.statusCallback !== null) {
      this.statusCallback(message);
    }
  }
}
