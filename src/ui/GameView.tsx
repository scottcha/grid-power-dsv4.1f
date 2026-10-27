import { useEffect, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { useGame, useHumanPlan } from './store';
import { GameRenderer, type RenderInput } from '../render/renderer';
import { buildCandidates } from '../engine/actions';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { BottomBar } from './BottomBar';
import { TilePanel } from './TilePanel';
import { EmpirePanel } from './EmpirePanel';
import { TechTree } from './TechTree';
import { TurnSummary } from './TurnSummary';
import { EventLog, HelpModal, PauseMenu } from './Modals';
import { VictoryScreen } from './Victory';
import { TutorialTip } from './Tutorial';
import { cameraBus } from './cameraBus';
import { Toast } from './Toast';

export function GameView(): JSX.Element | null {
  const game = useGame((s) => s.game);
  const plan = useHumanPlan();
  const selected = useGame((s) => s.selected);
  const hovered = useGame((s) => s.hovered);
  const overlay = useGame((s) => s.overlay);
  const buildMode = useGame((s) => s.buildMode);
  const empireOpen = useGame((s) => s.empireOpen);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const inputRef = useRef<RenderInput | null>(null);
  const centeredRef = useRef<string>('');
  const buildable = useMemo(() => {
    if (!game || !buildMode) return new Set<number>();
    return new Set(buildCandidates(game, 0, buildMode).map((t) => t.y * game.width + t.x));
  }, [game, buildMode]);

  inputRef.current =
    game && plan
      ? {
          state: game,
          humanId: 0,
          plan,
          overlay,
          selected,
          hovered,
          buildMode,
          buildable,
          time: 0,
        }
      : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new GameRenderer(canvas);
    rendererRef.current = renderer;
    cameraBus.centerOn = (x, y) => renderer.centerOn(x, y);
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);

    let frame = 0;
    const loop = (ms: number): void => {
      const input = inputRef.current;
      if (input) renderer.draw({ ...input, time: ms / 1000 });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    let drag: { x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;
    const point = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const p = point(event);
      drag = { x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false };
      canvas.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent): void => {
      const p = point(event);
      if (drag) {
        const dx = p.x - drag.x;
        const dy = p.y - drag.y;
        if (Math.abs(p.x - drag.startX) + Math.abs(p.y - drag.startY) > 6) drag.moved = true;
        if (drag.moved) {
          renderer.pan(dx, dy);
          drag.x = p.x;
          drag.y = p.y;
          canvas.classList.add('dragging');
        }
      } else {
        const tile = renderer.screenToTile(p.x, p.y);
        useGame.getState().hover(tile.x, tile.y);
      }
    };
    const onUp = (event: PointerEvent): void => {
      const p = point(event);
      canvas.classList.remove('dragging');
      if (drag && !drag.moved) {
        const tile = renderer.screenToTile(p.x, p.y);
        const state = useGame.getState().game;
        if (state && tile.x >= 0 && tile.y >= 0 && tile.x < state.width && tile.y < state.height) {
          useGame.getState().select(tile.x, tile.y);
        }
      }
      drag = null;
    };
    const onLeave = (): void => useGame.getState().hover(0, -1);
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const p = point(event);
      renderer.zoomAt(p.x, p.y, event.deltaY);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      rendererRef.current = null;
      centeredRef.current = '';
    };
  }, []);

  // Centre the camera when a different world loads.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!game || !renderer) return;
    const key = `${game.seed}:${game.width}:${game.turn === 1 ? 'fresh' : 'loaded'}`;
    if (centeredRef.current === key) return;
    centeredRef.current = key;
    const starter =
      game.tiles.find((t) => t.structure && t.structure.owner === 0 && t.structure.type === 'edge_dc') ??
      game.tiles.find((t) => t.structure && t.structure.owner === 0);
    renderer.camera.zoom = 1.18;
    if (starter) renderer.resetView(starter.x, starter.y);
    else renderer.resetView();
  }, [game]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const state = useGame.getState();
      if (event.code === 'Space') {
        event.preventDefault();
        if (!state.techOpen && !state.pauseOpen && !state.logOpen && !state.helpOpen && !state.summaryOpen) state.doEndTurn();
        return;
      }
      if (event.key === 'Escape') {
        if (state.techOpen) state.toggleTech(false);
        else if (state.logOpen) state.toggleLog(false);
        else if (state.helpOpen) state.toggleHelp(false);
        else if (state.pauseOpen) state.togglePause(false);
        else if (state.summaryOpen) state.closeSummary();
        else if (state.buildMode) state.cancelBuild();
        else if (state.selected) state.clearSelection();
        else state.togglePause(true);
        return;
      }
      switch (event.key.toLowerCase()) {
        case 't':
          state.toggleTech();
          break;
        case 'l':
          state.toggleLog();
          break;
        case 'h':
          state.toggleHelp(true);
          break;
        case 'p':
          state.togglePause(true);
          break;
        case 'm':
          state.toggleMute();
          break;
        case '1':
          state.setOverlay('power');
          break;
        case '2':
          state.setOverlay('compute');
          break;
        case '3':
          state.setOverlay('ownership');
          break;
        case '4':
          state.setOverlay('economy');
          break;
        case '0':
          state.setOverlay('none');
          break;
        default:
          break;
      }
      const renderer = rendererRef.current;
      if (renderer) {
        const step = 70;
        if (event.key === 'ArrowLeft') renderer.pan(step, 0);
        if (event.key === 'ArrowRight') renderer.pan(-step, 0);
        if (event.key === 'ArrowUp') renderer.pan(0, step);
        if (event.key === 'ArrowDown') renderer.pan(0, -step);
        if (event.key === '+' || event.key === '=') renderer.zoomAt(window.innerWidth / 2, window.innerHeight / 2, -120);
        if (event.key === '-' || event.key === '_') renderer.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 120);
        if (event.key === 'f' || event.key === 'F') {
          const game = useGame.getState().game;
          if (game) {
            let sx = 0;
            let sy = 0;
            let n = 0;
            for (const tile of game.tiles) {
              if (tile.structure && tile.structure.owner === 0) {
                sx += tile.x;
                sy += tile.y;
                n++;
              }
            }
            if (n > 0) renderer.centerOn(sx / n, sy / n);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!game || !plan) return null;

  return (
    <div className="app">
      <div className="canvas-layer">
        <canvas ref={canvasRef} className={`game-canvas ${buildMode ? 'placing' : ''}`} />
      </div>
      <div className="ui-layer">
        <TopBar />
        <LeftRail />
        <div className="right-panel">
          {selected ? (
            <>
              <TilePanel />
              <button className="btn wide" onClick={() => useGame.getState().clearSelection()}>
                Empire overview
              </button>
            </>
          ) : (
            empireOpen && <EmpirePanel />
          )}
        </div>
        <BottomBar />
        <TutorialTip />
        <Toast />
        <TechTree />
        <TurnSummary />
        <EventLog />
        <HelpModal />
        <PauseMenu />
        <VictoryScreen />
      </div>
    </div>
  );
}
