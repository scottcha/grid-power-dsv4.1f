import { describe, expect, it } from 'vitest';
import { blankState, put } from './helpers';
import { planPower } from '../src/engine/grid';
import { batteryStats, dataCenterPue, generationCapacity, linkCapacity } from '../src/engine/compute';
import { STRUCTURES } from '../src/engine/balance';
import { techSummary } from '../src/engine/tech';
import { tileAt } from '../src/engine/worldgen';

describe('power dispatch', () => {
  it('serves a data center from an adjacent generator', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'solar');
    const plan = planPower(state, 0);
    expect(plan.demand).toBeGreaterThan(8);
    expect(plan.shortfall).toBeCloseTo(0, 5);
    expect(plan.delivered).toBeCloseTo(plan.demand, 5);
    expect(plan.genCap).toBeCloseTo(12, 5);
    expect(plan.imports).toBe(0);
  });

  it('throttles compute when solar output collapses and there is no market gateway', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'line');
    put(state, 7, 5, 'solar');
    state.conditions.solar = 0.4;
    const plan = planPower(state, 0);
    expect(plan.genCap).toBeCloseTo(4.8, 5);
    expect(plan.shortfall).toBeGreaterThan(4);
    expect(plan.curtailed).toBeCloseTo(0, 4);
  });

  it('imports from the market through a substation to cover a deficit', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'substation');
    const plan = planPower(state, 0);
    expect(plan.shortfall).toBeCloseTo(0, 5);
    expect(plan.imports).toBeGreaterThan(8);
    expect(plan.importCost).toBeGreaterThan(plan.imports * 1.1);
  });

  it('exports surplus renewable output through a substation', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'substation');
    put(state, 7, 5, 'solar');
    const plan = planPower(state, 0);
    expect(plan.genCap).toBeCloseTo(12, 5);
    expect(plan.exports).toBeGreaterThan(1);
    expect(plan.exportRevenue).toBeCloseTo(plan.exports * state.conditions.elecPrice * 0.78, 5);
  });

  it('keeps disconnected generation stranded rather than teleporting it', () => {
    const state = blankState();
    put(state, 2, 2, 'edge_dc');
    put(state, 3, 2, 'solar');
    put(state, 12, 12, 'solar');
    const plan = planPower(state, 0);
    expect(plan.islands.length).toBe(2);
    expect(plan.genCap).toBeCloseTo(24, 5);
    expect(plan.curtailed).toBeGreaterThan(10);
    expect(plan.shortfall).toBeCloseTo(0, 5);
  });

  it('is limited by the smaller interconnect rating', () => {
    const state = blankState();
    put(state, 5, 5, 'giga_dc');
    put(state, 6, 5, 'line');
    put(state, 7, 5, 'gas');
    put(state, 7, 6, 'solar');
    put(state, 8, 5, 'geothermal');
    const plan = planPower(state, 0);
    expect(plan.genCap).toBeGreaterThan(50);
    expect(plan.shortfall).toBeGreaterThan(20);
    expect(plan.congested).toBeGreaterThan(0);
  });

  it('relieves a bottleneck with a substation', () => {
    const state = blankState();
    put(state, 5, 5, 'giga_dc');
    put(state, 6, 5, 'substation');
    put(state, 7, 5, 'gas');
    put(state, 6, 6, 'solar');
    const plan = planPower(state, 0);
    expect(plan.genCap).toBeGreaterThan(40);
    expect(plan.shortfall).toBeLessThan(30);
  });

  it('conserves battery state of charge on charge and discharge', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    put(state, 6, 5, 'substation');
    put(state, 7, 5, 'solar');
    put(state, 6, 6, 'battery', 0, 'max_compute', 20);
    const chargePlan = planPower(state, 0);
    expect(chargePlan.batteryCharge).toBeGreaterThan(0);
    const battery = tileAt(state, 6, 6)?.structure;
    const stats = batteryStats(STRUCTURES.battery, techSummary([]));
    expect(chargePlan.nodes.find((n) => n.kind === 'storage')?.socAfter).toBeLessThanOrEqual(stats.capacity + 1e-6);

    state.conditions.solar = 0.2;
    const dischargePlan = planPower(state, 0);
    expect(dischargePlan.batteryDischarge).toBeGreaterThan(0);
    const node = dischargePlan.nodes.find((n) => n.kind === 'storage');
    if (!node || !battery) throw new Error('battery missing');
    expect(node.socAfter).toBeGreaterThanOrEqual(-1e-6);
    expect(node.socAfter).toBeLessThanOrEqual(stats.capacity + 1e-6);
    expect(node.socAfter).toBeCloseTo(node.soc - node.produced / stats.eff, 5);
  });

  it('applies weather, terrain and technology to generation capacity', () => {
    const state = blankState();
    put(state, 5, 5, 'solar');
    const tile = tileAt(state, 5, 5);
    if (!tile) throw new Error('tile');
    put(state, 7, 5, 'wind');
    const windTile = tileAt(state, 7, 5);
    if (!windTile) throw new Error('tile');
    windTile.terrain = 'mountain';
    const baseSolar = generationCapacity(tile, tile.structure!, state.conditions, techSummary([]));
    const baseWind = generationCapacity(windTile, windTile.structure!, state.conditions, techSummary([]));
    state.conditions.solar = 0.5;
    state.conditions.wind = 0.5;
    const dimSolar = generationCapacity(tile, tile.structure!, state.conditions, techSummary([]));
    expect(dimSolar).toBeCloseTo(baseSolar * 0.5, 5);
    expect(baseWind).toBeGreaterThan(10);
    const mods = techSummary(['solar_cells']);
    state.conditions.solar = 1;
    expect(generationCapacity(tile, tile.structure!, state.conditions, mods)).toBeCloseTo(baseSolar * 1.25, 5);
    void baseWind;
  });

  it('lowers PUE with cooling technology and coastal siting', () => {
    const state = blankState();
    put(state, 5, 5, 'edge_dc');
    const tile = tileAt(state, 5, 5)!;
    const def = STRUCTURES.edge_dc;
    const base = dataCenterPue(state, tile, def, state.conditions, techSummary([]));
    const cooled = dataCenterPue(state, tile, def, state.conditions, techSummary(['advanced_cooling', 'liquid_cooling']));
    expect(cooled).toBeLessThan(base);
    tile.terrain = 'coast';
    expect(dataCenterPue(state, tile, def, state.conditions, techSummary([]))).toBeLessThan(base);
    state.conditions.cooling = 1.15;
    expect(dataCenterPue(state, tile, def, state.conditions, techSummary([]))).toBeGreaterThan(
      dataCenterPue(state, tile, def, { ...state.conditions, cooling: 1 }, techSummary([])),
    );
  });

  it('increases link capacity with transmission technology', () => {
    expect(linkCapacity('line', techSummary(['hv_transmission']))).toBeGreaterThan(linkCapacity('line', techSummary([])));
  });
});
