import type { GameState, OverlayId, PowerPlan, StructureType, Tile } from '../engine/types';
import { PLAYER_IDENTITIES, STRUCTURES, TERRAIN_INFO } from '../engine/balance';
import { TILE_H, TILE_THICK, TILE_W, diamondPoints, glow, polygon, shade, withAlpha } from './iso';
import { TERRAIN_TOP, drawStructure, drawTerrainDetail, drawWire, terrainColors, type OwnerPalette } from './art';

export interface RenderInput {
  state: GameState;
  humanId: number;
  plan: PowerPlan;
  overlay: OverlayId;
  selected: { x: number; y: number } | null;
  hovered: { x: number; y: number } | null;
  buildMode: StructureType | null;
  buildable: Set<number>;
  time: number;
  mutedSelection?: boolean;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const WEATHER_PARTICLES = 90;

function hash(x: number, y: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function ownerPalette(playerId: number): OwnerPalette {
  if (playerId < 0) return { color: '#9aa4b0', accent: '#d5dde6', dark: '#3a434d' };
  const id = PLAYER_IDENTITIES[Math.min(playerId, PLAYER_IDENTITIES.length - 1)];
  return { color: id.color, accent: id.accent, dark: id.dark };
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  camera: Camera = { x: 0, y: 0, zoom: 1.05 };
  private width = 18;
  private height = 18;
  private fogTexture: HTMLCanvasElement | null = null;
  private view = { minX: -1e9, maxX: 1e9, minY: -1e9, maxY: 1e9 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.ctx = ctx;
    this.fogTexture = this.makeFogTexture();
    this.resize();
  }

  private makeFogTexture(): HTMLCanvasElement {
    const sprite = document.createElement('canvas');
    sprite.width = 512;
    sprite.height = 512;
    const sctx = sprite.getContext('2d');
    if (!sctx) return sprite;
    for (let i = 0; i < 26; i++) {
      const x = hash(i, 1) * 512;
      const y = hash(i, 2) * 512;
      const r = 30 + hash(i, 3) * 90;
      const g = sctx.createRadialGradient(x, y, 2, x, y, r);
      const a = 0.05 + hash(i, 4) * 0.08;
      g.addColorStop(0, `rgba(158, 198, 212, ${a})`);
      g.addColorStop(1, 'rgba(158, 198, 212, 0)');
      sctx.fillStyle = g;
      sctx.beginPath();
      sctx.arc(x, y, r, 0, Math.PI * 2);
      sctx.fill();
    }
    return sprite;
  }

  private inView(x: number, y: number): boolean {
    return x >= this.view.minX && x <= this.view.maxX && y >= this.view.minY && y <= this.view.maxY;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private get cssWidth(): number {
    return this.canvas.width / Math.min(2, window.devicePixelRatio || 1);
  }

  private get cssHeight(): number {
    return this.canvas.height / Math.min(2, window.devicePixelRatio || 1);
  }

  private raw(x: number, y: number): { x: number; y: number } {
    return { x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) };
  }

  private centerOffset(): { x: number; y: number } {
    return this.raw((this.width - 1) / 2, (this.height - 1) / 2);
  }

  screenToTile(px: number, py: number): { x: number; y: number } {
    const center = this.centerOffset();
    const sx = (px - this.cssWidth / 2 - this.camera.x) / this.camera.zoom + center.x;
    const sy = (py - this.cssHeight / 2 - this.camera.y) / this.camera.zoom + center.y;
    const u = sx / (TILE_W / 2);
    const v = sy / (TILE_H / 2);
    return { x: Math.round((u + v) / 2), y: Math.round((v - u) / 2) };
  }

  pan(dx: number, dy: number): void {
    this.camera.x += dx;
    this.camera.y += dy;
  }

  zoomAt(px: number, py: number, delta: number): void {
    const before = this.camera.zoom;
    const next = Math.max(0.5, Math.min(2.6, before * Math.exp(-delta * 0.0014)));
    if (Math.abs(next - before) < 1e-4) return;
    const center = this.centerOffset();
    const worldX = (px - this.cssWidth / 2 - this.camera.x) / before + center.x;
    const worldY = (py - this.cssHeight / 2 - this.camera.y) / before + center.y;
    this.camera.zoom = next;
    this.camera.x = px - this.cssWidth / 2 - (worldX - center.x) * next;
    this.camera.y = py - this.cssHeight / 2 - (worldY - center.y) * next;
  }

  centerOn(tileX: number, tileY: number): void {
    const raw = this.raw(tileX, tileY);
    const center = this.centerOffset();
    this.camera.x = -(raw.x - center.x) * this.camera.zoom;
    this.camera.y = -(raw.y - center.y) * this.camera.zoom;
  }

  resetView(tileX?: number, tileY?: number): void {
    this.camera.zoom = 1.12;
    this.centerOn(tileX ?? (this.width - 1) / 2, tileY ?? (this.height - 1) / 2);
  }

  draw(input: RenderInput): void {
    const { state, humanId, plan, overlay, selected, hovered, buildMode, buildable, time } = input;
    this.width = state.width;
    this.height = state.height;
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;

    ctx.clearRect(0, 0, w, h);
    // Sea and sky backdrop.
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0c2836');
    bg.addColorStop(0.45, '#0e3544');
    bg.addColorStop(1, '#071a24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    this.drawSea(ctx, w, h, time);

    const corners = [this.screenToTile(0, 0), this.screenToTile(w, 0), this.screenToTile(0, h), this.screenToTile(w, h)];
    this.view = {
      minX: Math.min(...corners.map((c) => c.x)) - 3,
      maxX: Math.max(...corners.map((c) => c.x)) + 3,
      minY: Math.min(...corners.map((c) => c.y)) - 3,
      maxY: Math.max(...corners.map((c) => c.y)) + 3,
    };

    ctx.save();
    const center = this.centerOffset();
    ctx.translate(w / 2 + this.camera.x, h / 2 + this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-center.x, -center.y);

    const order = [...state.tiles].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
    const links = this.collectLinks(state);
    const sources = this.energySources(plan);

    // Terrain pass (only tiles inside the viewport).
    for (const tile of order) {
      if (!this.inView(tile.x, tile.y)) continue;
      this.drawTileBase(ctx, state, tile, time);
    }

    // Ground overlays sit under the buildings so the skyline stays readable.
    if (overlay === 'ownership') this.drawOwnership(ctx, state, humanId);
    if (overlay === 'power') this.drawPower(ctx, state, plan, time);
    if (overlay === 'compute') this.drawCompute(ctx, state, plan);
    if (overlay === 'economy') this.drawEconomy(ctx, state, humanId);

    // Wires behind buildings.
    for (const link of links) {
      if (!this.visible(link.from, humanId) || !this.visible(link.to, humanId)) continue;
      const a0 = this.tileTop(link.from);
      const b0 = this.tileTop(link.to);
      const a = { x: a0.x, y: a0.y - 17 };
      const b = { x: b0.x, y: b0.y - 17 };
      const powered =
        link.owner === humanId
          ? this.linkPowered(plan, link.from, link.to)
          : this.visible(link.from, humanId);
      drawWire(ctx, a, b, link.color, link.owner === humanId ? 0.85 : 0.4, time, powered, true);
    }

    // Structures.
    for (const tile of order) {
      if (!tile.structure) continue;
      if (!this.inView(tile.x, tile.y)) continue;
      const visible = this.visible(tile, humanId);
      if (!visible) continue;
      const pos = this.tileTop(tile);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      const def = STRUCTURES[tile.structure.type];
      const scale = def.scale;
      ctx.scale(scale * 1.14, scale * 1.14);
      const energized = tile.structure.owner === humanId ? sources.has(tile.y * state.width + tile.x) : true;
      drawStructure(ctx, tile.structure.type, ownerPalette(tile.structure.owner), time, tile.variant, energized);
      ctx.restore();
    }

    // Fog: a single clipped cloud field over every unexplored tile, so the
    // boundary stays organic instead of showing tile seams.
    const fogPath = new Path2D();
    for (const tile of order) {
      if (this.visible(tile, humanId)) continue;
      if (!this.inView(tile.x, tile.y)) continue;
      const p = this.tileTop(tile);
      const pts = diamondPoints(p.x, p.y, TILE_W + 4, TILE_H + 2, 0);
      fogPath.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) fogPath.lineTo(pts[i].x, pts[i].y);
      fogPath.closePath();
    }
    if (fogPath) {
      ctx.fillStyle = 'rgba(9, 26, 36, 0.9)';
      ctx.fill(fogPath);
      if (this.fogTexture) {
        ctx.save();
        ctx.clip(fogPath);
        const span = Math.max(this.width, this.height) * TILE_W;
        ctx.globalAlpha = 0.75;
        ctx.drawImage(this.fogTexture, -span, -span / 2, span * 2, span * 1.4);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      ctx.save();
      ctx.clip(fogPath);
      for (let i = 0; i < 26; i++) {
        const tile = state.tiles[Math.floor(hash(i, 7) * state.tiles.length)];
        if (!tile || this.visible(tile, humanId)) continue;
        const p = this.tileTop(tile);
        ctx.fillStyle = 'rgba(170,220,230,0.14)';
        ctx.beginPath();
        ctx.arc(p.x + (hash(i, 8) - 0.5) * 40, p.y + (hash(i, 9) - 0.5) * 20, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Build placement hints.
    if (buildMode) {
      const pulse = 0.7 + 0.3 * Math.sin(time * 4);
      for (const tile of state.tiles) {
        if (!this.inView(tile.x, tile.y) || !buildable.has(tile.y * state.width + tile.x)) continue;
        const p = this.tileTop(tile);
        polygon(
          ctx,
          diamondPoints(p.x, p.y, TILE_W - 6, TILE_H - 4),
          `rgba(90,255,200,${0.25 * pulse})`,
          `rgba(150,255,225,${pulse})`,
          2.2,
        );
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y);
        ctx.lineTo(p.x + 5, p.y);
        ctx.moveTo(p.x, p.y - 4);
        ctx.lineTo(p.x, p.y + 4);
        ctx.stroke();
      }
    }

    // Hover + selection.
    if (hovered) {
      const tile = this.tileAt(state, hovered.x, hovered.y);
      if (tile) {
        const p = this.tileTop(tile);
        polygon(ctx, diamondPoints(p.x, p.y, TILE_W - 3, TILE_H - 2), 'rgba(255,255,255,0.06)', 'rgba(220,245,255,0.5)', 1);
      }
    }
    if (selected) {
      const tile = this.tileAt(state, selected.x, selected.y);
      if (tile) {
        const p = this.tileTop(tile);
        const pulse = 0.65 + 0.25 * Math.sin(time * 3);
        polygon(
          ctx,
          diamondPoints(p.x, p.y, TILE_W - 2, TILE_H - 1),
          'rgba(255,255,255,0.08)',
          `rgba(150,255,225,${pulse})`,
          2,
        );
        ctx.fillStyle = `rgba(160,255,230,${pulse})`;
        for (const corner of diamondPoints(p.x, p.y, TILE_W + 8, TILE_H + 6)) {
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // Weather layers (screen space).
    this.drawWeather(ctx, state, w, h, time);
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(2,8,12,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  private drawSea(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 28; i++) {
      const x = ((hash(i, 3) * w + time * (6 + hash(i, 5) * 8)) % (w + 120)) - 60;
      const y = hash(i, 9) * h;
      ctx.strokeStyle = 'rgba(120,200,220,0.14)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 18, y - 4, x + 36, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private visible(tile: Tile, humanId: number): boolean {
    return (tile.revealed & (1 << humanId)) !== 0;
  }

  private tileAt(state: GameState, x: number, y: number): Tile | null {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
    return state.tiles[y * state.width + x];
  }

  private tileTop(tile: Tile): { x: number; y: number } {
    const raw = this.raw(tile.x, tile.y);
    const elevation = tile.terrain === 'mountain' ? (tile.elevation - 0.4) * 20 : 0;
    return { x: raw.x, y: raw.y - elevation };
  }

  private drawTileBase(ctx: CanvasRenderingContext2D, state: GameState, tile: Tile, time: number): void {
    const raw = this.raw(tile.x, tile.y);
    const topY = raw.y - (tile.terrain === 'mountain' ? (tile.elevation - 0.4) * 20 : 0);
    const colors = terrainColors(tile.terrain);
    const underwater = tile.terrain === 'ocean';
    if (underwater) {
      const wave = Math.sin(time * 1.1 + tile.x * 0.7 + tile.y * 0.9);
      const base = shade(TERRAIN_TOP.ocean, Math.round(wave * 8));
      polygon(ctx, diamondPoints(raw.x, raw.y, TILE_W, TILE_H, 0.5), base);
      ctx.strokeStyle = `rgba(170,235,250,${0.14 + 0.1 * Math.max(0, wave)})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(raw.x - 14, raw.y + wave * 1.5);
      ctx.quadraticCurveTo(raw.x, raw.y - 3 + wave * 1.5, raw.x + 14, raw.y + wave * 1.5);
      ctx.stroke();
      return;
    }

    // Cliffs only where land meets water or the map edge, so inland terrain
    // reads as one continuous landscape rather than a tiled board.
    const edge = tile.x === 0 || tile.y === 0 || tile.x === state.width - 1 || tile.y === state.height - 1;
    const neighbours = [
      this.tileAt(state, tile.x + 1, tile.y),
      this.tileAt(state, tile.x - 1, tile.y),
      this.tileAt(state, tile.x, tile.y + 1),
      this.tileAt(state, tile.x, tile.y - 1),
    ];
    const coastal = edge || neighbours.some((n) => n === null || n.terrain === 'ocean');
    if (coastal) {
      const skirt = diamondPoints(raw.x, raw.y + TILE_THICK, TILE_W, TILE_H);
      polygon(ctx, skirt, colors.right);
      polygon(
        ctx,
        [
          { x: raw.x - TILE_W / 2, y: raw.y },
          { x: raw.x, y: raw.y + TILE_H / 2 },
          { x: raw.x, y: raw.y + TILE_H / 2 + TILE_THICK },
          { x: raw.x - TILE_W / 2, y: raw.y + TILE_THICK },
        ],
        colors.left,
      );
      polygon(
        ctx,
        [
          { x: raw.x + TILE_W / 2, y: raw.y },
          { x: raw.x, y: raw.y + TILE_H / 2 },
          { x: raw.x, y: raw.y + TILE_H / 2 + TILE_THICK },
          { x: raw.x + TILE_W / 2, y: raw.y + TILE_THICK },
        ],
        colors.right,
      );
    }

    // Top face with a light gradient.
    const top = colors.top;
    polygon(ctx, diamondPoints(raw.x, topY, TILE_W, TILE_H), shade(top, 8));
    ctx.strokeStyle = 'rgba(10,24,28,0.16)';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(raw.x - TILE_W / 2 + 1, topY);
    ctx.lineTo(raw.x, topY - TILE_H / 2 + 1);
    ctx.lineTo(raw.x + TILE_W / 2 - 1, topY);
    ctx.stroke();

    // Subtle per-tile grain keeps large biomes from reading as flat swatches.
    for (let i = 0; i < 2; i++) {
      const hx = hash(tile.x * 7 + i, tile.y * 5 + tile.variant);
      const hy = hash(tile.y * 3 + i, tile.x * 11 + tile.variant);
      ctx.fillStyle = hx > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
      ctx.beginPath();
      ctx.ellipse(
        raw.x + (hx - 0.5) * TILE_W * 0.55,
        topY + (hy - 0.5) * TILE_H * 0.5,
        10 + hx * 16,
        4 + hy * 7,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Terrain dressing is drawn relative to the tile top.
    ctx.save();
    ctx.translate(raw.x, topY);
    drawTerrainDetail(ctx, tile.terrain, tile.variant, time);
    ctx.restore();

    // Revealed but not explored? (fog handled separately)
    if (tile.owner >= 0) {
      const palette = ownerPalette(tile.owner);
      ctx.strokeStyle = withAlpha(palette.color, 0.42);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = palette.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(raw.x, topY - TILE_H / 2 + 1);
      ctx.lineTo(raw.x + TILE_W / 2 - 1, topY);
      ctx.lineTo(raw.x, topY + TILE_H / 2 - 1);
      ctx.lineTo(raw.x - TILE_W / 2 + 1, topY);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private collectLinks(state: GameState): Array<{
    from: Tile;
    to: Tile;
    owner: number;
    color: string;
  }> {
    const lookup = new Map<string, Tile>();
    for (const t of state.tiles) if (t.structure) lookup.set(`${t.x},${t.y}`, t);
    const out: Array<{ from: Tile; to: Tile; owner: number; color: string }> = [];
    for (const t of state.tiles) {
      if (!t.structure) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as Array<[number, number]>) {
        const other = lookup.get(`${t.x + dx},${t.y + dy}`);
        if (!other || !other.structure || other.structure.owner !== t.structure.owner) continue;
        out.push({
          from: t,
          to: other,
          owner: t.structure.owner,
          color: ownerPalette(t.structure.owner).color,
        });
      }
    }
    return out;
  }

  private linkPowered(plan: PowerPlan, from: Tile, to: Tile): boolean {
    for (const link of plan.links) {
      const a = plan.nodes[link.a];
      const b = plan.nodes[link.b];
      if (
        (a.x === from.x && a.y === from.y && b.x === to.x && b.y === to.y) ||
        (a.x === to.x && a.y === to.y && b.x === from.x && b.y === from.y)
      ) {
        return link.flow > 0.05;
      }
    }
    return false;
  }

  private energySources(plan: PowerPlan): Set<number> {
    const set = new Set<number>();
    for (const node of plan.nodes) {
      if (node.produced > 0.02 || node.served > 0.02) set.add(node.y * this.width + node.x);
    }
    return set;
  }

  private drawOwnership(ctx: CanvasRenderingContext2D, state: GameState, humanId: number): void {
    for (const tile of state.tiles) {
      if (!this.inView(tile.x, tile.y)) continue;
      if (!this.visible(tile, humanId) || tile.owner < 0) continue;
      const p = this.tileTop(tile);
      polygon(ctx, diamondPoints(p.x, p.y, TILE_W - 2, TILE_H - 2), withAlpha(ownerPalette(tile.owner).color, 0.34));
    }
  }

  private drawPower(ctx: CanvasRenderingContext2D, state: GameState, plan: PowerPlan, time: number): void {
    for (const node of plan.nodes) {
      if (!this.inView(node.x, node.y)) continue;
      const tile = this.tileAt(state, node.x, node.y);
      if (!tile) continue;
      const p = this.tileTop(tile);
      let color = 'rgba(120,220,255,0.35)';
      if (node.kind === 'data' || node.kind === 'research') {
        const ratio = node.demand > 0 ? node.served / node.demand : 0;
        color = ratio > 0.98 ? 'rgba(110,255,180,0.42)' : ratio > 0.6 ? 'rgba(255,205,90,0.5)' : 'rgba(255,90,90,0.55)';
      } else if (node.kind === 'generation') {
        color = node.produced > 0 ? 'rgba(110,230,255,0.4)' : 'rgba(120,140,160,0.3)';
      } else if (node.kind === 'storage') {
        color = 'rgba(180,140,255,0.35)';
      }
      polygon(ctx, diamondPoints(p.x, p.y, TILE_W - 4, TILE_H - 3), color);
      if ((node.kind === 'data' || node.kind === 'research') && node.demand > 0 && node.served < node.demand - 0.4) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 5);
        glow(ctx, p.x, p.y, 18, `rgba(255,80,80,${0.5 * pulse})`, 0.5);
      }
    }
    for (const link of plan.links) {
      if (link.congested) {
        const a = plan.nodes[link.a];
        const b = plan.nodes[link.b];
        const ta = this.tileAt(state, a.x, a.y);
        const tb = this.tileAt(state, b.x, b.y);
        if (ta && tb) {
          const pa = this.tileTop(ta);
          const pb = this.tileTop(tb);
          ctx.strokeStyle = 'rgba(255,150,60,0.9)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y - 4);
          ctx.lineTo(pb.x, pb.y - 4);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  private drawCompute(ctx: CanvasRenderingContext2D, state: GameState, plan: PowerPlan): void {
    const maxCompute = Math.max(1, ...plan.nodes.map((n) => n.compute));
    for (const node of plan.nodes) {
      if (node.kind !== 'data' || !this.inView(node.x, node.y)) continue;
      const tile = this.tileAt(state, node.x, node.y);
      if (!tile) continue;
      const p = this.tileTop(tile);
      const intensity = node.compute / maxCompute;
      polygon(ctx, diamondPoints(p.x, p.y, TILE_W - 3, TILE_H - 2), `rgba(90,240,255,${0.15 + intensity * 0.4})`);
      const barW = 26;
      ctx.fillStyle = 'rgba(6,18,24,0.85)';
      ctx.fillRect(p.x - barW / 2, p.y - 52, barW, 4);
      ctx.fillStyle = node.demand > 0 && node.served / node.demand < 0.75 ? '#ff9a6b' : '#7dfccb';
      ctx.fillRect(p.x - barW / 2, p.y - 52, barW * Math.min(1, node.demand > 0 ? node.served / node.demand : 0), 4);
    }
  }

  private drawEconomy(ctx: CanvasRenderingContext2D, state: GameState, humanId: number): void {
    for (const tile of state.tiles) {
      if (!this.inView(tile.x, tile.y) || !this.visible(tile, humanId)) continue;
      if (tile.structure) continue;
      const info = TERRAIN_INFO[tile.terrain];
      if (!info.buildable) continue;
      const value = Math.min(1, info.claimValue / 3);
      const p = this.tileTop(tile);
      polygon(ctx, diamondPoints(p.x, p.y, TILE_W - 3, TILE_H - 2), `rgba(255,205,90,${0.1 + value * 0.25})`);
      if (tile.owner === humanId) {
        polygon(ctx, diamondPoints(p.x, p.y, TILE_W - 10, TILE_H - 6), 'rgba(120,255,200,0.22)', 'rgba(120,255,200,0.5)', 1);
      }
    }
  }

  private drawWeather(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, time: number): void {
    const kind = state.conditions.weather;
    if (kind === 'clear' || kind === 'heatwave') {
      ctx.save();
      const sun = ctx.createRadialGradient(w * 0.78, h * 0.12, 10, w * 0.78, h * 0.12, w * 0.5);
      sun.addColorStop(0, kind === 'heatwave' ? 'rgba(255,170,90,0.16)' : 'rgba(255,240,190,0.1)');
      sun.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);
      if (kind === 'heatwave') {
        ctx.strokeStyle = 'rgba(255,200,140,0.08)';
        for (let i = 0; i < 8; i++) {
          const y = ((i / 8) * h + Math.sin(time * 0.8 + i) * 8) % h;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.quadraticCurveTo(w / 2, y - 6, w, y);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    if (kind === 'cold_snap') {
      ctx.fillStyle = 'rgba(190,225,245,0.35)';
      for (let i = 0; i < WEATHER_PARTICLES; i++) {
        const speed = 18 + hash(i, 1) * 26;
        const x = (hash(i, 2) * w + Math.sin(time + i) * 20) % w;
        const y = (hash(i, 4) * h + time * speed) % h;
        ctx.beginPath();
        ctx.arc(x, y, 1.1 + hash(i, 6) * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (kind === 'storm' || kind === 'wind_drought') {
      const heavy = kind === 'storm';
      ctx.strokeStyle = heavy ? 'rgba(150,190,220,0.14)' : 'rgba(180,210,220,0.08)';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(heavy ? -0.5 : -0.25);
      for (let i = 0; i < 26; i++) {
        const y = (hash(i, 3) * h - h / 2) * 1.2;
        const x = ((time * (heavy ? 220 : 60) + hash(i, 7) * w) % (w * 1.6)) - w * 0.3;
        const len = heavy ? 22 + hash(i, 8) * 30 : 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + len * 0.25);
        ctx.stroke();
      }
      ctx.restore();
      if (heavy && Math.sin(time * 0.7) > 0.995) {
        ctx.fillStyle = 'rgba(220,240,255,0.16)';
        ctx.fillRect(0, 0, w, h);
      }
      return;
    }
    if (kind === 'dust_storm') {
      ctx.fillStyle = 'rgba(210,170,110,0.28)';
      for (let i = 0; i < 70; i++) {
        const x = (hash(i, 2) * w + time * (40 + hash(i, 5) * 60)) % w;
        const y = (hash(i, 7) * h + Math.sin(time * 2 + i) * 12) % h;
        ctx.fillRect(x, y, 2 + hash(i, 9) * 3, 1.2);
      }
    }
  }
}
