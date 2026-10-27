import type { JSX } from 'react';
import { useGame } from './store';
import { fmt, money, pct } from './format';
import { BoltIcon, ChipIcon, CloseIcon, CoinIcon, FlaskIcon, ShieldIcon } from './icons';

export function TurnSummary(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const summaryOpen = useGame((s) => s.summaryOpen);
  const closeSummary = useGame((s) => s.closeSummary);
  const summary = useGame((s) => s.summary);
  if (!game || !summaryOpen) return null;
  const report = summary ?? game.report;
  const mine = report?.players.find((p) => p.playerId === 0);
  const conditions = report?.conditions ?? game.conditions;
  const isOver = game.phase === 'gameover';
  const totalCompute = report?.players.reduce((sum, p) => sum + p.compute, 0) ?? 0;

  return (
    <div className="modal-backdrop" onClick={closeSummary}>
      <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 'min(920px, 96vw)' }}>
        <div className="modal-header">
          <div>
            <h2>Turn {report?.turn ?? game.turn} report</h2>
            <div className="modal-sub">
              {conditions.headline} · {conditions.description}
            </div>
          </div>
          <button className="close-x" onClick={closeSummary} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <div className="summary-headline">
            <div>
              <div className="bar-label">Net result</div>
              <div
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 28,
                  fontWeight: 600,
                  color: (mine?.netProfit ?? 0) >= 0 ? 'var(--accent)' : 'var(--danger)',
                }}
              >
                {money(mine?.netProfit ?? 0)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="bar-label">Treasury</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20 }}>{money(game.players[0].credits)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="bar-label">Compute share</div>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20 }}>
                {pct(mine?.share ?? 0, 1)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="bar-label">Stability</div>
              <div
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 20,
                  color: (mine?.stability ?? 0) > 0.7 ? 'var(--accent)' : 'var(--gold)',
                }}
              >
                {pct(mine?.stability ?? 0)}
              </div>
            </div>
          </div>

          <div className="summary-grid">
            <Stat icon={<CoinIcon size={13} />} label="Revenue" value={money(mine?.revenue ?? 0)} sub={`Opex ${money(mine?.opex ?? 0)} · fuel ${money(mine?.fuelCost ?? 0)}`} />
            <Stat icon={<BoltIcon size={13} />} label="Power" value={`${fmt(mine?.powerDelivered ?? 0)} MW`} sub={`${fmt(mine?.powerDemand ?? 0)} requested · ${fmt(mine?.curtailed ?? 0)} curtailed`} />
            <Stat icon={<ChipIcon size={13} />} label="Compute" value={`${fmt(mine?.compute ?? 0)} CU`} sub={`${pct(mine?.share ?? 0, 1)} of ${fmt(totalCompute)} market`} />
            <Stat icon={<FlaskIcon size={13} />} label="Research" value={`+${(mine?.research ?? 0).toFixed(1)} RP`} sub={`${game.players[0].techs.length} technologies owned`} />
            <Stat icon={<BoltIcon size={13} />} label="Imports" value={`${fmt(mine?.imported ?? 0)} MW`} sub={`Exports ${fmt(mine?.exported ?? 0)} MW`} />
            <Stat icon={<ShieldIcon size={13} />} label="Grid services" value={money(mine?.drRevenue ?? 0)} sub={`${mine?.congestedLinks ?? 0} congested links`} />
            <Stat icon={<ChipIcon size={13} />} label="Storage" value={`${fmt(mine?.charged ?? 0)} MWh`} sub={`${fmt(mine?.discharged ?? 0)} MW discharged`} />
            <Stat icon={<ShieldIcon size={13} />} label="Outages" value={`${mine?.outages ?? 0}`} sub={mine?.shortfall ? `${fmt(mine.shortfall)} MW shortfall` : 'all load served'} />
          </div>

          <div style={{ marginTop: 18 }}>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Compute</th>
                  <th>Share</th>
                  <th>Revenue</th>
                  <th>Net</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>
                {(report?.players ?? []).map((entry) => {
                  const p = game.players[entry.playerId];
                  return (
                    <tr key={entry.playerId} className={entry.playerId === 0 ? 'me' : ''}>
                      <td>
                        <span style={{ color: ['#4dd6c1', '#f5c04a', '#ff6b6b', '#a78bfa'][entry.playerId] }}>●</span>{' '}
                        {p.company}
                      </td>
                      <td>{fmt(entry.compute)}</td>
                      <td>{pct(entry.share, 1)}</td>
                      <td>{money(entry.revenue)}</td>
                      <td style={{ color: entry.netProfit >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{money(entry.netProfit)}</td>
                      <td>{money(entry.creditsAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(report?.worldNotes.length ?? 0) > 0 && (
            <div className="summary-notes">
              <div className="bar-label" style={{ marginBottom: 4 }}>World events</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {report?.worldNotes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            </div>
          )}

          <div className="summary-notes" style={{ marginTop: 12 }}>
            <strong style={{ color: 'var(--text)' }}>Next turn forecast: </strong>
            {game.forecast.conditions.headline} — electricity ${game.forecast.elecLow.toFixed(2)}–{game.forecast.elecHigh.toFixed(2)}/MW,
            compute ${game.forecast.computeLow.toFixed(2)}–{game.forecast.computeHigh.toFixed(2)}/CU.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn primary" onClick={closeSummary}>
            {isOver ? 'View final results' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: JSX.Element; label: string; value: string; sub: string }): JSX.Element {
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
