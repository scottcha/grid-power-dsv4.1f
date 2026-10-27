import type { JSX } from 'react';
import { useGame } from './store';
import { Minimap } from './Minimap';
import { fmt } from './format';
import { BoltIcon, ChipIcon, CoinIcon, LayersIcon } from './icons';
import type { OverlayId } from '../engine/types';

const OVERLAYS: Array<{ id: OverlayId; label: string; icon: JSX.Element }> = [
  { id: 'power', label: 'Power', icon: <BoltIcon size={15} /> },
  { id: 'compute', label: 'Compute', icon: <ChipIcon size={15} /> },
  { id: 'ownership', label: 'Land', icon: <LayersIcon size={15} /> },
  { id: 'economy', label: 'Value', icon: <CoinIcon size={15} /> },
];

export function LeftRail(): JSX.Element {
  const game = useGame((s) => s.game);
  const overlay = useGame((s) => s.overlay);
  const setOverlay = useGame((s) => s.setOverlay);
  if (!game) return <div />;
  const effectiveCompute = game.conditions.computePrice * game.marketSaturation;
  const forecast = game.forecast;

  return (
    <div className="left-rail">
      <Minimap />
      <div className="panel">
        <div className="panel-title">
          <span>Map layers</span>
          <span style={{ color: 'var(--faint)', fontSize: 9 }}>1–4</span>
        </div>
        <div className="overlay-row">
          {OVERLAYS.map((item) => (
            <button
              key={item.id}
              className={`overlay-btn ${overlay === item.id ? 'active' : ''}`}
              onClick={() => setOverlay(overlay === item.id ? 'none' : item.id)}
              title={`${item.label} overlay`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel conditions-card">
        <div className="conditions-head">
          <span style={{ color: game.conditions.marketEvent === 'none' ? 'var(--accent)' : 'var(--gold)' }}>
            {game.conditions.headline}
          </span>
        </div>
        <div className="conditions-desc">{game.conditions.description}</div>
        <div className="sep" />
        <div className="price-row">
          <span>Electricity</span>
          <strong>${game.conditions.elecPrice.toFixed(2)}/MW</strong>
        </div>
        <div className="price-row">
          <span>Compute clearing</span>
          <strong>${effectiveCompute.toFixed(2)}/CU</strong>
        </div>
        <div className="price-row">
          <span>Gas fuel</span>
          <strong>${game.conditions.fuelPrice.toFixed(2)}</strong>
        </div>
        <div className="sep" />
        <div className="price-row">
          <span>Next turn</span>
          <strong>{forecast.conditions.headline}</strong>
        </div>
        <div className="price-row">
          <span>Elec forecast</span>
          <strong>
            ${forecast.elecLow.toFixed(2)}–${forecast.elecHigh.toFixed(2)}
          </strong>
        </div>
        <div className="price-row">
          <span>Compute forecast</span>
          <strong>
            ${forecast.computeLow.toFixed(2)}–${forecast.computeHigh.toFixed(2)}
          </strong>
        </div>
        {game.marketSaturation < 0.95 && (
          <div className="price-row">
            <span>Fleet glut</span>
            <strong style={{ color: 'var(--gold)' }}>{fmt(game.marketSaturation * 100)}% of spot</strong>
          </div>
        )}
      </div>

    </div>
  );
}
