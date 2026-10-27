import type { JSX } from 'react';
import type { StructureType } from '../engine/types';
import {
  AtomIcon,
  BatteryIcon,
  GasIcon,
  GeoIcon,
  GridIcon,
  HydroIcon,
  LabIcon,
  PylonIcon,
  ServerIcon,
  SolarIcon,
  WindIcon,
} from './icons';

export const STRUCTURE_ICONS: Record<StructureType, (size?: number) => JSX.Element> = {
  solar: (size = 18) => <SolarIcon size={size} color="#ffd479" />,
  wind: (size = 18) => <WindIcon size={size} color="#9fe8ff" />,
  gas: (size = 18) => <GasIcon size={size} color="#ffb08c" />,
  hydro: (size = 18) => <HydroIcon size={size} color="#6cc7ff" />,
  geothermal: (size = 18) => <GeoIcon size={size} color="#ffa27a" />,
  nuclear: (size = 18) => <AtomIcon size={size} color="#b6ffcf" />,
  battery: (size = 18) => <BatteryIcon size={size} color="#c3a6ff" />,
  line: (size = 18) => <PylonIcon size={size} color="#a8bcc8" />,
  substation: (size = 18) => <GridIcon size={size} color="#a8bcc8" />,
  edge_dc: (size = 18) => <ServerIcon size={size} color="#7dfccb" />,
  hyper_dc: (size = 18) => <ServerIcon size={size} color="#4dd6c1" />,
  giga_dc: (size = 18) => <ServerIcon size={size} color="#b18cff" />,
  lab: (size = 18) => <LabIcon size={size} color="#9fd8ff" />,
};

export const BUILD_GROUPS: Array<{ label: string; types: StructureType[] }> = [
  { label: 'Generation', types: ['solar', 'wind', 'gas', 'hydro', 'geothermal', 'nuclear'] },
  { label: 'Grid', types: ['line', 'substation'] },
  { label: 'Compute', types: ['edge_dc', 'hyper_dc', 'giga_dc'] },
  { label: 'Storage', types: ['battery'] },
  { label: 'Research', types: ['lab'] },
];
