import type { JSX } from 'react';
import { useGame, useHumanPlan, useHumanPlayer } from './store';
import { useShallow } from 'zustand/react/shallow';
import { fmt, money, pct, signed } from './format';
import { BoltIcon, ChipIcon, CoinIcon, FlaskIcon, LayersIcon, LogIcon, MenuIcon, MuteIcon, ShieldIcon, SoundIcon, TreeIcon } from './icons';

function WeatherDot({ weather }: { weather: string }): JSX.Element {
  const color =
    weather === 'clear'
      ? '#ffd479'
      : weather === 'heatwave'
        ? '#ff9a5c'
        : weather === 'cold_snap'
          ? '#a8dcff'
          : weather === 'storm'
            ? '#8fb6ff'
            : weather === 'wind_drought'
              ? '#c3d7e0'
              : '#e0b177';
  return <span className="weather-dot" style={{ background: color, color }} />;
}

export function TopBar(): JSX.Element {
  const game = useGame((s) => s.game);
  const plan = useHumanPlan();
  const player = useHumanPlayer();
  const { techOpen, logOpen, toggleTech, toggleLog, togglePause, muted, toggleMute, overlay } = useGame(
    useShallow((s) => ({
      techOpen: s.techOpen,
      logOpen: s.logOpen,
      toggleTech: s.toggleTech,
      toggleLog: s.toggleLog,
      togglePause: s.togglePause,
      muted: s.muted,
      toggleMute: s.toggleMute,
      overlay: s.overlay,
    })),
  );
  if (!game || !player || !plan) return <div />;
  const report = game.report?.players.find((p) => p.playerId === 0);
  const identity = [
    { color: '#4dd6c1', accent: '#a6fff2' },
    { color: '#f5c04a', accent: '#ffe6a3' },
    { color: '#ff6b6b', accent: '#ffc2c2' },
    { color: '#a78bfa', accent: '#ddd0ff' },
  ][0];
  const powerRatio = plan.demand > 0 ? Math.min(1.4, plan.delivered / plan.demand) : 1;
  const powerTone = powerRatio > 0.96 ? 'good' : powerRatio > 0.7 ? 'warn' : 'bad';
  const creditTone = player.credits < 25 ? 'warn' : '';
  const stabilityTone = player.stats.stability > 0.72 ? 'good' : player.stats.stability > 0.45 ? 'warn' : 'bad';
  const researchPerTurn = report?.research ?? 0;

  return (
    <div className="topbar">
      <div className="company">
        <div className="company-mark" style={{ background: `linear-gradient(140deg, ${identity.accent}, ${identity.color})` }}>
          NX
        </div>
        <div>
          <div className="company-name">{player.company}</div>
          <div className="company-sub">{player.ceo} · Grid Operator</div>
        </div>
      </div>

      <div className="turn-pill">
        <span className="num">Turn {game.turn}</span>
        <span className="of">/ {game.settings.maxTurns}</span>
      </div>
      <div className="weather-chip" title={game.conditions.description}>
        <WeatherDot weather={game.conditions.weather} />
        <span>{game.conditions.headline}</span>
      </div>

      <div className="resources">
        <div className={`resource ${creditTone}`} title={`Net ${money(report?.netProfit ?? 0)} last turn`}>
          <div className="resource-icon" style={{ color: '#f2c45b' }}>
            <CoinIcon size={17} />
          </div>
          <div className="resource-body">
            <div className="resource-value">
              {money(player.credits)}
              {report && <span className="delta">{signed(report.netProfit)}</span>}
            </div>
            <div className="resource-label">Credits</div>
          </div>
        </div>

        <div className={`resource ${powerTone}`} title="Power delivered vs requested this turn">
          <div className="resource-icon" style={{ color: '#6cc7ff' }}>
            <BoltIcon size={17} />
          </div>
          <div className="resource-body">
            <div className="resource-value">
              {fmt(plan.delivered)}
              <span className="delta">/ {fmt(plan.demand)} MW</span>
            </div>
            <div className="resource-label">Power</div>
          </div>
        </div>

        <div className="resource" title="Compute produced per turn and market share">
          <div className="resource-icon" style={{ color: '#a78bfa' }}>
            <ChipIcon size={17} />
          </div>
          <div className="resource-body">
            <div className="resource-value">
              {fmt(report?.compute ?? plan.compute)}
              <span className="delta">{pct(report?.share ?? player.stats.share, 0)}</span>
            </div>
            <div className="resource-label">Compute</div>
          </div>
        </div>

        <div className="resource" title="Research points and income">
          <div className="resource-icon" style={{ color: '#7dfccb' }}>
            <FlaskIcon size={17} />
          </div>
          <div className="resource-body">
            <div className="resource-value">
              {fmt(player.researchPoints, 0)}
              {researchPerTurn > 0 && <span className="delta">+{researchPerTurn.toFixed(1)}/t</span>}
            </div>
            <div className="resource-label">Research</div>
          </div>
        </div>

        <div className={`resource ${stabilityTone}`} title="Grid stability: reserves, congestion and policy">
          <div className="resource-icon" style={{ color: '#ffd479' }}>
            <ShieldIcon size={17} />
          </div>
          <div className="resource-body">
            <div className="resource-value">{pct(plan.stability, 0)}</div>
            <div className="resource-label">Stability</div>
          </div>
        </div>
      </div>

      <div className="topbar-tools">
        <button className={`icon-btn ${techOpen ? 'active' : ''}`} title="Technology tree (T)" onClick={() => toggleTech()}>
          <TreeIcon size={17} />
        </button>
        <button
          className={`icon-btn ${overlay !== 'none' ? 'active' : ''}`}
          title="Overlays (1–4)"
          onClick={() => useGame.getState().setOverlay(overlay === 'none' ? 'power' : 'none')}
        >
          <LayersIcon size={17} />
        </button>
        <button className={`icon-btn ${logOpen ? 'active' : ''}`} title="Event log (L)" onClick={() => toggleLog()}>
          <LogIcon size={17} />
        </button>
        <button className="icon-btn" title={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
          {muted ? <MuteIcon size={17} /> : <SoundIcon size={17} />}
        </button>
        <button className="icon-btn" title="Menu (Esc)" onClick={() => togglePause(true)}>
          <MenuIcon size={17} />
        </button>
      </div>
    </div>
  );
}
