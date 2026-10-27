# GRIDPOWER — Architecture

## 1. Principles

1. **One authoritative simulation state.** `GameState` is a plain JSON-serialisable object. Rendering and React never own game truth.
2. **Simulation is pure of the browser.** `src/engine` imports no DOM, React, canvas or storage APIs. It can run in Node (the headless simulation does) and in the browser identically.
3. **Deterministic.** Every random draw comes from one seeded PRNG stored in the state. No `Math.random` in the engine. Same seed + same decisions → same game.
4. **Legal actions only.** All player and AI mutations go through validated action functions that return `{ ok, error? }`. UI and AI cannot mutate structures, ownership or credits directly.
5. **Rendering is a projection of state.** The renderer reads state and a derived power plan; it never changes gameplay.
6. **Balance is data.** Costs, capacities, multipliers, tech effects, victory thresholds and AI personas live in `src/engine/balance.ts`.

---

## 2. Module map

```
src/engine/
  types.ts        GameState, Tile, Structure, Player, Conditions, PowerPlan, reports
  balance.ts      every tunable value: structures, techs, market, weather, victory, personas
  rng.ts          mulberry32 PRNG + value-noise helpers
  worldgen.ts     seeded island generation, starts, neutral substations, fog
  flow.ts         Dinic max-flow for power transport
  compute.ts      PUE, utilisation, generation capacity, link capacity, costs
  tech.ts         technology aggregation and unlock checks
  grid.ts         network graph + island discovery + merit dispatch + storage/market planning
  market.ts       weather/event selection, price drift, forecast
  resolve.ts      per-turn resolution, reports, insolvency, victory checks
  actions.ts      validated player actions (claim, build, upgrade, research, policy, survey)
  ai.ts           utility-based rival turn
  derived.ts      firm capacity, installed generation, scores, victory progress
  save.ts         serialisation, validation, localStorage
  game.ts         createGame, start placement, endTurn orchestration
  log.ts          event log with bounded memory
  guards.ts       canonical runtime shape guard for persisted data

src/render/
  iso.ts          isometric projection helpers, boxes, cylinders, colour math
  art.ts          terrain dressing and every structure style, animated from time
  renderer.ts     Camera, picking, tile/scene drawing, overlays, weather, fog

src/ui/
  store.ts        Zustand UI store; wraps engine actions and autosave
  App/GameView    screen routing and the canvas host loop
  TopBar, LeftRail, BottomBar, TilePanel, EmpirePanel
  TechTree, TurnSummary, Modals, Victory, MainMenu, Tutorial, Minimap, Toast

src/audio/sfx.ts  procedural Web Audio effects + ambience
tests/            37 Vitest tests
sim/headless.ts   all-AI match runner
scripts/          Playwright E2E + screenshot capture
```

---

## 3. State model

`GameState` contains:

```ts
{
  version, seed, rngState, turn,
  settings: { mapSize, aiCount, maxTurns, seed, difficulty },
  width, height, tiles: Tile[],
  players: Player[],
  conditions: { weather, marketEvent, solar, wind, cooling, hydro,
                elecPrice, computePrice, fuelPrice, headline, description },
  forecast: { conditions, elecLow/High, computeLow/High, confidence },
  marketSaturation,
  log: LogEntry[], nextLogId, nextStructureId,
  report: TurnReport | null,
  phase: 'playing' | 'gameover',
  result: GameResult | null,
  pendingNotes: string[]
}
```

* A **tile** stores coordinates, terrain, elevation, visual variant, ownership (`-1` neutral), a reveal bitmask (one bit per player) and at most one structure.
* A **structure** stores type, owner (`-1` for neutral), policy, battery SOC and build turn.
* A **player** stores credits, research points, technologies, default policy, insolvency counter, per-turn stats, history for sparklines, victory streak counters and elimination state.

Key invariants (covered by tests and the headless invariant sweep):

* Every structure's terrain is legal for its type.
* Batteries satisfy `0 ≤ SOC ≤ capacity × (1 + battery tech)`.
* Power production never exceeds capacity; served load never exceeds demand.
* At most one structure per tile; ownership ids are valid.
* Credits and research are finite; a company below −$60 for two turns is eliminated and its structures are removed.
* The map's tile array length equals `width × height`.

`structuredClone` is used by the UI store before applying an action, providing cheap copy-on-write semantics for React. `endTurn` runs on a single clone and is then published, so an interrupted action cannot leave half-applied state in the UI.

---

## 4. Turn pipeline

`endTurn(state)` in `game.ts`:

1. **Rival build phases** — for each non-eliminated AI, `takeAITurn(state, id, rng)`.
   Every AI action still goes through the same validated action layer as the player. Decisions use the shared `planPower` preview, so AI and UI see the same physics.
2. **Resolution** — `resolveTurn(state, rng)`:
   * update compute-market saturation from last turn's fleet output;
   * for each player: `planPower` → commit battery SOC → research income → opex/fuel → revenue → outage roll → credits → insolvency/elimination;
   * compute shares and append history.
3. **Victory check** — `checkVictory` updates streak counters using the just-produced report, then evaluates compute → technology → energy → score/defeat.
4. **Advance** — if the game continues, turn++, current conditions become the previously committed forecast, and a new forecast is rolled and logged.
5. `state.rngState` is written back; the turn report is stored and returned.

`GameState.report` is the last resolved turn. UI previews call `planPower` directly; they are pure reads.

---

## 5. Electricity: graph and dispatch

### 5.1 Graph construction

`planPower(state, playerId)`:

1. Collect every structure owned by the player.
2. Create one node per structure with kind `generation | data | storage | research | grid`.
3. Add an edge for every orthogonally adjacent pair. Capacity `= min(tieA, tieB)` (technology can raise ties).
4. Discover islands by BFS over that graph.
5. Per node:
   * generation supply = weather/terrain/tech-adjusted MW;
   * data demand = `IT × PUE × utilisation`;
   * lab demand = 1 MW;
   * storage supply/demand decided per island.

### 5.2 Island planning

For each island:

* Compute generation capacity and base demand.
* If short: enable battery discharge (`min(power, SOC × eff)`), then imports at each substation.
* If long: add battery charging demand (70% of surplus, power-limited), then export demand at each substation (18 MW each).
* Sort supplies by marginal cost and allocate exactly `demandBase + charging + exports`, which implements merit-order dispatch and curtailment.
* Add all node supplies/demands to one global flow problem. Disconnected islands are independent components, so a single Dinic solve is equivalent and cheaper.

### 5.3 Flow solver

`flow.ts` implements Dinic's algorithm:

* Super-source edges carry node supply; node-to-sink edges carry demand.
* Undirected links are represented by paired arcs with capacity `c`; the net edge flow is `c − residual`.
* `produced`, `served`, `edgeFlow` and `congested` are read from residual capacities.
* Complexity is comfortable: a player's graph is at most a few hundred arcs and the game solves it a handful of times per turn. The UI reuses the plan per state change instead of per frame.

### 5.4 Post-processing

* Battery SOC is derived from **served/produced** flow, not planned values, so conservation survives congestion.
* Compute and revenue are derived per data node; stability is per island and weighted by load.
* Import cost and export revenue use delivered flow.
* Congestion is counted per island and exposed to overlays and AI.

This model deliberately omits AC power flow, voltage, frequency and line losses. It keeps the strategic behaviours (bottlenecks, islands, siting, storage, markets) with a solver small enough to reason about and test.

---

## 6. Compute, economy and research

* **PUE** combines base tier, technology delta, terrain cooling, weather cooling and adjacency to water.
* **Compute** = delivered IT power × efficiency × technology compute multiplier × stability factor.
* **Revenue** = compute × clearing price × contract multiplier. Clearing price = current compute price × fleet saturation (`1/(1 + previousFleetCU/20000)`).
* **Expenses** = structure opex + generation marginal cost × production + import cost.
* **Research** = base 2 + data-center research × delivered ratio + lab 5 × served, × research multiplier.
* **Tech modifiers** are aggregated by `techSummary` into additive percentages and PUE deltas; no tech's effect is hard-coded into systems.

---

## 7. AI architecture

`takeAITurn`:

1. Choose a policy for the turn from conditions, stability and persona.
2. Spend RP on the best value-per-RP technology (branch-weighted, with unlock and ultimate bonuses).
3. Loop up to 4–7 actions:
   * generate legal candidate actions: claims, every generation type, every DC tier, storage, line/substation, lab, upgrades;
   * filter by ownership, terrain, technology and affordability;
   * score each candidate from current plan (demand gap, nameplate headroom, curtailment, congestion, market forecast, persona weights, terrain placement);
   * apply the best action through the validated action API;
   * repeat until no candidate scores above threshold or budget is exhausted.
4. Never add load when load is currently unserved; plan reserve on **installed nameplate**, not weather-adjusted output.
5. Fall back to a starter generator if the company has no generation at all.

AI decisions are fast (whole 40-turn match in ~50–100 ms including all four companies) and deterministic. There is no external inference call.

---

## 8. Renderer

`GameRenderer` owns a canvas, DPR-aware sizing and a camera `{x, y, zoom}`.

* **Projection**: `sx = (x − y) × tileW/2`, `sy = (x + y) × tileH/2 − elevation`.
* **Painting order**: terrain (sorted by `x + y`), tile-top grain, ground overlays, wires, structures, fog, build highlights, hover/selection, weather, vignette.
* **Terrain**: diamond tiles; cliffs only where land meets water or the map edge so inland terrain reads as continuous; procedural trees, dune lines, peaks, river ripples, steam, urban roofs.
* **Structures**: vector iso cubes/cylinders/panels with owner-coloured accent stripes and time-driven animation (blades, fans, shimmer, LEDs, charge bars, steam, pulses).
* **Wires**: quadratic catenary between structure tops, owner colour, moving energy dots when the plan reports flow on that link.
* **Overlays**: ground tints for ownership/power/compute/economy; congestion dashes; unserved load pulses; compute bars.
* **Fog**: cold translucent silhouette plus soft radial cloud puffs; structures/wires are never drawn on unscouted tiles.
* **Weather**: screen-space rain, snow, dust, heat shimmer, storm flashes.
* **Picking**: inverse camera transform and iso rounding; elevation is ignored for clicks.
* **Performance**: one requestAnimationFrame loop, no React re-render per frame; game state and plan are read through a ref updated only when the store changes.

The renderer is intentionally a custom Canvas 2D implementation rather than Phaser/Pixi: the world is turn-based, the asset set is fully procedural, and this keeps the production bundle near 300 KB with complete visual control. DOM-heavy UI elements (menus, overlays) remain React.

---

## 9. UI

* The Zustand store holds `game`, screen, selection, hover, overlay, build mode, modal flags, toasts, mute, and save status.
* Every action clones the state, calls the engine action, and on success updates the store and autosaves. On failure it surfaces the engine's error message and plays an error cue.
* `endTurn` clones, calls the engine, opens the turn report, and lets the victory screen take over if the game ended.
* `useHumanPlan` memoises `planPower(game, 0)` per game reference; panels derive power, compute, revenue, stability and policy effects without duplicating formulas.
* `GameView` manages the renderer lifecycle, pointer/wheel/keyboard input, camera centring and screen composition. All other components are presentation and dispatch.
* Modals: tech tree, turn summary, event log, help, pause, victory. Main menu includes a live simulated diorama rendered by the same renderer.
* CSS provides the visual system: Inter/Space Grotesk, dark glass panels, resource bar, contextual bottom build dock, responsive breakpoints for 1280×800 and below.

---

## 10. Persistence

* `serializeGame` is JSON of `GameState`.
* `localStorage` key `gridpower.save.v3`, plus a timestamp.
* `parseGame` validates version, phase, dimensions, tile count, player presence, conditions/forecast/settings shape, RNG and saturation before accepting a save. Invalid or future saves are rejected rather than crashing the UI.
* Autosaves occur after every successful action and every turn; the pause menu offers an explicit save.

---

## 11. Testing

* `tests/flow.test.ts` — solver correctness, bottlenecks, disconnected components, capacity bounds.
* `tests/grid.test.ts` — dispatch, weather, imports/exports, islands, interconnect limits, storage conservation, PUE and tech multipliers.
* `tests/game.test.ts` — territory, construction legality, upgrades, demolition, surveys, research gates, policy/emergency behaviour, full resolution accounting, all victory paths (including a naturally optimised technology campus), insolvency, save/load and six-turn deterministic replay.
* `tests/helpers.ts` — clean fully revealed boards and structure placement.
* `sim/headless.ts` — complete AI-only matches, invariant sweep, performance and outcome reporting.
* `scripts/e2e.ts` — Playwright: menu → new game → build → claim → end turn → summary → tech tree → reload → resume → laptop layout, failing on console errors.
* `scripts/screenshots.ts` — real screenshots, including a late-game map loaded from a headless save.

### Performance observations

* 24-match all-AI sweep: **~60 ms per complete 40-turn match** (Node 22, one core), including all dispatch solves and AI decisions.
* UI `planPower` is sub-millisecond on a typical late-game 50-structure empire; the render loop targets 60 fps on a 1440p Canvas.
* A full match is ~40 turns; the human-paced campaign is expected to run 45–90 minutes.

---

## 12. Extension points

* Add a structure: `StructureType`, `STRUCTURES` entry, optional tech unlock, icon, and (if special) dispatch handling.
* Add a technology: append to `TECHS` with an `fx` descriptor; the aggregation is automatic.
* Add weather or a market event: add to the enums and the multiplier tables in `balance.ts`; the forecast and UI read them generically.
* Add a rival persona: extend `Persona`, `PLAYER_IDENTITIES`, `PERSONA_WEIGHTS`; the AI scorer takes weights as data.
* Change map size limits: `MAP` and the menu select; world generation scales with the size parameter.
* New victory path: add a condition in `checkVictory` and progress fields in `victoryProgress`.
