import { create } from 'zustand';
import { useMemo } from 'react';
import type { GameState, OverlayId, PolicyId, StructureType, TurnReport } from '../engine/types';
import { createGame, endTurn } from '../engine/game';
import {
  claimTile,
  buildStructure,
  upgradeFacility,
  demolishFacility,
  researchTech,
  setDataCenterPolicy,
  setDefaultPolicy,
  surveyArea,
  buildCandidates,
} from '../engine/actions';
import { planPower } from '../engine/grid';
import { loadGame, saveGame, hasSave, savedAt } from '../engine/save';
import { STRUCTURES } from '../engine/balance';
import { sound } from '../audio/sfx';

export type Screen = 'menu' | 'game';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

interface GameStore {
  game: GameState | null;
  screen: Screen;
  selected: { x: number; y: number } | null;
  hovered: { x: number; y: number } | null;
  overlay: OverlayId;
  buildMode: StructureType | null;
  techOpen: boolean;
  logOpen: boolean;
  helpOpen: boolean;
  pauseOpen: boolean;
  summaryOpen: boolean;
  empireOpen: boolean;
  summary: TurnReport | null;
  muted: boolean;
  toast: Toast | null;
  refresh: number;
  tutorialDismissed: boolean;
  hasSavedGame: boolean;
  savedAtMs: number | null;

  newGame: (opts: { seed?: number; mapSize: number; difficulty: 'relaxed' | 'standard' | 'brutal' }) => void;
  continueGame: () => void;
  backToMenu: () => void;
  select: (x: number, y: number) => void;
  clearSelection: () => void;
  hover: (x: number, y: number | null) => void;
  setOverlay: (overlay: OverlayId) => void;
  startBuild: (type: StructureType) => void;
  cancelBuild: () => void;
  placeHere: (x: number, y: number) => void;
  claim: () => void;
  upgrade: () => void;
  demolish: () => void;
  survey: () => void;
  research: (techId: string) => void;
  setPolicy: (policy: PolicyId, x?: number, y?: number) => void;
  doEndTurn: () => void;
  toggleTech: (open?: boolean) => void;
  toggleLog: (open?: boolean) => void;
  toggleHelp: (open?: boolean) => void;
  togglePause: (open?: boolean) => void;
  toggleEmpire: (open?: boolean) => void;
  closeSummary: () => void;
  toggleMute: () => void;
  dismissTutorial: () => void;
  saveNow: () => void;
  notify: (text: string, tone?: Toast['tone']) => void;
}

let toastId = 1;

function clone(state: GameState): GameState {
  return structuredClone(state);
}

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  screen: 'menu',
  selected: null,
  hovered: null,
  overlay: 'none',
  buildMode: null,
  techOpen: false,
  logOpen: false,
  helpOpen: false,
  pauseOpen: false,
  summaryOpen: false,
  empireOpen: true,
  summary: null,
  muted: false,
  toast: null,
  refresh: 0,
  tutorialDismissed: false,
  hasSavedGame: hasSave(),
  savedAtMs: savedAt(),

  newGame: ({ seed, mapSize, difficulty }) => {
    const game = createGame({ seed, mapSize, difficulty });
    const starter = game.tiles.find((t) => t.structure && t.structure.owner === 0 && STRUCTURES[t.structure.type].category === 'data');
    saveGame(game);
    sound.init();
    sound.startAmbience();
    set({
      game,
      screen: 'game',
      selected: starter ? { x: starter.x, y: starter.y } : null,
      hovered: null,
      overlay: 'none',
      buildMode: null,
      summary: null,
      summaryOpen: false,
      techOpen: false,
      pauseOpen: false,
      helpOpen: false,
      logOpen: false,
      empireOpen: true,
      tutorialDismissed: false,
      hasSavedGame: true,
      savedAtMs: Date.now(),
    });
    sound.play('start');
  },

  continueGame: () => {
    const loaded = loadGame();
    if (!loaded) {
      get().notify('No save available', 'bad');
      return;
    }
    sound.init();
    sound.startAmbience();
    const starter = loaded.tiles.find(
      (t) => t.structure && t.structure.owner === 0 && STRUCTURES[t.structure.type].category === 'data',
    );
    set({
      game: loaded,
      screen: 'game',
      selected: starter ? { x: starter.x, y: starter.y } : null,
      overlay: 'none',
      buildMode: null,
      summary: null,
      summaryOpen: false,
      techOpen: false,
      pauseOpen: false,
      helpOpen: false,
      logOpen: false,
      empireOpen: true,
    });
  },

  backToMenu: () => {
    const game = get().game;
    if (game && game.phase === 'playing') saveGame(game);
    set({ screen: 'menu', summaryOpen: false, pauseOpen: false, techOpen: false, buildMode: null, hasSavedGame: hasSave(), savedAtMs: savedAt() });
    sound.stopAmbience();
  },

  select: (x, y) => {
    const game = get().game;
    if (!game) return;
    const tile = game.tiles[y * game.width + x];
    if (!tile) return;
    if (get().buildMode) {
      get().placeHere(x, y);
      return;
    }
    set({ selected: { x, y }, empireOpen: false });
    sound.play('select');
  },

  clearSelection: () => set({ selected: null, empireOpen: true, buildMode: null }),

  hover: (x, y) => set({ hovered: y === null ? null : { x, y } }),

  setOverlay: (overlay) => set({ overlay }),

  startBuild: (type) => {
    const game = get().game;
    if (!game) return;
    const candidates = buildCandidates(game, 0, type);
    if (candidates.length === 0) {
      get().notify(`No legal plot for ${STRUCTURES[type].name}`, 'bad');
      sound.play('error');
      return;
    }
    set({ buildMode: type, empireOpen: false });
    sound.play('click');
  },

  cancelBuild: () => set({ buildMode: null }),

  placeHere: (x, y) => {
    const { game, buildMode } = get();
    if (!game || !buildMode) return;
    const next = clone(game);
    const result = buildStructure(next, 0, buildMode, x, y);
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot build there', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, buildMode: null, selected: { x, y }, refresh: get().refresh + 1 });
    sound.play('build');
    get().notify(`${STRUCTURES[buildMode].name} constructed`, 'good');
  },

  claim: () => {
    const { game, selected } = get();
    if (!game || !selected) return;
    const next = clone(game);
    const result = claimTile(next, 0, selected.x, selected.y);
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot claim', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, selected: selected, refresh: get().refresh + 1 });
    sound.play('claim');
  },

  upgrade: () => {
    const { game, selected } = get();
    if (!game || !selected) return;
    const next = clone(game);
    const result = upgradeFacility(next, 0, selected.x, selected.y);
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot upgrade', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, selected: selected, refresh: get().refresh + 1 });
    sound.play('build');
  },

  demolish: () => {
    const { game, selected } = get();
    if (!game || !selected) return;
    const next = clone(game);
    const result = demolishFacility(next, 0, selected.x, selected.y);
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot demolish', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, selected: selected, refresh: get().refresh + 1 });
    sound.play('claim');
  },

  survey: () => {
    const { game, selected } = get();
    if (!game || !selected) return;
    const next = clone(game);
    const result = surveyArea(next, 0, selected.x, selected.y);
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot survey', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, refresh: get().refresh + 1 });
    sound.play('survey');
  },

  research: (techId) => {
    const { game } = get();
    if (!game) return;
    const next = clone(game);
    const result = researchTech(next, 0, techId);
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot research', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, refresh: get().refresh + 1 });
    sound.play('research');
  },

  setPolicy: (policy, x, y) => {
    const { game, selected } = get();
    if (!game) return;
    const next = clone(game);
    let result;
    if (x !== undefined && y !== undefined) {
      result = setDataCenterPolicy(next, 0, x, y, policy);
    } else if (selected) {
      result = setDataCenterPolicy(next, 0, selected.x, selected.y, policy);
    } else {
      result = setDefaultPolicy(next, 0, policy);
    }
    if (!result.ok) {
      get().notify(result.error ?? 'Cannot change policy', 'bad');
      sound.play('error');
      return;
    }
    saveGame(next);
    set({ game: next, refresh: get().refresh + 1 });
    sound.play('click');
  },

  doEndTurn: () => {
    const game = get().game;
    if (!game || game.phase !== 'playing') return;
    const next = clone(game);
    const report = endTurn(next);
    saveGame(next);
    set({
      game: next,
      summary: report,
      summaryOpen: true,
      buildMode: null,
      selected: null,
      empireOpen: true,
      hasSavedGame: true,
      savedAtMs: Date.now(),
    });
    if (next.phase === 'gameover') sound.play(next.result?.winner === 0 ? 'victory' : 'defeat');
    else sound.play('endTurn');
  },

  toggleTech: (open) => set({ techOpen: open ?? !get().techOpen, buildMode: null }),
  toggleLog: (open) => set({ logOpen: open ?? !get().logOpen }),
  toggleHelp: (open) => set({ helpOpen: open ?? !get().helpOpen }),
  togglePause: (open) => set({ pauseOpen: open ?? !get().pauseOpen }),
  toggleEmpire: (open) => set({ empireOpen: open ?? !get().empireOpen }),
  closeSummary: () => set({ summaryOpen: false }),
  toggleMute: () => {
    const muted = !get().muted;
    sound.setMuted(muted);
    set({ muted });
  },
  dismissTutorial: () => set({ tutorialDismissed: true }),
  saveNow: () => {
    const game = get().game;
    if (!game) return;
    const ok = saveGame(game);
    set({ hasSavedGame: ok, savedAtMs: ok ? Date.now() : null });
    get().notify(ok ? 'Game saved' : 'Save failed', ok ? 'good' : 'bad');
  },
  notify: (text, tone = 'info') => {
    const id = toastId++;
    set({ toast: { id, text, tone } });
    window.setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3200);
  },
}));

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function useHumanPlayer() {
  const game = useGame((s) => s.game);
  return game ? game.players[0] : null;
}

export function useHumanPlan() {
  const game = useGame((s) => s.game);
  const refresh = useGame((s) => s.refresh);
  return useMemo(() => {
    void refresh;
    return game ? planPower(game, 0) : null;
  }, [game, refresh]);
}
