# ONE-SHOT BUILD PROMPT: GRIDPOWER

## Role and mission

You are an elite autonomous game development team combining the skills of a senior game designer, gameplay engineer, UI/UX designer, procedural artist, AI programmer, and QA engineer.

Your mission is to **build a complete, playable, beautiful, single-player 4X strategy game called GRIDPOWER**, inspired by the elegant, addictive, turn-based gameplay of *The Battle of Polytopia*, but with an original theme centered on data centers, AI compute, electricity markets, and energy infrastructure.

**This is a one-shot, non-interactive assignment.**

Do not ask me questions. Do not stop at planning, wireframes, documentation, or scaffolding. Make reasonable design decisions autonomously, implement the game, run it, test it, fix bugs, and deliver a playable result.

The game must be entertaining as a strategy game first, while incorporating realistic enough energy and data center concepts that players intuitively learn the strategic relationships between power, compute, infrastructure, and economics.

## 1. Core game vision

**Tagline:** Build the grid. Control the compute. Dominate the future.

GRIDPOWER is a turn-based, tile-based 4X strategy game in which competing AI infrastructure companies race to establish the most powerful compute empire.

Players begin with a small data center and limited electricity access. They expand across a procedurally generated landscape, acquire energy resources, build electrical infrastructure, construct data centers, research technologies, and compete with rival AI companies.

The central strategic tension:

- Electricity production is geographically constrained.
- Transmission infrastructure connects generation to compute.
- Data centers turn electricity into economically valuable AI compute.
- Energy prices, weather, and demand fluctuate.
- Efficiency technologies improve compute production per watt.
- Infrastructure investments compete with short-term profitability.
- Territory and grid access create geopolitical-style competition.
- Flexibility, batteries, and demand response unlock powerful strategies.

A player should constantly face decisions such as:

"Should I construct another gas turbine, expand transmission to a hydroelectric region, build batteries to handle peak demand, or invest in more efficient GPUs?"

"Should I buy territory near the cheap geothermal field or capture my competitor's power substation?"

"Do I maximize inference revenue this turn or curtail my data center to earn grid-service payments?"

These choices must have meaningful gameplay consequences.

## 2. Experience and visual direction

The design should capture the *approachability and clarity* of Polytopia without copying its visual assets, exact mechanics, or interface.

### Presentation

- Beautiful, colorful, low-poly or stylized isometric tile world.
- Recognizable terrain: forests, mountains, plains, deserts, rivers, coastline.
- Distinct power facilities: solar farms, wind turbines, gas turbines, hydro dams, nuclear reactors, geothermal plants.
- Distinct data centers: small edge sites, hyperscale campuses, advanced AI factories.
- Transmission towers, substations, and power lines visibly link infrastructure.
- Glowing network connections when electricity flows.
- Animated cooling fans, turbine blades, solar shimmer, and blinking server racks.
- Satisfying building placement effects, construction sounds, and progress indicators.
- Distinct visual identities for competing companies.
- Elegant typography, clean panels, readable icons, and restrained animations.

**The finished product should feel like a commercially polished indie strategy game rather than a developer demo or dashboard.**

The UI should be highly legible and aesthetically excellent at 1440p and usable at laptop resolutions.

### Primary interface

Use a full-screen game world with contextual controls.

Include:

- Top resource bar: Credits, Power, Compute, Research, Grid Stability.
- Top-left turn counter and company identity.
- Bottom contextual action panel.
- Technology tree.
- Build menus.
- Overview of connected electrical grids.
- Competitor status.
- Notifications and event log.
- Mini-map if useful.
- End Turn button.
- In-game tutorial hints.
- Main menu, pause menu, victory/defeat screens.

Support mouse, trackpad, and keyboard shortcuts. Smooth zoom and pan are required.

Avoid clutter and overly complicated menus.

## 3. Technology and implementation

Use a modern web-based game stack that runs locally.

Recommended:

- TypeScript
- React for menus, HUD, overlays, and settings
- Phaser 3 for the tile-world renderer and animation, or PixiJS if preferable
- Vite for the development/build workflow
- Zustand or an equivalent lightweight state system
- Local storage for saved games

You may choose another stack if it produces a demonstrably superior result.

Requirements:

- No backend or account required.
- No paid APIs.
- No external runtime service dependencies.
- Fully functional offline after assets are installed.
- Seeded procedural world generation.
- Deterministic game rules and reproducible turns.
- Save/load.
- Clearly separated game engine, rendering, AI, and UI code.
- Automated tests for core gameplay and game-state transitions.

Use code-generated or openly licensed visual/audio assets where useful. Do not use copyrighted Polytopia assets.

## 4. World and procedural map

Use an approximately 18×18 tile map for standard games, configurable for smaller or larger maps.

Map tiles should have strategic properties:

| Terrain | Gameplay significance |
|---|---|
| Plains | Cheap construction, moderate solar |
| Desert | Excellent solar, expensive cooling |
| Mountain | Wind potential, difficult transmission |
| Forest | Biomass opportunities, slower construction |
| River | Hydro potential and cooling |
| Coast | Offshore wind and cooling |
| Geothermal field | Reliable geothermal generation |
| Urban district | Strong compute demand and grid connections |
| Resource basin | Natural gas or other fuel advantage |

Each map should contain a mixture of regions:

- Renewable-rich, power-constrained regions.
- Energy-rich, low-connectivity regions.
- High-demand metro areas.
- Cooling-efficient northern or elevated terrain.
- Central infrastructure chokepoints.
- Strategically valuable existing substations.

World generation must guarantee that each starting player has viable expansion opportunities and that maps are not easily decided by starting-position luck.

Generate appealing, varied, readable maps, not random tile noise.

## 5. The resource economy

Use five core resources.

### Credits ($)

Represents capital and cash flow.

Earned primarily from selling AI compute, grid services, and market opportunities.

Spent on construction, research, maintenance, expansion, and acquisitions.

### Electricity (MW)

Represents available electrical power during a turn.

Generated by power facilities or acquired through market transactions.

Constrained by transmission connections, plant capacity, weather, and competing loads.

Electricity is a flow, not a stockpile. Batteries store energy separately.

### Compute (CU)

Represents useful AI workloads completed each turn.

Generated by operational data centers consuming electricity.

Compute produces revenue based on demand, efficiency, and contracts.

### Research (RP)

Generated by research facilities and certain data centers.

Used to unlock technologies.

### Grid Stability

Represents reliability and operating reserves within each electrical island.

Poor grid stability can cause financial penalties, reduced production, or outages.

Make these resources intuitive. Use tooltips to show how they relate.

## 6. Essential energy gameplay mechanics

This is the heart of the game's differentiation.

### 6.1 Power generation

Implement at least six generation technologies with different characteristics.

| Facility | Strategic identity |
|---|---|
| Solar | Cheap, intermittent, terrain dependent |
| Wind | Variable, complementary to solar |
| Natural gas | Dispatchable, fuel costs |
| Hydro | Stable output, geographically limited |
| Nuclear | Expensive upfront, high stable output |
| Geothermal | Reliable baseload, location constrained |

Each has:

- Construction cost
- Power capacity
- Per-turn operating cost
- Availability
- Research prerequisites, when applicable
- Terrain restrictions
- Strategic strengths and weaknesses

Weather changes renewable output.

### 6.2 Transmission and grid connectivity

A data center must have an adequate grid connection to receive electricity.

Implement a clear electrical network model with:

- Substations
- Power lines
- Transmission capacity
- Connected generation and loads
- Network bottlenecks
- Disconnected grid islands

Use a simplified but internally consistent flow algorithm, not a full AC power flow solver.

Power generation that cannot reach a connected consumer has reduced or no economic value unless storage or market mechanics provide an outlet.

The player must see where bottlenecks exist.

Clicking a substation or grid element should reveal connected capacity, available supply, load, and congestion.

### 6.3 Data centers

Data centers are the economic heart of each player's empire.

Three building tiers:

1. Edge Data Center
2. Hyperscale Data Center
3. AI Gigafactory

For each data center, model:

- Installed IT capacity
- Power draw
- Power Usage Effectiveness (PUE)
- Compute efficiency
- Cooling requirements
- Construction cost
- Operating cost
- Upgrade opportunities

Use a simplified formula:

Compute Output = IT Power × Compute Efficiency × Utilization

Facility Power = IT Power × PUE

Facilities generate compute only when supplied sufficient electricity, including the ability to run at reduced utilization.

Allow multiple data centers with different efficiency levels.

### 6.4 Energy-aware AI optimization

An important advanced upgrade path should let the player improve compute per watt without necessarily increasing raw capacity.

Implement an **AI Optimization Agent** technology branch.

Progression:

- Static GPU Power Limits
- Dynamic GPU Power Management
- Workload-Aware Scheduling
- Adaptive Inference Optimization
- Autonomous Fleet Optimization

Possible effects:

- Increased compute per MW
- Reduced energy per workload
- Ability to change power draw dynamically
- Greater demand-response revenue
- Reduced impacts from fluctuating electricity

Make this one of several viable strategies, not an automatic dominant upgrade.

### 6.5 Battery storage

Batteries are constructed infrastructure with:

- MW discharge rating
- MWh capacity
- State of charge
- Charging/discharging efficiency
- Per-turn charge/discharge limits

Give them meaningful uses:

- Capture excess renewable power.
- Reduce risk of shortages.
- Shift consumption across price periods.
- Support data centers during grid events.
- Earn grid-services revenue.

### 6.6 Dynamic energy and compute markets

Every turn has market conditions:

- Electricity price
- AI compute demand
- Wholesale compute price
- Renewable output forecast
- Grid reliability events

Examples:

- AI Demand Boom: Compute value increases.
- Solar Oversupply: Midday electricity becomes cheap.
- Heatwave: Cooling consumption increases.
- Grid Emergency: Flexibility rewards increase.
- Fuel Price Spike: Gas generation becomes expensive.
- Wind Drought: Wind power becomes scarce.

Show the forecast for the next turn with uncertainty, allowing players to plan.

Players should be able to develop strategies around markets rather than simply expand every turn.

## 7. 4X pillars

All four must be playable and interconnected.

### EXPLORE

- Start with partially obscured map.
- Reveal tiles through expansion, scouts, or grid surveys.
- Discover geothermal resources, transmission corridors, existing substations, and prime data center locations.
- Finding valuable terrain should reward exploration.

### EXPAND

- Claim adjacent territory.
- Build generation infrastructure.
- Construct substations and transmission lines.
- Connect isolated territories.
- Establish new data centers.

Territory acquisition must have an escalating cost to discourage uncontrolled expansion.

### EXPLOIT

- Produce electricity.
- Optimize energy-to-compute conversion.
- Develop valuable compute markets.
- Use battery arbitrage.
- Improve data centers.
- Research advanced technologies.
- Earn from demand-response and grid-support services.

### EXTERMINATE / COMPETE

Conflict should reflect infrastructure competition rather than traditional soldiers.

Implement three forms of competition:

**Territorial competition**

Rivals contest unclaimed valuable tiles and strategic resources.

**Economic competition**

Players compete for high-value AI contracts, control market supply, and improve unit economics.

**Infrastructure competition**

Players can acquire or contest neutral transmission assets and strategic grid connections.

Optional hostile actions such as disruptive cyber operations should NOT be the main gameplay focus. Prefer economic, territorial, and infrastructure contests.

A player should be able to win without eliminating competitors entirely.

## 8. Rival AI companies

Implement three computer-controlled opponents with visibly different strategies.

### Helios Energy

Focuses on renewable energy and inexpensive power generation.

### Titan Compute

Focuses on aggressive data center expansion and compute market share.

### Volt Dynamics

Focuses on grid control, batteries, demand response, and operational flexibility.

They should exhibit meaningful strategic behavior, not random action selection.

AI behavior should include:

- Finding useful expansion tiles.
- Investing in generation based on supply shortfalls.
- Connecting infrastructure.
- Building and upgrading data centers.
- Researching technologies.
- Responding to weather and market conditions.
- Competing over scarce strategic locations.
- Making decisions consistent with their personality.

Use heuristic or utility-based AI with enough lookahead to make competent decisions.

Do not require LLM calls for AI opponents.

AI turns must resolve quickly.

## 9. Turn-based gameplay loop

A turn represents one operational period, abstracting several days or weeks.

Recommended turn structure:

1. Review production, finances, supply/demand, and event alerts.
2. Explore and claim territory.
3. Build and upgrade infrastructure.
4. Allocate budget and research.
5. Configure data center operating policies.
6. Finish turn.
7. Rival AIs take turns.
8. Resolve weather, dispatch, storage, compute production, markets, and revenue.
9. Show turn summary.

Players should generally have enough resources for two or three meaningful actions early in the game.

Avoid excessive micromanagement.

Aim for:

- 30–60 seconds for early turns.
- 1–2 minutes for midgame turns.
- 45–90 minutes per standard game.

**The result must have the "one more turn" quality of a great strategy game.**

## 10. Operating policies

Allow players to choose global or per-data-center strategies:

- Maximize Compute
- Maximize Profit
- Minimize Energy Cost
- Grid Flexible
- Reliability First

Policies change dispatch, utilization, storage, and economic outcomes.

The effects should be visible and quantitatively understandable.

A Grid Flexible data center might earn lower compute revenue but greater grid-service payments during a shortage event.

An optimized data center might generate more compute using the same electricity.

Provide straightforward feedback rather than forcing players to understand power engineering.

## 11. Research technology tree

Build a real interactive technology tree with at least 15 technologies.

Suggested branches:

**Compute**
- Efficient GPUs
- Advanced Cooling
- Liquid Cooling
- AI Accelerators
- Next-Generation AI Factories

**Energy**
- Improved Solar Cells
- Advanced Wind Turbines
- High-Density Batteries
- Smart Grid Dispatch
- Advanced Nuclear

**Optimization**
- GPU Power Management
- Workload Scheduling
- Adaptive Inference
- Demand Response
- Autonomous Fleet Optimization

**Infrastructure**
- High-Voltage Transmission
- Modular Substations
- Grid Interconnection
- Advanced Grid Operations

Unlocks must affect actual game mechanics.

Research should offer meaningful strategic choices; not every technology should be affordable within a normal game.

## 12. Victory conditions

Support three victory paths.

### Compute Dominance

Control at least 60% of the total compute market for three consecutive turns.

### Energy Empire

Achieve a high threshold of controlled reliable generation and grid infrastructure while maintaining excellent financial performance.

### Technology Leadership

Complete the ultimate AI infrastructure technology and sustain a specified level of efficient compute production.

Also implement a fixed-turn score victory, for example at turn 40.

Victory must be attainable by different strategies.

Show victory progress in the game UI.

## 13. Early game and initial balance

Start each player with:

- One starter data center.
- One nearby power source.
- One connected substation.
- A modest treasury.
- A small amount of revealed territory.
- Basic construction and exploration technologies.

The opening five turns should teach:

1. How electricity supports compute.
2. How compute generates credits.
3. How expansion creates opportunities.
4. Why transmission matters.
5. How technology improves efficiency.

The player should reach a compelling strategic decision by turn three.

Do not front-load the experience with tutorials or dense explanations.

Use contextual onboarding and discovery.

## 14. Essential feedback and visualizations

Players must clearly understand their electrical network and economy.

Implement:

### Power overlay

Color tiles or links according to available capacity, congestion, or disconnection.

### Compute overlay

Show data center throughput and utilization.

### Ownership overlay

Show claimed territory and competitor borders.

### Economic overlay

Show high-value terrain, construction potential, and expected profitability.

### Turn summary

Display:

- Electricity generated
- Electricity consumed
- Compute completed
- Revenue
- Operating expenses
- Net profit
- Research earned
- Grid events
- Most important changes since prior turn

Use satisfying visual transitions and easy-to-understand numbers.

Add small charts/sparklines for empire performance if they make the interface better.

## 15. Art direction and delight

I want the presentation to be notably better than a typical programmer-created game.

Set a cohesive artistic direction before implementation.

Target:

- Stylized miniature industrial world.
- Carefully selected palette with readable terrain and player colors.
- Attractive isometric buildings with recognizable silhouettes.
- Animated infrastructure.
- Energy moving through power networks.
- Subtle atmospheric lighting and environmental effects.
- Clean, responsive interface panels.
- Strong visual hierarchy and spacing.
- A sense of scale as the infrastructure empire grows.

Create memorable visual moments:

- A new nuclear power plant energizing nearby cities.
- Transmission lines lighting up after a connection is completed.
- Data center campuses growing into huge AI factories.
- Solar generation fading as a storm front arrives.
- Data centers entering flexible mode during a grid emergency.
- A competitor claiming a strategically valuable transmission chokepoint.

If generated artwork is needed, create it using SVG, Canvas, procedural techniques, or available asset-generation tools.

Avoid emoji as final game assets.

No placeholder rectangles or generic UI kits masquerading as a finished game.

Provide sound effects and optional background music when feasible, with a mute toggle.

## 16. Engineering architecture

Separate concerns into clear modules:

- GameState
- WorldGenerator
- TileSystem
- EconomySystem
- PowerGridSystem
- PowerDispatchSystem
- ComputeSystem
- ResearchSystem
- MarketSystem
- EventSystem
- TerritorySystem
- AIStrategySystem
- VictorySystem
- SaveLoadSystem
- Renderer
- UI

Maintain a single authoritative simulation state.

Gameplay logic must not be embedded directly in rendering components.

Use typed definitions for:

- Tiles
- Structures
- Players
- Research nodes
- Turns
- Events
- Power networks
- Transactions
- AI actions

Use pure, testable functions where possible.

Centralize economic balance values to enable rapid tuning.

Support deterministic random seeds for map generation and event sequences.

## 17. Automated testing and gameplay validation

This is a requirement, not an optional polish step.

Implement automated tests covering:

- Power dispatch and generation limits.
- Grid connections and disconnected islands.
- Transmission bottlenecks.
- Battery state-of-charge conservation.
- Data center electricity consumption.
- PUE effects.
- Research unlocks.
- Territory ownership.
- Construction costs.
- AI action legality.
- Victory conditions.
- Serialization/save-load.
- Deterministic turn resolution.

Also implement headless simulation tests.

Run several complete AI-only matches on different seeds.

Use those runs to identify:

- Crashes.
- Stalled economies.
- AI opponents that stop expanding.
- Impossible victory conditions.
- Runaway resource accumulation.
- Unbalanced dominant strategies.
- Long game resolution times.

Rebalance parameters based on observed results.

Whenever practical, use browser automation to test actual interactions, screenshots, and layouts.

## 18. Scope and development priorities

You have autonomy to implement the game end to end, but prioritize a strong, complete core loop over an enormous unfinished feature set.

Priority 0 — Fully playable:
- Map.
- Turn system.
- Territory expansion.
- Power generation.
- Grid connectivity.
- Data centers.
- Compute revenue.
- Construction.
- Basic economy.
- AI opponents.
- Victory conditions.

Priority 1 — Core differentiation:
- Weather.
- Research tree.
- Batteries.
- Dynamic markets.
- Compute optimization.
- Operating policies.
- Grid overlays.
- Meaningful competitor strategies.

Priority 2 — Finish:
- High-quality visual assets.
- Animations.
- Audio.
- Tutorial.
- Save/load.
- Polish.
- Balance.

Implement all three priority levels as far as possible. If time or complexity becomes restrictive, simplify secondary systems rather than delivering an unplayable game.

No dead-end menu buttons. No fake features. No nonfunctional UI.

Do not add controls for mechanics that are not implemented.

## 19. Definition of done

The game is complete only when:

- I can launch it locally using documented commands.
- I can start a new game from the main menu.
- A procedurally generated map appears.
- I can explore, claim land, and construct infrastructure.
- Electricity flows through connected power networks.
- My data centers consume electricity and produce compute.
- Compute produces revenue.
- I can build multiple data centers and power plants.
- Different buildings create real strategic tradeoffs.
- I can research technologies that alter gameplay.
- I can build and operate battery storage.
- I can compete against three AI companies.
- AI competitors expand and develop credible strategies.
- The game resolves turns correctly.
- Weather and market events affect economics.
- Victory or defeat can actually occur.
- I can save and resume games.
- The interface is polished, coherent, and responsive.
- Core automated tests pass.
- At least several complete simulated games finish without errors.

Do not report success solely because the application compiles.

## 20. Deliverables

Deliver a fully working project in the current repository.

Include:

1. Complete source code and assets.
2. `README.md` with install, run, build, and test instructions.
3. `GAME_DESIGN.md` describing mechanics and balance.
4. `ARCHITECTURE.md` explaining simulation and rendering architecture.
5. `BALANCE.md` documenting initial game parameters and results of simulated matches.
6. Screenshots of the playable game, captured from the actual running application.
7. Automated tests.
8. A production build.
9. A concise final summary including implemented mechanics, testing results, and any known limitations.

If the repository already contains relevant code, inspect and reuse or refactor it intelligently rather than replacing useful existing work.

## 21. Execution instructions — critical

**Do not request additional input.**

**Do not merely generate an implementation plan.**

Execute autonomously in this order:

1. Inspect the repository and development environment.
2. Choose and document the technology stack.
3. Build the deterministic game simulation.
4. Implement the map and core interactions.
5. Implement the power and compute economy.
6. Implement rival AI.
7. Implement research, storage, markets, and victory.
8. Integrate the complete gameplay loop.
9. Develop and polish the visual presentation.
10. Run unit tests and headless complete-game simulations.
11. Launch the application and validate the UI using screenshots or browser automation.
12. Fix discovered bugs and usability problems.
13. Refine game balance.
14. Produce documentation and final artifacts.

Do not stop after an intermediate milestone unless a genuine external limitation makes further progress impossible.

If an implementation choice is uncertain, select the option that creates the most enjoyable, coherent, and visually compelling game with the fewest dependencies.

Think like a game designer, not a simulation engineer. Scientific plausibility matters, but entertaining and comprehensible gameplay comes first.

### Final quality bar

A new player should be able to understand the basics in five minutes, enjoy meaningful strategy within ten minutes, and want to start another game after finishing their first.

**Build GRIDPOWER. Make it beautiful. Make it strategic. Make it playable.**
