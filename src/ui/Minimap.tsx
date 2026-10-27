import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { PLAYER_IDENTITIES } from '../engine/balance';
import { useGame, useHumanPlan } from './store';
import { cameraBus } from './cameraBus';

const COLORS = PLAYER_IDENTITIES.map((p) => p.color);

export function Minimap(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const game = useGame((s) => s.game);
  const plan = useHumanPlan();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 232;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const cell = Math.floor(size / Math.max(game.width, game.height));
    const offsetX = (size - cell * game.width) / 2;
    const offsetY = (size - cell * game.height) / 2;
    for (const tile of game.tiles) {
      const x = offsetX + tile.x * cell;
      const y = offsetY + tile.y * cell;
      const base =
        tile.terrain === 'ocean'
          ? '#12495e'
          : tile.terrain === 'mountain'
            ? '#6b7280'
            : tile.terrain === 'forest'
              ? '#356b42'
              : tile.terrain === 'desert'
                ? '#bfa164'
                : tile.terrain === 'geothermal'
                  ? '#8d614b'
                  : tile.terrain === 'urban'
                    ? '#757988'
                    : tile.terrain === 'river'
                      ? '#378fac'
                      : tile.terrain === 'basin'
                        ? '#8b6a42'
                        : tile.terrain === 'coast'
                          ? '#a89666'
                          : '#5a9450';
      ctx.fillStyle = base;
      ctx.fillRect(x, y, cell, cell);
      const revealed = (tile.revealed & 1) !== 0;
      if (!revealed) {
        ctx.fillStyle = 'rgba(4, 14, 19, 0.48)';
        ctx.fillRect(x, y, cell, cell);
        continue;
      }
      if (tile.owner >= 0) {
        ctx.fillStyle = COLORS[tile.owner] ?? '#888';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, cell, cell);
        ctx.globalAlpha = 1;
      }
      if (tile.structure) {
        ctx.fillStyle = tile.structure.owner === -1 ? '#b9c6ce' : tile.structure.owner === 0 ? '#ffffff' : '#e2f0f5';
        ctx.globalAlpha = 0.95;
        const pad = Math.max(1, Math.floor(cell * 0.24));
        ctx.fillRect(x + pad, y + pad, Math.max(2, cell - pad * 2), Math.max(2, cell - pad * 2));
        ctx.globalAlpha = 1;
      }
    }
    if (plan) {
      ctx.strokeStyle = 'rgba(120,255,220,0.5)';
      ctx.lineWidth = 1;
      for (const link of plan.links) {
        const a = plan.nodes[link.a];
        const b = plan.nodes[link.b];
        if (link.flow <= 0.05) continue;
        ctx.beginPath();
        ctx.moveTo(offsetX + (a.x + 0.5) * cell, offsetY + (a.y + 0.5) * cell);
        ctx.lineTo(offsetX + (b.x + 0.5) * cell, offsetY + (b.y + 0.5) * cell);
        ctx.stroke();
      }
    }
  }, [game, plan]);

  if (!game) return <div />;

  return (
    <div className="panel minimap-wrap">
      <canvas
        ref={canvasRef}
        className="minimap"
        style={{ aspectRatio: '1 / 1' }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const size = rect.width;
          const cell = size / Math.max(game.width, game.height);
          const offsetX = (size - cell * game.width) / 2;
          const offsetY = (size - cell * game.height) / 2;
          const x = Math.floor((event.clientX - rect.left - offsetX) / cell);
          const y = Math.floor((event.clientY - rect.top - offsetY) / cell);
          if (x < 0 || y < 0 || x >= game.width || y >= game.height) return;
          useGame.getState().select(x, y);
          cameraBus.centerOn(x, y);
        }}
      />
      <div className="minimap-caption">
        <span>Grid overview</span>
        <span>{game.width}×{game.height}</span>
      </div>
    </div>
  );
}
