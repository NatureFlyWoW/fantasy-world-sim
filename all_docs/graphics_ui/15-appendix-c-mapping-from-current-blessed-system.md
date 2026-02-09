## Appendix C: Mapping from Current Blessed System

| Current (blessed) | New (Electron + PixiJS) | Notes |
|---|---|---|
| `blessed.screen()` | Electron BrowserWindow | Full window container |
| `blessed.box()` + borders | `.panel` div + `.panel-frame` | Ornate corners replace ASCII borders |
| `BasePanel` class | Panel web component | Same lifecycle, different rendering |
| `THEME.ui.background` (#0a0a0a) | BG0 (#0c0c14) | Slightly bluer dark |
| `THEME.ui.text` (#cccccc) | N3 (#c8c8cc) | Warmer, slightly cooler |
| `CATEGORY_COLORS[Political]` (#FFDD44) | CP (#d4a832) | More muted, golden |
| `CATEGORY_COLORS[Military]` (#FF4444) | CM (#c44040) | Desaturated crimson |
| `SIGNIFICANCE_COLORS.legendary` (#FF00FF) | FM (#9040cc) | Purple, not magenta |
| `blessed.tags` for colored text | CSS classes | No tag balancing headaches |
| `screen.render()` | DOM auto-updates | No manual render calls |
| `MenuBar` class | `.topbar` nav element | Integrated date + speed + views |
| `LayoutManager` class | CSS Grid + resize observers | Responsive by default |
| `biome-render-config.ts` pools | Glyph atlas + variant tables | Same data, sprite rendering |
| `overlay-bridge.ts` cache | Same data structure | 92% code reuse |
| `event-aggregator.ts` | Same module | 100% code reuse (pure logic) |
| `event-filter.ts` | Same module | 100% code reuse (pure logic) |
| `inspector-prose.ts` tables | Same module | 100% code reuse (lookup tables) |
| `heraldry.ts` ASCII output | Canvas-rendered 48x48 shields | Same generation logic |
