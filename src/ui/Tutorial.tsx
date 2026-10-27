import type { JSX } from 'react';
import { useGame, useHumanPlan, useHumanPlayer } from './store';
import { STRUCTURES } from '../engine/balance';

export function TutorialTip(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const player = useHumanPlayer();
  const plan = useHumanPlan();
  const dismissed = useGame((s) => s.tutorialDismissed);
  const dismiss = useGame((s) => s.dismissTutorial);
  if (!game || !player || !plan || dismissed || game.phase !== 'playing') return null;
  if (game.turn > 10) return null;

  const dcCount = game.tiles.filter(
    (t) => t.structure && t.structure.owner === 0 && STRUCTURES[t.structure.type].category === 'data',
  ).length;
  const myStructures = game.tiles.filter((t) => t.structure && t.structure.owner === 0).length;
  const ownedTiles = game.tiles.filter((t) => t.owner === 0).length;
  const techs = player.techs.length;

  let tip = '';
  let title = 'Getting started';
  if (game.turn === 1) {
    title = 'Claim your first land';
    tip = 'Click an unclaimed tile bordering your territory, then press Claim. New land unlocks building sites and reveals resources.';
  } else if (plan.shortfall > 0.5) {
    title = 'Load is unserved';
    tip = `${plan.shortfall.toFixed(0)} MW cannot reach your data centers. Build generation adjacent to your grid, or add a line/substation if the power is stranded behind a congested link.`;
  } else if (dcCount < 2 && ownedTiles > 5) {
    title = 'Add a data center';
    tip = 'Every extra campus turns megawatts into credits. Select an owned empty tile next to your grid and build an Edge DC.';
  } else if (techs === 0 && player.researchPoints >= 30) {
    title = 'Spend research';
    tip = 'You have enough RP for your first technology. Open the tech tree (T) and pick a branch that fits your strategy.';
  } else if (plan.genCap < plan.demand + 4) {
    title = 'Stay ahead of demand';
    tip = 'Keep about 20% generation reserve. Weather can remove half of your solar or wind output in a single turn.';
  } else if (game.turn >= 4 && !player.techs.includes('advanced_cooling')) {
    title = 'Efficiency compounds';
    tip = 'Cooling and GPU technologies raise compute per MW. Rivers, coasts and cold snaps already lower your PUE — put campuses there.';
  } else if (myStructures >= 4) {
    title = 'Plan for the market';
    tip = 'Watch the next-turn forecast in the left rail. Grid emergencies reward flexible data centers and batteries; gluts reward storage and efficiency.';
  } else {
    return null;
  }

  return (
    <div className="tutorial">
      <div className="tip-kicker">
        <span>Tutorial · turn {game.turn}</span>
        <button className="tip-close" onClick={dismiss} title="Dismiss hints">
          ×
        </button>
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, marginTop: 4 }}>{title}</div>
      <div className="tip-text">{tip}</div>
    </div>
  );
}
