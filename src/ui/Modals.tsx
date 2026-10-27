import type { JSX } from 'react';
import { useGame } from './store';
import { CloseIcon } from './icons';
import { shortTime } from './format';
import { VICTORY } from '../engine/balance';

const KIND_LABEL: Record<string, string> = {
  info: 'INFO',
  good: 'GOOD',
  warn: 'WARN',
  bad: 'ALERT',
  market: 'MKT',
  weather: 'WX',
  tech: 'TECH',
  build: 'BUILD',
  ai: 'RIVAL',
  victory: 'WIN',
};

export function EventLog(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const open = useGame((s) => s.logOpen);
  const toggle = useGame((s) => s.toggleLog);
  if (!game || !open) return null;
  const entries = [...game.log].reverse();
  return (
    <div className="modal-backdrop" onClick={() => toggle(false)}>
      <div className="modal narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Operations log</h2>
            <div className="modal-sub">Turn {game.turn} · {entries.length} entries</div>
          </div>
          <button className="close-x" onClick={() => toggle(false)} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '62vh' }}>
          <div className="log-list">
            {entries.map((entry) => (
              <div className={`log-item ${entry.kind}`} key={entry.id}>
                <span className="log-turn">T{entry.turn}</span>
                <span style={{ minWidth: 42, color: 'var(--faint)', fontSize: 9, letterSpacing: '0.08em' }}>
                  {KIND_LABEL[entry.kind] ?? entry.kind.toUpperCase()}
                </span>
                <span style={{ flex: 1 }}>{entry.text}</span>
              </div>
            ))}
            {entries.length === 0 && <div className="empty-note">No events yet.</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn primary" onClick={() => toggle(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function HelpModal(): JSX.Element | null {
  const open = useGame((s) => s.helpOpen);
  const toggle = useGame((s) => s.toggleHelp);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => toggle(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 'min(880px, 96vw)' }}>
        <div className="modal-header">
          <div>
            <h2>How to run an AI infrastructure empire</h2>
            <div className="modal-sub">Five resources, one grid, three rivals, forty turns.</div>
          </div>
          <button className="close-x" onClick={() => toggle(false)} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <HelpContent />
        </div>
        <div className="modal-footer">
          <button className="btn primary" onClick={() => toggle(false)}>
            Back to the grid
          </button>
        </div>
      </div>
    </div>
  );
}

export function HelpContent(): JSX.Element {
  return (
    <>
      <div className="feature-list">
        <div>
          <strong>Power is a flow</strong>
          Generators inject megawatts, data centers draw them. Power only moves between adjacent structures, and every
          structure has an interconnect limit — watch the power overlay for red or congested links.
        </div>
        <div>
          <strong>Compute is revenue</strong>
          Compute = delivered IT power × efficiency × utilisation. Higher PUE means more power burned on cooling for the
          same compute; rivers, coasts and cold snaps improve PUE.
        </div>
        <div>
          <strong>Territory gates everything</strong>
          Claim tiles adjacent to your land. Costs rise as your empire grows. Build only on land you own, and only where
          the terrain allows the structure.
        </div>
        <div>
          <strong>Markets move</strong>
          Electricity, fuel and compute prices change every turn with weather and market events. Demand-response and
          storage pay best during grid emergencies.
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Winning</h3>
        <div className="feature-list">
          <div>
            <strong>Compute dominance</strong>
            Hold at least {Math.round(VICTORY.computeShare * 100)}% of the total compute market for three consecutive turns (from turn {VICTORY.computeEarliestTurn}).
          </div>
          <div>
            <strong>Energy empire</strong>
            {VICTORY.firmGen} MW of firm generation, {VICTORY.gridLinks} grid links, ${VICTORY.treasury} in the bank and ${VICTORY.profit} net profit for {VICTORY.energyTurns} turns.
          </div>
          <div>
            <strong>Technology leadership</strong>
            Research Autonomous Fleet Optimization, then sustain {VICTORY.efficiency} CU per delivered MW.
          </div>
          <div>
            <strong>Score at turn 40</strong>
            If nobody has won by turn {VICTORY.maxTurns}, the highest score (revenue, technologies, territory, share and treasury) takes the game.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Grid mechanics worth knowing</h3>
        <div className="feature-list">
          <div>
            <strong>Policy per data center</strong>
            Max Compute, Max Profit, Min Energy, Grid Flexible and Reliability First change utilisation, stability and
            demand-response income. Grid Flexible sheds load during emergencies for premium payments.
          </div>
          <div>
            <strong>Storage</strong>
            Batteries absorb surplus renewable output and discharge in deficit. They also earn availability payments in
            grid emergencies. Round-trip losses apply.
          </div>
          <div>
            <strong>Substations</strong>
            A substation is a 90 MW hub and your gateway to imports (22 MW) and exports (18 MW), the only way to buy or
            sell power. Imports cost a 30% premium; exports sell at 78% of spot.
          </div>
          <div>
            <strong>Congestion</strong>
            Interconnects are limited by the smaller structure's rating. A 30 MW line feeding a gigafactory cannot deliver
            its full load — put a substation on the campus.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Controls</h3>
        <div className="feature-list">
          <div><strong>Camera</strong> Drag to pan · wheel to zoom · click minimap to jump</div>
          <div><strong>Build</strong> Pick a structure in the bottom bar, then click a highlighted tile · <span className="kbd">Esc</span> cancels</div>
          <div><strong>Turn</strong> <span className="kbd">Space</span> end turn · <span className="kbd">T</span> tech tree · <span className="kbd">L</span> log · <span className="kbd">1–4</span> overlays</div>
          <div><strong>Menus</strong> <span className="kbd">Esc</span> pause / close · <span className="kbd">H</span> help · <span className="kbd">M</span> mute</div>
        </div>
      </div>
    </>
  );
}

export function PauseMenu(): JSX.Element | null {
  const open = useGame((s) => s.pauseOpen);
  const toggle = useGame((s) => s.togglePause);
  const saveNow = useGame((s) => s.saveNow);
  const savedAtMs = useGame((s) => s.savedAtMs);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const backToMenu = useGame((s) => s.backToMenu);
  const toggleTech = useGame((s) => s.toggleTech);
  const toggleHelp = useGame((s) => s.toggleHelp);
  const game = useGame((s) => s.game);
  if (!open || !game) return null;
  return (
    <div className="modal-backdrop" onClick={() => toggle(false)}>
      <div className="modal narrow" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Paused</h2>
            <div className="modal-sub">
              {game.players[0].company} · turn {game.turn} · autosaved {shortTime(savedAtMs)}
            </div>
          </div>
          <button className="close-x" onClick={() => toggle(false)} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn primary wide" onClick={() => toggle(false)}>
              Resume
            </button>
            <button className="btn wide" onClick={() => saveNow()}>
              Save now
            </button>
            <button
              className="btn wide"
              onClick={() => {
                toggleTech(true);
                toggle(false);
              }}
            >
              Technology tree
            </button>
            <button
              className="btn wide"
              onClick={() => {
                toggleHelp(true);
                toggle(false);
              }}
            >
              How to play
            </button>
            <button className="btn wide" onClick={toggleMute}>
              {muted ? 'Sound: off' : 'Sound: on'}
            </button>
            <button className="btn wide danger" onClick={() => backToMenu()}>
              Save and return to main menu
            </button>
          </div>
          <div className="empty-note" style={{ marginTop: 12 }}>
            The game autosaves after every action and at the end of each turn.
          </div>
        </div>
      </div>
    </div>
  );
}
