import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { createGame, endTurn } from '../engine/game';
import { planPower } from '../engine/grid';
import { GameRenderer } from '../render/renderer';

/**
 * Live isometric diorama behind the main menu: a real simulated world is played
 * forward a dozen turns, then slowly orbited. Pure decoration, no interaction.
 */
export function MenuBackdrop(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new GameRenderer(canvas);
    const world = createGame({ seed: 4711, allAI: true });
    for (let i = 0; i < 20 && world.phase === 'playing'; i++) endTurn(world);
    const plan = planPower(world, 0);
    const owned = world.tiles.filter((t) => t.structure && t.structure.owner === 0);
    const cx = owned.reduce((sum, t) => sum + t.x, 0) / Math.max(1, owned.length);
    const cy = owned.reduce((sum, t) => sum + t.y, 0) / Math.max(1, owned.length);
    renderer.camera.zoom = 1.3;
    renderer.resetView(cx, cy);
    const baseX = renderer.camera.x;
    const baseY = renderer.camera.y;
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    let frame = 0;
    const loop = (ms: number): void => {
      const t = ms / 1000;
      renderer.camera.x = baseX - 70 + Math.sin(t * 0.045) * 55;
      renderer.camera.y = baseY + Math.cos(t * 0.032) * 26;
      renderer.draw({
        state: world,
        humanId: 0,
        plan,
        overlay: 'none',
        selected: null,
        hovered: null,
        buildMode: null,
        buildable: new Set<number>(),
        time: t,
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="menu-art" aria-hidden="true" />;
}
