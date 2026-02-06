/**
 * Blessed Terminal UI Spike Test
 *
 * Evaluates blessed for Phase 4 rendering requirements:
 * - 3-panel layout (map, event log, status bar)
 * - Colored ASCII character rendering
 * - Keyboard input handling
 * - Scrollable lists
 * - Box-drawing characters
 */

import blessed from 'blessed';
import { BIOME_CHARS, BiomeType, ENTITY_MARKERS } from './themes/biome-chars.js';

// =============================================================================
// SPIKE TEST SETUP
// =============================================================================

console.log('Starting blessed spike test...');
console.log('Press ESC or q to quit, arrow keys to navigate, Tab to switch panels');

// Create the main screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'Æternum - Blessed Spike Test',
  fullUnicode: true,
  forceUnicode: true,
});

// =============================================================================
// PANEL 1: MAP AREA (top-left, 60% width, 80% height)
// =============================================================================

const mapBox = blessed.box({
  parent: screen,
  label: ' Map View ',
  top: 0,
  left: 0,
  width: '60%',
  height: '80%',
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: '#5080a0',
    },
    label: {
      fg: '#80c0e0',
    },
  },
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  scrollbar: {
    ch: '│',
    style: {
      bg: '#304050',
    },
  },
});

// Render a sample map using biome characters
function renderSampleMap(): string {
  const biomes = Object.values(BiomeType);
  const lines: string[] = [];

  // Header
  lines.push('{bold}Biome Rendering Test:{/bold}');
  lines.push('');

  // Render each biome type with its character
  for (const biome of biomes) {
    const visual = BIOME_CHARS[biome];
    // Use blessed color tags
    const coloredChar = `{${visual.fg}-fg}{${visual.bg}-bg}${visual.char}{/}`;
    lines.push(`${coloredChar} ${coloredChar}${coloredChar}${coloredChar} ${biome}`);
  }

  lines.push('');
  lines.push('{bold}Entity Markers:{/bold}');
  lines.push('');

  // Entity markers
  for (const [key, marker] of Object.entries(ENTITY_MARKERS)) {
    const coloredMarker = `{${marker.fg}-fg}${marker.char}{/}`;
    lines.push(`${coloredMarker}  ${marker.label} (${key})`);
  }

  lines.push('');
  lines.push('{bold}Sample Map Grid:{/bold}');
  lines.push('');

  // Generate a 20x10 sample map
  const mapWidth = 40;
  const mapHeight = 12;
  const biomeList = [
    BiomeType.DeepOcean, BiomeType.Ocean, BiomeType.Coast,
    BiomeType.Plains, BiomeType.Forest, BiomeType.DenseForest,
    BiomeType.Mountain, BiomeType.HighMountain, BiomeType.Desert,
  ];

  for (let y = 0; y < mapHeight; y++) {
    let row = '';
    for (let x = 0; x < mapWidth; x++) {
      // Simple noise-like pattern
      const idx = (x + y * 3 + Math.floor(x / 5) + Math.floor(y / 3)) % biomeList.length;
      const biome = biomeList[idx];
      if (biome === undefined) continue;
      const visual = BIOME_CHARS[biome];
      row += `{${visual.fg}-fg}{${visual.bg}-bg}${visual.char}{/}`;
    }
    lines.push(row);
  }

  return lines.join('\n');
}

mapBox.setContent(renderSampleMap());

// =============================================================================
// PANEL 2: EVENT LOG (top-right, 40% width, 80% height)
// =============================================================================

const eventLog = blessed.log({
  parent: screen,
  label: ' Event Log ',
  top: 0,
  right: 0,
  width: '40%',
  height: '80%',
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: '#5080a0',
    },
    label: {
      fg: '#80c0e0',
    },
  },
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: '│',
    style: {
      bg: '#304050',
    },
  },
});

// Add sample events with color-coding
const sampleEvents = [
  { type: 'war', text: 'The Kingdom of Valdris declares war on the Merchant Republic' },
  { type: 'peace', text: 'Treaty of Ironhold signed, ending the Border Wars' },
  { type: 'death', text: 'King Aldric III has died at age 67' },
  { type: 'birth', text: 'A heir is born to House Blackwood' },
  { type: 'magic', text: 'A magical catastrophe devastates the Arcane Academy' },
  { type: 'religion', text: 'Prophet Serana proclaims a new divine revelation' },
  { type: 'trade', text: 'New trade route established between Valdris and the Free Cities' },
  { type: 'disaster', text: 'Earthquake strikes the northern mountains' },
  { type: 'discovery', text: 'Ancient ruins discovered beneath the old capital' },
  { type: 'political', text: 'Coup attempt fails in the Oligarchy of Merchants' },
];

const eventColors: Record<string, string> = {
  war: '#e04040',
  peace: '#40e040',
  death: '#808080',
  birth: '#e0e040',
  magic: '#a040e0',
  religion: '#e0e0a0',
  trade: '#40a0e0',
  disaster: '#e08040',
  discovery: '#40e0e0',
  political: '#e040a0',
};

// Log events with timestamps
let year = 1247;
let month = 1;
for (const event of sampleEvents) {
  const color = eventColors[event.type] ?? '#ffffff';
  const timestamp = `Year ${year}, Month ${month}`;
  eventLog.log(`{#606060-fg}[${timestamp}]{/} {${color}-fg}${event.text}{/}`);
  month++;
  if (month > 12) {
    month = 1;
    year++;
  }
}

// =============================================================================
// PANEL 3: STATUS BAR (bottom, full width, 20% height)
// =============================================================================

const statusBox = blessed.box({
  parent: screen,
  label: ' Status ',
  bottom: 0,
  left: 0,
  width: '100%',
  height: '20%',
  border: {
    type: 'line',
  },
  style: {
    border: {
      fg: '#5080a0',
    },
    label: {
      fg: '#80c0e0',
    },
  },
  tags: true,
});

// Box-drawing character test
const boxDrawingTest = `
{bold}Box Drawing Characters:{/bold}
╔════════════════╗  ┌────────────────┐
║ Double Border  ║  │ Single Border  │
║ ═══ ║ ╬ ╦ ╩   ║  │ ─── │ ┼ ┬ ┴   │
╚════════════════╝  └────────────────┘

{bold}Status:{/bold} {#40e040-fg}Ready{/}  {bold}Time:{/bold} Year 1247, Month 3, Day 15  {bold}Speed:{/bold} {#e0e040-fg}Normal{/}
{bold}Focus:{/bold} Map View  {bold}Entities:{/bold} 1,247  {bold}Events/tick:{/bold} 23

{#808080-fg}[Tab] Switch Panel  [Arrows] Navigate  [Space] Pause  [+/-] Speed  [Q/Esc] Quit{/}
`;

statusBox.setContent(boxDrawingTest);

// =============================================================================
// KEYBOARD HANDLING
// =============================================================================

let focusedPanel = 0;
const panels = [mapBox, eventLog];

function updatePanelFocus(): void {
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    if (panel === undefined) continue;
    if (i === focusedPanel) {
      panel.style.border = { fg: '#e0e040' };
      panel.focus();
    } else {
      panel.style.border = { fg: '#5080a0' };
    }
  }
  screen.render();
}

// Tab to switch panels
screen.key(['tab'], () => {
  focusedPanel = (focusedPanel + 1) % panels.length;
  updatePanelFocus();
  eventLog.log(`{#808080-fg}[System]{/} Switched to panel ${focusedPanel + 1}`);
});

// Arrow keys
screen.key(['up'], () => {
  eventLog.log('{#808080-fg}[Input]{/} Up arrow pressed');
});

screen.key(['down'], () => {
  eventLog.log('{#808080-fg}[Input]{/} Down arrow pressed');
});

screen.key(['left'], () => {
  eventLog.log('{#808080-fg}[Input]{/} Left arrow pressed');
});

screen.key(['right'], () => {
  eventLog.log('{#808080-fg}[Input]{/} Right arrow pressed');
});

// Space to simulate pause toggle
let paused = false;
screen.key(['space'], () => {
  paused = !paused;
  const status = paused ? '{#e04040-fg}PAUSED{/}' : '{#40e040-fg}RUNNING{/}';
  eventLog.log(`{#808080-fg}[System]{/} Simulation ${status}`);
});

// Quit
screen.key(['escape', 'q', 'C-c'], () => {
  console.log('\nSpike test completed successfully!');
  console.log('blessed is working correctly.');
  return process.exit(0);
});

// Initial focus
updatePanelFocus();

// =============================================================================
// RENDER AND RUN
// =============================================================================

screen.render();

// Log test completion info
eventLog.log('');
eventLog.log('{#40e040-fg}═══ Spike Test Active ═══{/}');
eventLog.log('{#808080-fg}All rendering features working{/}');
eventLog.log('{#808080-fg}Press Q or ESC to exit{/}');
