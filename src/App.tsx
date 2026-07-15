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
  RefreshCw,
  Compass,
  Layers,
  Eye,
  Boxes,
  Network,
  Sun,
  Orbit
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

  // New camera perspectives and matrix modes states
  const [viewAngle, setViewAngle] = useState<'perspective' | 'side' | 'top' | null>('perspective');
  const [visualMode, setVisualMode] = useState<'light' | 'void' | 'special' | null>(null);
  const [activeField, setActiveField] = useState<'four' | 'eight' | null>(null);

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
    setVisualMode(null); // Reset special visual modes to allow focused element visual rendering!
    setActiveField(null); // Clear multi-element fields
    
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

  const handleClearViewAnglePreset = () => {
    setViewAngle(null);
  };

  const handleActivateFourElements = () => {
    setVisualMode(null);
    setActiveField('four');
    setSelectedElementId('fire');

    setElements((prev) =>
      prev.map((el) => {
        if (el.type === 'major') {
          return { ...el, amplitude: 0.6 };
        } else {
          return { ...el, amplitude: 0.0 };
        }
      })
    );

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        const el = INITIAL_ELEMENTS.find(e => e.id === n.id);
        if (el && el.type === 'major') {
          return { ...n, distance: 0.65, isActive: true };
        } else {
          return { ...n, distance: 0.2, isActive: false };
        }
      })
    );
  };

  const handleActivateEightElements = () => {
    setVisualMode(null);
    setActiveField('eight');
    setSelectedElementId('fire');

    setElements((prev) =>
      prev.map((el) => {
        return { ...el, amplitude: 0.5 };
      })
    );

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        return { ...n, distance: 0.6, isActive: true };
      })
    );
  };

  const handleSelectLightMode = () => {
    setVisualMode('light');
    setActiveField(null);
    setSelectedElementId('life'); // Life as central golden focus

    // High golden soundscape: Air + Life + Ice active
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === 'air' || el.id === 'life' || el.id === 'ice') {
          return { ...el, amplitude: 0.65 };
        } else {
          return { ...el, amplitude: 0.0 };
        }
      })
    );

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === 'air' || n.id === 'life' || n.id === 'ice') {
          return { ...n, distance: 0.72, isActive: true };
        } else {
          return { ...n, distance: 0.2, isActive: false };
        }
      })
    );
  };

  const handleSelectVoidMode = () => {
    setVisualMode('void');
    setActiveField(null);
    setSelectedElementId('earth');

    // Deep void soundscape: Earth + Water + Seismic active
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === 'earth' || el.id === 'water' || el.id === 'seismic') {
          return { ...el, amplitude: 0.75 };
        } else {
          return { ...el, amplitude: 0.0 };
        }
      })
    );

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === 'earth' || n.id === 'water' || n.id === 'seismic') {
          return { ...n, distance: 0.35, isActive: true };
        } else {
          return { ...n, distance: 0.2, isActive: false };
        }
      })
    );
  };

  const handleSelectSpecialMode = () => {
    setVisualMode('special');
    setActiveField(null);
    setSelectedElementId('lightning');

    // Electric spiral: Fire + Lightning + Air active
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === 'fire' || el.id === 'lightning' || el.id === 'air') {
          return { ...el, amplitude: 0.7 };
        } else {
          return { ...el, amplitude: 0.0 };
        }
      })
    );

    setNodes((prevNodes) =>
      prevNodes.map((n) => {
        if (n.id === 'fire' || n.id === 'lightning' || n.id === 'air') {
          return { ...n, distance: 0.8, isActive: true };
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
    <div className="flex flex-col md:flex-row w-screen h-screen min-h-screen bg-[#030509] text-slate-100 font-sans overflow-hidden select-none">
      
      {/* 1. Left Sidebar panel: Header + Selector + HUD controls */}
      <aside className="w-full md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-slate-900 bg-slate-950/40 backdrop-blur-md p-4 sm:p-5 md:p-6 flex flex-col justify-between gap-4 md:gap-5 overflow-y-auto z-10 shadow-2xl">
        
        {/* Top block: title and buttons */}
        <div className="flex flex-col gap-4">
          
          {/* Header Title section */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 border border-slate-800 text-indigo-400 rounded-xl shadow-lg shadow-indigo-500/5">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-mono font-bold tracking-widest text-slate-200 uppercase leading-none">
                Cymatic 3D Simulator
              </h1>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium mt-1">
                Harmonic Horn Torus Field Matrix
              </p>
            </div>
          </div>

          {/* Combined Resonance Elements and Controls tray divided into elegant categories */}
          <div className="flex flex-col gap-3.5 mt-2">
            
            {/* 1. RESONANCE ELEMENTS SECTOR */}
            <div>
              <div className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1.5">
                Resonance Elements
              </div>
              <div className="grid grid-cols-4 md:grid-cols-1 gap-1.5 md:gap-2">
                {elements.map((el) => {
                  const cfg = ELEMENT_BUTTON_CONFIG[el.id];
                  const IconComp = cfg?.icon || Sparkles;
                  const isSelected = selectedElementId === el.id && visualMode === null && activeField === null;

                  return (
                    <button
                      key={el.id}
                      onClick={() => handleSelectElementAndActivate(el.id)}
                      className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                        isSelected
                          ? `bg-gradient-to-br ${cfg.color} ${cfg.borderGlow} scale-[1.02] md:scale-[1.03] z-10 shadow-lg shadow-indigo-950/40`
                          : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                      }`}
                    >
                      <IconComp size={13} className={`${isSelected ? 'animate-bounce text-white' : 'opacity-70 text-slate-400'}`} />
                      <div className="flex flex-col leading-tight items-center md:items-start">
                        <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">{cfg?.label || el.name}</span>
                        <span className={`hidden md:inline text-[8px] font-mono font-normal mt-0.5 ${isSelected ? 'text-white/85' : 'text-slate-500'}`}>
                          {Math.round(el.frequency)} Hz
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CAMERA VIEW PERSPECTIVES */}
            <div>
              <div className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1.5">
                View Angles
              </div>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-1.5 md:gap-2">
                
                {/* Perspective Angle View */}
                <button
                  onClick={() => setViewAngle('perspective')}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    viewAngle === 'perspective'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Compass size={13} className={viewAngle === 'perspective' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Reset</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Perspective
                    </span>
                  </div>
                </button>

                {/* Side Angle View */}
                <button
                  onClick={() => setViewAngle('side')}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    viewAngle === 'side'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Layers size={13} className={viewAngle === 'side' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Side</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Profile View
                    </span>
                  </div>
                </button>

                {/* Top Angle View */}
                <button
                  onClick={() => setViewAngle('top')}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    viewAngle === 'top'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Eye size={13} className={viewAngle === 'top' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Top</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Down View
                    </span>
                  </div>
                </button>

              </div>
            </div>

            {/* 3. HARMONIC GRID MATRIX MODES */}
            <div>
              <div className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1.5">
                Harmonic Fields
              </div>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5 md:gap-2">
                
                {/* 4 Elements */}
                <button
                  onClick={handleActivateFourElements}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    activeField === 'four'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Boxes size={13} className={activeField === 'four' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">4 Elements</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Major Active
                    </span>
                  </div>
                </button>

                {/* 8 Elements */}
                <button
                  onClick={handleActivateEightElements}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    activeField === 'eight'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Network size={13} className={activeField === 'eight' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">8 Elements</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Full Resonance
                    </span>
                  </div>
                </button>

                {/* Light (highlight outer layer in golden) */}
                <button
                  onClick={handleSelectLightMode}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    visualMode === 'light'
                      ? 'bg-gradient-to-br from-amber-600 to-yellow-500 border-amber-400 text-white shadow-lg shadow-amber-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Sun size={13} className={visualMode === 'light' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Light</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Golden Torus
                    </span>
                  </div>
                </button>

                {/* Void (highlight center with small violet torus connect to all elements) */}
                <button
                  onClick={handleSelectVoidMode}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    visualMode === 'void'
                      ? 'bg-gradient-to-br from-purple-600 to-fuchsia-500 border-purple-400 text-white shadow-lg shadow-purple-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Orbit size={13} className={visualMode === 'void' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Void</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Violet Singularity
                    </span>
                  </div>
                </button>

                {/* Special (radius = 0 double-spiral vortex) */}
                <button
                  onClick={handleSelectSpecialMode}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    visualMode === 'special'
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-500 border-violet-400 text-white shadow-lg shadow-violet-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <Activity size={13} className={visualMode === 'special' ? 'text-white' : 'opacity-70 text-slate-400'} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Special</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Spiral Vortex
                    </span>
                  </div>
                </button>

              </div>
            </div>

            {/* 4. UTILITIES AND AUDIO SYSTEM CONTROLS */}
            <div>
              <div className="text-[9px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-1.5">
                System Controls
              </div>
              <div className="grid grid-cols-3 md:grid-cols-1 gap-1.5 md:gap-2">
                
                {/* Sound Control Button */}
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    audioEnabled
                      ? 'bg-gradient-to-br from-emerald-600/30 to-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  {audioEnabled ? <Volume2 size={13} className="text-emerald-400" /> : <VolumeX size={13} className="opacity-70 text-slate-400" />}
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Sound</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      {audioEnabled ? 'Active' : 'Muted'}
                    </span>
                  </div>
                </button>

                {/* Auto Spin Control Button */}
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer ${
                    autoRotate
                      ? 'bg-gradient-to-br from-indigo-600/30 to-indigo-950/40 border-indigo-500/50 text-indigo-300 shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80'
                  }`}
                >
                  <RotateCw size={13} className={`${autoRotate ? 'animate-spin text-indigo-400' : 'opacity-70 text-slate-400'}`} style={{ animationDuration: '6s' }} />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Auto-Spin</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      {autoRotate ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </button>

                {/* Reset Matrix Button */}
                <button
                  onClick={handleResetResonance}
                  className="relative flex items-center justify-center md:justify-start gap-2 px-2 md:px-3 py-1.5 md:py-2.5 rounded-xl border font-mono text-[10px] md:text-[11px] font-bold capitalize transition-all duration-300 w-full text-center md:text-left cursor-pointer bg-slate-900/40 border-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-800 hover:bg-slate-900/80"
                >
                  <RefreshCw size={12} className="opacity-70 text-slate-400" />
                  <div className="flex flex-col leading-tight items-center md:items-start">
                    <span className="text-[10px] md:text-[11px] font-semibold tracking-wide">Re-Align</span>
                    <span className="hidden md:inline text-[8px] font-mono font-normal mt-0.5 opacity-80">
                      Restore Fire
                    </span>
                  </div>
                </button>

              </div>
            </div>

            {/* Volume Control Slider */}
            {audioEnabled && (
              <div className="flex items-center justify-between gap-3 bg-slate-950/60 border border-slate-900 px-3 py-2 rounded-xl shadow-md">
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">Volume:</span>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={audioVolume}
                  onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            )}

          </div>

        </div>

      </aside>

      {/* 2. Main content: Completely full screen right-side panel with visualizer */}
      <main className="flex-1 h-full min-h-[300px] relative overflow-hidden bg-[#030509]">
        <CymaticsVisualizer
          elements={elements}
          nodes={nodes}
          onNodeChange={handleNodeChange}
          selectedElementId={selectedElementId}
          onSelectElement={handleSelectElementAndActivate}
          autoRotate={autoRotate}
          viewAngle={viewAngle}
          onClearViewAnglePreset={handleClearViewAnglePreset}
          visualMode={visualMode}
          activeField={activeField}
        />
      </main>

    </div>
  );
}
