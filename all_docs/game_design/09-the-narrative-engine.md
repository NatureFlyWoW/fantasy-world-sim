## 9. The Narrative Engine

The Narrative Engine transforms raw simulation events into readable, atmospheric prose. It operates on a template-based system augmented with contextual variation, literary device insertion, and tone control.

### 9.1 Template Architecture

The engine contains **281 templates across 11 category files**:

| Category File | Template Count | Covers |
|---------------|---------------|--------|
| political.ts | ~40 | Succession, diplomacy, governance, rebellion |
| military.ts | ~35 | Battles, sieges, wars, armies, conquest |
| economic.ts | ~25 | Trade, markets, resource, treasury |
| cultural.ts | ~30 | Technology, art, philosophy, traditions |
| religious.ts | ~30 | Faith, schisms, miracles, temples |
| magical.ts | ~25 | Research, artifacts, catastrophes, anomalies |
| personal.ts | ~25 | Birth, death, marriage, rivalry |
| character-actions.ts | ~30 | Individual character decisions, achievements |
| disaster.ts | ~15 | Natural disasters, plagues, famine |
| scientific.ts | ~15 | Discoveries, inventions, knowledge |
| exploratory.ts | ~11 | Exploration, discovery (no system yet) |

Each template is parameterized with:
- **Entity references:** `{character.name}`, `{faction.name}`, `{site.name}` -- automatically resolved from entity state
- **Pronoun handling:** `{pronoun.subject}`, `{pronoun.object}`, `{pronoun.possessive}` -- correctly gendered
- **Conditional sections:** `{#if condition}...{/if}` -- include/exclude based on world state
- **Tone variants:** Templates exist in multiple tone variants
- **Significance scaling:** Low-significance events get brief templates. High-significance events get dramatic, literary templates with metaphor and foreshadowing

### 9.2 The Five Narrative Tones

The player selects a narrative tone governing template selection and prose style:

**Epic Historical.** Grand, sweeping language. "The realm mourned," "destiny would decree," "an age of darkness descended." Characters described by roles and epithets. The "narrator reading from a history book" voice.

**Personal Character Focus.** Intimate, character-driven. "She felt the weight of the crown," "he could not forgive what had been done." Events filtered through the perspectives of people who lived them.

**Mythological.** Ancient, reverent. "In the Time Before Time," "forged in celestial fire," "prophecy speaks of a reckoning." Events as legend, amplifying grandeur and stripping mundane detail.

**Political Intrigue.** Analytical, suspicious. "Observers noted the conspicuous absence," "intelligence suggests deeper currents," "the real negotiations happened behind closed doors." Every event as a chess move.

**Scholarly.** Dry, academic. "Evidence suggests," "the primary factor was," "contrary to popular belief." Events as subjects of study rather than drama.

### 9.3 Literary Device Integration

The engine inserts literary devices creating the texture of real storytelling:

**Foreshadowing.** When the engine detects a "rising action" arc, it adds hints in earlier events. Describing a magic academy's founding, it might add "none could foresee the horrors this pursuit of knowledge would eventually unleash" if it knows the cascade leads to catastrophe.

**Dramatic Irony.** When the player knows something a character does not, the engine highlights the gap: "placing his trust in the very man who would betray him three years hence."

**Metaphor Selection.** Templates include metaphor slots filled from context-appropriate pools. Death in winter draws cold/sleep metaphors. Political rise draws climbing/height metaphors.

**Callback and Echo.** When current events mirror historical ones: "Like the first Valmont who defied a king, so too did his great-granddaughter stand before the throne and refuse to kneel."

### 9.4 Template Example: The Same Event in Five Tones

Consider the event: "King Aldric III of Valoria died of old age, succeeded by his daughter Queen Mira."

**Epic Historical:**
> "And so passed Aldric the Steadfast, third of his name, whose reign of forty years had seen the kingdom of Valoria rise from provincial obscurity to continental power. The crown passed to his daughter Mira, who would inherit both her father's throne and the web of alliances he had so carefully woven."

**Personal Character Focus:**
> "Mira knelt beside the bed where her father lay still. His hand was cold in hers. She had known this day would come -- had prepared for it, as he had taught her to prepare for everything. But preparation could not quiet the hollowness in her chest as the chamberlain gently placed the crown upon her head."

**Mythological:**
> "The Silver King returned to the earth from which all mortals spring. His spirit passed through the Veil as the sun set over Valoria, and in the same hour, the stars shifted to mark the ascension of the Moon Queen, whose destiny had been written in the heavens since her birth."

**Political Intrigue:**
> "Aldric's death, though long anticipated by the court, set in motion a delicate succession. Queen Mira's position, while legitimate by law, was not uncontested -- her uncle's faction had been quietly building support for months, and the transfer of power would prove far less smooth than the official proclamations suggested."

**Scholarly:**
> "The death of Aldric III (Year 247, aged 73) concluded a 40-year reign characterized by diplomatic expansion and economic modernization. His successor, Queen Mira (aged 31), represented the first female monarch in Valorian history, a development that contemporary chronicles attribute to Aldric's progressive reforms of Year 230."

### 9.5 Entity Reference Resolution

Entity names within narrative prose are resolved through an EntityResolver chain:
1. Character resolution (by CharacterId)
2. Faction resolution (by FactionId)
3. Site resolution (by SiteId)
4. Artifact resolution (by ArtifactId)
5. World-based fallback via Status component (for armies, institutions)

The resolver produces both plain-text names for prose and clickable names (colored `#88AAFF`) for the interactive UI.

### 9.5 Significance-Based Elaboration

Events receive different narrative treatment based on significance:

| Significance | Treatment |
|-------------|-----------|
| 0-19 (Trivial) | Aggregated into summary batches by category |
| 20-39 (Minor) | One-line log entry |
| 40-59 (Moderate) | Short narrative paragraph |
| 60-79 (Major) | Full narrative with context |
| 80-94 (Critical) | Extended prose with literary devices |
| 95-100 (Legendary) | Maximum prose, auto-pause, vignette trigger |
