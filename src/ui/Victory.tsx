import type { JSX } from 'react';
import { useGame } from './store';
import { playerScore } from '../engine/derived';
import { fmt, money, pct } from './format';

const WIN_LABEL: Record<string, string> = {
  compute: 'Compute Dominance',
  energy: 'Energy Empire',
  technology: 'Technology Leadership',
  score: 'Highest final score',
};

const COLORS = ['#4dd6c1', '#f5c04a', '#ff6b6b', '#a78bfa'];

export function VictoryScreen(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const summaryOpen = useGame((s) => s.summaryOpen);
  const backToMenu = useGame((s) => s.backToMenu);
  const newGame = useGame((s) => s.newGame);
  if (!game || game.phase !== 'gameover' || summaryOpen || !game.result) return null;
  const result = game.result;
  const winner = game.players[result.winner];
  const humanWon = result.winner === 0;
  const ranking = game.players
    .map((p) => ({ player: p, score: result.scores[p.id] ?? playerScore(game, p.id) }))
    .sort((a, b) => b.score - a.score);
  const rank = ranking.findIndex((entry) => entry.player.id === 0) + 1;

  return (
    <div className="game-over">
      <div className="game-over-card">
        <div className="game-over-kicker">{humanWon ? 'Campaign victory' : 'Campaign complete'}</div>
        <div className="game-over-title">{humanWon ? 'You own the grid.' : `${winner.company} takes the future.`}</div>
        <div className="game-over-sub">
          {WIN_LABEL[result.winType]} · turn {result.turn} · {humanWon ? 'your empire prevailed' : `you finished #${rank} of ${ranking.length}`}
        </div>

        <div className="score-list">
          {ranking.map(({ player: p, score }, index) => (
            <div className={`score-row ${p.id === result.winner ? 'win' : ''}`} key={p.id}>
              <span className="score-rank">{index + 1}</span>
              <span>
                <span style={{ color: COLORS[p.id] }}>●</span> {p.company}
                <span style={{ color: 'var(--faint)', fontSize: 10, marginLeft: 8 }}>
                  {fmt(p.stats.lifetimeCompute)} CU lifetime · {pct(p.stats.share, 1)} final share · {p.techs.length} techs
                </span>
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>{money(p.credits)}</span>
              <strong style={{ fontFamily: 'Space Grotesk, sans-serif', minWidth: 62, textAlign: 'right' }}>
                {fmt(score)} pts
              </strong>
            </div>
          ))}
        </div>

        <div className="empty-note" style={{ marginBottom: 18 }}>
          {WIN_LABEL[result.winType]}. The final score weighs lifetime revenue, technologies, territory, compute share
          and treasury.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            className="btn primary"
            onClick={() =>
              newGame({
                seed: game.seed + 1,
                mapSize: game.settings.mapSize,
                difficulty: game.settings.difficulty,
              })
            }
          >
            Start a new campaign
          </button>
          <button className="btn" onClick={backToMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}
