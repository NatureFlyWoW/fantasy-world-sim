# Context View: Visual Layout Specification

## Table of Contents
1. [Blessed Box Structure](#1-blessed-box-structure)
2. [Header Bar Layout](#2-header-bar-layout)
3. [Section Accordion Pattern](#3-section-accordion-pattern)
4. [Footer Hint Bar](#4-footer-hint-bar)
5. [Entity Name Clickability](#5-entity-name-clickability)
6. [Special Elements](#6-special-elements)
7. [Color Palette](#7-color-palette)
8. [Typography Guide](#8-typography-guide)
9. [Responsive Width Rules](#9-responsive-width-rules)
10. [Blessed Tag Patterns](#10-blessed-tag-patterns)

---

## 1. Blessed Box Structure

The Context View inspector is a single `blessed.Widgets.BoxElement` created by
`BasePanel`. All content is rendered as a flat string[] joined with `\n` and
passed to `setContent()`. There are no nested blessed boxes within the inspector.

### Content Flow

```
+-- BasePanel blessed box (border: 'line') ---------+
|                                                    |  <-- box.setContent(
|   Header Bar (4-5 lines)                          |      lines.join('\n')
|   ==================================== divider    |  )
|   Sections (scrollable region)                    |
|     v [1] Section expanded...                     |
|     > [2] Section collapsed...                    |
|     ...                                           |
|   ----------------------------------------        |
|   Footer Hint Bar (1 line)                        |
+----------------------------------------------------+
```

### Scroll Region

The entire content (header + sections + footer) is built as a string[].
The scroll offset is applied to the section region only. The header and
footer are always visible by being excluded from the scroll window.

**Implementation approach:**

```typescript
const headerLines: string[] = this.renderHeader(...);
const sectionLines: string[] = this.renderSections(...);
const footerLines: string[] = this.renderFooter(...);

const { height } = this.getInnerDimensions();
const footerHeight = footerLines.length;
const headerHeight = headerLines.length;
const scrollableHeight = height - headerHeight - footerHeight;

const visibleSections = sectionLines.slice(
  this.scrollOffset,
  this.scrollOffset + scrollableHeight
);

const allLines = [
  ...headerLines,
  ...visibleSections,
  // pad to push footer to bottom
  ...Array(Math.max(0, scrollableHeight - visibleSections.length)).fill(''),
  ...footerLines,
];

this.setContent(allLines.join('\n'));
```

---

## 2. Header Bar Layout

The header occupies lines 0-4 of the panel content. It provides identity,
orientation, and navigation.

### Structure (5 lines)

```
Line 0:  TYPE_ICON TYPE_LABEL ----------- (rule fills width)
Line 1:  Entity Name, Epithet/Title
Line 2:  One-liner summary            |  Temporal context
Line 3:  < Back   [Crumb > Trail > Here]       Forward >
Line 4:  ============================================= (thick divider)
```

### Line 0: Type + Rule

```typescript
const icon = TYPE_ICONS[entityType];        // '@', '&', '!', '~', '#', '*'
const label = TYPE_LABELS[entityType];      // 'CHARACTER', 'FACTION', etc.
const iconColor = TYPE_COLORS[entityType];  // see Color Palette section
const { width } = this.getInnerDimensions();
const ruleLen = Math.max(0, width - icon.length - label.length - 4);
const rule = '-'.repeat(ruleLen);

line0 = `{${iconColor}-fg}{bold} ${icon} ${label}{/bold}{/} ${rule}`;
```

**Blessed tag pattern:**
```
{#88AAFF-fg}{bold} @ CHARACTER{/bold}{/} ------------------------------------------
```

Each entity type gets a distinctive color on line 0:

| Type      | Icon | Label       | Color     |
|-----------|------|-------------|-----------|
| Character | `@`  | CHARACTER   | `#88AAFF` |
| Faction   | `&`  | FACTION     | `#FF8844` |
| Event     | `!`  | EVENT       | Category  |
| Region    | `~`  | REGION      | `#44CC88` |
| Site      | `#`  | SITE        | `#FFDD00` |
| Artifact  | `*`  | ARTIFACT    | `#FF00FF` |

### Line 1: Entity Name

```typescript
const name = resolvedName;
const epithet = getEpithet(entityId, context);
const nameStr = epithet ? `${name}, ${epithet}` : name;
const truncated = truncateToWidth(nameStr, width - 2);

line1 = `  {bold}${truncated}{/bold}`;
```

**Blessed tag pattern:**
```
  {bold}Thorin Ironhand, the Unyielding{/bold}
```

For entity types without epithets (Event, Region), line 1 shows the
primary title or narrative title instead.

### Line 2: One-liner + Temporal Context

The one-liner sits left-aligned. The temporal context is right-aligned on the
same line, separated by a `|` pipe character. When the combined length exceeds
the panel width, the one-liner is truncated.

```typescript
const temporal = getTemporalContext(entityId, entityType, context);
const temporalLen = stripTags(temporal).length;
const availableForOneliner = width - temporalLen - 7; // 2 indent + 3 separator + 2 pad
const oneliner = truncateToWidth(getSummary(entityId, context), availableForOneliner);
const padding = width - 2 - stripTags(oneliner).length - 3 - temporalLen;

line2 = `  {#aaaaaa-fg}${oneliner}{/}  {#666666-fg}|{/}  {#888888-fg}${temporal}{/}`;
```

**Blessed tag pattern:**
```
  {#aaaaaa-fg}Warlord of the Iron Confederacy{/}  {#666666-fg}|{/}  {#888888-fg}Year 247, Age 63{/}
```

**Temporal context by entity type:**

| Type      | Format                               | Example                    |
|-----------|--------------------------------------|----------------------------|
| Character | `Year N, Age A` or `Deceased Y000`   | `Year 247, Age 63`        |
| Faction   | `Est. Year N (A years)`              | `Est. Year 89 (158 years)`|
| Event     | `Year N, Season` + sig dot           | `Year 231, Spring`        |
| Region    | (none -- regions are timeless)       | --                         |
| Site      | `Pop. N (Size)` or `Founded Year N`  | `Pop. 24,000 (City)`      |

### Line 3: Breadcrumb Navigation

The breadcrumb trail shows the exploration path. Max 4 segments. Each segment
is clickable (colored in ENTITY_NAME_COLOR). The current item is shown in
brackets or bold.

```
  < Back   [World] > Iron Conf... > Thorin > [Betrayal]   Forward >
```

**Layout algorithm:**

```typescript
function renderBreadcrumbs(
  history: readonly NavigationEntry[],
  currentIndex: number,
  maxWidth: number
): { line: string; spans: Array<{ startCol: number; endCol: number; entityId: EntityId }> } {
  const canBack = currentIndex > 0;
  const canForward = currentIndex < history.length - 1;

  const backStr = canBack ? '< Back' : '      ';
  const fwdStr = canForward ? 'Forward >' : '         ';

  // Show last 3 entries + [World] root
  const crumbs: string[] = ['[World]'];
  const startIdx = Math.max(0, currentIndex - 2);
  if (startIdx > 0) crumbs.push('...');

  for (let i = startIdx; i <= currentIndex; i++) {
    const entry = history[i];
    const name = truncateToWidth(resolveEntityName(entry.entityId), 15);
    const isCurrent = i === currentIndex;
    crumbs.push(isCurrent ? `[${name}]` : name);
  }

  const trail = crumbs.join(' > ');
  const available = maxWidth - backStr.length - fwdStr.length - 4;
  const truncatedTrail = truncateToWidth(trail, available);

  // Center the trail between back and forward
  const line = `  ${backStr}   ${truncatedTrail}   ${fwdStr}`;
  return { line, spans: [] }; // spans tracked for clickability
}
```

**Blessed tag pattern:**
```
  {#666666-fg}< Back{/}   {#88AAFF-fg}[World]{/} > {#88AAFF-fg}Iron Conf...{/} > {bold}Thorin{/bold}   {#666666-fg}Forward >{/}
```

**Key visual rules:**
- `< Back` and `Forward >` are dimmed (#666666) when unavailable, bright (#cccccc) when available
- Breadcrumb names are colored in ENTITY_NAME_COLOR (#88AAFF)
- Current entity is bold or in brackets
- `>` separators are dim (#666666)
- `[World]` is always the leftmost crumb

### Line 4: Thick Divider

```typescript
line4 = `{#555555-fg}${'='.repeat(width)}{/}`;
```

**Blessed tag pattern:**
```
{#555555-fg}============================================================{/}
```

---

## 3. Section Accordion Pattern

Sections are the primary content structure. Each section has a header line
that is always visible and a content region that appears when expanded.

### 3.1 Section Header (Collapsed)

```
  > [2] Bonds & Rivalries                          8 relations
```

**Layout algorithm:**

```typescript
function renderSectionHeader(
  section: InspectorSection,
  index: number,
  summaryHint: string,
  width: number
): string {
  const icon = section.collapsed ? '>' : 'v';
  const num = index + 1;
  const title = section.title;

  const prefix = `  ${icon} [${num}] ${title}`;
  const prefixLen = prefix.length;
  const hintLen = summaryHint.length;
  const gapLen = Math.max(2, width - prefixLen - hintLen - 2);
  const gap = ' '.repeat(gapLen);

  return `  {bold}${icon}{/bold} {#888888-fg}[${num}]{/} {bold}${title}{/bold}${gap}{#888888-fg}${summaryHint}{/}`;
}
```

**Blessed tag pattern (collapsed):**
```
  {bold}>{/bold} {#888888-fg}[2]{/} {bold}Bonds & Rivalries{/bold}                  {#888888-fg}8 relations{/}
```

**Blessed tag pattern (expanded):**
```
  {bold}v{/bold} {#888888-fg}[1]{/} {bold}The Story So Far{/bold}                   {#888888-fg}12 events{/}
```

### 3.2 Section Content (Expanded)

Content is indented 4 spaces from the left margin. This creates visual
hierarchy and distinguishes section content from section headers.

```
  v [1] The Story So Far                              12 events
      Born in the mountain-hold of Kazad-dum in Year 184,
      Thorin was the son of Durin the Steadfast and Helga
      Stonesinger. His early years were shaped by the War
      of Broken Passes...

      Key moments:
        ! Y206 Founded the Iron Confederacy
        ! Y231 Betrayed by Azog the Pale
```

**Content indentation:**
- Prose paragraphs: 4 spaces indent
- Sub-headers within sections: 4 spaces + bold
- Data rows: 6 spaces indent (4 + 2 for sub-indent)
- Event timeline items: 6 spaces + `!` prefix
- Blank line between prose paragraph and data

**Blessed tag pattern for section content:**
```
    {#cccccc-fg}Born in the mountain-hold of Kazad-dum in Year 184,{/}
    {#cccccc-fg}Thorin was the son of {/}{#88AAFF-fg}Durin the Steadfast{/}{#cccccc-fg} and{/}
    {#cccccc-fg}Helga Stonesinger.{/}
```

Note: Every entity name within prose MUST have its own tag pair that
closes on the same line. Tags cannot span multiple lines in blessed.

### 3.3 Content Between Sections

A single blank line separates an expanded section's content from the
next section header. Collapsed sections have no blank line between them.

```
  v [1] Expanded Section                            hint
      content line 1
      content line 2

  > [2] Collapsed Section                          hint
  > [3] Another Collapsed                          hint
  v [4] Another Expanded                           hint
      content here...
```

### 3.4 Summary Hints

Summary hints provide at-a-glance information on collapsed sections.
They are right-aligned and dimmed.

| Hint Type       | Format           | Example               | Color     |
|-----------------|------------------|-----------------------|-----------|
| Count           | `N items`        | `8 relations`         | `#888888` |
| Status word     | single word      | `Warlord`             | `#888888` |
| Key value       | `Label: Value`   | `Treasury: 14,200`    | `#888888` |
| Prose snippet   | quoted fragment   | `"Bitter enemies..."` | `#888888` |
| Mini bar        | `[====------]`   | `[====------]`        | `#888888` |

---

## 4. Footer Hint Bar

The footer is pinned to the bottom of the panel. It shows context-sensitive
keyboard hints.

### Structure

```
  ----------------------------------------------------------
  [1-N] Sections  [Bksp] Back  [g] Location  [t] Timeline
```

**Two lines:**
- Line 0: Thin dash divider
- Line 1: Hint text

### Divider Line

```typescript
const divider = `{#444444-fg}${'-'.repeat(width)}{/}`;
```

### Hint Format

Hints use the pattern `[Key] Action` separated by two spaces. Keys are
highlighted, actions are dim.

```typescript
function renderHint(key: string, action: string): string {
  return `{#cccccc-fg}[${key}]{/} {#888888-fg}${action}{/}`;
}
```

**Blessed tag pattern:**
```
  {#cccccc-fg}[1-7]{/} {#888888-fg}Sections{/}  {#cccccc-fg}[Bksp]{/} {#888888-fg}Back{/}  {#cccccc-fg}[g]{/} {#888888-fg}Location{/}
```

### Variants by Entity Type

**Character Inspector:**
```
  [1-7] Sections  [Bksp] Back  [t] Timeline  [g] Location  [b] Bookmark
```

**Faction Inspector:**
```
  [1-8] Sections  [Bksp] Back  [h] Heraldry  [g] Capital  [r] Diplomacy
```

**Event Inspector:**
```
  [1-6] Sections  [Bksp] Back  [c] Cascade  [v] Story  [g] Location
```

**Region Inspector:**
```
  [1-6] Sections  [Bksp] Back  [g] Center map
```

**Site Inspector:**
```
  [1-7] Sections  [Bksp] Back  [g] Center map  [p] Population
```

### Layout Rules

- Hints are left-aligned with 2 spaces of left padding
- If hints exceed panel width, drop rightmost hints
- Always show `[1-N] Sections` and `[Bksp] Back` first (highest priority)
- Type-specific hints come after the universal ones

---

## 5. Entity Name Clickability

Entity names throughout the inspector are rendered as colored, clickable
text spans.

### Visual Rendering

Entity names are rendered in ENTITY_NAME_COLOR (`#88AAFF`), which
provides a clear blue signal against the default `#cccccc` prose text.

```
When justice demanded severity, {#88AAFF-fg}Zhi Yamoto{/} instead offered mercy.
```

### Blessed Tag Pattern

**Single entity in prose:**
```
{#cccccc-fg}When justice demanded severity, {/}{#88AAFF-fg}Zhi Yamoto{/}{#cccccc-fg} instead{/}
{#cccccc-fg}offered mercy to the vanquished {/}{#88AAFF-fg}Goblin Horde{/}{#cccccc-fg}.{/}
```

Critical: Tags MUST close on every line. The above shows how a prose
sentence that wraps across two lines must re-open the `#cccccc` tag on
each line and close it at the end of each line.

**Entity in data row with dotted leader:**
```
  {#88AAFF-fg}@ Thorin Ironhand{/} {#666666-fg}..........{/} {#cccccc-fg}Warlord (Leader){/}
```

**Entity in timeline entry:**
```
  {#888888-fg}!{/} {#666666-fg}Y206{/} {#88AAFF-fg}Founded the Iron Confederacy{/}
```

### Span Tracking

The inspector tracks clickable entity spans using the same pattern as
`EventLogPanel.rightPaneEntitySpans`:

```typescript
private entitySpans: Map<number, Array<{
  startCol: number;
  endCol: number;
  entityId: EntityId;
}>> = new Map();
```

Row numbers are relative to the panel content area (0-based, after
accounting for scroll offset and border).

**Building spans during render:**

```typescript
function addEntitySpan(
  row: number,
  col: number,
  name: string,
  entityId: EntityId,
  spans: Map<number, Array<{ startCol: number; endCol: number; entityId: EntityId }>>
): string {
  const rowSpans = spans.get(row) ?? [];
  rowSpans.push({ startCol: col, endCol: col + name.length, entityId });
  spans.set(row, rowSpans);

  return `{#88AAFF-fg}${name}{/}`;
}
```

### Click Detection

On click, convert screen coordinates to panel-relative coordinates,
then check against the entitySpans map:

```typescript
handleClick(x: number, y: number): boolean {
  const adjustedY = y + this.scrollOffset;
  const spans = this.entitySpans.get(adjustedY);
  if (spans === undefined) return false;

  for (const span of spans) {
    if (x >= span.startCol && x < span.endCol) {
      this.navigateTo(span.entityId);
      return true;
    }
  }
  return false;
}
```

### Tag-Length vs Display-Length

When computing column positions for entity spans, blessed tags must be
stripped to get the actual display column. Use a helper:

```typescript
function stripBlessedTags(str: string): string {
  return str.replace(/\{[^}]*\}/g, '');
}
```

The `startCol` and `endCol` values refer to the visible character
positions after tags are stripped, not the raw string positions.

---

## 6. Special Elements

### 6.1 Progress Bars

Progress bars show numeric values as visual bars within the section
content area.

**Structure:**
```
      Label:  [===============-----] 78%
```

**Blessed tag pattern:**
```
      {#cccccc-fg}Health:{/}  {#44FF88-fg}[==============={/}{#444444-fg}-----]{/} {#cccccc-fg}78%{/}
```

**Color logic for bars:**

| Range   | Bar Color  |
|---------|------------|
| 0-25    | `#FF4444`  |
| 26-50   | `#FF8844`  |
| 51-75   | `#CCCC44`  |
| 76-100  | `#44FF88`  |

**Implementation:**

```typescript
function renderProgressBar(
  label: string,
  value: number,
  maxValue: number,
  barWidth: number = 20
): string {
  const normalized = Math.max(0, Math.min(1, value / maxValue));
  const filledCount = Math.round(normalized * barWidth);
  const emptyCount = barWidth - filledCount;
  const pct = Math.round(normalized * 100);

  const color = pct >= 76 ? '#44FF88' : pct >= 51 ? '#CCCC44' : pct >= 26 ? '#FF8844' : '#FF4444';
  const filled = '='.repeat(filledCount);
  const empty = '-'.repeat(emptyCount);

  return `      {#cccccc-fg}${label}:{/}  {${color}-fg}[${filled}{/}{#444444-fg}${empty}]{/} {#cccccc-fg}${pct}%{/}`;
}
```

**Two-column attribute bars (for Character inspector):**
```
      {#cccccc-fg}STR{/} {#CCCC44-fg}[=====-----------]{/}  {#cccccc-fg}INT{/} {#44FF88-fg}[===============----]{/}
```

### 6.2 Relationship Lists

Relationship entries use a consistent format: icon, name (clickable),
dotted leader, role/label, and optional affinity bracket.

**Structure:**
```
    ALLIES:
      & Iron Confederacy ......... Warlord (leader)     [+82]
      @ Balin Broadshield ........ Trusted Advisor       [+82]
```

**Blessed tag pattern:**
```
    {bold}ALLIES:{/bold}
      {#FF8844-fg}&{/} {#88AAFF-fg}Iron Confederacy{/} {#444444-fg}..........{/} {#cccccc-fg}Warlord (leader){/}     {#44FF88-fg}[+82]{/}
      {#88AAFF-fg}@{/} {#88AAFF-fg}Balin Broadshield{/} {#444444-fg}.........{/} {#cccccc-fg}Trusted Advisor{/}      {#44FF88-fg}[+82]{/}
```

**Icon colors:**
- `@` (character): `#88AAFF`
- `&` (faction): `#FF8844`
- `#` (site): `#FFDD00`
- `~` (region): `#44CC88`

**Affinity colors:**
- Positive (> 0): `#44FF88`
- Negative (< 0): `#FF4444`
- Neutral (0): `#CCCC44`

**Dotted leader algorithm:**

```typescript
function renderDottedLeader(
  leftPart: string,
  rightPart: string,
  totalWidth: number,
  minDots: number = 3
): string {
  const leftLen = stripBlessedTags(leftPart).length;
  const rightLen = stripBlessedTags(rightPart).length;
  const dotsNeeded = Math.max(minDots, totalWidth - leftLen - rightLen - 2);
  const dots = '.'.repeat(dotsNeeded);

  return `${leftPart} {#444444-fg}${dots}{/} ${rightPart}`;
}
```

**Category headers within relationship lists:**
```
    {bold}ALLIES:{/bold}
    {bold}RIVALS:{/bold}
    {bold}FAMILY:{/bold}
    {bold}NEUTRAL:{/bold}
```

### 6.3 Event Timeline Entries

Timeline entries within sections show historical events as clickable items.

**Structure:**
```
      ! Y206 Founded the Iron Confederacy
      ! Y231 Betrayed by Azog the Pale
      ! Y245 Led the Siege of Erebor
```

**Blessed tag pattern:**
```
      {#888888-fg}!{/} {#666666-fg}Y206{/} {#88AAFF-fg}Founded the Iron Confederacy{/}
      {#888888-fg}!{/} {#666666-fg}Y231{/} {#88AAFF-fg}Betrayed by Azog the Pale{/}
```

The entire event description is clickable (navigates to Event Inspector).
The `!` prefix is dim, the year is secondary, and the description is in
ENTITY_NAME_COLOR to signal clickability.

**Significance coloring for events:**

When events appear in timeline context with known significance, the `!`
prefix can be colored by significance:

| Significance | Prefix | Color     |
|-------------|--------|-----------|
| 95+         | `!!!`  | `#FF00FF` |
| 80-94       | `!!`   | `#FF2222` |
| 60-79       | `!`    | `#FF8844` |
| 40-59       | `!`    | `#CCCC44` |
| < 40        | `!`    | `#888888` |

### 6.4 Trait Tags

Compact inline tags for traits, values, and similar short labels.

**Structure:**
```
    Traits:  Cunning  |  Stubborn  |  Ambitious  |  Vengeful
```

**Blessed tag pattern:**
```
    {#cccccc-fg}Traits:{/}  {bold}Cunning{/bold}  {#666666-fg}|{/}  {bold}Stubborn{/bold}  {#666666-fg}|{/}  {bold}Ambitious{/bold}
```

### 6.5 Heraldry Block

The heraldry block uses the existing `renderLargeCoatOfArms` and
`describeCoatOfArms` functions. It is centered within the section
content area.

```
           /\
          /  \
         / ** \
        / *  * \
       /========\
       |  IRON  |
       | HAMMER |
       |________|

    "Azure, a hammer argent between two stars or"
```

The heraldry is rendered by the existing `renderLargeCoatOfArms()`
function. The blazon description from `describeCoatOfArms()` is
shown in italics (dim) below.

### 6.6 Prose Paragraphs

Narrative prose is the primary content in most sections. It wraps to
the available width with 4-space indentation.

**Word-wrap algorithm:**

```typescript
function wrapProse(
  text: string,
  maxWidth: number,
  indent: number = 4
): string[] {
  const effectiveWidth = maxWidth - indent;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= effectiveWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(' '.repeat(indent) + currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(' '.repeat(indent) + currentLine);
  }

  return lines;
}
```

**Important**: When prose contains clickable entity names, the word-wrap
function must be entity-name-aware. Entity names should not be split
across lines. The wrap algorithm should treat `{#88AAFF-fg}name{/}` as a
single unit whose visible length is `name.length`.

---

## 7. Color Palette

All colors are specified as hex strings compatible with blessed tags.

### Entity Type Colors

| Entity Type | Icon Color | Used For                          |
|-------------|------------|-----------------------------------|
| Character   | `#88AAFF`  | @ icon, name in header           |
| Faction     | `#FF8844`  | & icon, name in header           |
| Event       | (varies)   | ! icon uses category color       |
| Region      | `#44CC88`  | ~ icon, name in header           |
| Site        | `#FFDD00`  | # icon, name in header           |
| Artifact    | `#FF00FF`  | * icon, name in header           |

### Text Hierarchy Colors

| Role              | Color     | Blessed Tag             | Usage                     |
|-------------------|-----------|-------------------------|---------------------------|
| Primary text      | `#cccccc` | `{#cccccc-fg}...{/}`    | Prose body, labels        |
| Bright/emphasis   | `#ffffff` | `{bold}...{/bold}`      | Entity name in header     |
| Secondary text    | `#888888` | `{#888888-fg}...{/}`    | Hints, counts, dates      |
| Dim/tertiary      | `#666666` | `{#666666-fg}...{/}`    | Separators, leaders       |
| Very dim          | `#444444` | `{#444444-fg}...{/}`    | Dotted leaders, dividers  |
| Clickable name    | `#88AAFF` | `{#88AAFF-fg}...{/}`    | Any entity name link      |
| Narrative prose   | `#aaaaaa` | `{#aaaaaa-fg}...{/}`    | Longer prose paragraphs   |

### Relationship Affinity Colors

| Affinity   | Color     | Range       |
|------------|-----------|-------------|
| Allied     | `#44FF88` | +50 to +100 |
| Friendly   | `#88DD88` | +20 to +49  |
| Neutral    | `#CCCC44` | -19 to +19  |
| Unfriendly | `#FF8844` | -50 to -20  |
| Hostile    | `#FF4444` | -100 to -51 |

### Significance Colors (from theme.ts)

| Level     | Color     | Range  |
|-----------|-----------|--------|
| Trivial   | `#666666` | 0-19   |
| Minor     | `#888888` | 20-39  |
| Moderate  | `#CCCC44` | 40-59  |
| Major     | `#FF8844` | 60-79  |
| Critical  | `#FF2222` | 80-94  |
| Legendary | `#FF00FF` | 95-100 |

### Category Colors (from theme.ts)

| Category    | Color     |
|-------------|-----------|
| Political   | `#FFDD44` |
| Military    | `#FF4444` |
| Magical     | `#CC44FF` |
| Cultural    | `#44DDFF` |
| Religious   | `#FFAAFF` |
| Economic    | `#44FF88` |
| Personal    | `#88AAFF` |
| Disaster    | `#FF6600` |
| Scientific  | `#00FFCC` |
| Exploratory | `#88FF44` |

---

## 8. Typography Guide

Blessed supports a limited set of text formatting via tags.

### Available Styles

| Style      | Tag                    | Usage                                |
|------------|------------------------|--------------------------------------|
| Bold       | `{bold}...{/bold}`     | Headers, entity names, emphasis      |
| Underline  | `{underline}...{/}`    | Rarely used (poor terminal support)  |
| Inverse    | `{inverse}...{/}`      | Flash effect on navigation           |
| Dim        | No native tag          | Use dim colors instead               |

### Hierarchy Levels

```
Level 1: {bold} + colored icon       -- Type label line (@ CHARACTER)
Level 2: {bold}                      -- Entity name in header
Level 3: {bold}                      -- Section titles
Level 4: {#cccccc-fg}               -- Primary prose text
Level 5: {#888888-fg}               -- Secondary info (hints, counts)
Level 6: {#666666-fg}               -- Tertiary info (separators)
Level 7: {#444444-fg}               -- Structural elements (dots, rules)
```

### When to Use Bold

- Entity name on line 1 of the header
- Section titles (both expanded and collapsed)
- Category headers within sections (ALLIES:, RIVALS:, etc.)
- Key data labels (Population:, Government:, etc.)
- Trait tags
- The type icon + label on line 0

### When NOT to Use Bold

- Prose body text (use #cccccc instead)
- Entity names within prose (use #88AAFF color, no bold)
- Summary hints (use #888888 dim)
- Footer hint actions (use #888888)
- Dotted leaders (use #444444)

---

## 9. Responsive Width Rules

The inspector panel width varies depending on the layout preset and
terminal size.

### Width Ranges

| Range         | Width      | Typical Layout            |
|---------------|------------|---------------------------|
| Minimum       | 40 chars   | Very narrow split         |
| Compact       | 50 chars   | Log-focus layout          |
| Standard      | 60 chars   | Default layout            |
| Comfortable   | 70 chars   | Narrative layout          |
| Wide          | 80+ chars  | Map-focus (inspector wide)|

### Truncation Rules

When content exceeds available width, truncation is applied in this
priority order (highest priority = last to truncate):

1. **Entity names in header** (line 1): Truncate with `...` at width - 4
2. **One-liner summary** (line 2): Truncate when temporal context is present
3. **Temporal context** (line 2): Never truncated (it is compact by design)
4. **Breadcrumb segments**: Truncate names to 15 chars, then 10, then 8
5. **Section titles**: Never truncated (they are short by design)
6. **Summary hints**: Truncated or hidden if section title is long
7. **Prose text**: Re-wrapped to new width
8. **Dotted leaders**: Minimum 3 dots, reduce gap if needed
9. **Progress bar width**: Scale from 20 down to 10 at minimum
10. **Footer hints**: Drop rightmost hints that don't fit

### Width-Specific Adaptations

**At 40-49 chars (minimum):**
- Progress bar width: 10 characters
- Dotted leaders: minimum 3 dots
- Two-column attribute bars become single-column
- Breadcrumbs show only [World] > Current
- Footer shows only [1-N] and [Bksp]

**At 50-59 chars (compact):**
- Progress bar width: 15 characters
- Dotted leaders: 5+ dots
- Attribute bars: single column
- Breadcrumbs: 3 segments max
- Footer: 3-4 hints

**At 60-69 chars (standard):**
- Progress bar width: 20 characters
- Dotted leaders: natural width
- Attribute bars: two-column layout
- Breadcrumbs: 4 segments
- Footer: all hints

**At 70+ chars (comfortable):**
- Full layout, no truncation needed
- Prose wraps naturally
- All elements at full size

### Implementation

```typescript
function getWidthClass(width: number): 'minimum' | 'compact' | 'standard' | 'comfortable' {
  if (width < 50) return 'minimum';
  if (width < 60) return 'compact';
  if (width < 70) return 'standard';
  return 'comfortable';
}

function getBarWidth(panelWidth: number): number {
  if (panelWidth < 50) return 10;
  if (panelWidth < 60) return 15;
  return 20;
}

function getMaxBreadcrumbs(panelWidth: number): number {
  if (panelWidth < 50) return 2;
  if (panelWidth < 60) return 3;
  return 4;
}
```

---

## 10. Blessed Tag Patterns

### Tag Safety Rules

1. **Close every tag on every line.** Blessed counts characters including
   tags for layout. Unclosed tags corrupt line length calculations.

   WRONG:
   ```
   {#88AAFF-fg}Thorin went to
   the mountain{/}
   ```

   RIGHT:
   ```
   {#88AAFF-fg}Thorin went to{/}
   {#88AAFF-fg}the mountain{/}
   ```

2. **Use `{/}` to close the most recent tag.** For nested tags, close
   inner first:

   ```
   {bold}{#FF8844-fg}& FACTION{/}{/bold}
   ```

   Note: In practice, `{/}` closes all open tags in blessed, so a single
   `{/}` at end of a segment is often sufficient if you are not nesting.

3. **Avoid tag nesting when possible.** Instead of nesting color inside
   bold, close bold first and re-open:

   ```
   {bold}ALLIES:{/bold}
   ```

4. **Strip tags before measuring display width.** When computing column
   positions for entity spans or truncation:

   ```typescript
   const displayLen = str.replace(/\{[^}]*\}/g, '').length;
   ```

5. **ASCII-safe characters for panel borders and mockups:**
   - Panel borders: `+`, `-`, `|` (handled by blessed border: 'line')
   - Thick divider: `=` repeated
   - Thin divider: `-` repeated
   - Collapse/expand icons: `>` and `v` (ASCII, not Unicode arrows)
   - Section number brackets: `[1]` through `[9]`
   - Dotted leaders: `.` repeated
   - Progress bar: `=` (filled) and `-` (empty), wrapped in `[` `]`

   Note: The actual blessed rendering uses Unicode characters from the
   existing codebase (arrows, block characters, etc.) but mockups in
   documentation use ASCII equivalents for portability.

### Common Tag Patterns Reference

```
-- Header type label --
{#88AAFF-fg}{bold} @ CHARACTER{/bold}{/} ---------

-- Header entity name --
  {bold}Thorin Ironhand, the Unyielding{/bold}

-- Header one-liner --
  {#aaaaaa-fg}Warlord of the Iron Confederacy{/}  {#666666-fg}|{/}  {#888888-fg}Year 247, Age 63{/}

-- Breadcrumb --
  {#888888-fg}< Back{/}   {#88AAFF-fg}[World]{/} {#666666-fg}>{/} {#88AAFF-fg}Iron Conf...{/} {#666666-fg}>{/} {bold}Thorin{/bold}   {#888888-fg}Forward >{/}

-- Thick divider --
{#555555-fg}============================================================{/}

-- Section header (expanded) --
  {bold}v{/bold} {#888888-fg}[1]{/} {bold}The Story So Far{/bold}                   {#888888-fg}12 events{/}

-- Section header (collapsed) --
  {bold}>{/bold} {#888888-fg}[3]{/} {bold}Bonds & Rivalries{/bold}                  {#888888-fg}8 relations{/}

-- Prose with clickable name --
  {#cccccc-fg}Born in Year 184 to {/}{#88AAFF-fg}Durin the Steadfast{/}{#cccccc-fg}, Thorin's{/}
  {#cccccc-fg}youth was forged in the fires of war.{/}

-- Data row with dotted leader --
      {#88AAFF-fg}@ Thorin Ironhand{/} {#444444-fg}..........{/} {#cccccc-fg}Warlord (Leader){/}     {#44FF88-fg}[+82]{/}

-- Progress bar --
      {#cccccc-fg}Stability:{/}  {#CCCC44-fg}[=============------]{/} {#cccccc-fg}72%{/}

-- Timeline event --
      {#FF8844-fg}!{/} {#666666-fg}Y206{/} {#88AAFF-fg}Founded the Iron Confederacy{/}

-- Footer divider --
{#444444-fg}------------------------------------------------------------{/}

-- Footer hints --
  {#cccccc-fg}[1-7]{/} {#888888-fg}Sections{/}  {#cccccc-fg}[Bksp]{/} {#888888-fg}Back{/}  {#cccccc-fg}[g]{/} {#888888-fg}Location{/}
```

---

## Appendix A: Type Definitions

```typescript
/** Entity type icon mapping */
const TYPE_ICONS: Record<InspectableEntityType, string> = {
  character: '@',
  faction: '&',
  event: '!',
  region: '~',
  location: '#',
  artifact: '*',
  unknown: '?',
};

/** Entity type label mapping */
const TYPE_LABELS: Record<InspectableEntityType, string> = {
  character: 'CHARACTER',
  faction: 'FACTION',
  event: 'EVENT',
  region: 'REGION',
  location: 'SITE',
  artifact: 'ARTIFACT',
  unknown: 'UNKNOWN',
};

/** Entity type color mapping */
const TYPE_COLORS: Record<InspectableEntityType, string> = {
  character: '#88AAFF',
  faction: '#FF8844',
  event: '#FFDD44',  // default; use category color when available
  region: '#44CC88',
  location: '#FFDD00',
  artifact: '#FF00FF',
  unknown: '#888888',
};
```

## Appendix B: Prose Lookup Tables (New)

These tables support the prose-first design. Each maps a state category
to atmospheric text.

```typescript
const HEALTH_PROSE: Record<string, string> = {
  perfect:  'is in the prime of health',
  healthy:  'bears no significant wounds',
  injured:  'nurses injuries from recent conflict',
  wounded:  'suffers from grievous wounds',
  critical: 'clings to life by a thread',
  dead:     'has passed beyond the veil',
};

const PERSONALITY_AXIS: Record<string, [string, string]> = {
  openness:          ['traditional and set in their ways', 'endlessly curious and open to new ideas'],
  conscientiousness: ['free-spirited and spontaneous', 'methodical and disciplined'],
  extraversion:      ['reserved and introspective', 'gregarious and commanding'],
  agreeableness:     ['sharp-tongued and confrontational', 'gentle and accommodating'],
  neuroticism:       ['unnervingly calm under pressure', 'prone to anxiety and dark moods'],
};

const SETTLEMENT_SIZE_PROSE: Record<string, string> = {
  Hamlet:       'A scattering of homes clustered together',
  Village:      'A modest village where everyone knows their neighbor',
  Town:         'A bustling town at the crossroads of trade',
  City:         'A city of consequence, its walls marking ambition in stone',
  'Large City': 'A great city whose name is known across the realm',
  Metropolis:   'A vast metropolis, teeming with life and intrigue',
};

const RELATION_CATEGORY_LABELS: Record<string, string> = {
  family:   'FAMILY',
  ally:     'ALLIES',
  rival:    'RIVALS',
  neutral:  'ACQUAINTANCES',
  vassal:   'VASSALS',
  overlord: 'OVERLORDS',
};

const MILITARY_STATE_PROSE: Record<string, string> = {
  peaceful:   'swords rest in their sheaths',
  mobilizing: 'armies muster and march',
  at_war:     'blood and fire consume the frontier',
  victorious: 'banners fly in triumph',
  defeated:   'the realm licks its wounds',
};

const ECONOMIC_STATE_PROSE: Record<string, string> = {
  destitute:   'coffers echo with emptiness',
  poor:        'the treasury stretches thin',
  modest:      'modest wealth sustains the realm',
  comfortable: 'prosperity flows through the markets',
  wealthy:     'gold flows freely in the counting houses',
  opulent:     'wealth beyond measure fills the vaults',
};
```
