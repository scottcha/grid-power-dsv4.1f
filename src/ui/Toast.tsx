import type { JSX } from 'react';
import { useGame } from './store';

export function Toast(): JSX.Element | null {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return (
    <div className={`toast ${toast.tone}`} key={toast.id}>
      {toast.text}
    </div>
  );
}
