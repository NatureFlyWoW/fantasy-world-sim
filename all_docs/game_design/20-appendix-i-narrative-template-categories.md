## Appendix I: Narrative Template Categories

The 281 narrative templates are organized across 11 category files, each covering a simulation domain. Every template exists in multiple tone variants (typically 3-5) to support the five narrative voices.

```
TEMPLATE CATEGORY INVENTORY
---------------------------------------------------------------

CHARACTER ACTIONS (66 templates, 22 subtypes x 3 tones)
  befriend, trade, craft_item, study_lore, pray, journey,
  experiment, steal, proselytize, research_spell, enchant_item,
  forage, flee, seek_healing, dream, betray, intimidate,
  show_mercy, negotiate_treaty, forge_alliance, rally_troops,
  plan_campaign

POLITICAL (21 templates, 7 subtypes x 3 tones)
  coronation, coup, diplomatic_crisis, reform,
  succession, treaty, war_declaration

MILITARY (27 templates, 9 subtypes x 3 tones)
  army_movement, battle, campaign, heroic_stand,
  recruitment, retreat, siege, surrender, default

PERSONAL (27 templates, 9 subtypes x 3 tones)
  achievement, betrayal, birth, death, feud,
  friendship, marriage, romance, default

RELIGIOUS (21 templates, 7 subtypes x 3 tones)
  conversion, divine_intervention, holy_war,
  miracle, prophet_emergence, schism, default

ECONOMIC (24 templates, 8 subtypes x 3 tones)
  boom, bust, famine, innovation, monopoly,
  resource_discovery, trade_route, default

DISASTER (21 templates, 7 subtypes x 3 tones)
  earthquake, ecological_collapse, flood,
  magical_blight, plague, volcanic_eruption, default

MAGICAL (24 templates, 8 subtypes x 3 tones)
  artifact_creation, ascension, catastrophe, discovery,
  duel, planar_rift, wild_magic, default

CULTURAL (18 templates, 6 subtypes x 3 tones)
  artistic_movement, language_change, oral_tradition,
  philosophy_school, technology_invention, default

ECOLOGICAL (18 templates, 6 subtypes x 3 tones)
  deforestation, dragon_territory, environmental_degradation,
  resource_depletion, species_extinction, default

SECRET (15 templates, 5 subtypes x 3 tones)
  conspiracy, identity, prophecy, revelation, default

---------------------------------------------------------------

Template Selection: NarrativeEngine selects based on
(eventCategory, eventSubtype, narrativeTone, significance).
Higher significance events use more elaborate templates.
Fallback chain: exact match -> subtype default -> category
default -> generic template.

---------------------------------------------------------------
```
