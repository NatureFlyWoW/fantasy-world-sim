## Appendix C: The Cascade Chain Anatomy

A single event's lifecycle through the cascade engine:

```
CAUSE EVENT
  "Queen Ashara's ambassador insults King Theron at the banquet"
  Category: Political | Significance: 45
  Participants: [Ambassador, King Theron, Queen Ashara]
       |
       | [Consequence evaluation]
       |
  +----+----+----+
  |    |    |    |
  v    v    v    v

CONSEQUENCE 1                 CONSEQUENCE 2
"King Theron's grudge         "Diplomatic relations
 against Ashara deepens"       between kingdoms worsen"
 Category: Personal            Category: Political
 Sig: 35                       Sig: 50
 Depth: 1                      Depth: 1
 Prob: 95% (high pride)        Prob: 85%
       |                             |
       v                             v

CONSEQUENCE 1.1               CONSEQUENCE 2.1
"Theron recalls his            "Trade agreements
 ambassador from               suspended between
 Ashara's court"                the two kingdoms"
 Category: Political            Category: Economic
 Sig: 40                        Sig: 55
 Depth: 2                       Depth: 2
 Prob: 70% x (1-0.15)^1        Prob: 60% x (1-0.15)^1
     = 59.5%                       = 51%
       |                             |
       v                             v
      ...                    CONSEQUENCE 2.1.1
                              "Merchant city dependent on
                               this trade suffers economic
                               downturn"
                               Category: Economic -> Disaster
                               Sig: 48
                               Depth: 3
                               Prob: 45% x (1-0.15)^2
                                   = 32.5%
                                     |
                                     v
                                    ...
                              [Max depth 10, dampening
                               reduces probability at
                               each level]
```
