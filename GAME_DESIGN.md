# GRIDPOWER — Game Design

## 1. Vision

**Build the grid. Control the compute. Dominate the future.**

GRIDPOWER is a turn-based 4X game in which four AI-infrastructure companies race across a strained electricity system. The central loop is physical: generation must reach data centers through limited interconnects, and the resulting compute is sold into a moving market. Every strategic decision is a version of one question:

> Is the next megawatt better spent on more capacity, better connectivity, or better efficiency?

The game is deliberately closer to *Polytopia* than to a hard simulation: small maps, a readable 5-resource economy, 30–60 second early turns, and a compact 40-turn campaign. Scientific plausibility is used to make the trade-offs intuitive, not to require a power-engineering degree.

---

## 2. Turn structure

A turn abstracts an operating period (days to weeks).

1. **Review** — read the market forecast, weather, rival moves and last turn's report.
2. **Explore** — select a fogged tile near your territory and survey it (12 credits, radius 3).
3. **Expand** — claim bordering land; costs escalate with the size of your empire.
4. **Build** — generation, transmission, data centers, storage or labs on owned terrain.
5. **Research** — spend RP on the tech tree.
6. **Tune** — set a default operating policy or a per-campus policy; upgrade or demolish facilities.
7. **End turn** — rivals act; all players' dispatch and production resolve simultaneously; markets and weather advance; a turn report opens.
8. **Repeat** until a victory condition or turn 40.

Actions are validated and applied immediately against a clone of authoritative state, then autosaved. Rival AI build phases run at the start of `endTurn`, before the shared production resolution.

---

## 3. Five resources

| Resource | Meaning | Produced by | Spent on |
|---|---|---|---|
| **Credits** | Capital and cash flow | Compute sales, exports, grid services | Construction, claims, imports, upgrades, maintenance |
| **Electricity** | Instantaneous power flow (MW) | Generation, imports, battery discharge, exports | Data centers, labs, battery charging, exports |
| **Compute (CU)** | Useful AI workloads | Operational data centers | Sold automatically for credits |
| **Research (RP)** | R&D progress | Labs, data centers, a small base trickle | Technologies |
| **Grid stability** | Reliability/reserves | Reserves, policy, low congestion | Affects compute output and outage risk |

Credits are a stock; electricity is a flow; compute and research are per-turn outputs; stability is a 0–1 operating quality. Batteries hold MWh, separate from the MW flow.

---

## 4. Map and territory

* Standard map **18×18**, options 13×13 and 24×24.
* Terrain: ocean (unbuildable), plains, desert, mountain, forest, river, coast, geothermal field, urban district, resource basin.
* Terrain modifies solar/wind output and cooling. Resources are geographically constrained, so land is strategic.
* **Fog** starts as a circular area of radius 3.5 around each company's pocket. Claims reveal radius 2; survey drones reveal radius 3 around a target within 6 tiles of your territory.
* **Claims** require an unclaimed, revealed land tile bordering your territory (8-neighbourhood). Cost:

  `claimCost = min(18, 3 + floor(ownedTiles / 7)) + 16 if the tile holds neutral infrastructure`

* Six neutral substations are seeded each map away from starts. Claiming their tile acquires the 90 MW hub.
* Construction requires ownership, the right terrain and (for advanced facilities) technology.

---

## 5. Electricity model

### 5.1 Network

* Every structure is a node.
* Two **adjacent** structures of the same company are connected.
* The link's capacity is the **smaller** of the two structures' interconnect ratings (`tie`). This makes transmission upgrades and campus siting matter.
* Connected components are electrical **islands**; power cannot cross islands.

### 5.2 Dispatch pipeline (per player, per turn)

1. **Demand** — each data center requests `IT × PUE × utilisationTarget`; each lab 1 MW.
2. **Renewable capacity** — generation capacity is adjusted for weather, terrain, and technology.
3. **Storage scheduling**
   * If island generation capacity < demand: batteries become supplies `min(powerRating, SOC × efficiency)`.
   * If generation > demand: batteries become loads with capacity `min(powerRating, (capacity − SOC) / efficiency)`, targeting 70% of the surplus.
4. **Market gateway** — if a substation is present:
   * deficit → import up to 22 MW per substation at `spot × 1.30`;
   * surplus → export up to 18 MW per substation at `spot × 0.78`.
5. **Merit order** — supplies are dispatched cheapest first: solar/wind (0) → storage (0) → geothermal (0.25) → nuclear (0.30) → hydro (0.35) → gas (`fuel × 0.55`) → imports (`spot × 1.30`).
6. **Flow solve** — a Dinic max-flow over the player's whole grid determines which supply reaches which load. Congested links are marked.
7. **Consequences** — unserved demand throttles data centers; unused generation is curtailed; battery SOC is committed; imports/exports are billed; stability and DR income are computed.

This is a transport-flow model, not AC power flow. Voltage, frequency, reactive power and thermal dynamics are intentionally abstracted.

### 5.3 Grid stability

Per island (weighted by load):

```
reserveRatio = (generationCapacity − demand) / max(1, demand)
stability = 0.66
          + 0.28 × clamp(reserveRatio, −1, 1)
          + technologyStability
          + averagePolicyStability
          − shortfallFraction × 1.15
          − congestedLinks × 0.012
          − 0.035 if storm
          − 0.045 if grid emergency
clamped to 0.05 … 0.99
```

If stability < 0.34 there is a per-turn chance of a **30% compute outage**, scaled by how far below 0.34 the island is.

### 5.4 Batteries

* Edge values: 18 MW power, 44 MWh, 0.9 round-trip efficiency.
* Charging adds `servedMW × efficiency` to SOC; discharging draws `producedMW / efficiency`.
* SOC is clamped to `[0, capacity]`; conservation is covered by tests.
* Batteries also earn availability payments during grid emergencies.

### 5.5 Imports and exports

A substation is both a 90 MW hub and the only market gateway. Imports cover deficits at a premium; exports monetise surplus at a discount. This makes substations strategically valuable without letting a player conjure power from nowhere.

---

## 6. Data centers and compute

### 6.1 Facility tiers

| Tier | IT load | Base PUE | Compute efficiency | Link | Build | Unlock |
|---|---|---|---|---|---|---|
| Edge Data Center | 6 MW | 1.55 | 8.0 CU/MW | 46 MW | 58 | innate |
| Hyperscale Campus | 20 MW | 1.40 | 10.5 CU/MW | 92 MW | 225 | Modular Data Centers |
| AI Gigafactory | 55 MW | 1.30 | 12.5 CU/MW | 175 MW | 690 | Next-Gen AI Factories |

Edge → Hyperscale costs 180 credits and Hyperscale → Gigafactory 500 (before cost modifiers), reusing the plot, provided the target tier's technology is available.

### 6.2 PUE

```
PUE = basePUE + techPueDelta
    − (terrainCooling − 1) × 0.40
    + (weatherCooling − 1) × 0.45
    − 0.035 if adjacent to river/coast/ocean
    min 1.05
```

Deserts are hot (PUE up), coasts/rivers/mountains are cool (PUE down). Heatwaves raise PUE; cold snaps lower it. Liquid + advanced cooling can take a coastal gigafactory close to 1.05.

### 6.3 Compute and revenue

```
deliveredIT   = deliveredFacilityPower / PUE
compute       = deliveredIT × efficiency × (1 + computePct/100) × (0.75 + 0.25 × stability)
revenue       = compute × clearingPrice × (1 + contractPricePct/100)
clearingPrice = computePrice × marketSaturation
marketSaturation = 1 / (1 + previousFleetCompute / 20000)
```

Fleet-wide supply compresses the clearing price, which prevents infinite exponential growth and mirrors a compute glut. The current clearing price is shown in the left rail and empire panel.

### 6.4 Operating policies

| Policy | Utilisation | Emergency shed | DR multiplier | Stability bonus |
|---|---|---|---|---|
| Maximize Compute | 100% | 0% | 0 | 0 |
| Maximize Profit | 90% (86% in a glut) | 15% | 0.25 | +0.02 |
| Minimize Energy | 72% | 20% | 0.20 | +0.03 |
| Grid Flexible | 88% | 55% | 1.00 | +0.05 |
| Reliability First | 94% | 5% | 0.10 | +0.10 |

During a grid emergency, utilisation becomes `max(0.30, util − flex × 0.85)`. Demand-response income is based on the shed megawatts, spot price, policy DR factor and DR technology multipliers. Grid Flexible gives up compute for premium payments; Reliability First stabilises the island; Max Profit trims output when compute is cheap.

---

## 7. Research

24 technologies across four branches. Costs 28–150 RP; prerequisites form real chains; not every technology is affordable in a 40-turn game.

* **Compute** — Efficient GPUs, Advanced/Liquid Cooling, AI Accelerators, Next-Gen AI Factories (unlocks gigafactories).
* **Energy** — Solar Cells, Wind Turbines, High-Voltage Transmission, Modular Substations, Advanced Nuclear (unlocks nuclear), Deep Geothermal.
* **Optimization** — Static GPU Power Limits, Dynamic GPU Power Management, Workload Scheduling, Adaptive Inference, Demand Response, Autonomous Fleet Optimization (the ultimate tech and Technology Leadership requirement).
* **Infrastructure** — Grid Analytics, Grid Interconnection, Smart Grid Dispatch, High-Density Batteries, Modular Data Centers (unlocks hyperscale), Enterprise AI Contracts, Virtual Power Plant.

Effects are real multipliers on generation, PUE, link capacity, storage, construction cost, compute, DR income, stability, research and price. See [BALANCE.md](BALANCE.md) for the full table.

---

## 8. Markets, weather and events

Each turn has:

* **Weather** — clear, heatwave, cold snap, storm, wind drought, dust storm. Multipliers for solar, wind, hydro, cooling, electricity price, fuel price.
* **Market event** — none, AI demand boom, solar oversupply, grid emergency, fuel price spike, compute glut.
* **Prices** — electricity ($/MW), compute clearing ($/CU), gas fuel, with ±6% drift.
* **Forecast** — next turn's weather and event are committed and shown with honest ±12% price bands, so players can plan around a storm or emergency rather than being surprised.

The full multiplier tables are in [BALANCE.md](BALANCE.md).

---

## 9. Rivals

All rivals use deterministic utility scoring over legal actions; no LLM or external service is involved.

**Shared heuristics**

* Keep a buffer of claimable, buildable land; claim contiguously and prefer grid-adjacent plots.
* Plan reserves on **nameplate** generation, not current weather-dependent output.
* Never add a data center when load is already unserved or when nameplate headroom is below the new facility's draw plus reserve.
* Build generation when nameplate reserve falls below ~125% of demand.
* Prefer available terrain bonuses and avoid over-concentrating in one weather-sensitive technology.
* Build transmission when the plan reports congestion, or a substation when none exists.
* Research by persona-weighted value-per-RP, with bonuses for unlocks that match the current fleet.
* Adopt policies based on conditions (Grid Flexible in emergencies, Reliability First when stability is low, Max Profit in a glut).
* Build one step ahead of demand, but spend almost all available credits each turn.

**Personas**

| Company | Renewable | Compute | Grid | Storage | Research | Expansion | Risk |
|---|---|---|---|---|---|---|---|
| Helios Energy | 1.9 | 1.05 | 1.2 | 0.8 | 1.1 | 1.3 | 0.8 |
| Titan Compute | 0.8 | 2.0 | 1.1 | 0.75 | 1.0 | 1.15 | 1.25 |
| Volt Dynamics | 1.0 | 1.0 | 1.7 | 2.4 | 1.25 | 0.95 | 0.6 |

Rival competence varies by difficulty (`relaxed`, `standard`, `brutal`) through budget and aggression multipliers.

---

## 10. Victory and defeat

| Path | Condition |
|---|---|
| **Compute Dominance** | ≥60% of total compute for 3 consecutive turns, from turn 18 |
| **Energy Empire** | ≥130 MW firm generation, ≥6 grid links, ≥$260 treasury, ≥$45 net profit for 2 turns |
| **Technology Leadership** | Autonomous Fleet Optimization + ≥14 CU per delivered MW for 2 turns |
| **Score** | At turn 40, highest score: lifetime revenue×0.04 + techs×8 + tiles×2 + share×150 + credits×0.03 |

Defeat: credits below −$60 for two consecutive turns → insolvent, assets abandoned. If the player is eliminated, the game ends with the best rival's score. Victory progress is always visible in the empire panel.

---

## 11. Onboarding

Contextual hints (turn 1–10) teach the next bottleneck rather than front-loading a manual:

1. Claim adjacent land.
2. Build generation connected to your grid.
3. Add a second data center.
4. Spend research.
5. Keep reserve ahead of demand (weather risk).
6. Use cooling/terrain and the market forecast.

The tile inspector explains every structure's live power, PUE, compute, revenue, stability and policy. The power overlay turns unserved load red and marks congested links. The turn report explains where the money went.

---

## 12. Interface and art direction

* A stylised miniature industrial island: continuous terrain, cliff coastlines, low-poly buildings, readable silhouettes, player-colour accents.
* Live animation: turbine rotation, cooling fans, solar shimmer, steam, battery charge, blinking racks, flowing power particles.
* Deliberate visual hierarchy: resources top, context right, construction bottom, strategic map centre.
* Dark control-room UI with teal/amber accents, tight data density, and tooltips or labels explaining every mechanic.

The full visual rationale and rendering pipeline are in [ARCHITECTURE.md](ARCHITECTURE.md).
