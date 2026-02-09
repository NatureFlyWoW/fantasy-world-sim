## 19. Future Vision

### 19.1 Graphical Overhaul (Electron + PixiJS)

The terminal UI preserves the full simulation, but the visual experience is constrained by ASCII rendering. The planned graphical overhaul creates a parallel `@fws/electron` package (the blessed terminal version is preserved as fallback).

**Architecture:**

```
GRAPHICAL OVERHAUL ARCHITECTURE
---------------------------------------------------------------

@fws/core (unchanged)     @fws/generator (unchanged)
       \                         /
        \                       /
         @fws/electron (NEW) --+-- @fws/narrative (unchanged)
         |
         +-- main/           Electron main process
         |   |               (simulation runner, full ECS access)
         |   +-- ipc-handlers.ts
         |   +-- simulation-runner.ts
         |
         +-- renderer/        Electron renderer process
         |   +-- pixi/        Map canvas (terrain, overlays)
         |   +-- ui/          HTML panels (log, inspector, topbar)
         |   +-- procgen/     Procedural sprite generation
         |   +-- data/        Data adapters (from blessed panels)
         |   +-- styles/      14 CSS files
         |
         +-- shared/          IPC types between processes

@fws/renderer (blessed - PRESERVED, launched via `pnpm run start`)

---------------------------------------------------------------
```

**Platform:** Electron 33 desktop app with Vite bundling
**Map Rendering:** PixiJS 8 for 2D sprite rendering, top-down pixel art first, isometric later
**UI Panels:** HTML/CSS with ornate medieval styling (CSS Grid layout, parchment textures)
**Art Pipeline:** Procedural generation (runtime, seed-based), no hand-drawn assets

**Procedural Pixel Art Pipeline (5-Layer Tile Generation):**

```
TILE GENERATION LAYERS (32x32 pixels)
---------------------------------------------------------------

Layer 1: BASE COLOR
  SimplexNoise at freq 0.02, maps to biome palette base array

Layer 2: TEXTURE VARIATION
  Noise at 0.08 freq. Above +0.3: blend 40% toward highlight.
  Below -0.3: blend 30% toward shadow.

Layer 3: DETAIL SPECKS
  Noise at 0.2 freq. Top 15%: blend 60% detail color.
  (wildflowers, stone flecks, lava specks)

Layer 4: ORDERED DITHERING
  4x4 Bayer matrix for pixel art cross-hatch texture.
  Modulated by noise at 0.15 freq.

Layer 5: DIRECTIONAL LIGHTING
  Top-left light source for consistent illumination.
  Strength varies by biome (0.2 ocean to 0.8 desert).

---------------------------------------------------------------
```

**Sprite Atlas Budget:**

| Atlas | Size | Contents | GPU Memory |
|-------|------|----------|------------|
| Terrain | 512x512 | 136 tiles (17 biomes x 8 variants) | 1 MB |
| Transitions | 512x512 | ~80 domain-warped boundary tiles | 1 MB |
| Features | 256x256 | 36 trees + 12 rocks + vegetation | 256 KB |
| Structures | 1024x512 | 40 buildings + 5 castles + farms | 2 MB |
| UI | 256x256 | corners + badges + icons | 256 KB |
| **Total** | | | **~5.5 MB** |

**Settlement Tiers (Castle Sprites):**

| Tier | Size | Visual Components |
|------|------|------------------|
| Hamlet | 24x20 | Single tower, low walls |
| Village | 32x24 | Keep + 2 towers + walls |
| Town | 48x36 | Keep + 4 towers + gatehouse |
| City | 64x48 | Tall keep + 4 outer + 2 inner towers |
| Capital | 80x56 | Grand palace + 6 towers + triple wall |

**UI Chrome (75 CSS Custom Properties):**
- Backgrounds: near-black with blue undertone (`#0a0a0e`), dark blue-charcoal panels (`#16161c`)
- Borders: warm dark brown (`#2a2825`), bronze metalwork (`#8b6914`), gold highlights (`#c9a84c`)
- Text: warm parchment primary (`#e0d8c4`), secondary (`#b0a890`), tertiary (`#7a7060`)
- Category colors: 10 desaturated tones (Political `#d4a832`, Military `#c44040`, etc.)
- Significance: 6 tiers from Trivial `#444440` to Legendary `#d040c0` (with pulse animation)
- Typography: Cinzel (serif headers), Source Sans 3 (body), JetBrains Mono (data)

**Seasonal Color Shifts (via PixiJS ColorMatrixFilter, no tile regeneration):**

| Season | Saturation | Hue Shift | Brightness |
|--------|-----------|-----------|------------|
| Spring | +10% | -5 degrees | +5% |
| Summer | baseline | 0 | baseline |
| Autumn | -15% | +25 degrees | -5% |
| Winter | -35% | -10 degrees | +10% |

**Data Reuse:** 70% of current renderer code (5,685 of 8,094 LOC) is reusable -- territory flood-fill, trade route tracing, prose generation, entity resolution, aggregation logic. Only the blessed-specific 30% (tag formatting, box rendering, key handlers) is replaced.

**IPC Pattern:** Simulation runs in Electron main process. Renderer receives delta updates per tick (~10KB). Inspector queries use invoke/handle for on-demand data. Initial map load sends full tile data once (~800KB for 128x128). Performance targets: 60 FPS rendering, <3 second startup, <200MB memory.

### 19.2 Enhanced Narrative Systems

- **First-person introspection mode.** Stream-of-consciousness text reflecting a character's personality, goals, and emotional state.
- **Oral tradition system.** Knowledge transmitted through social networks with high mutation rates. A heroic deed becomes legend, distorting beyond recognition over centuries.
- **Procedural ambient soundscapes.** Tone.js generating music reflecting world state: harmony from dominant culture's mood, tempo from event density, dissonance proportional to conflict.
- **Expanded vignette system.** More trigger archetypes, longer vignettes for truly legendary events, multi-character vignettes for confrontation scenes.

### 19.3 Expanded Simulation Depth

- **Treaty system.** Complex multi-clause treaties with violation mechanics and diplomatic reputation consequences.
- **Espionage system.** Spy networks, intelligence gathering, covert operations, counter-intelligence.
- **Economic specialization.** Guild systems, craft mastery, luxury goods, black markets.
- **Advanced ecology.** More detailed food webs, climate feedback loops, magical ecosystem effects.
- **Expanded artifact consciousness.** Artifacts that actively pursue goals, influence wielders more dramatically, and resist incompatible users.

### 19.4 Export and Documentation System

The simulation produces a world so rich in detail that players want to preserve and share it. The export system generates multiple document types:

**World Encyclopedia.** A comprehensive compendium of all entities, events, and lore, organized by category. Entries for every named character, settlement, faction, artifact, book, spell, religion, and event. Each entry cross-references related entries, creating a hyperlinked wiki of the emergent world.

**Character Chronicles.** Individual biographies for selected characters, written in the active narrative tone and filtered through the active chronicler. These read as self-contained short stories -- the complete life from birth to death.

**Historical Timelines.** Chronological narratives with configurable scope: a single civilization, a single century, a single war, or the entire history.

**Genealogies.** Family trees with connecting lines showing trait inheritance, marriage alliances, and hereditary grudges.

**Map Atlases.** Rendered world maps at multiple time points showing territorial changes. A "time-lapse atlas" shows empires rising and falling as a sequence of snapshots.

**Religious Texts.** In-world holy books with doctrines, creation myths, prophecies, and moral codes -- generated from actual simulation events, filtered through the religion's theological biases.

**Cultural Guides.** Descriptions of art styles, traditions, fashion, cuisine, and social customs for each civilization.

**Export Formats:**
- Plain text (preserving ASCII art formatting)
- HTML with CSS styling matching the terminal aesthetic
- JSON/XML data for external analysis and tool integration

### 19.5 Social and Sharing Features

- **World fingerprint gallery.** Browse and compare generated worlds across sessions.
- **Shareable timeline snapshots.** Export specific historical moments for sharing.
- **Seed sharing.** Share world seeds and parameters so others can generate identical worlds.
- **Community challenges.** "Achieve lasting peace for 500 years" or "Prevent empire collapse using only cultural influence" -- player-defined goals within the cultivation model.
