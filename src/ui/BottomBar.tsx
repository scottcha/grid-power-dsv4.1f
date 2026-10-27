import type { JSX } from 'react';
import { useGame, useHumanPlayer } from './store';
import { STRUCTURES, TECH_MAP } from '../engine/balance';
import { buildCandidates, claimCost, isRevealed } from '../engine/actions';
import { buildCost } from '../engine/compute';
import { structureTech, structureUnlocked, techSummary } from '../engine/tech';
import { BUILD_GROUPS, STRUCTURE_ICONS } from './buildingIcons';
import { fmt, money } from './format';
import { BoltIcon, CloseIcon, LockIcon } from './icons';

export function BottomBar(): JSX.Element {
  const game = useGame((s) => s.game);
  const player = useHumanPlayer();
  const buildMode = useGame((s) => s.buildMode);
  const selected = useGame((s) => s.selected);
  const startBuild = useGame((s) => s.startBuild);
  const cancelBuild = useGame((s) => s.cancelBuild);
  const claim = useGame((s) => s.claim);
  const survey = useGame((s) => s.survey);
  const doEndTurn = useGame((s) => s.doEndTurn);
  if (!game || !player) return <div />;
  const mods = techSummary(player.techs);
  const selectedTile = selected ? game.tiles[selected.y * game.width + selected.x] : null;
  const canClaim =
    selectedTile !== null &&
    isRevealed(selectedTile, 0) &&
    selectedTile.owner === -1 &&
    selectedTile.terrain !== 'ocean' &&
    hasOwnedNeighbour(game, selectedTile.x, selectedTile.y) &&
    player.credits >= claimCost(game, 0, selectedTile);
  const claimPrice = selectedTile ? claimCost(game, 0, selectedTile) : 0;
  const surveyTarget = selectedTile !== null && !isRevealed(selectedTile, 0);

  return (
    <div className="bottom-bar panel">
      <div className="build-groups">
        {BUILD_GROUPS.map((group) => (
          <div className="build-group" key={group.label}>
            <div className="build-group-label">{group.label}</div>
            <div className="build-group-items">
              {group.types.map((type) => {
                const def = STRUCTURES[type];
                const locked = !structureUnlocked(player, type);
                const cost = buildCost(type, mods);
                const hasPlot = buildCandidates(game, 0, type).length > 0;
                const affordable = player.credits >= cost;
                const tech = structureTech(type);
                return (
                  <button
                    key={type}
                    className={`build-btn ${buildMode === type ? 'active' : ''}`}
                    disabled={locked || !affordable || !hasPlot}
                    title={
                      locked
                        ? `Requires ${TECH_MAP[tech ?? '']?.name ?? 'technology'}`
                        : !hasPlot
                          ? 'Claim a suitable plot first'
                          : `${def.name} — ${def.desc}`
                    }
                    onClick={() => (buildMode === type ? cancelBuild() : startBuild(type))}
                  >
                    {locked && (
                      <span className="lock">
                        <LockIcon size={10} />
                      </span>
                    )}
                    <span className="bicon">{STRUCTURE_ICONS[type](19)}</span>
                    <span className="bname">{def.short}</span>
                    <span className="bcost">{locked ? 'locked' : `$${cost}`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="build-group" style={{ justifyContent: 'flex-end' }}>
        <div className="build-group-label">Territory</div>
        <div className="build-group-items">
          <button
            className="build-btn"
            disabled={!canClaim}
            title={selectedTile ? `Claim this tile for $${claimPrice}` : 'Select an adjacent unclaimed tile'}
            onClick={claim}
          >
            <span className="bicon">
              <BoltIcon size={18} color="#f2c45b" />
            </span>
            <span className="bname">Claim</span>
            <span className="bcost">{canClaim ? `$${claimPrice}` : '—'}</span>
          </button>
          <button
            className="build-btn"
            disabled={!surveyTarget || player.credits < 12}
            title="Survey a fogged tile within range (12 credits)"
            onClick={survey}
          >
            <span className="bicon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9fd8ff" strokeWidth="1.7">
                <circle cx="11" cy="11" r="6.4" />
                <path d="m16 16 4 4" />
              </svg>
            </span>
            <span className="bname">Survey</span>
            <span className="bcost">$12</span>
          </button>
          {buildMode && (
            <button className="build-btn" onClick={cancelBuild} title="Cancel placement (Esc)">
              <span className="bicon">
                <CloseIcon size={16} />
              </span>
              <span className="bname">Cancel</span>
              <span className="bcost">Esc</span>
            </button>
          )}
        </div>
      </div>

      <div className="turn-controls">
        <button
          className="btn primary end-turn"
          onClick={doEndTurn}
          disabled={game.phase !== 'playing'}
          title="Resolve production and end the turn (Space)"
        >
          {game.phase === 'playing' ? 'End Turn' : 'Game Over'}
          <span className="key">Space</span>
        </button>
        <div className="hint">
          {buildMode
            ? `Placing ${STRUCTURES[buildMode].name} — click a highlighted tile`
            : `${fmt(player.stats.share * 100)}% compute share · ${money(player.credits)} available`}
        </div>
      </div>
    </div>
  );
}

function hasOwnedNeighbour(game: NonNullable<ReturnType<typeof useGame.getState>['game']>, x: number, y: number): boolean {
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
