## 7. Memory and Reputation

This system transforms characters from reactive decision-makers into beings with persistent inner lives. It is the foundation for grudges, gratitude, learning from experience, and the rich personal histories that make characters feel real.

### 7.1 Memory Architecture

Every named character maintains a Memory Store -- an ordered collection of memory records, each representing a significant experience.

```
MEMORY RECORD
---------------------------------------------------------------
eventId:        EventId        // The original event
timestamp:      WorldTime      // When it happened
emotionalWeight: number        // -100 (traumatic) to +100 (joyful)
significance:   number         // 0-100, how important
participants:   EntityId[]     // Who was involved
myRole:         MemoryRole     // Actor, target, or witness
category:       MemoryCategory // Betrayal, kindness, loss, triumph...
accuracy:       number         // 0-100, how accurately remembered
timesRecalled:  number         // How often accessed
lastRecalled:   WorldTime      // When last accessed
narrative:      string         // Character's subjective version
---------------------------------------------------------------
```

**Memory Formation Rules:** Not every event becomes a memory. Formation requires direct involvement (actor, target, or witness) and exceeding a significance threshold modified by personality. Empathetic characters form memories from witnessing suffering. Self-absorbed characters only remember events affecting them directly. Ambitious characters remember power dynamics.

### 7.2 Memory Decay and Distortion

Memories decay over time -- significance slowly decreases, and low-significance memories are eventually pruned. However, highly emotional memories resist decay. A traumatic betrayal (emotional weight -90) stays vivid for a lifetime. A pleasant dinner party (+20) fades within years.

More critically, **memories distort**. Each time a memory is recalled (when the character encounters a related situation or person), accuracy can decrease. Details shift, emotions intensify, blame is redistributed. A character partly responsible for a failed battle might, after years, remember the failure as entirely their rival's fault.

This distortion is the engine powering grudges, heroic self-narratives, and the divergence between what "actually happened" (the event log) and what a character "remembers" (their memory store).

### 7.3 Reputation System

Reputation is the social mirror of memory -- what others believe about a character.

**Propagation chain:**
1. Character performs action (event generated)
2. Witnesses form memories (with their own bias)
3. Witnesses share with contacts (distortion chance per hop)
4. Recipients share further (further distortion)
5. After N hops, the story may differ significantly from reality

**Propagation speed depends on:** social network density (court gossip spreads fast, rural news slow), story significance, existing reputation, and trade/communication infrastructure.

**Six Reputation Dimensions** (each valued separately per observing faction):
- Martial (combat prowess, military victories)
- Diplomatic (trustworthiness, negotiation skill)
- Scholarly (knowledge, discoveries, teaching)
- Moral (virtue/villainy, colored by observer's moral framework)
- Magical (power, feats, artifacts created)
- Leadership (faction performance, crisis management)

A character might have high Scholarly and Magical reputation everywhere, but Moral reputation of "terrifying villain" in most kingdoms and "misunderstood genius" among apprentices.

### 7.4 Generational Grudges

When a character dies, their most emotionally significant memories are partially inherited by close family:

```
GRUDGE INHERITANCE
---------------------------------------------------------------
Generation 1 (direct experience):   100% emotional weight
Generation 2 (parent's story):       60% emotional weight
Generation 3 (grandparent):          30% emotional weight
Generation 4 (great-grandparent):    10% emotional weight
Generation 5+: Fades to cultural memory
---------------------------------------------------------------
```

**Grudge Refreshing:** If the target family/faction performs a new hostile action, the grudge resets to the higher of the new event's intensity or the inherited intensity.

**Grudge Resolution:** Apology/reparation, intermarriage, shared threats, passage of time, or the "forgiving" personality trait.

**Cultural Memory:** When a grudge fades below individual significance but was historically important, it transitions to cultural memory -- a background bias with lower intensity but much longer duration.

### 7.5 False Memories and Propaganda

**Organic Distortion.** Natural memory degradation over time.

**Deliberate Propaganda.** Faction leaders can create false narratives. A usurper's historians rewrite the previous king as a tyrant. A religious order rewrites a saint's history.

**In-World Historians.** When a historian character writes a book, the account is filtered through their biases. A historian employed by Kingdom A portrays Kingdom A favorably. This produces contradictory historical accounts within the simulation, which the Unreliable Chronicler system surfaces to the player.

### 7.6 The Dreaming Layer

Beyond conscious decisions, characters have a subconscious Dreaming Layer that processes experiences during "sleep." Dreams can:
- Resolve conflicting goals (reducing internal stress)
- Reinforce fears (increasing anxiety-related behavior)
- Generate creative inspiration (research breakthroughs)

The player's "prophetic dream" influence action works by inserting content into this layer, processed as if it were natural.
