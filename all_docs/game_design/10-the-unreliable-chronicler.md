## 10. The Unreliable Chronicler

### 10.1 Concept

The simulation does not have a single objective narrator. The raw event log provides ground truth, but narrative prose is always filtered through an in-world chronicler whose biases, allegiances, and personality color their reporting. The player can switch chroniclers to see events from different perspectives, discovering that history is contested narrative, not fixed truth.

### 10.2 Chronicler Properties

Chroniclers are special character entities with:
- **Faction Allegiance.** Events involving their faction are presented favorably.
- **Ideological Bias.** A militarist emphasizes warfare and heroism. A religious chronicler interprets through theology. A humanist focuses on individual stories.
- **Knowledge Limitation.** A chronicler in Kingdom A may lack accurate information about distant Kingdom B.
- **Personal Grudges and Admiration.** Personal experiences color portrayals.
- **Writing Style.** Each has distinct prose style -- flowery and metaphor-heavy, terse and factual, sardonic and critical.

### 10.3 The Bias Filter

The ChroniclerBiasFilter modifies base narrative in several ways:

**Faction Spin.** Battle loss becomes "strategic withdrawal." War of aggression becomes "just campaign to protect our borders." Rival achievements are downplayed.

**Omission.** Embarrassing events may simply not appear. Gaps in one chronicler's account are present in another's.

**Attribution Shift.** Credit shifts toward favored individuals. Blame shifts toward outsiders and scapegoats.

**Tone Adjustment.** The same siege: "the valiant defense of our sacred capital" vs. "the desperate stand of a tyrant clinging to stolen power."

### 10.4 Player Interaction with Chroniclers

- **Switch Chroniclers.** UI dropdown selects from available chroniclers. Narrative updates to reflect the selected perspective.
- **Compare Accounts.** Split view shows the same event from two chroniclers, highlighting divergences.
- **View Raw Record.** The objective event log is always available as ground truth.
- **Commission New Chroniclers.** Using influence points, the player can inspire a character to become a chronicler.

### 10.5 Lost History

If all chroniclers who recorded an event die without passing their works to a library or successor, the detailed narrative is "lost." The raw event log retains the data, but the narrative panel shows only a bare summary: "Detailed accounts of this event have been lost to time."

If a later historian rediscovers lost texts, narratives are restored -- potentially with new biases from the rediscoverer's interpretation. The player watches history being literally rewritten.
