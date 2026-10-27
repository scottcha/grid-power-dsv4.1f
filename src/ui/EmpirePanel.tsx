import type { JSX } from 'react';
import { useGame, useHumanPlan, useHumanPlayer } from './store';
import { MARKET, POLICIES, VICTORY } from '../engine/balance';
import { victoryProgress, playerScore } from '../engine/derived';
import type { GameState, PolicyId } from '../engine/types';
import { fmt, money, pct } from './format';
import { BoltIcon, ChipIcon, FlaskIcon, ShieldIcon } from './icons';

export function EmpirePanel(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const player = useHumanPlayer();
  const plan = useHumanPlan();
  if (!game || !player || !plan) return null;
  const progress = victoryProgress(game, 0);
  const ranking = game.players
    .filter((p) => !p.eliminated)
    .map((p) => ({ player: p, score: playerScore(game, p.id) }))
    .sort((a, b) => b.score - a.score);
  const report = game.report?.players.find((r) => r.playerId === 0);

  return (
    <>
      <div className="panel">
        <div className="panel-title">
          <span>Empire</span>
          <span style={{ color: 'var(--faint)', fontSize: 9 }}>Turn {game.turn}</span>
        </div>
        <div className="panel-body">
          <div className="summary-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <MiniStat icon={<BoltIcon size={14} color="#6cc7ff" />} label="Delivered" value={`${fmt(plan.delivered)} MW`} sub={`of ${fmt(plan.demand)} requested`} />
            <MiniStat icon={<ChipIcon size={14} color="#b18cff" />} label="Compute" value={`${fmt(report?.compute ?? plan.compute)} CU`} sub={`${pct(player.stats.share, 1)} share`} />
            <MiniStat icon={<FlaskIcon size={14} color="#7dfccb" />} label="Research" value={`${fmt(player.researchPoints)} RP`} sub={`+${(report?.research ?? 0).toFixed(1)} per turn`} />
            <MiniStat icon={<ShieldIcon size={14} color="#f2c45b" />} label="Stability" value={pct(plan.stability)} sub={`${plan.islands.length} island${plan.islands.length === 1 ? '' : 's'}`} />
          </div>
          <div className="sep" />
          <Sparkline game={game} />
          <div className="kv">
            <span>Net profit last turn</span>
            <strong style={{ color: (report?.netProfit ?? 0) >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
              {money(report?.netProfit ?? 0)}
            </strong>
          </div>
          <div className="kv">
            <span>Compute efficiency</span>
            <strong>{plan.dcEfficiency.toFixed(1)} CU/MW</strong>
          </div>
          <div className="kv">
            <span>Market clearing</span>
            <strong>${(game.conditions.computePrice * game.marketSaturation).toFixed(2)}/CU</strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>Electrical islands</span>
          <span style={{ color: 'var(--faint)', fontSize: 9 }}>{plan.congested} congested</span>
        </div>
        <div className="panel-body">
          {plan.islands.length === 0 && <div className="empty-note">Build generation and data centers to create a grid.</div>}
          {plan.islands.map((island) => (
            <div key={island.id} style={{ marginBottom: 8 }}>
              <div className="kv">
                <span>Island {island.id + 1}</span>
                <strong className={island.stability > 0.7 ? 'good' : island.stability > 0.45 ? 'warn' : 'bad'}>
                  {pct(island.stability)} stable
                </strong>
              </div>
              <div className="bar">
                <span style={{ width: `${Math.min(100, (island.genCap / Math.max(1, island.demand)) * 100)}%` }} />
              </div>
              <div className="bar-label">
                <span>{fmt(island.genCap)} MW capacity</span>
                <span>{fmt(island.demand)} MW load</span>
              </div>
              {(island.shortfall > 0.4 || island.congested > 0) && (
                <div className="empty-note" style={{ color: 'var(--gold)', marginTop: 3 }}>
                  {island.shortfall > 0.4 ? `${fmt(island.shortfall)} MW unserved. ` : ''}
                  {island.congested > 0 ? `${island.congested} congested link(s).` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>Victory paths</span>
          <span style={{ color: 'var(--faint)', fontSize: 9 }}>Turn {game.turn}/{game.settings.maxTurns}</span>
        </div>
        <div className="panel-body">
          <ProgressLine
            label="Compute dominance"
            value={`${pct(progress.computeShare, 1)}`}
            goal={`${pct(progress.computeGoal)} · ${progress.computeStreak}/${progress.computeTurns} turns`}
            fill={progress.computeShare / progress.computeGoal}
            tone="violet"
          />
          <ProgressLine
            label="Energy empire"
            value={`${fmt(progress.firmGen)} MW firm`}
            goal={`${fmt(progress.gridGoal)} links · $${progress.treasuryGoal} · $${progress.profitGoal} profit`}
            fill={Math.min(progress.firmGen / progress.firmGoal, progress.gridLinks / progress.gridGoal, progress.treasury / progress.treasuryGoal)}
            tone="gold"
          />
          <ProgressLine
            label="Technology leadership"
            value={progress.hasUltimate ? `${progress.efficiency.toFixed(1)} CU/MW` : 'Autonomous Fleet locked'}
            goal={`${progress.efficiencyGoal} CU/MW · ${progress.leadershipStreak}/${progress.leadershipTurns} turns`}
            fill={progress.hasUltimate ? progress.efficiency / progress.efficiencyGoal : 0}
            tone=""
          />
          <div className="kv" style={{ marginTop: 6 }}>
            <span>Grid links</span>
            <strong>
              {progress.gridLinks} / {progress.gridGoal}
            </strong>
          </div>
          <div className="kv">
            <span>Score victory at turn {game.settings.maxTurns}</span>
            <strong>{fmt(playerScore(game, 0))} pts</strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>Rivals</span>
          <span style={{ color: 'var(--faint)', fontSize: 9 }}>by score</span>
        </div>
        <div className="panel-body">
          {ranking.map(({ player: rival, score }) => (
            <div className="rival-row" key={rival.id}>
              <span className="rival-dot" style={{ background: rivalColor(rival.id), color: rivalColor(rival.id) }} />
              <span className="rival-name">{rival.company}</span>
              <span className="rival-meta">
                {rival.eliminated ? 'wound up' : `${pct(rival.stats.share, 0)} · ${fmt(score)} pts`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>Default operating policy</span>
        </div>
        <div className="panel-body">
          <div className="empty-note" style={{ marginBottom: 7 }}>
            {POLICIES[player.defaultPolicy].blurb}
          </div>
          <div className="policy-grid">
            {(Object.keys(POLICIES) as PolicyId[]).map((id) => (
              <button
                key={id}
                className={`policy-btn ${player.defaultPolicy === id ? 'active' : ''}`}
                title={POLICIES[id].blurb}
                onClick={() => useGame.getState().setPolicy(id)}
              >
                {POLICIES[id].name}
              </button>
            ))}
          </div>
          <div className="empty-note" style={{ marginTop: 7 }}>
            Baseline compute price ${MARKET.computeBase.toFixed(2)}/CU · base electricity ${MARKET.elecBase.toFixed(2)}/MW
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ icon, label, value, sub }: { icon: JSX.Element; label: string; value: string; sub: string }): JSX.Element {
  return (
    <div className="stat-card">
      <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function ProgressLine({
  label,
  value,
  goal,
  fill,
  tone,
}: {
  label: string;
  value: string;
  goal: string;
  fill: number;
  tone: string;
}): JSX.Element {
  return (
    <div className="progress-line">
      <div className="head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={`bar ${tone}`}>
        <span style={{ width: `${Math.max(2, Math.min(100, fill * 100))}%` }} />
      </div>
      <div className="bar-label">
        <span>{goal}</span>
      </div>
    </div>
  );
}

function Sparkline({ game }: { game: GameState }): JSX.Element | null {
  const history = game.players[0].history;
  if (history.length < 2) {
    return <div className="empty-note">Empire charts appear after your first full turn.</div>;
  }
  const width = 280;
  const height = 46;
  const max = Math.max(...history.map((h) => h.compute), 1);
  const points = history
    .map((h, i) => `${(i / (history.length - 1)) * width},${height - (h.compute / max) * (height - 6) - 3}`)
    .join(' ');
  const creditMax = Math.max(...history.map((h) => h.credits), 1);
  const creditPoints = history
    .map((h, i) => `${(i / (history.length - 1)) * width},${height - (h.credits / creditMax) * (height - 6) - 3}`)
    .join(' ');
  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={creditPoints} fill="none" stroke="rgba(242,196,91,0.55)" strokeWidth="1.4" />
        <polyline points={points} fill="none" stroke="#4dd6c1" strokeWidth="1.8" />
      </svg>
      <div className="bar-label">
        <span style={{ color: '#4dd6c1' }}>Compute</span>
        <span style={{ color: 'var(--gold)' }}>Credits</span>
      </div>
      <div style={{ height: 4 }} />
    </div>
  );
}

export function rivalColor(id: number): string {
  return ['#4dd6c1', '#f5c04a', '#ff6b6b', '#a78bfa'][id] ?? '#8fa9b5';
}

export const victoryGoals = VICTORY;
