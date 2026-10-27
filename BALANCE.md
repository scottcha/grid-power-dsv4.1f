# GRIDPOWER — Balance

All values are centralised in `src/engine/balance.ts`. This document records the tuned values, the economy's formulas, and the results of the headless validation sweep used to set them.

---

## 1. Economy at a glance

| Constant | Value |
|---|---|
| Starting credits | 125 |
| Starting RP / base RP | 0 / 2 per turn |
| Claim cost | `min(18, 3 + floor(ownedTiles / 7))`, +16 to acquire neutral infrastructure |
| Claim reveal radius | 2 (survey radius 3 for 12 credits) |
| Liquidation refund | 25% of build cost |
| Insolvency | credits < −60 for 2 consecutive turns |
| Standard campaign | 40 turns |
| Compute base price | $0.42/CU |
| Electricity base price | $1.15/MW |
| Gas fuel base | $1.60/MMBtu-equivalent |
| Import / export | spot × 1.30 / spot × 0.78 |
| Import / export capacity | 22 / 18 MW per substation |
| Demand-response base | $3.40 per shed MW, × spot, × policy, × tech |
| Compute clearing saturation | `1 / (1 + previousFleetCU / 20,000)` |
| Score weights | revenue 0.04 · tech 8 · tile 2 · share 150 · credits 0.03 |

A company's compute revenue is therefore driven by four levers: delivered IT power, PUE, accelerator/tech efficiency and market price. Market saturation is the anti-runaway control.

---

## 2. Structures

| Facility | Cost | Opex/turn | Output | Interconnect | Terrain | Tech |
|---|---|---|---|---|---|---|
| Solar Farm | 34 | 1.3 | 12 MW, free fuel | 32 MW | plains, desert, urban | — |
| Wind Park | 38 | 1.4 | 10 MW, free fuel | 32 MW | mountain, coast, plains | — |
| Gas Turbine | 58 | 2.2 | 30 MW, $0.90/MW at base fuel | 64 MW | basin, plains, urban | — |
| Hydro Station | 50 | 1.5 | 18 MW, $0.35/MW | 52 MW | river | — |
| Nuclear Reactor | 260 | 9.0 | 60 MW, $0.30/MW | 130 MW | plains, urban, coast | Advanced Nuclear |
| Geothermal Plant | 74 | 3.0 | 22 MW, $0.25/MW | 52 MW | geothermal field | — |
| Battery Array | 52 | 1.2 | 18 MW / 44 MWh, 0.90 eff | 52 MW | all land | — |
| Power Line | 9 | 0.2 | transmission only | 30 MW | all land | — |
| Substation | 30 | 0.7 | market gateway | 90 MW | all land | — |
| Edge Data Center | 58 | 6 | 6 MW IT @ 1.55 PUE, 8 CU/MW | 46 MW | plains, desert, urban, forest, coast | — |
| Hyperscale Campus | 225 | 22 | 20 MW IT @ 1.40 PUE, 10.5 CU/MW | 92 MW | plains, desert, urban, coast, forest | Modular Data Centers |
| AI Gigafactory | 690 | 50 | 55 MW IT @ 1.30 PUE, 12.5 CU/MW | 175 MW | plains, desert, coast, forest | Next-Gen AI Factories |
| Research Lab | 40 | 2.5 | +5 RP, 1 MW draw | 20 MW | plains, urban, forest | — |

Upgrades: Edge → Hyperscale at 180 credits (78% of a new campus); Hyperscale → Gigafactory at 500. Both require the target tier's technology.

### Generation output modifiers

* Solar × terrain solar factor (desert 1.50), × weather solar.
* Wind × terrain wind factor (mountain 1.35, coast 1.20), × weather wind.
* Hydro × weather hydro.
* Gas marginal cost scales with fuel price (`fuel × 0.55`).
* Firm capacity for the Energy Empire path: nuclear, hydro and geothermal full MW, gas at 50%.

### PUE and compute

```
PUE     = basePUE + techPUE − (terrainCooling−1)×0.40 + (weatherCooling−1)×0.45 − 0.035 (adjacent water), min 1.05
compute = (servedFacilityMW / PUE) × efficiency × (1 + computePct) × (0.75 + 0.25×stability)
revenue = compute × computePrice × saturation × (1 + contractPricePct)
```

A coastal hyperscale campus with Advanced Cooling + Liquid Cooling reaches ~1.10 PUE; a desert campus runs >1.5.

---

## 3. Policies

| Policy | Normal utilisation | Emergency utilisation | DR factor | Stability |
|---|---|---|---|---|
| Maximize Compute | 100% | 100% | 0.00 | +0.00 |
| Maximize Profit | 90% (86% in a glut) | 77.3% | 0.25 | +0.02 |
| Minimize Energy | 72% | 55% | 0.20 | +0.03 |
| Grid Flexible | 88% | 41.2% | 1.00 | +0.05 |
| Reliability First | 94% | 89.8% | 0.10 | +0.10 |

Emergency utilisation is `max(0.30, util − flex × 0.85)`; the difference is shed against demand-response payments.

---

## 4. Technology

| Tech | Branch | RP | Requires | Effects |
|---|---|---|---|---|
| Efficient GPUs | Compute | 34 | — | +12% compute |
| Advanced Cooling | Compute | 42 | — | −0.10 PUE |
| Liquid Cooling | Compute | 78 | Advanced Cooling | −0.15 PUE |
| AI Accelerators | Compute | 96 | Efficient GPUs | +18% compute |
| Next-Gen AI Factories | Compute | 150 | AI Accelerators + Liquid Cooling | +10% compute, unlock Gigafactory |
| Improved Solar Cells | Energy | 32 | — | +25% solar |
| Advanced Wind Turbines | Energy | 38 | — | +30% wind |
| High-Voltage Transmission | Energy | 46 | — | +50% link capacity, −15% line cost |
| Modular Substations | Energy | 58 | HV Transmission | −25% substation cost, +25% imports |
| Advanced Nuclear | Energy | 125 | Modular Substations | +10% nuclear, unlock Nuclear |
| Deep Geothermal | Energy | 64 | — | +35% geothermal |
| Static GPU Power Limits | Optimization | 28 | — | +5% compute, −0.04 PUE |
| Dynamic GPU Power Management | Optimization | 50 | Static GPU Limits | +20% DR |
| Workload-Aware Scheduling | Optimization | 70 | Dynamic GPU Power | +10% compute, +10% DR |
| Adaptive Inference | Optimization | 92 | Workload Scheduling | +12% compute, +25% DR |
| Autonomous Fleet Optimization | Optimization | 150 | Adaptive Inference + Demand Response | +15% compute, +40% DR, +0.04 stability |
| Demand Response Platforms | Optimization | 66 | — | +100% DR, +0.03 stability |
| Grid Analytics | Infrastructure | 40 | — | +0.10 stability, +5% research |
| Grid Interconnection | Infrastructure | 76 | HV Transmission | +30% link capacity, +25% exports |
| Smart Grid Dispatch | Infrastructure | 82 | Grid Analytics | +10% battery efficiency, +0.04 stability |
| High-Density Batteries | Infrastructure | 56 | — | +40% battery capacity, −10% cost |
| Modular Data Centers | Infrastructure | 44 | — | −15% DC cost, unlock Hyperscale |
| Enterprise AI Contracts | Infrastructure | 62 | — | +12% compute price |
| Virtual Power Plant | Infrastructure | 108 | Demand Response + Smart Dispatch | +50% DR, +25% battery power, +0.03 stability |

Total cost is ~1,700 RP. A normal 40-turn campaign can afford roughly a third to a half of the tree, so players must specialise. (AI-only matches reach 15–20 techs because they build many research-producing campuses; the tree is still not fully affordable.)

---

## 5. Markets

### Weather

| Weather | Solar | Wind | Cooling | Hydro | Elec price | Compute price |
|---|---|---|---|---|---|---|
| Clear Skies | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Heatwave | 1.12 | 0.82 | 1.12 | 0.92 | 1.22 | 1.00 |
| Cold Snap | 0.90 | 1.10 | 0.90 | 1.00 | 1.12 | 1.00 |
| Storm Front | 0.55 | 1.35 | 1.06 | 1.20 | 1.18 | 1.00 |
| Wind Drought | 1.08 | 0.45 | 1.00 | 0.85 | 1.15 | 1.00 |
| Dust Storm | 0.70 | 0.85 | 0.92 | 1.00 | 1.20 | 0.98 |

### Market events

| Event | Compute | Electricity | Fuel |
|---|---|---|---|
| None | 1.00 | 1.00 | 1.00 |
| AI Demand Boom | 1.65 | 1.05 | 1.00 |
| Solar Oversupply | 1.00 | 0.62 | 1.00 |
| Grid Emergency | 1.12 | 1.85 | 1.35 |
| Fuel Price Spike | 1.00 | 1.30 | 1.90 |
| Compute Glut | 0.68 | 0.95 | 1.00 |

Each turn also applies ±6% price drift. Next-turn conditions are committed and previewed with ±12% bands. Weather weights: clear 34, heatwave 14, cold snap 14, storm 14, wind drought 12, dust 12. Event weights: none 42, boom 13, oversupply 13, emergency 10, fuel 11, glut 11.

---

## 6. Victory thresholds

| Path | Requirement |
|---|---|
| Compute Dominance | share ≥ 0.60 for 3 turns, from turn 18 |
| Energy Empire | firm ≥ 130 MW, grid links ≥ 6, treasury ≥ 260, net profit ≥ 45 for 2 turns |
| Technology Leadership | Autonomous Fleet + efficiency ≥ 14 CU/MW + compute ≥ 40, for 2 turns |
| Score | turn 40; `0.04×lifetimeRevenue + 8×techs + 2×tiles + 150×share + 0.03×credits` |

Efficiency is computed as last-turn compute ÷ last-turn power delivered to data centers, so it includes PUE and cooling quality.

---

## 7. AI personas

| Company | Renewable | Compute | Grid | Storage | Research | Expansion | Risk |
|---|---|---|---|---|---|---|---|
| Helios Energy | 1.9 | 1.05 | 1.2 | 0.8 | 1.1 | 1.3 | 0.8 |
| Titan Compute | 0.8 | 2.0 | 1.1 | 0.75 | 1.0 | 1.15 | 1.25 |
| Volt Dynamics | 1.0 | 1.0 | 1.7 | 2.4 | 1.25 | 0.95 | 0.6 |
| Player (Nexus Grid) | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |

Difficulty scales AI budget/aggression: relaxed ×0.78, standard ×1.00, brutal ×1.22.

---

## 8. Headless match results

Protocol: `npm run sim -- 24 600` — complete all-AI matches, standard difficulty, 18×18 maps, seeds 600–623, 40-turn limit. Node 22.

### Aggregate

| Metric | Result |
|---|---|
| Matches completed | 24 / 24 |
| Crashes or invariant failures | 0 |
| Average length | 38.2 turns (min 20, max 40) |
| Average resolution time | 60 ms per complete match |
| Winner distribution | Titan 8 · Helios 8 · Nexus 7 · Volt 1 |
| Victory types | Score 20 · Energy 2 · Compute 2 · Technology 0 |
| Average final credits | $6,653 (max $20,471) |
| Average structures per company | 48.8 |
| Average technologies per company | 14.7 |
| Average stability | 0.80 |
| Average compute efficiency | 10.4 CU/MW (max 14.6) |
| Highest observed compute share | 73.3% |

### Representative matches

**Seed 600 — compute rush, ended turn 20.** Titan Compute took 73.3% of a 1,570 CU market with 14 Edge DCs and 2 Hyperscale campuses in 32 structures, finishing on 7 techs, $383 and 15 MW firm. Rivals had 6–13 structures and under 20% share. This is the fastest legitimate win in the sweep: an early campus rush on a strong opening can end the game before the weather cycle matters.

**Seed 601 — four-way score finish.** All four companies finished within 185 points (Nexus 1,223, Helios 1,408, Titan 1,328, Volt 1,396). Helios won on 18 technologies and $9,884; Titan had the biggest compute share (29.8%) but lower revenue. This is the target shape for a balanced late game.

**Seed 620 — energy empire, turn 38.** Titan Compute won with 157 MW firm generation (including 9 gas turbines), 9 grid links, 39.9% share, $8,891 and 7 lines. The firm-capacity strategy held off Helios' 27.7% share.

**Seed 618 — energy at the deadline.** Nexus Grid finished the 40-turn game with 53.4% share, 133 MW firm, 9 links and $20,471, just under the compute-dominance streak it needed; the Energy Empire condition resolved first.

Both compute victories occurred on turn 20; energy victories landed on turns 38 and 40.

### Checks performed each turn

* No NaN/Infinity in credits, research or share.
* Ownership ids valid; at most one structure per tile.
* Battery SOC within `[0, capacity×tech]`.
* Structure terrain remains legal after upgrades.
* Power production ≤ capacity; served load ≤ demand.
* All matches reached `phase === 'gameover'` with a result.

Additional tests prove the Technology Leadership path is reachable with a realistically built gigafactory and the full efficiency tech chain (≈19 CU/MW in the unit test).

---

## 9. Tuning log (summary)

1. **Initial economy** produced runaway credit growth and ~5,000 CU fleets by turn 40. Compute base price was cut from 0.50 → 0.42, campus costs raised, and a fleet-saturation term added to clearing prices.
2. **Saturation was initially too harsh** (÷6,000) and made hyperscale campuses unprofitable; changed to ÷20,000 so late fleets clear at ~50–70% of spot.
3. **AI early game** over-invested in batteries, labs and transmission, leaving no capital for data centers. Battery/lab weights were made conditional on actual surplus/shortage, and claim spending was capped by a small land buffer.
4. **AI expansion deadlocks** appeared when grid adjacency and claim rules interacted; fixed by requiring contiguous claims, allowing line extension onto empty owned plots, and validating options against `canBuild` instead of breaking the action loop.
5. **AI power planning** originally used weather-adjusted capacity, causing chronic shortfalls after weather swings. Reserve planning moved to nameplate generation, and data-center construction is now blocked when load is already unserved.
6. **Data-center interconnect limits** were raised (20/48/110 → 46/92/175) because low busbar ratings created artificial transit congestion. Real bottlenecks now live on 30 MW lines and 90 MW substations.
7. **Energy victory** required 12 grid links, which no AI ever built. Lowered to 6 after observing AI grid sizes of 3–15 links, and AI transmission building was allowed for genuine congestion instead of a hard 2-line cap.
8. **Score weights** were shifted from treasury/revenue toward compute share and technology so that hoarding alone is not dominant.

---

## 10. Open balance issues / next steps

* **Late-game treasury** can still reach five figures when the map is full. A future credit sink (grid hardening, corporate R&D, acquisitions) would create better late decisions.
* **Tech and compute victories are rare in AI-only games** (0 and 2 of 24). The rules are implemented and unit-tested; a human focusing on efficiency or an early campus rush can trigger them, but AI lobbies usually settle into score/energy outcomes.
* **Titan and Helios are the strongest AIs** (8/24 wins each); Volt lags (1/24) because storage payoffs depend on emergency events. A small storage/DR buff or emergency-frequency adjustment would help.
* **Compute Dominance can resolve early** (turn 20) in lobbies where rivals under-invest. The 60% threshold is intentional; the variance comes from early AI spending quality.
* **Demand-response income** is meaningful only during grid emergencies (10/105 event weight per roll). A future update could add ancillary-service prices to more market states.
