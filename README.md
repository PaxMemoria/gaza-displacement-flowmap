# Gaza displacement flow map

Animated flow map of reported displacements inside the Gaza Strip, January 2025 – November 2026,
shown one phase at a time. Built from the PaxMemoria/Sudan flow-map template
(Leaflet + CanvasFlowmapLayer). The page is in English by default; add `?lang=ar` for Arabic.

## Phases

| Phase | Dates in the data | Routes | Reported displacements | Source layer |
|---|---|---|---|---|
| 1 | 27 Jan – 6 Feb 2025 | 19 | 643,463 | MovementsWave1_XYToLine |
| 2 | 19 Mar – 14 May 2025 | 173 | 432,665 | MovementsWave2_XYToLine |
| 3 | 15 May – 11 Aug 2025 | 385 | 342,650 | MovementsWave3_Lines |
| 4 | 15 Aug – 5 Oct 2025 | 433 | 467,613 | MovementsWave4_Lines |
| 5 | 10 Oct 2025 – 14 Feb 2026 | 285 | 833,265 | MovementsWave5_Lines |
| 6 | 5 Jun – 23 Nov 2026 | 30 | 4,606 | Movements_XYToLine5 |

Phases 1–5 are IOM's five wave layers. Phase 6 comes from a separate web map. Phase labels on
the map are the first and last dates in each phase's data.
There is no data for 15 February – 4 June 2026.

## Sources

- IOM OPT Needs and Population Monitoring (NPM) programme: the public web maps
  "Displacement Movements Wave 1" to "Displacement Movement Wave 5".
- Public web map "DisplacementMovementsPoints_All" (phase 6 and the 2026 yellow-line and
  militarized-zone layers).
- All layers are public feature services of the ArcGIS Online account `saljazarahIOM`, downloaded
  2026-11-25. The raw downloads are in `data/raw/`.

The data belongs to IOM. Credit them and confirm permission before publishing.

## Data notes

- `data/data.csv` is built from `data/raw/`: dates converted to ISO (one wave-3 row used
  `6/30/2025`), names trimmed, empty `Field12`–`Field20` columns dropped. `uid` = phase, ID and
  object ID, since IDs repeat across waves.
- Waves 2 and 3 each contain one row that exactly duplicates another (same date, places and count).
  They are kept as published.
- Wave 1 and the first rows of wave 5 use broad "South" and "North" points rather than specific
  places.
- Households are recorded only in phase 6.
- The yellow line and militarized zones are 2026 layers and are shown only with phase 6.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
