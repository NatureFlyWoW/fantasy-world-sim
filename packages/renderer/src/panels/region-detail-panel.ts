/**
 * Region Detail Panel — shows atmospheric prose about the terrain at the cursor location.
 * Displays biome descriptions, environmental conditions, resources, and settlement info.
 */

import type * as blessed from 'blessed';
import { BasePanel } from '../panel.js';
import type { PanelLayout, RenderContext, RenderableTile } from '../types.js';
import { PanelId } from '../types.js';

/**
 * Atmospheric biome descriptions — 2-3 sentences of prose for each biome type.
 */
const BIOME_PROSE: Readonly<Record<string, string>> = {
  DeepOcean: 'Fathomless waters stretch to every horizon, dark and unfathomable. Strange currents churn in the depths where no light has ever reached. Sailors whisper of leviathans that slumber below.',
  Ocean: 'Open waters roll endlessly under the sky. The wind carries the salt of distant shores, and the waves keep their own ancient rhythm.',
  Coast: 'Where land meets sea, the tide paints the shore in foam and shell. Gulls wheel overhead, and the air tastes of brine and possibility.',
  Plains: 'Grasslands ripple like a green sea under the wind. The horizon stretches unbroken in every direction, vast and humbling.',
  Forest: 'Tall trees crowd together, their canopy filtering the sun into dappled gold. Birdsong and rustling leaves fill the air with quiet life.',
  DenseForest: 'Ancient trees grow so thick that twilight reigns even at noon. Moss clings to every surface, and the air is heavy with the scent of loam and decay. Few paths survive in this primordial wood.',
  Mountain: 'Rocky slopes rise above the tree line, wind-scoured and stern. Stone and sky meet in a jagged embrace, and the air thins with every step upward.',
  HighMountain: 'Towering peaks pierce the clouds, their summits crowned with eternal snow. The wind howls through passes carved by aeons, and the world below seems impossibly distant.',
  Desert: 'Sand and stone shimmer under a merciless sun. Heat rises in visible waves, and the silence is absolute save for the whisper of wind-driven grains.',
  Tundra: 'A frozen expanse of scrub and lichen stretches to the pale horizon. The ground is locked in permafrost, and life clings stubbornly to every sheltered hollow.',
  Swamp: 'Dark water pools between twisted roots and hummocks of sodden earth. The air is thick with mist and the drone of insects. Footing is treacherous, and the land seems to breathe.',
  Volcano: 'The earth itself bleeds fire here. Ash drifts on sulfurous winds, and the ground trembles with the mountain\'s restless fury. Life retreats before the forge of creation.',
  Jungle: 'A riot of green engulfs everything in sight. Vines hang like curtains, flowers bloom in impossible colors, and the canopy hums with the calls of unseen creatures.',
  Savanna: 'Golden grass sways beneath a wide sky dotted with flat-topped trees. The dry season bakes the earth to amber, while the rains transform the land into a brief, vivid green.',
  Taiga: 'Endless ranks of dark conifers march across the frozen north. Snow lies deep between the trunks, and the silence is broken only by the crack of ice and the call of ravens.',
  IceCap: 'A blinding expanse of ice and snow extends without end. Nothing grows here; nothing moves but the wind. It is a land of terrible, pristine beauty.',
  MagicWasteland: 'Reality frays at the edges in this scarred land. The ground pulses with residual energy, colors shift without cause, and the air tastes of copper and ozone. Something went terribly wrong here.',
};

/**
 * Elevation descriptor thresholds.
 */
function describeElevation(elevation: number): string {
  if (elevation >= 0.9) return 'The highest peaks scrape the heavens';
  if (elevation >= 0.75) return 'Lofty heights command a sweeping view';
  if (elevation >= 0.6) return 'Highland terrain rolls with rocky ridges';
  if (elevation >= 0.45) return 'Gentle hills give way to broad valleys';
  if (elevation >= 0.3) return 'Low-lying ground stretches flat and open';
  if (elevation >= 0.15) return 'Coastal lowlands hug the water\'s edge';
  if (elevation >= 0.05) return 'The land barely rises above the waterline';
  return 'Deep waters conceal the ocean floor';
}

/**
 * Temperature descriptor thresholds.
 */
function describeTemperature(temperature: number): string {
  if (temperature >= 0.9) return 'Scorching heat makes the air shimmer';
  if (temperature >= 0.75) return 'Tropical warmth pervades the atmosphere';
  if (temperature >= 0.6) return 'Warm breezes carry the scent of growing things';
  if (temperature >= 0.45) return 'The climate is temperate and mild';
  if (temperature >= 0.3) return 'A cool wind speaks of approaching winter';
  if (temperature >= 0.15) return 'Bitter cold seeps into the bones';
  if (temperature >= 0.05) return 'Frigid air stings exposed skin';
  return 'Lethal cold grips the frozen waste';
}

/**
 * Rainfall descriptor thresholds.
 */
function describeRainfall(rainfall: number): string {
  if (rainfall >= 0.85) return 'Rain falls in near-constant sheets';
  if (rainfall >= 0.7) return 'Heavy rains nourish the lush growth';
  if (rainfall >= 0.5) return 'Regular rains sustain the land';
  if (rainfall >= 0.35) return 'Seasonal rains come and go';
  if (rainfall >= 0.2) return 'Scarce rainfall leaves the earth thirsty';
  if (rainfall >= 0.1) return 'Only the hardiest plants survive the drought';
  return 'Rain is a distant memory here';
}

/**
 * Resource prose descriptions.
 */
const RESOURCE_PROSE: Readonly<Record<string, string>> = {
  iron: 'Veins of iron ore run through the rock',
  gold: 'Precious gold glints in the earth',
  silver: 'Silver deposits gleam in the stone',
  copper: 'Copper ore colours the exposed rock green',
  gemstones: 'Rare gemstones lie hidden in the deep places',
  timber: 'Tall stands of timber await the axe',
  stone: 'Quarryable stone lies close to the surface',
  clay: 'Rich clay deposits line the riverbanks',
  herbs: 'Medicinal herbs grow wild in the undergrowth',
  game: 'Game animals roam through the wilds',
  fish: 'The waters teem with fish',
  fertile_soil: 'Rich, dark soil promises bountiful harvests',
  crystal: 'Crystalline formations pulse with faint energy',
};

/**
 * Throttle cooldown in milliseconds for rapid cursor movement.
 */
const UPDATE_COOLDOWN_MS = 200;

/**
 * RegionDetailPanel displays atmospheric prose about the terrain at cursor location.
 */
/**
 * Optional settlement/faction data for the current tile.
 */
export interface RegionOverlayData {
  readonly controllingFaction?: string;
  readonly nearbySettlements?: readonly { name: string; distance: number }[];
}

export class RegionDetailPanel extends BasePanel {
  private currentX = -1;
  private currentY = -1;
  private currentTile: RenderableTile | null = null;
  private currentOverlay: RegionOverlayData | null = null;
  private lastUpdateTime = 0;
  private lines: string[] = [];
  private scrollOffset = 0;

  constructor(
    screen: blessed.Widgets.Screen,
    layout: PanelLayout,
    boxFactory: (opts: blessed.Widgets.BoxOptions) => blessed.Widgets.BoxElement
  ) {
    super(screen, layout, boxFactory);
    this.setTitle('Region');
  }

  /**
   * Update location from cursor movement.
   * Throttled to avoid excessive re-rendering during rapid movement.
   */
  updateLocation(x: number, y: number, tile: RenderableTile | null, _entityId?: unknown, overlay?: RegionOverlayData): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < UPDATE_COOLDOWN_MS && this.currentX === x && this.currentY === y) {
      return;
    }

    this.currentX = x;
    this.currentY = y;
    this.currentTile = tile;
    this.currentOverlay = overlay ?? null;
    this.lastUpdateTime = now;
    this.scrollOffset = 0;
    this.lines = this.buildContent();
  }

  /**
   * Get the current location coordinates.
   */
  getLocation(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  /**
   * Handle keyboard input.
   */
  handleInput(key: string): boolean {
    switch (key) {
      case 'up':
      case 'k':
      case 'wheelup':
        if (this.scrollOffset > 0) {
          this.scrollOffset--;
          return true;
        }
        return false;
      case 'down':
      case 'j':
      case 'wheeldown':
        this.scrollOffset++;
        return true;
      default:
        return false;
    }
  }

  /**
   * Render the panel content.
   */
  render(_context: RenderContext): void {
    if (this.lines.length === 0) {
      this.lines = this.buildContent();
    }

    const { height } = this.getInnerDimensions();
    const visibleLines = this.lines.slice(this.scrollOffset, this.scrollOffset + height);
    this.setContent(visibleLines.join('\n'));
  }

  /**
   * Build all content lines for the current location.
   */
  private buildContent(): string[] {
    const lines: string[] = [];
    const { width } = this.getInnerDimensions();

    if (this.currentTile === null) {
      lines.push('');
      lines.push('  {#888888-fg}Move the cursor across the map{/}');
      lines.push('  {#888888-fg}to explore the world.{/}');
      lines.push('');
      lines.push('  {#888888-fg}Each region tells its own story \u2014{/}');
      lines.push('  {#888888-fg}of land, weather, and the marks{/}');
      lines.push('  {#888888-fg}left by those who came before.{/}');
      return lines;
    }

    const tile = this.currentTile;

    // Location header
    lines.push(`{bold} \u2500\u2500\u2500 (${this.currentX}, ${this.currentY}) ${'─'.repeat(Math.max(0, width - 16))} {/bold}`);
    lines.push('');

    // Biome prose
    const biomeProse = BIOME_PROSE[tile.biome];
    if (biomeProse !== undefined) {
      const wrapped = this.wrapText(biomeProse, Math.max(10, width - 4));
      for (const line of wrapped) {
        lines.push(`  ${line}`);
      }
    } else {
      lines.push(`  ${tile.biome} terrain`);
    }

    lines.push('');

    // Environmental conditions
    if (tile.elevation !== undefined || tile.temperature !== undefined || tile.rainfall !== undefined) {
      lines.push(`{bold}  Conditions:{/bold}`);

      if (tile.elevation !== undefined) {
        lines.push(`  \u25B2 ${describeElevation(tile.elevation)}`);
      }
      if (tile.temperature !== undefined) {
        lines.push(`  \u2600 ${describeTemperature(tile.temperature)}`);
      }
      if (tile.rainfall !== undefined) {
        lines.push(`  \u2602 ${describeRainfall(tile.rainfall)}`);
      }

      lines.push('');
    }

    // Water features
    if (tile.riverId !== undefined) {
      lines.push('  {#5ea8d4-fg}\u2248 A river winds through this region{/}');
      lines.push('');
    }

    // Ley line
    if (tile.leyLine === true) {
      lines.push('  {#b040e0-fg}\u2726 A ley line pulses with arcane energy beneath the earth{/}');
      lines.push('');
    }

    // Resources
    if (tile.resources !== undefined && tile.resources.length > 0) {
      lines.push(`{bold}  Resources:{/bold}`);
      for (const resource of tile.resources) {
        const desc = RESOURCE_PROSE[resource];
        if (desc !== undefined) {
          lines.push(`  \u25C6 ${desc}`);
        } else {
          const name = resource.charAt(0).toUpperCase() + resource.slice(1).replace(/_/g, ' ');
          lines.push(`  \u25C6 ${name} can be found here`);
        }
      }
      lines.push('');
    }

    // Settlement & faction overlay
    if (this.currentOverlay !== null) {
      if (this.currentOverlay.controllingFaction !== undefined) {
        lines.push(`{bold}  Dominion:{/bold}`);
        lines.push(`  \u269C ${this.currentOverlay.controllingFaction} holds this land`);
        lines.push('');
      }

      if (this.currentOverlay.nearbySettlements !== undefined && this.currentOverlay.nearbySettlements.length > 0) {
        lines.push(`{bold}  Nearby Settlements:{/bold}`);
        for (const s of this.currentOverlay.nearbySettlements) {
          const distWord = s.distance <= 3 ? 'adjacent' : s.distance <= 10 ? 'near' : 'distant';
          lines.push(`  \u25CB ${s.name} (${distWord})`);
        }
        lines.push('');
      }
    }

    return lines;
  }

  /**
   * Wrap text to fit within a given width.
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Clean up resources.
   */
  override destroy(): void {
    this.currentTile = null;
    super.destroy();
  }
}

/**
 * Create region detail panel layout.
 */
export function createRegionDetailPanelLayout(
  x: number,
  y: number,
  width: number,
  height: number
): PanelLayout {
  return {
    id: PanelId.RegionDetail,
    x,
    y,
    width,
    height,
    focused: false,
  };
}

// Export prose maps for testing
export { BIOME_PROSE, RESOURCE_PROSE, describeElevation, describeTemperature, describeRainfall };
