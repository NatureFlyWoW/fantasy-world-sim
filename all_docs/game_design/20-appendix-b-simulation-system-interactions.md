## Appendix B: Simulation System Interactions

```
SYSTEM INTERACTION MAP
---------------------------------------------------------------

     Environment
         |
    [weather, resources]
         |
    Economy ---------> Military
    [supply, trade]    [armies, war]
         |                  |
         v                  v
    Politics <-----------> Military
    [stability, law]   [territory, reparations]
         |                  |
         v                  v
    Social             Character AI
    [reputation,       [decisions, goals,
     relationships]     personality]
         |                  |
         v                  v
    Cultural           Magic
    [technology,       [research, artifacts,
     art, philosophy]   catastrophes]
         |                  |
         v                  v
    Religion           Ecology
    [faith, schisms,   [fauna, flora,
     divine power]      resource cycles]
         |                  |
         +-------->---------+
                   |
              Event Resolution
              [cascade engine,
               significance scoring]
                   |
              Narrative Generation
              [templates, tones,
               chronicler filtering]

---------------------------------------------------------------

All arrows represent communication through the EVENT QUEUE
and SHARED COMPONENT STATE. Systems never reference each
other directly.
```
