export type ElementType =
  | 'fire'
  | 'air'
  | 'water'
  | 'earth'
  | 'lightning'
  | 'ice'
  | 'life'
  | 'seismic';

export interface ElementConfig {
  id: ElementType;
  name: string;
  type: 'major' | 'minor';
  color: string;
  glowColor: string;
  parents?: [ElementType, ElementType]; // for minor elements
  baseFrequency: number;     // base reference frequency in Hz
  frequency: number;         // current tuned frequency (e.g. 100Hz - 800Hz)
  amplitude: number;         // current tuned amplitude (0 to 1)
  harmonicRatio: number;     // multiplier for cymatic waves (e.g. 1 to 12)
  phase: number;             // wave phase offset
  modulationDepth: number;   // for minor elements (interaction level)
  description: string;
  icon: string;
}

export interface CymaticNode {
  id: ElementType;
  angle: number;             // angle on the equatorial plane (radians)
  distance: number;          // distance from center (0.2 to 1.0)
  isActive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  theta: number;             // poloidal angle around the 0-radius torus tube
  phi: number;               // toroidal angle around the center
  speed: number;
  color: string;
  size: number;
  alpha: number;
  age: number;
  lifeSpan: number;
}
