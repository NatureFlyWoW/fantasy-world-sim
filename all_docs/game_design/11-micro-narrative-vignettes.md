## 11. Micro-Narrative Vignettes

Beyond the chronicle-style log, the simulator occasionally produces small, intimate scene fragments -- moments of fiction that bring characters to life in a way summary prose cannot.

### 11.1 Design Philosophy

Vignettes are rare by design. Target frequency: approximately one per 50-100 simulation years (tunable). Their rarity makes each feel like a discovered treasure -- a moment where the curtain between simulation and story lifts.

### 11.2 Trigger Conditions

A vignette generates when ALL of these are met:
- Significance score above 85
- At least one participant has rich memory history (10+ significant memories)
- The event involves strong emotional content (betrayal, triumph, sacrifice, reunion, discovery)
- No vignette generated in the last 50 simulation years (cooldown)

### 11.3 Vignette Structure

Each vignette is a short prose fragment (200-500 words) written in present tense, close third-person perspective. It does not explain context -- it drops the reader into a moment and trusts the simulation has provided enough context through the event log and inspector.

**Example -- The General Before Battle:**

```
+------------------------------------------------------+
|  A MOMENT IN TIME -- Year 1247, Day of the Red Dawn  |
+------------------------------------------------------+

The tent flap does not move. The wind has died, as if
the world itself holds its breath before what is to come.

General Kaelin Stormhold stands over the map table, but
her eyes are not reading the terrain lines or the painted
markers representing ten thousand soldiers. She is looking
at the small iron ring on her left hand -- the one her
mother wore, the one her mother's mother wore before the
Valmont treachery took their ancestral seat three
generations past.

Tomorrow she will face the Valmont host across the
Ashenmere. They will have the high ground. They will have
the sun at their backs. They will have numbers.

She has something else.

She touches the ring, and somewhere in the archives of
memory -- her mother's voice, her grandmother's fury, a
hundred years of waiting -- she finds the thing she needs.

Not courage. Not strategy. Not divine favor.

Certainty.

She calls for her captains.

+------------------------------------------------------+
```

This vignette connects to the Memory system (inherited grudge), the Military system (upcoming battle), and the Character AI (personality-driven certainty). It draws power from context the simulation has been building for generations.

### 11.4 Vignette Categories

- **Before the Storm.** A leader contemplating a world-changing decision. Tone: tense, reflective.
- **The Discovery.** A scholar encountering something beyond understanding. Tone: awe, wonder.
- **The Confrontation.** Two characters with deep history facing each other. Tone: loaded silence.
- **The Legacy.** A child hearing about events the player witnessed. Tone: nostalgia.
- **The Farewell.** A character at the end of their life. Tone: peaceful or bitter.
- **The Betrayal.** The moment trust breaks. Tone: sharp, visceral.
- **The Coronation.** Taking on a defining role. Tone: weight, expectation.
- **The Aftermath.** Surveying consequences of a major event. Tone: shell-shock.

### 11.5 Character Introspection

A related system provides first-person reflections. When the player inspects a character, the introspection system generates a brief internal monologue reflecting the character's current emotional state, active goals, and recent memories. Unlike vignettes (which are rare, narrative moments), introspection is available on demand but is less literary -- it reads more like overheard thoughts than crafted prose.

**Example -- Introspection of a conflicted advisor:**

```
"The king trusts me. I have earned that trust over
twenty years. But his latest decree -- taxing the
border provinces to fund his obsession with the Eastern
Campaign -- I cannot support this. The provinces are
already restless. Lord Aldren's letters grow more
pointed each month. I know what he is building toward,
even if the king does not see it.

I should warn him. I should...

But if I speak against the campaign, I lose my seat
at the table. And without me at the table, who will
temper his worst impulses?"
```

This introspection is generated from: Goal (serve faction vs. moral duty), Relationship (king loyalty 60, Aldren relationship 45), Memory (twenty years of service), Personality (high conscientiousness, moderate neuroticism). The text is assembled from fragments, not hand-written -- but the fragments are rich enough to feel personal.
