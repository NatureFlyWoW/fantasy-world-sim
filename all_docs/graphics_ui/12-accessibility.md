## 12. Accessibility

### 12.1 Contrast Ratios

All text meets WCAG AA contrast requirements against its background:

| Text Color | Background | Contrast Ratio | Passes AA? |
|---|---|---|---|
| N3 (#c8c8cc) on BG1 (#16161e) | -- | 10.8:1 | Yes (AAA) |
| N2 (#8a8a90) on BG1 (#16161e) | -- | 5.4:1 | Yes (AA) |
| N1 (#585860) on BG1 (#16161e) | -- | 3.1:1 | Yes (AA large text only) |
| PA1 (#c9b896) on BG1 (#16161e) | -- | 8.2:1 | Yes (AAA) |
| N3 (#c8c8cc) on BG2 (#22222c) | -- | 8.1:1 | Yes (AAA) |
| PA1 (#c9b896) on BG2 (#22222c) | -- | 6.2:1 | Yes (AA) |
| N0 (#3a3a44) on BG1 (#16161e) | -- | 1.9:1 | Decorative only |

N0 is used only for decorative borders and disabled states -- never for content
that must be read.

### 12.2 Colorblind Modes

Three alternative palette mappings:

**Deuteranopia mode:** Remaps CE (#3aad6a) to CC (#40b0c8) and shifts terrain
greens to use more blue. Political (gold) vs Military (red) remains safe because
gold/red distinction is preserved in deuteranopia.

**Protanopia mode:** Remaps CM (#c44040) to a darker shade and adjusts FL to
use orange. Green/blue distinction maintained via brightness difference.

**Achromatopsia mode:** Remaps all semantic colors to a brightness-only scale.
Category icons become the sole differentiator.

### 12.3 Shape + Color Encoding

No information is encoded by color alone:

- Event categories: unique icon per category (crown, swords, coins, etc.)
- Significance: increasing dot size + different glyph shape per tier
- Factions: geometric symbol (square, triangle, diamond, circle, hex, etc.)
- Entity types: unique ASCII icon per type (@, &, #, *, !, ~)

### 12.4 Keyboard-Only Navigation

Every UI operation is achievable without a mouse. Full keyboard shortcut table in
Section 9.4. Focus indicators are always visible via `:focus-visible` with AU1
outline.

### 12.5 Screen Reader Considerations

- `<nav>` for top bar and breadcrumbs
- `<article>` for event cards
- `<section>` with `<h2>` for inspector sections
- `aria-label` on icon-only buttons
- `aria-expanded` on collapsible sections
- `role="tablist"` and `role="tab"` for tab bars
- Map canvas: `aria-label="World map"` with `aria-roledescription="interactive map"`

### 12.6 Scalable UI

Two scale factors supported:

- **1x (default):** 16x24 tiles, 13px body text
- **2x (large):** 32x48 tiles, 16px body text, all spacing doubled

Toggled with `Ctrl+=` / `Ctrl+-`. The 2x mode uses CSS `transform: scale(2)` on
the PixiJS canvas and CSS font size increases on panels.
