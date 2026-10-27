import { useState } from 'react';
import type { JSX } from 'react';
import { useGame } from './store';
import { HelpContent } from './Modals';
import { MenuBackdrop } from './MenuBackdrop';
import { PlayIcon } from './PlayIcon';
import { shortTime } from './format';
import { PLAYER_IDENTITIES } from '../engine/balance';

export function MainMenu(): JSX.Element {
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  const hasSave = useGame((s) => s.hasSavedGame);
  const savedAtMs = useGame((s) => s.savedAtMs);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 900000) + 100000));
  const [mapSize, setMapSize] = useState(18);
  const [difficulty, setDifficulty] = useState<'relaxed' | 'standard' | 'brutal'>('standard');
  const [help, setHelp] = useState(false);
  const [about, setAbout] = useState(false);

  const start = (): void => {
    const parsed = Number.parseInt(seed, 10);
    newGame({
      seed: Number.isFinite(parsed) ? parsed : undefined,
      mapSize,
      difficulty,
    });
  };

  return (
    <div className="app">
      <div className="menu">
        <MenuBackdrop />
        <div className="menu-hero">
          <div className="menu-kicker">Turn-based infrastructure strategy</div>
          <div className="menu-title">GRIDPOWER</div>
          <div className="menu-tagline">Build the grid. Control the compute. Dominate the future.</div>
          <div className="menu-blurb">
            Four AI infrastructure companies race across a strained electricity system. Claim land, build generation,
            wire it to data centers, and turn megawatts into compute — before the market turns, the wind dies, or a rival
            buys the substation you needed.
          </div>
          <div className="menu-logos">
            {PLAYER_IDENTITIES.map((identity) => (
              <div className="menu-logo" key={identity.company} style={{ borderColor: `${identity.color}44`, color: identity.color }}>
                {identity.company}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 26, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setHelp(true)}>
              How to play
            </button>
            <button className="btn" onClick={() => setAbout(true)}>
              About the simulation
            </button>
            <button className="btn" onClick={toggleMute}>
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </div>
        </div>

        <div className="menu-card">
          <h2>New campaign</h2>
          <div className="sub">One human operator, three rival AI companies, forty turns.</div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="seed">World seed</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id="seed"
                  value={seed}
                  inputMode="numeric"
                  onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, '').slice(0, 9))}
                />
                <button
                  className="btn"
                  title="Random seed"
                  onClick={() => setSeed(String(Math.floor(Math.random() * 900000) + 100000))}
                >
                  ⟳
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="size">Map size</label>
              <select id="size" value={mapSize} onChange={(event) => setMapSize(Number(event.target.value))}>
                <option value={13}>Small · 13×13</option>
                <option value={18}>Standard · 18×18</option>
                <option value={24}>Large · 24×24</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="difficulty">Rival competence</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as 'relaxed' | 'standard' | 'brutal')}
            >
              <option value="relaxed">Relaxed — forgiving rivals, gentle markets</option>
              <option value="standard">Standard — competent, expansive rivals</option>
              <option value="brutal">Brutal — aggressive build-outs and margin pressure</option>
            </select>
          </div>

          <div className="menu-actions">
            <button className="btn primary" onClick={start}>
              <PlayIcon size={15} /> Start new game
            </button>
            <button className="btn" onClick={continueGame} disabled={!hasSave}>
              Continue campaign {hasSave ? `· ${shortTime(savedAtMs)}` : '· no save'}
            </button>
          </div>

          <div className="menu-foot">
            <span>Autosave on · deterministic seed</span>
            <span>v1.0</span>
          </div>
        </div>
      </div>

      <div className="menu-corner">
        <span>Original game · inspired by classic turn-based 4X design</span>
        <span>Mouse · trackpad · keyboard</span>
      </div>

      {(help || about) && (
        <div className="modal-backdrop" onClick={() => (help ? setHelp(false) : setAbout(false))}>
          <div className="modal" onClick={(event) => event.stopPropagation()} style={{ width: 'min(880px, 96vw)' }}>
            <div className="modal-header">
              <div>
                <h2>{help ? 'How to play' : 'About the simulation'}</h2>
                <div className="modal-sub">
                  {help ? 'The first five minutes' : 'How GRIDPOWER models power, compute and markets'}
                </div>
              </div>
              <button className="close-x" onClick={() => (help ? setHelp(false) : setAbout(false))}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {help ? (
                <HelpContent />
              ) : (
                <>
                  <div className="feature-list">
                    <div>
                      <strong>Electrical network</strong>
                      Every structure is a node. Adjacent structures share an interconnect sized by the smaller rating.
                      A max-flow solver dispatches power each turn, which is why bottlenecks and islands are real.
                    </div>
                    <div>
                      <strong>Dispatch</strong>
                      Generation is merit-ordered by marginal cost, batteries charge from surplus and discharge into
                      deficits, and substations expose imports and exports to the wholesale market.
                    </div>
                    <div>
                      <strong>Compute economics</strong>
                      Delivered IT power × accelerator efficiency × utilisation produces compute. Cooling (PUE) is
                      weather- and terrain-sensitive, and fleet-wide compute supply compresses clearing prices.
                    </div>
                    <div>
                      <strong>Rivals</strong>
                      Helios Energy chases cheap renewables, Titan Compute expands campuses aggressively, and Volt
                      Dynamics invests in storage, substations and demand response. Each uses utility scoring over legal
                      actions — no external AI service.
                    </div>
                  </div>
                  <div className="empty-note" style={{ marginTop: 14 }}>
                    Deterministic rules: the same seed and the same decisions always produce the same world. The game runs
                    entirely in your browser and saves to local storage.
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => (help ? setHelp(false) : setAbout(false))}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
