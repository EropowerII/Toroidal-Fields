import React, { useState, useEffect, useRef } from 'react';
import { ElementConfig, ElementType, CymaticNode } from './types';
import CymaticsVisualizer from './components/CymaticsVisualizer';
import { AudioSynthesizer } from './utils/AudioSynthesizer';

const INITIAL_ELEMENTS: ElementConfig[] = [
  {
    id: 'fire',
    name: 'fire',
    type: 'major',
    color: '#f97316', // orange
    glowColor: 'rgba(249,115,22,0.4)',
    baseFrequency: 220,
    frequency: 220,
    amplitude: 0.65,
    harmonicRatio: 3,
    phase: 0,
    modulationDepth: 0.5,
    description: 'High-energy thermal excitation. Characterized by sharp, jagged waveforms and volatile frequency ripples.',
    icon: 'Flame',
  },
  {
    id: 'air',
    name: 'wind',
    type: 'major',
    color: '#cbd5e1', // silver/slate
    glowColor: 'rgba(203,213,225,0.4)',
    baseFrequency: 440,
    frequency: 440,
    amplitude: 0.5,
    harmonicRatio: 5,
    phase: Math.PI / 4,
    modulationDepth: 0.5,
    description: 'Highly coherent atmospheric flow. Soft, soothing, high-mid pitch sinusoidal vibrations.',
    icon: 'Wind',
  },
  {
    id: 'water',
    name: 'water',
    type: 'major',
    color: '#3b82f6', // blue
    glowColor: 'rgba(59,130,246,0.4)',
    baseFrequency: 174,
    frequency: 174,
    amplitude: 0.6,
    harmonicRatio: 4,
    phase: Math.PI / 2,
    modulationDepth: 0.5,
    description: 'Fluid molecular turbulence. Rolling waves with cascading harmonics and smooth phase-shifts.',
    icon: 'Droplet',
  },
  {
    id: 'earth',
    name: 'earth',
    type: 'major',
    color: '#10b981', // green
    glowColor: 'rgba(16,185,129,0.4)',
    baseFrequency: 110,
    frequency: 110,
    amplitude: 0.7,
    harmonicRatio: 2,
    phase: Math.PI,
    modulationDepth: 0.5,
    description: 'Deep tectonic gravitative density. Heavy, solid, low frequency square waves that act as structural grids.',
    icon: 'Globe',
  },
  // Minor Elements (Combinations of the Major Elements)
  {
    id: 'lightning',
    name: 'lightning',
    type: 'minor',
    color: '#d946ef', // magenta
    glowColor: 'rgba(217,70,239,0.4)',
    parents: ['fire', 'air'],
    baseFrequency: 330,
    frequency: 330,
    amplitude: 0.0, // start disabled/quiet
    harmonicRatio: 6,
    phase: 0,
    modulationDepth: 0.8,
    description: 'Pure electrical discharge born from the friction of Air and Fire. Generates complex FM-synthesis wave spikes.',
    icon: 'Zap',
  },
  {
    id: 'ice',
    name: 'ice',
    type: 'minor',
    color: '#22d3ee', // cyan
    glowColor: 'rgba(34,211,238,0.4)',
    parents: ['air', 'water'],
    baseFrequency: 528,
    frequency: 528,
    amplitude: 0.0, // start disabled/quiet
    harmonicRatio: 8,
    phase: Math.PI / 6,
    modulationDepth: 0.7,
    description: 'A crystalline lattice formed by chilling fluidic Water with atmospheric Air. Employs crisp wave-folded fractal rings.',
    icon: 'Snowflake',
  },
  {
    id: 'life',
    name: 'life',
    type: 'minor',
    color: '#a7f3d0', // mint
    glowColor: 'rgba(167,243,208,0.4)',
    parents: ['earth', 'water'],
    baseFrequency: 272,
    frequency: 272,
    amplitude: 0.0, // start disabled/quiet
    harmonicRatio: 7,
    phase: Math.PI / 3,
    modulationDepth: 0.9,
    description: 'Organic cellular vitality nurtured by Earth and Water. Superimposes waveforms in the golden-ratio (1.618) phi-harmonic sweep.',
    icon: 'Leaf',
  },
  {
    id: 'seismic',
    name: 'seismic',
    type: 'minor',
    color: '#f59e0b', // amber/gold
    glowColor: 'rgba(245,158,11,0.4)',
    parents: ['earth', 'fire'],
    baseFrequency: 82,
    frequency: 82,
    amplitude: 0.0, // start disabled/quiet
    harmonicRatio: 3,
    phase: Math.PI * 1.5,
    modulationDepth: 0.6,
    description: 'Tectonic rupturing. Dense thermal Fire expanding under Earth\'s heavy gravity, causing violent low-frequency pulse pressure waves.',
    icon: 'Activity',
  },
];

// 8 Nodes sequentially distributed on equatorial plane (angles in radians)
// 4 major points at 90 deg, 4 minor offset by 45 deg
const INITIAL_NODES: CymaticNode[] = [
  { id: 'fire', angle: 0, distance: 0.65, isActive: true },                          // 0° (Major)
  { id: 'lightning', angle: Math.PI / 4, distance: 0.2, isActive: false },            // 45° (Minor, Fire + Air)
  { id: 'air', angle: Math.PI / 2, distance: 0.5, isActive: true },                  // 90° (Major)
  { id: 'ice', angle: (3 * Math.PI) / 4, distance: 0.2, isActive: false },           // 135° (Minor, Air + Water)
  { id: 'water', angle: Math.PI, distance: 0.6, isActive: true },                    // 180° (Major, Opposing Fire)
  { id: 'life', angle: (5 * Math.PI) / 4, distance: 0.2, isActive: false },           // 225° (Minor, Opposing Lightning, Earth + Water)
  { id: 'earth', angle: (3 * Math.PI) / 2, distance: 0.7, isActive: true },           // 270° (Major, Opposing Wind)
  { id: 'seismic', angle: (7 * Math.PI) / 4, distance: 0.2, isActive: false },         // 315° (Minor, Opposing Ice, Earth + Fire)
];

import { 
  Sparkles, 
  Flame, 
  Zap, 
  Wind, 
  Snowflake, 
  Droplet, 
  Leaf, 
  Globe, 
  Activity, 
  Volume2, 
  VolumeX, 
  RotateCw, 
  Pause, 
  Info,
  RefreshCw
} from 'lucide-react';

const ELEMENT_BUTTON_CONFIG: Record<ElementType, { label: string; icon: React.ComponentType<any>; color: string; borderGlow: string }> = {
  fire: { label: 'Fire', icon: Flame, color: 'from-orange-600 to-red-500', borderGlow: 'shadow-orange-500/40 border-orange-500 text-white' },
  lightning: { label: 'Lightning', icon: Zap, color: 'from-fuchsia-600 to-purple-500', borderGlow: 'shadow-fuchsia-500/40 border-fuchsia-500 text-white' },
  air: { label: 'Air', icon: Wind, color: 'from-slate-500 to-slate-400', borderGlow: 'shadow-slate-400/40 border-slate-300 text-slate-100' },
  ice: { label: 'Ice', icon: Snowflake, color: 'from-cyan-600 to-sky-500', borderGlow: 'shadow-cyan-500/40 border-cyan-400 text-white' },
  water: { label: 'Water', icon: Droplet, color: 'from-blue-600 to-indigo-500', borderGlow: 'shadow-blue-500/40 border-blue-400 text-white' },
  life: { label: 'Life', icon: Leaf, color: 'from-emerald-500 to-teal-400', borderGlow: 'shadow-emerald-400/40 border-emerald-400 text-white' },
  earth: { label: 'Earth', icon: Globe, color: 'from-green-600 to-emerald-500', borderGlow: 'shadow-green-500/40 border-green-500 text-white' },
  seismic: { label: 'Seismic', icon: Activity, color: 'from-amber-600 to-orange-500', borderGlow: 'shadow-amber-500/40 border-amber-500 text-white' }
};

export default function App() {
  const [elements, setElements] = useState<ElementConfig[]>(() => {
    // Start with 'fire' as selected and active, others muted initially
    return INITIAL_ELEMENTS.map(el => {
      if (el.id === 'fire') return { ...el, amplitude: 0.85 };
      return { ...el, amplitude: 0.0 };
    });
  });
  const [nodes, setNodes] = useState<CymaticNode[]>(() => {
    return INITIAL_NODES.map(n => {
      if (n.id === 'fire') return { ...n, distance: 0.88, isActive: true };
      return { ...n, distance: 0.2, isActive: false };
    });
  });
  const [selectedElementId, setSelectedElementId] = useState<ElementType>('fire');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0.35);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const synthRef = useRef<AudioSynthesizer | null>(null);

  // Initialize Audio Synthesizer once
  useEffect(() => {
    synthRef.current = new AudioSynthesizer();
    return () => {
      if (synthRef.current) {
        synthRef.current.setEnabled(false);
      }
    };
  }, []);

  // Update Synth configuration when elements or active nodes change
  useEffect(() => {
    if (!synthRef.current) return;

    synthRef.current.setEnabled(audioEnabled);
    synthRef.current.setMasterVolume(audioVolume);

    elements.forEach((el) => {
      const activeNode = nodes.find(n => n.id === el.id);
      const isVoiceActive = activeNode ? (el.amplitude > 0.05 && activeNode.isActive) : false;
      
      synthRef.current?.updateElementSound(el, isVoiceActive);
    });
  }, [elements, nodes, audioEnabled, audioVolume]);

  // Handle updates originating from selecting elements (button click)
  const handleSelectElementAndActivate = (id: ElementType) => {
    setSelectedElementId(id);
    
    // Set selected element amplitude to 0.85, and others to 0.0 for quiet background
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id) {
          return { ...el, amplitude: 0.85 };
        } else {
          return { ...el, amplitude: 0.0 };
        }
      })
    );

    // Sync to nodes
    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === id) {
          return { ...n, distance: 0.88, isActive: true };
        } else {
          return { ...n, distance: 0.2, isActive: false };
        }
      })
    );
  };

  // Handle node edits from visualizer drag interaction
  const handleNodeChange = (
    id: ElementType,
    updates: Partial<CymaticNode> & { amplitude?: number; frequency?: number }
  ) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            ...updates,
            isActive: updates.amplitude !== undefined ? updates.amplitude > 0.05 : node.isActive,
          };
        }
        return node;
      })
    );

    setElements((prevElements) =>
      prevElements.map((el) => {
        if (el.id === id) {
          const syncUpdates: Partial<ElementConfig> = {};
          if (updates.amplitude !== undefined) syncUpdates.amplitude = updates.amplitude;
          if (updates.frequency !== undefined) syncUpdates.frequency = updates.frequency;
          return { ...el, ...syncUpdates };
        }
        return el;
      })
    );
  };

  const handleResetResonance = () => {
    handleSelectElementAndActivate('fire');
  };

  return (
    <div className="min-h-screen bg-[#030509] text-slate-100 flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans overflow-x-hidden">
      <div className="w-full max-w-7xl flex flex-col gap-4 sm:gap-6">
        
        {/* Sleek Header Controls */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 border border-slate-800 text-indigo-400 rounded-xl shadow-lg shadow-indigo-500/5">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-mono font-bold tracking-widest text-slate-200 uppercase">
                Cymatic 3D Visualizer
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Harmonic Horn Torus Field Matrix
              </p>
            </div>
          </div>

          {/* Quick HUD controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold transition-all duration-200 shadow-md ${
                audioEnabled 
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
              }`}
            >
              {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {audioEnabled ? 'SOUND: ON' : 'SOUND: MUTED'}
            </button>

            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-[11px] font-bold transition-all duration-200 shadow-md ${
                autoRotate 
                  ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/40' 
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80'
              }`}
            >
              <RotateCw size={13} className={autoRotate ? 'animate-spin' : ''} style={{ animationDuration: '6s' }} />
              {autoRotate ? 'AUTO-SPIN: ON' : 'SPIN: OFF'}
            </button>

            <button
              onClick={handleResetResonance}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 font-mono text-[11px] font-bold transition-all duration-200 shadow-md"
              title="Reset state to default Fire"
            >
              <RefreshCw size={13} />
              RESET
            </button>
          </div>
        </header>

        {/* Core Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full">
          
          {/* Left Panel: Resonance Selector (Selection Buttons) */}
          <div className="col-span-1 lg:col-span-3 flex flex-col gap-4 bg-slate-950/30 border border-slate-900 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="flex flex-col gap-1 border-b border-slate-900 pb-3">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                RESONANCE MATRIX
              </span>
              <span className="text-[9px] font-mono text-slate-500 uppercase">
                Select Resonance Node
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              {elements.map((el) => {
                const cfg = ELEMENT_BUTTON_CONFIG[el.id];
                const IconComp = cfg?.icon || Sparkles;
                const isSelected = selectedElementId === el.id;

                return (
                  <button
                    key={el.id}
                    onClick={() => handleSelectElementAndActivate(el.id)}
                    className={`relative flex items-center justify-start gap-3 px-3.5 py-3 sm:py-3.5 rounded-xl border font-mono text-xs font-bold capitalize transition-all duration-300 w-full text-left cursor-pointer ${
                      isSelected
                        ? `bg-gradient-to-r ${cfg.color} ${cfg.borderGlow} scale-[1.02] lg:scale-[1.03] z-10 shadow-lg shadow-indigo-950/40`
                        : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                    }`}
                  >
                    <IconComp size={15} className={`${isSelected ? 'animate-bounce text-white' : 'opacity-70 text-slate-400'}`} />
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] font-semibold tracking-wide">{cfg?.label || el.name}</span>
                      <span className={`text-[9px] font-mono font-normal mt-0.5 ${isSelected ? 'text-white/85' : 'text-slate-500'}`}>
                        {Math.round(el.frequency)} Hz
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Area: Hologram Sphere (Frameless/Spacious) */}
          <div className="col-span-1 lg:col-span-9 flex items-center justify-center relative w-full min-h-[500px] sm:min-h-[580px]">
            <CymaticsVisualizer
              elements={elements}
              nodes={nodes}
              onNodeChange={handleNodeChange}
              selectedElementId={selectedElementId}
              onSelectElement={handleSelectElementAndActivate}
              autoRotate={autoRotate}
            />
          </div>

        </div>

        {/* Technical Footer */}
        <footer className="border-t border-slate-900 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-slate-900/40 border border-slate-800/40 text-slate-500 rounded-lg">
              <Info size={13} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                Symmetrical Standing Wave Field Theory
              </span>
              <span className="text-[9px] text-slate-500 max-w-xl mt-0.5 leading-normal">
                Four major nodes (Fire, Air, Water, Earth) form direct orthogonal harmonic pairings. The minor nodes represent interactions generating skewed asymmetric field lines.
              </span>
            </div>
          </div>

          {/* Quick interactive audio helper */}
          {audioEnabled && (
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-850 px-3 py-1.5 rounded-xl">
              <span className="text-[9px] font-mono text-slate-400">VOL:</span>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={audioVolume}
                onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
