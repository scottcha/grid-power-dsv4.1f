/** Isometric geometry and colour helpers shared by the renderer and art modules. */

export const TILE_W = 78;
export const TILE_H = 39;
export const TILE_THICK = 15;

export interface Pt {
  x: number;
  y: number;
}

export function shade(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const num = parseInt(hex.slice(1), 16);
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
}

export function polygon(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  fill: string | CanvasGradient | CanvasPattern,
  stroke?: string,
  lineWidth = 1,
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function diamondPoints(cx: number, cy: number, w = TILE_W, h = TILE_H, inset = 0): Pt[] {
  const hw = w / 2 - inset;
  const hh = h / 2 - inset * (h / w);
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}

/** Footprint axes for an isometric box: x runs down-right, y runs down-left. */
export const AX: Pt = { x: TILE_W / 2, y: TILE_H / 2 };
export const AY: Pt = { x: -TILE_W / 2, y: TILE_H / 2 };

export interface BoxStyle {
  top: string;
  left: string;
  right: string;
  stroke?: string;
}

/**
 * Draw an isometric box whose base footprint is centred at (cx, cy).
 * `size` is a fraction of a tile (0..1), `height` in pixels.
 */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  height: number,
  style: BoxStyle,
): void {
  const back = { x: cx, y: cy - (size * TILE_H) / 2 };
  const right = { x: cx + (size * TILE_W) / 2, y: cy };
  const front = { x: cx, y: cy + (size * TILE_H) / 2 };
  const left = { x: cx - (size * TILE_W) / 2, y: cy };
  const top = [
    { x: back.x, y: back.y - height },
    { x: right.x, y: right.y - height },
    { x: front.x, y: front.y - height },
    { x: left.x, y: left.y - height },
  ];
  const up = (p: Pt): Pt => ({ x: p.x, y: p.y + height });
  polygon(ctx, [left, front, up(front), up(left)], style.left, style.stroke);
  polygon(ctx, [right, front, up(front), up(right)], style.right, style.stroke);
  polygon(ctx, top, style.top, style.stroke);
}

export function drawCylinder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  height: number,
  topColor: string,
  sideColor: string,
  darkColor: string,
): void {
  const ry = radius * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx - radius, cy - height);
  ctx.ellipse(cx, cy - height, radius, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + radius, cy);
  ctx.closePath();
  ctx.fillStyle = sideColor;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - height);
  ctx.ellipse(cx, cy - height, radius, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, radius, ry, 0, 0, Math.PI);
  ctx.fillStyle = darkColor;
  ctx.fill();
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 0.5): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
