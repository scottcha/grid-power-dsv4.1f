import type { JSX } from 'react';

export function PlayIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.2v13.6L19 12 8 5.2Z" />
    </svg>
  );
}
