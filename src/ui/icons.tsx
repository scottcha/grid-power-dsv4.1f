import type { JSX } from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

const base = (size: number, color: string | undefined) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color ?? 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function CoinIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4v9.2M14.8 9.2c-.6-.9-1.7-1.3-2.8-1.3-1.7 0-3 .9-3 2.2 0 2.6 5.9 1.3 5.9 4 0 1.4-1.4 2.3-3 2.3-1.3 0-2.5-.5-3-1.4" />
    </svg>
  );
}

export function BoltIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M13.2 2.5 5.6 13.4h5l-1 8.1 8-11.5h-5.1l.7-7.5Z" />
    </svg>
  );
}

export function ChipIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3" />
    </svg>
  );
}

export function FlaskIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M9 3h6M10 3v5.2L5.6 17a2 2 0 0 0 1.8 3h9.2a2 2 0 0 0 1.8-3L14 8.2V3" />
      <path d="M7.5 14h9" />
    </svg>
  );
}

export function ShieldIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M12 2.8 4.8 5.6v6c0 4.3 3 7.7 7.2 9.6 4.2-1.9 7.2-5.3 7.2-9.6v-6L12 2.8Z" />
      <path d="M8.4 12.1h7.2M12 8.5v7.2" />
    </svg>
  );
}

export function TreeIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M12 3v18M12 6h5M12 10h7M12 14h4M12 6H8M12 10H6" />
      <circle cx="5" cy="10" r="1.4" />
      <circle cx="5" cy="6" r="1.4" />
    </svg>
  );
}

export function LayersIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </svg>
  );
}

export function LogIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M5 4h14v16H5z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </svg>
  );
}

export function MenuIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function SoundIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 5 0 0 1 0 12" />
    </svg>
  );
}

export function MuteIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

export function CloseIcon({ size = 16, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function LockIcon({ size = 11, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

export function BatteryIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <rect x="3" y="8" width="16" height="9" rx="2" />
      <path d="M21 11v3M6.5 11v3M10 11v3" />
    </svg>
  );
}

export function SolarIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M4 14h16l-2-6H6l-2 6ZM7 18h10M8.5 14v4M12 14v4M15.5 14v4" />
      <circle cx="12" cy="4" r="2" />
    </svg>
  );
}

export function WindIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M12 12V21M12 12 5 7M12 12l7-3" />
      <circle cx="12" cy="12" r="1.8" />
    </svg>
  );
}

export function GasIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M6 21V8l5-4v17M11 21h7V11a3 3 0 0 0-3-3h-4" />
      <path d="M8 10h2M8 13h2M8 16h2M14 21v-4h2v4" />
    </svg>
  );
}

export function HydroIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M4 6h16M4 6v8a8 8 0 0 0 16 0V6" />
      <path d="M10 10v6M14 10v6" />
    </svg>
  );
}

export function AtomIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <circle cx="12" cy="12" r="1.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </svg>
  );
}

export function GeoIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M12 21c4 0 7-2.5 7-6 0-4.5-7-12-7-12S5 10.5 5 15c0 3.5 3 6 7 6Z" />
      <path d="M9.5 15.5c0-2 2.5-5 2.5-5s2.5 3 2.5 5a2.5 2.5 0 0 1-5 0Z" />
    </svg>
  );
}

export function GridIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M4 20V8l6-3 6 3v12M4 20h16M9 20v-5h5v5" />
      <path d="M7 11h1M12 11h1M16 6V3" />
    </svg>
  );
}

export function ServerIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <rect x="4" y="3.5" width="16" height="6" rx="1.5" />
      <rect x="4" y="14.5" width="16" height="6" rx="1.5" />
      <path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6" />
    </svg>
  );
}

export function PylonIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M12 3v15M6 21l6-18 6 18M7 13h10M9 8h6M8 18h8" />
    </svg>
  );
}

export function LabIcon({ size = 18, color }: IconProps): JSX.Element {
  return (
    <svg {...base(size, color)}>
      <path d="M5 21V10l7-6 7 6v11" />
      <path d="M9 21v-5h6v5M12 4v4" />
      <circle cx="12" cy="10" r="0.8" />
    </svg>
  );
}
