## 14. World Fingerprint System

### 14.1 Concept

Each generated world develops a unique identity over time. The World Fingerprint captures this identity in a compact visualization letting the player quickly understand a world's character.

### 14.2 Fingerprint Components

**Balance Glyph.** A radial diagram showing relative weight of six historical domains: Warfare, Magic, Religion, Commerce, Scholarship, and Diplomacy. Shape immediately communicates the world's flavor -- war-dominated worlds weight toward Warfare, magic-driven worlds toward Magic.

**Civilization Palette.** Horizontal color bar showing dominant civilizations ordered by historical significance. One-empire worlds are mostly one color. Contested worlds are rainbows.

**Volatility Graph.** Sparkline of conflict intensity over history. Peaks = war eras, valleys = peace. Shape communicates turbulence vs. stability patterns.

**Magic Curve.** Sparkline of magical prevalence over time. Some worlds see magic increase through research; others decline through suppression.

**Population Trend.** Sparkline of total sentient population. Growth = stability, decline = crisis. Sudden drops mark existential events.

**Complexity Score.** Single number (0-100) representing total significant cascades, cross-domain interactions, and narrative arcs. High = rich interconnection, low = linear histories.

### 14.3 Fingerprint Visualization Example

```
WORLD FINGERPRINT: "The Age of Broken Crowns" (Seed: 42)
+----------------------------------------------------------+
|                                                          |
|  BALANCE GLYPH            CIVILIZATION PALETTE           |
|                                                          |
|       Warfare             |███████|████|██|█|            |
|         /\                Iron    Ash- Go- Wd            |
|        /  \               Conf.   veil blin .            |
|  Dipl./    \ Magic                                       |
|      |      |             VOLATILITY (conflict/century)  |
|  Comm.\    / Relig.       ._-^-._--^^--_.--^--_._        |
|        \  /                                              |
|         \/                MAGIC CURVE (prevalence)       |
|      Scholar              .___..---''''''---...___       |
|                                                          |
|  Complexity: 78/100       POPULATION TREND               |
|                           .__--''----..._--''--          |
|                                                          |
+----------------------------------------------------------+
```

### 14.4 Domain Balance Calculations

The WorldFingerprintCalculator scores six domains based on event significance:
- **Warfare:** Sum of Military event significance
- **Magic:** Sum of Magical event significance
- **Religion:** Sum of Religious event significance
- **Commerce:** Sum of Economic event significance
- **Scholarship:** Sum of Scientific + Cultural (research) significance
- **Diplomacy:** Sum of Political event significance

Domain names must match exactly: Warfare, Magic, Religion, Commerce, Scholarship, Diplomacy.

### 14.5 Use Cases

- **World Selection.** Fingerprint gallery for finding interesting worlds. "Show me worlds where magic declined" or "find worlds with high conflict" becomes a visual scan.
- **World Comparison.** Place two fingerprints side by side to see how different parameters produced different histories from the same seed.
- **Personal Collection.** Named, tagged, organized gallery of pocket universes. Players build collections of their favorite emergent histories.
