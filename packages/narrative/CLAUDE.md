# @fws/narrative

Event-to-prose transformation. 281+ templates, 5 tones, chronicler system, vignettes.

## Directory Layout
- `src/templates/` — 11+ category files + types.ts + index.ts (template registry)
- `src/templates/types.ts` — NarrativeTemplate, TemplateVariable, requiredContext
- `src/chronicler/` — Chronicler (unreliable narrator), BiasFilter, LostHistoryTracker
- `src/transforms/` — NarrativeEngine (template matching + rendering), TemplateParser
- `src/vignettes/` — VignetteGenerator (rare scenes, significance >85), triggers, introspection
- `src/styles/tones.ts` — 5 tone definitions (Epic, Personal, Mythological, Political, Scholarly)

## Conventions
- Template subtypes: simulation emits prefixed (`culture.technology_invented`), templates use simple (`technology_invented`)
- `requiredContext` refers to `event.data` fields, NOT entity types
- character-actions.ts templates: `requiredContext: []` not `['character']`
- NarrativeEngine produces NarrativeOutput: { title, body, tone, templateId }
- Templates support conditional blocks: `{#if event.data.FIELD}...{/if}`
- Template variables: `{character.name}`, `{target.name}`, `{site.name}` etc.
