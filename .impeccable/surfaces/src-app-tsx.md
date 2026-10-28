---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface: Tactica11 app shell (all tabs)

Mode: Operate. Scope: whole app UI chrome — top bar, view tabs, panels (Effectif, bench, inspector), menus, popovers, dialogs, onboarding, Séquence editor chrome, Phase arrêtée chrome, Studio UI. Exports (MP4, Studio poster, PNG) render unchanged. Features and flows unchanged. Light AND dark themes both first-class. iPad touch priority.

Audience: author first, then coaches (iPad, dressing room), content creators, analysts. Problem replaced: "arcade / amateur" look (neon green, radial glows, glass, pills, 16px radii, flat hierarchy).

## Direction contract

THESIS: Tactica11 is a working console for tactics: persistent panels separated by 1px seams, colour that only ever means state, and the pitch as the one coloured surface. It refuses the category default of glowing dark glass, neon accent and pill buttons.

OWN-WORLD: Graphite ground (#16191D) with one step of elevation (#1C1F24) and seams (#2E333A); light twin on cool paper grey (#F5F6F7) with white panels and #DADDE1 seams. Inter for UI, JetBrains Mono for figures only (numbers, coordinates, counts, durations). Panel headers in 11px small caps. Radii 4px controls / 6px popovers, no pills, no gradients, no glass, no halos. State: blue #4C8DF6 selection, green #2EA043 primary/confirmed, amber #D29922 uncertain, red #E5534B destructive/injured. Destructive actions outline-only, spatially isolated.

STORY: The user knows where everything is before noticing the style; the squad, the pitch and the selected slot's properties read as three stable work areas; tactical colour (team kits, arrows, zones) lives on the pitch alone, so it reads instantly.

FIRST VIEWPORT: 44–48px top bar with brand, compo/système selects, tab strip with 2px underline, undo/redo and a single green Partager at right. Left panel Effectif (dense rows: mono number, name, poste, status mark in a fixed cell). Centre: segmented Base/Attaque/Défense above the pitch, pitch centred at maximum height. Right/side controls as hairline-seamed panels. Selection = blue.

FORM: Console graphite (dark-first developer console challenger, fused), chosen by user over assigned; raises kept: 3 type sizes max, status marks in fixed cells struck not removed, flat colour, presentation mode pitch owns viewport with one tool rail. seed:7da16a7aac74f30a

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Chosen sketch: .impeccable/mocks/decision/challenger-console.html

## Open decisions
- Ghost base positions while editing Attaque/Défense: deferred (new behaviour).
- Pitch turf/markings rendering: not flagged as amateur; keep unless it clashes.
