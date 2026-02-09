## 10. Animation & Motion

### 10.1 What Animates and Why

Animation in Aetherum is restrained. The game is about centuries passing -- not about
moment-to-moment action. Animation serves three purposes:

1. **Aliveness:** Water tiles shimmer. This tells the player the world is running.
2. **Attention:** Legendary events pulse. This draws the eye to important events.
3. **Feedback:** Panels respond. This confirms the player's actions.

### 10.2 World Animations (PixiJS Canvas, 15fps Update Rate)

**Water shimmer:** Ocean and coast tiles cycle between two glyph variants every
2 seconds. The glyph swaps (e.g., `~` to `approx` to `~`), keeping the same
palette colors. Hard frame cuts, no smooth interpolation.

```
Frame 0 (0-59 at 15fps):    ~ glyph in TS (#2868a0)
Frame 1 (60-119):           approx glyph in TS (#2868a0)
Repeat.
```

**Lava pulse:** Volcano tiles cycle the primary glyph color between FL (#e04020)
and AU2 (#c9a84c) every 1.5 seconds. A hard cut, not a fade.

**Magic shimmer:** Magic Wasteland tiles and ley line overlays cycle between FM
(#9040cc) and CR (#b87acc) every 3 seconds.

**Flag waving:** Capital markers cycle between two glyph variants (flag-left,
flag-right) every 1 second.

### 10.3 UI Animations (CSS, 60fps)

**Event card entry:** New cards slide in from the top:

```css
@keyframes card-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 200ms ease-out */
```

**Legendary pulse:** The significance indicator for legendary events pulses:

```css
@keyframes legendary-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1.0; }
}
/* Duration: 2s, infinite */
```

No `box-shadow` glow -- just opacity change, keeping within the palette constraint.

**Panel transitions:** When switching layouts, panels resize over 200ms `ease-out`.
Content redraws after transition completes (no reflow during animation).

**Tab switch:** Content fades in over 100ms when switching tabs.

**Section collapse:** Content `max-height` transition over 200ms ease.

**All hover transitions:** 150ms ease, uniform across the interface.

### 10.4 Loading States

During world generation, a hourglass glyph from the UI atlas rotates through 4
frames at 250ms intervals. Accompanied by text with animated dots:

```
Generating world...
Generating world.
Generating world..
Generating world...
(500ms per dot, cycling)
```

### 10.5 Simulation Speed Visual Feedback

The speed indicator in the top bar changes color based on simulation speed:

| Speed | Color | Label |
|---|---|---|
| Paused | CM #c44040 | `PAUSED` |
| Slow Motion | N1 #585860 | `0.5x` |
| Normal | N2 #8a8a90 | `1x` |
| Fast 7 | AU1 #8b6914 | `7x` |
| Fast 30 | AU2 #c9a84c | `30x` |
| Fast 365 | CP #d4a832 | `365x` |
| Ultra Fast | FM #9040cc | `3650x` |

The active speed button gets AU1 (#8b6914) background with BG0 text. The pause
button when active gets CM (#c44040) background.
