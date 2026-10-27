import type { StructureType, Terrain } from '../engine/types';
import { TILE_H, TILE_W, drawBox, drawCylinder, glow, polygon, roundedRect, shade } from './iso';

export interface OwnerPalette {
  color: string;
  accent: string;
  dark: string;
}

export const TERRAIN_TOP: Record<Terrain, string> = {
  ocean: '#1e6e8c',
  plains: '#86c968',
  desert: '#e6c780',
  mountain: '#9aa0ad',
  forest: '#4a8f59',
  river: '#4aa9cc',
  coast: '#e0cd96',
  geothermal: '#b8815f',
  urban: '#a7a8b6',
  basin: '#c09a66',
};

export function terrainColors(terrain: Terrain): { top: string; left: string; right: string } {
  const base = TERRAIN_TOP[terrain];
  return { top: base, left: shade(base, -24), right: shade(base, -42) };
}

/* ------------------------------------------------------------------ */
/* Terrain dressing                                                    */
/* ------------------------------------------------------------------ */

export function drawTerrainDetail(
  ctx: CanvasRenderingContext2D,
  terrain: Terrain,
  variant: number,
  time: number,
): void {
  const jitter = (i: number): number => {
    const v = Math.sin((variant + i * 37.7) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  switch (terrain) {
    case 'plains': {
      for (let i = 0; i < 5; i++) {
        const x = (jitter(i) - 0.5) * TILE_W * 0.5;
        const y = (jitter(i + 9) - 0.5) * TILE_H * 0.5;
        ctx.strokeStyle = 'rgba(46,94,42,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y - 4);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 2, y - 4);
        ctx.stroke();
      }
      for (let i = 0; i < 2; i++) {
        const x = (jitter(i + 20) - 0.5) * TILE_W * 0.5;
        const y = (jitter(i + 24) - 0.5) * TILE_H * 0.5;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,232,160,0.8)' : 'rgba(240,180,220,0.7)';
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'desert': {
      ctx.strokeStyle = 'rgba(160,120,60,0.35)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const x = (jitter(i + 2) - 0.5) * TILE_W * 0.55;
        const y = (jitter(i + 5) - 0.5) * TILE_H * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
      break;
    }
    case 'forest': {
      for (let i = 0; i < 5; i++) {
        const x = (jitter(i) - 0.5) * TILE_W * 0.62;
        const y = (jitter(i + 11) - 0.5) * TILE_H * 0.6;
        const h = 11 + jitter(i + 3) * 8;
        ctx.fillStyle = 'rgba(30,60,36,0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y + 1, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = i % 2 === 0 ? '#2f6b3e' : '#357a48';
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + 5, y + 1);
        ctx.lineTo(x - 5, y + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(120,180,110,0.4)';
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + 2, y - h * 0.45);
        ctx.lineTo(x - 1, y - h * 0.45);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'mountain': {
      const peaks = 1 + (variant % 2);
      for (let i = 0; i < peaks; i++) {
        const x = (jitter(i + 1) - 0.5) * TILE_W * 0.42;
        const y = (jitter(i + 4) - 0.5) * TILE_H * 0.25;
        const h = 12 + jitter(i + 7) * 8;
        ctx.fillStyle = i === 0 ? '#767d8b' : '#666d7b';
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + 14, y + 6);
        ctx.lineTo(x - 13, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(150,160,176,0.55)';
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + 3, y - h * 0.45);
        ctx.lineTo(x - 4, y - h * 0.45);
        ctx.closePath();
        ctx.fill();
        if (variant > 620) {
          ctx.fillStyle = 'rgba(235,242,250,0.8)';
          ctx.beginPath();
          ctx.moveTo(x, y - h);
          ctx.lineTo(x + 4, y - h * 0.72);
          ctx.lineTo(x - 4, y - h * 0.74);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case 'river': {
      ctx.strokeStyle = 'rgba(220,250,255,0.55)';
      ctx.lineWidth = 1.4;
      const wobble = Math.sin(time * 1.6 + variant) * 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 12 - 6, -4 + wobble);
        ctx.quadraticCurveTo(i * 12, 2, i * 12 + 6, -2 + wobble);
        ctx.stroke();
      }
      break;
    }
    case 'coast': {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      const off = Math.sin(time * 1.2 + variant) * 2.2;
      ctx.beginPath();
      ctx.arc(0, 3 + off, TILE_W * 0.3, 0.12, Math.PI - 0.12);
      ctx.stroke();
      break;
    }
    case 'geothermal': {
      ctx.fillStyle = 'rgba(52,32,26,0.5)';
      ctx.beginPath();
      ctx.ellipse(2, 2, 11, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 2; i++) {
        const t = (time * 0.35 + i * 0.5 + jitter(i) * 0.4) % 1;
        ctx.fillStyle = `rgba(230,240,244,${0.32 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(4 + Math.sin(t * 6 + i) * 4, -4 - t * 24, 5 + t * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'urban': {
      for (let i = 0; i < 3; i++) {
        const x = (jitter(i) - 0.5) * TILE_W * 0.5;
        const y = (jitter(i + 6) - 0.5) * TILE_H * 0.4;
        const h = 8 + jitter(i + 2) * 14;
        ctx.fillStyle = '#6d7180';
        ctx.fillRect(x - 4, y - h, 8, h);
        ctx.fillStyle = 'rgba(255,214,128,0.75)';
        for (let wy = 0; wy < 3; wy++) {
          if (jitter(i * 5 + wy) > 0.4) ctx.fillRect(x - 2.5, y - h + 2 + wy * 4, 2, 2);
        }
      }
      break;
    }
    case 'basin': {
      ctx.fillStyle = '#7b6144';
      roundedRect(ctx, -12, -4, 22, 8, 2, '#7b6144');
      ctx.strokeStyle = '#d8b26a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-12, 2);
      ctx.lineTo(-12, 8);
      ctx.stroke();
      ctx.strokeStyle = '#c9a05a';
      ctx.beginPath();
      ctx.moveTo(6, -2);
      ctx.lineTo(10, -10);
      ctx.lineTo(16, -10);
      ctx.stroke();
      ctx.fillStyle = '#e5c07b';
      ctx.beginPath();
      ctx.arc(-12, 8, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Structures                                                          */
/* ------------------------------------------------------------------ */

function ownerStripe(ctx: CanvasRenderingContext2D, palette: OwnerPalette, cx: number, y: number, w: number): void {
  ctx.fillStyle = palette.color;
  ctx.fillRect(cx - w / 2, y, w, 2.5);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(cx - w / 2, y, w * 0.35, 1);
}

function leds(ctx: CanvasRenderingContext2D, cx: number, y: number, time: number, variant: number): void {
  for (let i = 0; i < 3; i++) {
    const blink = 0.45 + 0.55 * Math.max(0, Math.sin(time * 2.4 + i * 2 + variant));
    ctx.fillStyle = `rgba(120,255,190,${blink})`;
    ctx.fillRect(cx - 6 + i * 5, y, 2, 2);
  }
}

function fan(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, time: number, speed: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * speed);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(35,45,58,0.85)';
    ctx.beginPath();
    ctx.ellipse(r * 0.45, 0, r * 0.45, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#2a3442';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function steam(ctx: CanvasRenderingContext2D, cx: number, cy: number, time: number, seed: number): void {
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.22 + i * 0.33 + seed) % 1;
    ctx.fillStyle = `rgba(240,246,250,${0.22 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(cx + Math.sin(t * 5 + seed * 7) * 6, cy - t * 30, 6 + t * 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawStructure(
  ctx: CanvasRenderingContext2D,
  type: StructureType,
  palette: OwnerPalette,
  time: number,
  variant: number,
  energized: boolean,
): void {
  const metal = '#c3ccd8';
  const metalDark = '#8b97a7';
  const accent = palette.color;

  // Footprint pad.
  ctx.save();
  polygon(
    ctx,
    [
      { x: 0, y: -TILE_H * 0.31 },
      { x: TILE_W * 0.31, y: 0 },
      { x: 0, y: TILE_H * 0.31 },
      { x: -TILE_W * 0.31, y: 0 },
    ],
    'rgba(16,26,34,0.22)',
  );
  ctx.restore();

  switch (type) {
    case 'solar': {
      ctx.save();
      ctx.translate(0, 2);
      for (let r = 0; r < 3; r++) {
        const yy = -r * 7;
        for (let c = 0; c < 3; c++) {
          const xx = (c - 1) * 15 + (r % 2) * 4;
          polygon(
            ctx,
            [
              { x: xx - 7, y: yy - 3 },
              { x: xx + 6, y: yy + 1 },
              { x: xx + 6, y: yy + 8 },
              { x: xx - 7, y: yy + 4 },
            ],
            '#2b4c86',
            '#1b2d52',
            0.6,
          );
          const shimmer = Math.max(0, Math.sin(time * 1.5 + r + c + variant));
          ctx.globalAlpha = 0.25 + shimmer * 0.45;
          polygon(
            ctx,
            [
              { x: xx - 6, y: yy - 1 },
              { x: xx - 1, y: yy + 0.5 },
              { x: xx - 1, y: yy + 3 },
              { x: xx - 6, y: yy + 1.5 },
            ],
            '#9fd8ff',
          );
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
      ownerStripe(ctx, palette, 0, 8, 30);
      break;
    }
    case 'wind': {
      const h = 34;
      ctx.strokeStyle = metal;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -h);
      ctx.stroke();
      ctx.strokeStyle = metalDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(0, -h);
      ctx.moveTo(5, 2);
      ctx.lineTo(0, -h);
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -h);
      fan(ctx, 0, 0, 13, time, 2.2 + (variant % 7) * 0.12);
      ctx.restore();
      ctx.fillStyle = accent;
      ctx.fillRect(-2, -h + 4, 4, 4);
      break;
    }
    case 'gas': {
      drawBox(ctx, 0, 0, 0.52, 22, {
        top: '#d7dde6',
        left: '#a7b1be',
        right: '#7f8a98',
        stroke: '#5a6472',
      });
      drawCylinder(ctx, 14, -4, 4.5, 30, '#e2e7ee', '#aab3c0', '#7a8492');
      const flick = 0.6 + 0.4 * Math.sin(time * 9 + variant);
      glow(ctx, 14, -36, 12, `rgba(255,170,70,${flick * 0.8})`, 0.7);
      ownerStripe(ctx, palette, 0, -3, 20);
      leds(ctx, -6, -12, time, variant);
      break;
    }
    case 'hydro': {
      drawBox(ctx, 0, 0, 0.62, 15, {
        top: '#b7c3cd',
        left: '#8d99a5',
        right: '#6a7581',
        stroke: '#4b545f',
      });
      ctx.strokeStyle = 'rgba(150,240,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 1);
      ctx.quadraticCurveTo(-10, 8, 0, 9);
      ctx.quadraticCurveTo(10, 8, 16, 1);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(-8, -22, 16, 3);
      ctx.fillStyle = '#cfd8e3';
      ctx.fillRect(-6, -22, 3, 8);
      ctx.fillRect(3, -22, 3, 8);
      break;
    }
    case 'nuclear': {
      drawCylinder(ctx, -11, 0, 10, 26, '#e3e9f0', '#b3bfcc', '#8794a3');
      drawCylinder(ctx, 11, 0, 9, 22, '#e3e9f0', '#b3bfcc', '#8794a3');
      drawBox(ctx, 0, 6, 0.3, 9, { top: '#c9d2dc', left: '#9aa5b1', right: '#74808c' });
      steam(ctx, -11, -26, time, 0.2);
      steam(ctx, 11, -22, time, 0.6);
      ownerStripe(ctx, palette, 0, 6, 20);
      break;
    }
    case 'geothermal': {
      drawCylinder(ctx, 0, 2, 14, 12, '#bcc5ce', '#8e99a5', '#6b7581');
      drawBox(ctx, 0, 3, 0.28, 16, { top: '#d0d8e0', left: '#a2acb8', right: '#7d8894' });
      steam(ctx, 0, -18, time, 0.45);
      ctx.strokeStyle = '#c9a05a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-13, 4);
      ctx.quadraticCurveTo(-18, 0, -16, -6);
      ctx.stroke();
      ownerStripe(ctx, palette, 0, 8, 18);
      break;
    }
    case 'battery': {
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 13;
        drawBox(ctx, x, 0, 0.28, 12, {
          top: '#dbe3ec',
          left: '#aab4c0',
          right: '#818c99',
          stroke: '#5c6673',
        });
        const level = 0.35 + 0.3 * Math.sin(time * 0.8 + i + variant);
        ctx.fillStyle = accent;
        ctx.fillRect(x - 3, -8 + (1 - level) * 6, 6, level * 6);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x - 3, -8, 6, 1);
      }
      break;
    }
    case 'line': {
      ctx.strokeStyle = metalDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -34);
      ctx.stroke();
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-9, -28);
      ctx.lineTo(9, -28);
      ctx.moveTo(-6, -22);
      ctx.lineTo(6, -22);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -35, 2, 0, Math.PI * 2);
      ctx.fill();
      if (energized) glow(ctx, 0, -34, 9, 'rgba(120,255,220,0.8)', 0.45);
      break;
    }
    case 'substation': {
      drawBox(ctx, 0, 0, 0.5, 10, { top: '#b8c2cc', left: '#8e99a4', right: '#6c7681', stroke: '#4f5862' });
      drawCylinder(ctx, -10, 0, 6, 12, '#dfe6ee', '#aab4bf', '#828c97');
      drawCylinder(ctx, 9, -2, 5, 9, '#dfe6ee', '#aab4bf', '#828c97');
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-18 + i * 5, -10);
        ctx.lineTo(-18 + i * 5, -18);
        ctx.stroke();
      }
      const hum = 0.35 + 0.25 * Math.sin(time * 6 + variant);
      glow(ctx, 0, -8, 16, `rgba(120,220,255,${hum})`, 0.35);
      ownerStripe(ctx, palette, 0, 7, 22);
      break;
    }
    case 'edge_dc': {
      drawBox(ctx, 0, 0, 0.46, 22, {
        top: '#cfd7e2',
        left: palette.dark,
        right: '#1d2733',
        stroke: '#101820',
      });
      ctx.fillStyle = '#26303c';
      for (let r = 0; r < 3; r++) ctx.fillRect(-10, -19 + r * 5, 20, 2.4);
      fan(ctx, 0, -23, 6, time, 3);
      ownerStripe(ctx, palette, 0, -2, 26);
      leds(ctx, 0, -8, time, variant);
      break;
    }
    case 'hyper_dc': {
      drawBox(ctx, 0, 0, 0.62, 30, {
        top: '#d4dce7',
        left: palette.dark,
        right: '#1c2632',
        stroke: '#0e151c',
      });
      drawBox(ctx, -14, -4, 0.24, 20, { top: '#e2e9f2', left: '#9aa5b2', right: '#6f7a87' });
      for (let i = 0; i < 2; i++) fan(ctx, -4 + i * 9, -33, 7, time, 3.4 + i * 0.4);
      ctx.fillStyle = '#1d2731';
      for (let i = 0; i < 4; i++) ctx.fillRect(-20 + i * 11, -22, 6, 2);
      ownerStripe(ctx, palette, 0, -4, 34);
      leds(ctx, 0, -12, time, variant);
      break;
    }
    case 'giga_dc': {
      drawBox(ctx, 0, 0, 0.74, 26, {
        top: '#c8d2de',
        left: palette.dark,
        right: '#161f29',
        stroke: '#0b1117',
      });
      drawBox(ctx, -18, -2, 0.26, 46, { top: '#e6edf4', left: '#a3aeba', right: '#727d8a' });
      drawBox(ctx, 16, -1, 0.22, 38, { top: '#e6edf4', left: '#a3aeba', right: '#727d8a' });
      drawBox(ctx, 0, -8, 0.3, 54, {
        top: palette.color,
        left: palette.dark,
        right: '#101820',
        stroke: '#0a0f13',
      });
      const pulse = 0.5 + 0.5 * Math.sin(time * 2);
      glow(ctx, 0, -60, 22, `rgba(150,255,235,${pulse * 0.8})`, 0.6);
      ctx.fillStyle = '#eaffff';
      ctx.fillRect(-1.4, -64, 2.8, 8);
      fan(ctx, -14, -33, 6, time, 4);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(140,255,220,${0.35 + 0.5 * Math.max(0, Math.sin(time * 3 + i))})`;
        ctx.fillRect(-22 + i * 8, -16, 4, 1.8);
      }
      ownerStripe(ctx, palette, 0, -6, 42);
      leds(ctx, 0, -20, time, variant);
      break;
    }
    case 'lab': {
      drawBox(ctx, 0, 0, 0.42, 14, {
        top: '#dfe8f1',
        left: '#a7b3c1',
        right: '#7c8897',
        stroke: '#59636f',
      });
      ctx.strokeStyle = metal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(8, -28);
      ctx.stroke();
      ctx.save();
      ctx.translate(8, -30);
      ctx.rotate(time * 0.5);
      ctx.fillStyle = '#e8eef5';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const blink = 0.4 + 0.6 * Math.max(0, Math.sin(time * 3 + variant));
      glow(ctx, 8, -34, 8, `rgba(140,200,255,${blink})`, 0.5);
      ownerStripe(ctx, palette, 0, 4, 18);
      break;
    }
    default:
      break;
  }
}

/** Catenary-ish wire between two structure tops. */
export function drawWire(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  alpha: number,
  time: number,
  powered: boolean,
  electric: boolean,
): void {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + 10;
  ctx.strokeStyle = alpha > 0.4 ? 'rgba(20,30,36,0.85)' : 'rgba(20,30,36,0.5)';
  ctx.lineWidth = 1.4;
  if (powered && electric) {
    ctx.strokeStyle = `rgba(120,255,215,${0.22 + 0.15 * Math.sin(time * 2)})`;
    ctx.lineWidth = 5;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(mx, my, to.x, to.y);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = powered ? 1.6 : 1;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(mx, my, to.x, to.y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (powered) {
    for (let i = 0; i < 2; i++) {
      const t = (time * 0.45 + i * 0.5) % 1;
      const p = quadratic(from, { x: mx, y: my }, to, t);
      ctx.fillStyle = 'rgba(170,255,235,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function quadratic(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * b.x + t * t * c.x,
    y: mt * mt * a.y + 2 * mt * t * b.y + t * t * c.y,
  };
}
