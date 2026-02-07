# Hi-Fi UI Designer Memory

## Key Design Decisions (Rev 1.0, 2026-02-07)

### Architecture
- Electron + PixiJS (map canvas) + HTML/CSS (panels)
- CSS Grid root: `1fr minmax(420px, 35%)` columns
- PixiJS canvas fills left grid cell, HTML panels in right column
- Panel column: Event Log (top 50%) + resize divider + Inspector (bottom 50%)
- Top bar: 36px, Status bar: 24px

### Established Color Palette
- See `docs/plans/hifi-ui-component-system.md` Section 6 for full palette
- Panel bg: #16161c (solid) / rgba(22,22,28,0.92) (alpha)
- Borders: #2a2825 (default), #3a3530 (strong), #8b6914 (ornamental gold)
- Parchment accent: #c9b896 (active tabs, headers)
- Text: #e0d8c4 (primary), #b0a890 (secondary), #7a7060 (tertiary), #4a4540 (quaternary)

### Category Colors (Desaturated for pixel art)
- Political #d4a832, Military #c44040, Economic #3aad6a
- Social #6888c8, Cultural #40b0c8, Religious #b87acc
- Magical #9040cc, Personal #6088cc, Disaster #cc6020, Exploratory #70c040

### Significance Colors
- Trivial #444440, Minor #686860, Moderate #c4a840
- Major #cc6830, Critical #cc3030, Legendary #d040c0

### Typography
- Display: Cinzel (Google Font), serif fallbacks
- Body: Source Sans 3, system-ui fallbacks
- Mono: JetBrains Mono, Consolas fallback
- Base size: 13px, scale: 10/11/13/14/16/18/22px

### Panel Frame Design
- Ornate L-shaped corner sprites (24x24px each, mirrored via CSS)
- Bronze/gold color: #8b6914 base, #c9a84c highlight, #6b4e0a shadow
- 1px solid #2a2825 default border between corners
- Pure CSS fallback available (2px L-brackets)

### Icon System
- Sprite sheet: ui-icons.png, 160x32px (10 cols x 2 rows, 16px cells)
- Row 0: 10 category icons, Row 1: entity/action icons
- `image-rendering: pixelated` for crisp scaling
- Sizes: 12/16/24/32px variants via background-size scaling

### Key Files
- Complete spec: `docs/plans/hifi-ui-component-system.md`
- Current ASCII theme: `packages/renderer/src/theme.ts`
- Current layout: `packages/renderer/src/layout-manager.ts`
- Target mockups: `remake_samples/new_ui_sample1.png`, `new_ui_sample2.png`, `new_ui_sample3.png`
- Rework requirements: `remake_samples/rework.md`

### CSS File Organization
- `packages/renderer/src/styles/` directory with 14 CSS files
- Import order: variables > reset > typography > layout > panel-frame > ...

### Mapping: Old Terminal to New HTML/CSS
- blessed.screen -> Electron BrowserWindow
- blessed.box -> .panel div with .panel-frame
- blessed tags -> CSS classes + inline styles (no tag balancing!)
- THEME.ui.* -> CSS custom properties (--bg-*, --text-*, etc.)
- screen.render() -> DOM auto-updates (no manual render)

### Implementation Priority
Phase 1: Foundation (CSS vars, reset, fonts, grid, PixiJS mount)
Phase 2: Panel chrome (frames, corners, titlebars, divider)
Phase 3: Event Log (modes, headers, cards, badges, significance)
Phase 4: Inspector (tabs, breadcrumbs, sections, prose, data)
Phase 5: Top/status bars
Phase 6: Polish (tooltips, modals, icons, accessibility)
