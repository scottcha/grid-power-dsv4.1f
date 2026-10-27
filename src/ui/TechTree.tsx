import type { JSX } from 'react';
import { useGame, useHumanPlayer } from './store';
import { TECH_MAP, TECHS, type TechBranch, type TechDef } from '../engine/balance';
import { canResearch } from '../engine/tech';
import { CloseIcon, FlaskIcon } from './icons';

const BRANCHES: Array<{ id: TechBranch; name: string; blurb: string }> = [
  { id: 'compute', name: 'Compute', blurb: 'More CU from every megawatt.' },
  { id: 'energy', name: 'Energy', blurb: 'Cheaper, firmer, more flexible generation.' },
  { id: 'optimization', name: 'Optimization', blurb: 'AI-driven power and demand response.' },
  { id: 'infrastructure', name: 'Infrastructure', blurb: 'Transmission, storage and contracts.' },
];

export function TechTree(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const player = useHumanPlayer();
  const techOpen = useGame((s) => s.techOpen);
  const toggleTech = useGame((s) => s.toggleTech);
  const research = useGame((s) => s.research);
  if (!game || !player || !techOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => toggleTech(false)}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Technology Tree</h2>
            <div className="modal-sub">
              {player.techs.length} of {TECHS.length} technologies researched ·{' '}
              <span style={{ color: 'var(--accent)' }}>{player.researchPoints.toFixed(0)} RP available</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="btn small" style={{ pointerEvents: 'none' }}>
              <FlaskIcon size={13} /> {player.researchPoints.toFixed(1)} RP
            </span>
            <button className="close-x" onClick={() => toggleTech(false)} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="modal-body">
          <div className="tech-columns">
            {BRANCHES.map((branch) => (
              <div className="tech-col" key={branch.id}>
                <h3>{branch.name}</h3>
                <div className="empty-note" style={{ marginBottom: 8 }}>
                  {branch.blurb}
                </div>
                {TECHS.filter((t) => t.branch === branch.id).map((tech) => (
                  <TechCard
                    key={tech.id}
                    tech={tech}
                    state={techState(tech, player.techs, player.researchPoints)}
                    onClick={() => research(tech.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <div className="empty-note" style={{ marginRight: 'auto' }}>
            Research income: 1–5 RP per lab plus data centers. Hover a card to read its effects.
          </div>
          <button className="btn primary" onClick={() => toggleTech(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

type TechState = 'researched' | 'available' | 'unaffordable' | 'locked';

function techState(tech: TechDef, techs: string[], rp: number): TechState {
  if (techs.includes(tech.id)) return 'researched';
  const prereq = tech.requires.every((req) => techs.includes(req));
  if (!prereq) return 'locked';
  return rp >= tech.cost ? 'available' : 'unaffordable';
}

function TechCard({ tech, state, onClick }: { tech: TechDef; state: TechState; onClick: () => void }): JSX.Element {
  return (
    <button
      className={`tech-card ${state}`}
      onClick={state === 'available' ? onClick : undefined}
      disabled={state !== 'available'}
      title={state === 'locked' ? `Requires ${tech.requires.map((r) => TECH_MAP[r]?.name ?? r).join(' + ')}` : tech.desc}
    >
      <div className="tname">
        <span>{tech.name}</span>
        <span className="tcost">
          {state === 'researched' ? '✓ done' : `${tech.cost} RP`}
        </span>
      </div>
      <div className="tdesc">{tech.desc}</div>
      {tech.requires.length > 0 && state !== 'researched' && (
        <div className="reqs">Requires {tech.requires.map((r) => TECH_MAP[r]?.name ?? r).join(', ')}</div>
      )}
      {tech.ultimate && <div className="tech-badge">Ultimate · victory path</div>}
    </button>
  );
}

export function TechMiniStatus(): JSX.Element | null {
  const player = useHumanPlayer();
  if (!player) return null;
  const available = TECHS.filter((t) => canResearch(player, t.id) && player.researchPoints >= t.cost).length;
  return (
    <div className="empty-note">
      {available > 0 ? `${available} technology${available === 1 ? '' : 's'} ready to research.` : 'No technologies affordable yet.'}
    </div>
  );
}
