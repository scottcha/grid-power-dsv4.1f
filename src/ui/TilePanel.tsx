import type { JSX } from 'react';
import { useGame, useHumanPlan, useHumanPlayer } from './store';
import type { GameState, PolicyId, StructureType } from '../engine/types';
import { POLICIES, STRUCTURES, TERRAIN_INFO, TECH_MAP } from '../engine/balance';
import { batteryStats, buildCost, generationCapacity, policyUtil } from '../engine/compute';
import { canBuild, canUpgrade, claimCost, isRevealed } from '../engine/actions';
import { structureUnlocked, techSummary } from '../engine/tech';
import { STRUCTURE_ICONS } from './buildingIcons';
import { fmt, money, pct } from './format';

export function TilePanel(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.selected);
  const plan = useHumanPlan();
  const player = useHumanPlayer();
  if (!game || !selected || !player || !plan) return null;
  const tile = game.tiles[selected.y * game.width + selected.x];
  if (!tile) return null;
  const info = TERRAIN_INFO[tile.terrain];
  const revealed = isRevealed(tile, 0);
  const structure = tile.structure;
  const mods = techSummary(player.techs);
  const node = plan.nodes.find((n) => n.x === tile.x && n.y === tile.y);
  const island = node ? plan.islands[node.island] : null;
  const ownerName = tile.owner >= 0 ? game.players[tile.owner].company : 'Unclaimed';
  const ownerColor = tile.owner >= 0 ? ['#4dd6c1', '#f5c04a', '#ff6b6b', '#a78bfa'][tile.owner] : '#8fa9b5';
  const claimable =
    revealed &&
    tile.owner === -1 &&
    tile.terrain !== 'ocean' &&
    hasNeighbour(game, tile.x, tile.y) &&
    player.credits >= claimCost(game, 0, tile);
  const claimPrice = claimCost(game, 0, tile);
  const upgrade = structure && structure.owner === 0 ? canUpgrade(game, 0, tile.x, tile.y) : { ok: false as const };
  const buildHere = structure ? [] : (Object.keys(STRUCTURES) as StructureType[]).map((type) => ({
    type,
    check: canBuild(game, 0, type, tile.x, tile.y),
    cost: buildCost(type, mods),
    locked: !structureUnlocked(player, type),
  }));
  const ownerIsMe = tile.owner === 0;

  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      <div className="tile-head">
        <div className="tile-swatch" style={{ background: revealed ? tileSwatch(tile.terrain) : '#122a35' }}>
          {!revealed ? (
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, color: 'var(--faint)' }}>?</span>
          ) : structure ? (
            STRUCTURE_ICONS[structure.type](22)
          ) : (
            <TerrainGlyph terrain={tile.terrain} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div className="tile-title">
            {!revealed ? 'Unexplored tile' : structure ? STRUCTURES[structure.type].name : info.name}
          </div>
          <div className="tile-sub">
            Tile {tile.x},{tile.y} · {revealed ? ownerName : 'no survey data'}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: ownerColor,
            border: `1px solid ${ownerColor}55`,
            borderRadius: 999,
            padding: '3px 7px',
            background: `${ownerColor}14`,
          }}
        >
          {!revealed ? 'fogged' : tile.owner === 0 ? 'yours' : tile.owner === -1 ? 'neutral' : 'rival'}
        </span>
      </div>

      <div className="panel-body">
        {!revealed ? (
          <>
            <div className="empty-note">
              Unsurveyed territory. Deploy a survey drone to reveal resources within 3 tiles.
            </div>
            <button
              className="btn wide"
              style={{ marginTop: 10 }}
              disabled={player.credits < 12}
              onClick={() => useGame.getState().survey()}
            >
              Survey area · $12
            </button>
          </>
        ) : (
          <>
            <div className="kv">
              <span>Terrain</span>
              <strong>{info.name}</strong>
            </div>
            <div className="kv">
              <span>Claim value</span>
              <strong>{info.claimValue.toFixed(1)}</strong>
            </div>
            {tile.terrain !== 'ocean' && (
              <>
                <div className="kv">
                  <span>Solar / wind potential</span>
                  <strong>
                    {pct(info.solar, 0)} / {pct(info.wind, 0)}
                  </strong>
                </div>
                <div className="kv">
                  <span>Cooling factor</span>
                  <strong>{pct(info.cooling, 0)}</strong>
                </div>
              </>
            )}

            {structure && node && (
              <>
                <div className="sep" />
                <StructureDetails
                  state={game}
                  node={node}
                  structure={structure}
                  islandStability={island?.stability ?? 0.8}
                />
                {structure.owner === 0 && (
                  <>
                    {STRUCTURES[structure.type].dc && (
                      <>
                        <div className="sep" />
                        <div className="bar-label">
                          <span>Operating policy</span>
                          <span>{POLICIES[structure.policy].name}</span>
                        </div>
                        <div className="policy-grid" style={{ marginTop: 5 }}>
                          {(Object.keys(POLICIES) as PolicyId[]).map((id) => (
                            <button
                              key={id}
                              className={`policy-btn ${structure.policy === id ? 'active' : ''}`}
                              title={POLICIES[id].blurb}
                              onClick={() => useGame.getState().setPolicy(id, tile.x, tile.y)}
                            >
                              {POLICIES[id].name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="btn-row" style={{ marginTop: 10 }}>
                      {upgrade.ok && upgrade.to && (
                        <button className="btn small" onClick={() => useGame.getState().upgrade()}>
                          Upgrade → {STRUCTURES[upgrade.to].short} · ${fmt(upgrade.cost ?? 0)}
                        </button>
                      )}
                      <button className="btn small danger" onClick={() => useGame.getState().demolish()}>
                        Demolish · +${fmt(Math.round(STRUCTURES[structure.type].cost * 0.25))}
                      </button>
                    </div>
                  </>
                )}
                {structure.owner === -1 && (
                  <>
                    <div className="sep" />
                    <div className="empty-note">
                      Pre-existing neutral infrastructure. Claim this tile to take control of the
                      {' '}
                      {STRUCTURES[structure.type].name.toLowerCase()} and its {STRUCTURES[structure.type].tie} MW interconnects.
                    </div>
                  </>
                )}
              </>
            )}

            {!structure && ownerIsMe && (
              <>
                <div className="sep" />
                <div className="bar-label">
                  <span>Build here</span>
                  <span>{player.credits >= 0 ? money(player.credits) : ''}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                  {buildHere.map((entry) => (
                    <button
                      key={entry.type}
                      className="btn small"
                      disabled={!entry.check.ok}
                      title={
                        entry.locked
                          ? `Requires ${TECH_MAP[STRUCTURES[entry.type].tech ?? '']?.name ?? 'technology'}`
                          : entry.check.error ?? STRUCTURES[entry.type].desc
                      }
                      onClick={() => useGame.getState().startBuild(entry.type)}
                    >
                      {STRUCTURE_ICONS[entry.type](13)} {STRUCTURES[entry.type].short}
                    </button>
                  ))}
                  {buildHere.every((entry) => !entry.check.ok) && (
                    <div className="empty-note">This plot cannot host any available structure.</div>
                  )}
                </div>
              </>
            )}

            {!structure && !ownerIsMe && tile.owner === -1 && (
              <>
                <div className="sep" />
                {claimable ? (
                  <button className="btn wide gold" onClick={() => useGame.getState().claim()}>
                    Claim territory · ${claimPrice}
                  </button>
                ) : (
                  <div className="empty-note">
                    {tile.terrain === 'ocean'
                      ? 'Open water cannot be claimed.'
                      : hasNeighbour(game, tile.x, tile.y)
                        ? 'Not enough credits to claim this tile.'
                        : 'Claim a bordering tile first.'}
                  </div>
                )}
              </>
            )}
            {tile.owner > 0 && (
              <div className="empty-note" style={{ marginTop: 10 }}>
                Rival asset. Contest it by expanding around it and outbuilding its grid.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StructureDetails({
  state,
  node,
  structure,
  islandStability,
}: {
  state: GameState;
  node: NonNullable<ReturnType<typeof useHumanPlan>>['nodes'][number];
  structure: NonNullable<GameState['tiles'][number]['structure']>;
  islandStability: number;
}): JSX.Element {
  const def = STRUCTURES[structure.type];
  const player = state.players[0];
  const mods = techSummary(player.techs);
  const tile = state.tiles[node.y * state.width + node.x];
  const servedRatio = node.demand > 0 ? node.served / node.demand : 1;
  return (
    <>
      {!hasGridNeighbour(state, node.x, node.y) && (
        <>
          <div className="empty-note" style={{ color: 'var(--gold)' }}>
            Isolated: this facility touches no other structure of yours, so no power can flow. Build adjacent
            generation or a line to connect it.
          </div>
          <div className="sep" />
        </>
      )}
      {def.dc && (
        <>
          <div className="kv">
            <span>IT capacity</span>
            <strong>{def.dc.it} MW</strong>
          </div>
          <div className="kv">
            <span>PUE</span>
            <strong>{node.pue.toFixed(2)}</strong>
          </div>
          <div className="kv">
            <span>Utilisation target</span>
            <strong>{pct(policyUtil(structure, state.conditions))}</strong>
          </div>
          <div className="kv">
            <span>Power</span>
            <strong className={servedRatio > 0.96 ? 'good' : servedRatio > 0.7 ? 'warn' : 'bad'}>
              {node.served.toFixed(1)} / {node.demand.toFixed(1)} MW
            </strong>
          </div>
          <div className="bar-label">
            <span>Delivered</span>
            <span>{pct(servedRatio)}</span>
          </div>
          <div className={`bar ${servedRatio > 0.96 ? '' : servedRatio > 0.7 ? 'gold' : 'bad'}`}>
            <span style={{ width: `${Math.min(100, servedRatio * 100)}%` }} />
          </div>
          <div className="kv">
            <span>Compute output</span>
            <strong>{fmt(node.compute)} CU</strong>
          </div>
          <div className="kv">
            <span>Revenue</span>
            <strong className="good">{money(node.revenue)}</strong>
          </div>
          <div className="kv">
            <span>Grid stability</span>
            <strong>{pct(islandStability)}</strong>
          </div>
          <div className="kv">
            <span>Cooling environment</span>
            <strong>{pct(TERRAIN_INFO[tile.terrain].cooling)}</strong>
          </div>
        </>
      )}
      {def.generation && (
        <>
          <div className="kv">
            <span>Installed capacity</span>
            <strong>{def.generation.mw} MW</strong>
          </div>
          <div className="kv">
            <span>Available this turn</span>
            <strong>{generationCapacity(tile, structure, state.conditions, mods).toFixed(1)} MW</strong>
          </div>
          <div className="kv">
            <span>Dispatched</span>
            <strong className={node.produced > 0 ? 'good' : ''}>{node.produced.toFixed(1)} MW</strong>
          </div>
          <div className="kv">
            <span>Marginal cost</span>
            <strong>{node.marginal > 0 ? `$${node.marginal.toFixed(2)}/MW` : 'free'}</strong>
          </div>
          <div className="kv">
            <span>Type</span>
            <strong>{def.generation.reliable ? 'Firm / dispatchable' : 'Weather-driven'}</strong>
          </div>
        </>
      )}
      {def.battery && (
        <>
          <BatterySoc state={state} structure={structure} />
          <div className="kv">
            <span>Power rating</span>
            <strong>{batteryStats(def, mods).power.toFixed(0)} MW</strong>
          </div>
          <div className="kv">
            <span>Capacity</span>
            <strong>{batteryStats(def, mods).capacity.toFixed(0)} MWh</strong>
          </div>
          <div className="kv">
            <span>Efficiency</span>
            <strong>{pct(batteryStats(def, mods).eff)}</strong>
          </div>
          <div className="kv">
            <span>This turn</span>
            <strong>
              {node.served > 0.01 ? `charging ${node.served.toFixed(1)} MW` : node.produced > 0.01 ? `discharging ${node.produced.toFixed(1)} MW` : 'idle'}
            </strong>
          </div>
        </>
      )}
      {def.category === 'grid' && (
        <>
          <div className="kv">
            <span>Interconnect rating</span>
            <strong>{def.tie} MW</strong>
          </div>
          <div className="kv">
            <span>Role</span>
            <strong>{structure.type === 'substation' ? 'Hub · market gateway' : 'Transmission link'}</strong>
          </div>
          <div className="kv">
            <span>Island load</span>
            <strong>{node.kind === 'grid' ? `${node.island + 1}` : '—'}</strong>
          </div>
          <div className="empty-note" style={{ marginTop: 6 }}>
            {structure.type === 'substation'
              ? 'Substations unlock imports (+22 MW) and exports (18 MW) when the island is short or long on power.'
              : 'Lines carry 30 MW. Build them to bridge generation and loads across the map.'}
          </div>
        </>
      )}
      {def.labResearch && (
        <>
          <div className="kv">
            <span>Research</span>
            <strong className="good">+{def.labResearch} RP</strong>
          </div>
          <div className="kv">
            <span>Power draw</span>
            <strong>{node.served.toFixed(1)} / 1.0 MW</strong>
          </div>
        </>
      )}
    </>
  );
}

function BatterySoc({ state, structure }: { state: GameState; structure: NonNullable<GameState['tiles'][number]['structure']> }): JSX.Element {
  const def = STRUCTURES[structure.type];
  const mods = techSummary(state.players[0].techs);
  const stats = batteryStats(def, mods);
  const soc = Math.max(0, Math.min(stats.capacity, structure.soc));
  return (
    <>
      <div className="bar-label">
        <span>State of charge</span>
        <span>
          {soc.toFixed(0)} / {stats.capacity.toFixed(0)} MWh
        </span>
      </div>
      <div className="bar violet">
        <span style={{ width: `${stats.capacity > 0 ? (soc / stats.capacity) * 100 : 0}%` }} />
      </div>
    </>
  );
}

function hasGridNeighbour(state: GameState, x: number, y: number): boolean {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as Array<[number, number]>) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
    const other = state.tiles[ny * state.width + nx];
    if (other.structure && other.structure.owner === 0) return true;
  }
  return false;
}

function tileSwatch(terrain: string): string {
  const map: Record<string, string> = {
    ocean: '#155a72',
    plains: '#4f8a45',
    desert: '#b99a5c',
    mountain: '#6e7480',
    forest: '#2f613c',
    river: '#3a8ba8',
    coast: '#b3a471',
    geothermal: '#8a5f49',
    urban: '#6d717e',
    basin: '#8c6c46',
  };
  return map[terrain] ?? '#4f8a45';
}

function TerrainGlyph({ terrain }: { terrain: string }): JSX.Element {
  const color = '#e8f6f8';
  if (terrain === 'mountain') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="m3 19 6-11 4 6 3-4 5 9H3Z" />
      </svg>
    );
  }
  if (terrain === 'forest') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M12 3 7 12h10L12 3ZM12 7l-3 7h6l-3-7ZM12 16v5" />
      </svg>
    );
  }
  if (terrain === 'ocean') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
        <path d="M3 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2M3 17c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
      <path d="M4 17h16M6 13h12M9 9h6" />
    </svg>
  );
}

function hasNeighbour(game: GameState, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= game.width || ny >= game.height) continue;
      if (game.tiles[ny * game.width + nx].owner === 0) return true;
    }
  }
  return false;
}
