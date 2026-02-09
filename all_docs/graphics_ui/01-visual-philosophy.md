## 1. Visual Philosophy

### 1.1 The Caves of Qud Principle

Caves of Qud proves that a fixed, constrained palette -- 18 colors in their case --
produces visual cohesion that unconstrained palettes never achieve. Every tile uses
exactly three color slots: a primary glyph color, a detail/secondary color, and a
background color. The result is not "retro" in any nostalgic sense. It is *designed*.
The constraints are the design.

Aetherum adopts this principle with a wider but still bounded palette of 28 colors.
The constraint is that every visual element on screen -- terrain tiles, UI chrome,
event cards, inspector text -- draws exclusively from this palette. No gradients.
No alpha blending that produces off-palette intermediates. No arbitrary hex codes
invented per-component. Twenty-eight colors, used everywhere, producing a world
that feels unified even as it displays political maps, character inspectors, and
prose chronicles simultaneously.

### 1.2 Not Trying to Look Old

The goal is not to simulate a CRT monitor, a VGA card, or a specific era of hardware.
There are no scan lines. There is no vignetting. There is no fake screen curvature.
The aesthetic is *tile-based clarity* -- the same principle that makes subway maps,
chess boards, and spreadsheets readable. Each tile is a discrete unit of information.
Each color has a semantic meaning. The eye can parse the map at a glance because
the vocabulary is small and consistent.

This approach is *modern* in its UX thinking. Tooltips appear instantly. Panels
resize smoothly. Click targets are generous. Keyboard shortcuts have visual feedback.
The rendering technology is contemporary (PixiJS WebGL). Only the visual language
is constrained.

### 1.3 The Observation Fantasy

Aetherum is not an action game. The player watches centuries unfold. The UI must
serve this specific fantasy: **the god's-eye chronicler**, peering down at a living
world, watching factions rise and fall, characters scheme and die, empires expand
and crumble. The visual design supports this by:

- Making the map the dominant visual element (65-70% of screen)
- Treating the chronicle as a medieval manuscript, not a chat log
- Presenting entity details as prose first, data second
- Using restrained color to avoid visual fatigue over long sessions
- Ensuring text is readable at sizes that allow information density

The player should feel like they are reading an illuminated manuscript that updates
in real time, with a living map as its centerpiece illustration.

### 1.4 Why Constraints Inspire Rather Than Limit

A constrained palette forces every color decision to be intentional. When you have
16 million hex codes available, you reach for "close enough" and end up with
a UI that has 47 shades of gray. When you have four shades of gray (BG0-BG3),
each shade carries meaning:

- BG0: the void, the deepest layer, the app edge
- BG1: the surface, the panel background, the reading area
- BG2: the card, the elevated element, the thing worth noticing
- BG3: the hover, the "you are touching this," the interactive response

This semantic clarity extends to every palette group. The six terrain colors are
not decorative -- they are a mapping language. The six semantic colors are not
branding -- they are event categories made visible. The constraints produce a
visual system where nothing is arbitrary.

### 1.5 Reference Points

| Reference | What We Take From It |
|---|---|
| Caves of Qud | Constrained palette, tile grid, three-colors-per-tile |
| Dwarf Fortress (Steam) | Tile variation within biomes, entity markers on map |
| Crusader Kings III | Information hierarchy in character/faction panels |
| Total War campaign map | Territory visualization, army markers, trade routes |
| Medieval manuscripts | Decorative borders, section ornaments, serif headers |

What we explicitly avoid:
- Isometric 3D perspective in Phase 1 (adds complexity; possible future mode)
- High-fidelity pixel art with anti-aliasing (breaks the constrained palette)
- Animated character sprites (the game has no real-time action)
- Scan lines, vignetting, CRT effects (the user explicitly excluded these)
- Fake-retro screen distortion of any kind
