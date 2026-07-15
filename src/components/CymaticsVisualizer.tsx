import React, { useRef, useEffect, useState } from 'react';
import { ElementConfig, CymaticNode, Particle, ElementType } from '../types';

const ELEMENT_RGBS: Record<ElementType, [number, number, number]> = {
  fire: [249, 115, 22],       // #f97316
  lightning: [217, 70, 239],  // #d946ef
  air: [203, 213, 225],        // #cbd5e1
  ice: [34, 211, 238],         // #22d3ee
  water: [59, 130, 246],       // #3b82f6
  life: [167, 243, 208],       // #a7f3d0
  earth: [16, 185, 129],       // #10b981
  seismic: [245, 158, 11]      // #f59e0b
};

interface CymaticsVisualizerProps {
  elements: ElementConfig[];
  nodes: CymaticNode[];
  onNodeChange: (id: ElementType, updates: Partial<CymaticNode> & { amplitude?: number; frequency?: number }) => void;
  selectedElementId: ElementType;
  onSelectElement: (id: ElementType) => void;
  autoRotate: boolean;
  viewAngle: 'perspective' | 'side' | 'top' | null;
  onClearViewAnglePreset: () => void;
  visualMode: 'light' | 'void' | 'special' | null;
  activeField: 'four' | 'eight' | null;
}

export default function CymaticsVisualizer({
  elements,
  nodes,
  onNodeChange,
  selectedElementId,
  onSelectElement,
  autoRotate,
  viewAngle,
  onClearViewAnglePreset,
  visualMode,
  activeField,
}: CymaticsVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Camera current angles (radians)
  // Default: side-ish profile view slightly above the equatorial line (pitch: -0.15, yaw: Math.PI / 2)
  const pitchRef = useRef<number>(-0.15); // tilt
  const yawRef = useRef<number>(Math.PI / 2);    // spin

  // Camera target angles for smooth transition
  const targetPitchRef = useRef<number>(-0.15);
  const targetYawRef = useRef<number>(Math.PI / 2);

  const [isDraggingCamera, setIsDraggingCamera] = useState<boolean>(false);
  const [draggedNodeId, setDraggedNodeId] = useState<ElementType | null>(null);

  // Keep track of interaction states for smooth rendering
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number }>({ x: 0, y: 0, yaw: 0, pitch: 0 });
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nodeScreenCoordsRef = useRef<Map<ElementType, { x: number; y: number; radius: number }>>(new Map());

  // Particle list
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Handle resizing
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(300, width),
          height: Math.max(300, height),
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Sync viewAngle state to target angles
  useEffect(() => {
    if (viewAngle === 'perspective') {
      targetPitchRef.current = -0.15;
      targetYawRef.current = Math.PI / 2;
    } else if (viewAngle === 'side') {
      targetPitchRef.current = 0.0;
      targetYawRef.current = Math.PI / 2;
    } else if (viewAngle === 'top') {
      targetPitchRef.current = -Math.PI / 2;
      targetYawRef.current = 0.0;
    }
  }, [viewAngle]);

  // Initialize Particles
  useEffect(() => {
    const particles: Particle[] = [];
    const count = 1000;

    for (let i = 0; i < count; i++) {
      particles.push(generateRandomParticle());
    }
    particlesRef.current = particles;
  }, []);

  // Generate a particle representing Horn Torus flow
  const generateRandomParticle = (): Particle => {
    const theta = Math.random() * Math.PI * 2 - Math.PI;
    const phi = Math.random() * Math.PI * 2;
    const lifeSpan = 100 + Math.random() * 100;

    return {
      x: 0,
      y: 0,
      z: 0,
      theta,
      phi,
      speed: 0.008 + Math.random() * 0.012,
      color: 'rgb(255, 255, 255)',
      size: 1.2 + Math.random() * 1.8,
      alpha: 0.3 + Math.random() * 0.5,
      age: Math.random() * lifeSpan,
      lifeSpan,
    };
  };

  // Convert element IDs to their display configs
  const getElementColor = (id: ElementType) => {
    const el = elements.find(e => e.id === id);
    return el ? el.color : '#ffffff';
  };

  const getElementGlowColor = (id: ElementType) => {
    const el = elements.find(e => e.id === id);
    return el ? el.glowColor : 'rgba(255,255,255,0.5)';
  };

  // 3D Math operations
  const project3D = (
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    pPitch: number,
    pYaw: number
  ) => {
    // Rotate around Z axis (Yaw spin)
    const cosY = Math.cos(pYaw);
    const sinY = Math.sin(pYaw);
    const x1 = x * cosY - y * sinY;
    const y1 = x * sinY + y * cosY;

    // Rotate around X axis (Pitch tilt)
    const cosP = Math.cos(pPitch);
    const sinP = Math.sin(pPitch);
    const y2 = y1 * cosP - z * sinP;
    const z2 = y1 * sinP + z * cosP;

    // Perspective parameters
    const fov = 400;
    const distance = 420;
    const scale = fov / (distance + z2);

    const centerX = width / 2;
    const centerY = height / 2;

    return {
      x: centerX + x1 * scale,
      y: centerY + y2 * scale,
      z: z2,
      scale,
    };
  };

  // 3D Horn Torus modulation formula driven by Cymatic Frequencies
  const getCymaticModulation = (theta: number, phi: number, elementsList: ElementConfig[]) => {
    let modulation = 1.0;
    let totalAmp = 0;

    for (const el of elementsList) {
      if (el.amplitude > 0.01) {
        const wave = Math.cos(el.harmonicRatio * phi + el.phase) * Math.sin(el.frequency * 0.02 * theta);
        
        if (el.type === 'minor') {
          const parentFreqDiff = Math.abs(el.baseFrequency - (el.frequency));
          const waveComplex = Math.sin(el.harmonicRatio * phi * 1.5) * Math.cos((el.frequency * 0.03) * theta + Math.sin(parentFreqDiff * 0.05 * theta));
          modulation += el.amplitude * waveComplex * (1 + el.modulationDepth * 0.8);
        } else {
          modulation += el.amplitude * wave * 0.6;
        }
        totalAmp += el.amplitude;
      }
    }

    return Math.max(0.1, Math.min(2.5, modulation));
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // 1. Update yaw if auto-rotating and not interacting
      if (autoRotate && !isDraggingCamera && !draggedNodeId) {
        targetYawRef.current += 0.003;
      }

      // Smooth camera lerp
      const lerpFactor = 0.07;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * lerpFactor;
      
      let diffYaw = targetYawRef.current - yawRef.current;
      diffYaw = Math.atan2(Math.sin(diffYaw), Math.cos(diffYaw));
      yawRef.current += diffYaw * lerpFactor;

      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const localYaw = yaw;

      const { width, height } = dimensions;
      ctx.clearRect(0, 0, width, height);

      // Dark background with radial gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height) / 2);
      bgGrad.addColorStop(0, '#07090e');
      bgGrad.addColorStop(1, '#020305');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'screen';

      const sphereRadius = Math.max(120, Math.min(width, height) * 0.30); // The bounding sphere radius

      // 2. Draw Bounding Sphere Wireframe (Futuristic and thin)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;

      // Latitude lines
      for (let lat = -Math.PI / 2 + Math.PI / 6; lat < Math.PI / 2; lat += Math.PI / 6) {
        ctx.beginPath();
        const rLat = sphereRadius * Math.cos(lat);
        const zLat = sphereRadius * Math.sin(lat);
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          const sx = rLat * Math.cos(a);
          const sy = rLat * Math.sin(a);
          const pt = project3D(sx, sy, zLat, width, height, pitch, localYaw);
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = 0; lon < Math.PI * 2; lon += Math.PI / 6) {
        ctx.beginPath();
        for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += 0.05) {
          const sx = sphereRadius * Math.cos(lat) * Math.cos(lon);
          const sy = sphereRadius * Math.cos(lat) * Math.sin(lon);
          const sz = sphereRadius * Math.sin(lat);
          const pt = project3D(sx, sy, sz, width, height, pitch, localYaw);
          if (lat === -Math.PI / 2) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // 3. Draw Equatorial Ring
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
        const pt = project3D(sphereRadius * Math.cos(a), sphereRadius * Math.sin(a), 0, width, height, pitch, localYaw);
        if (a === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // 1. Get active element list based on activeField or selection
      const activeIds = activeField === 'four' 
        ? ['fire', 'water', 'earth', 'air'] 
        : (activeField === 'eight' ? ['fire', 'water', 'earth', 'air', 'ice', 'lightning', 'seismic', 'life'] : [selectedElementId]);

      const getClosestActiveElement = (angle: number) => {
        let closestId = selectedElementId;
        let maxCos = -1.0;
        activeIds.forEach((id) => {
          const nodeObj = nodes.find(n => n.id === id);
          const nodeAngle = nodeObj ? nodeObj.angle : 0;
          const cosVal = Math.cos(angle - nodeAngle);
          if (cosVal > maxCos) {
            maxCos = cosVal;
            closestId = id as ElementType;
          }
        });
        return { id: closestId, cosVal: maxCos };
      };

      // Find selected node and angle
      const selectedNodeObj = nodes.find(n => n.id === selectedElementId);
      const phiSelected = selectedNodeObj ? selectedNodeObj.angle : 0;
      const selectedElement = elements.find(e => e.id === selectedElementId);
      const highlightRGB = ELEMENT_RGBS[selectedElementId] || [255, 255, 255];

      const isVoid = visualMode === 'void';
      const isLight = visualMode === 'light';
      const isSpecial = visualMode === 'special';
      const torusScale = isVoid ? 0.28 : (isLight ? 0.72 : 0.5);

      // 4. Draw Torus Shape Wireframe
      if (isSpecial) {
        // Special Mode: Double spiral vortex to the poles (radius R = 0, collapsing)
        const spiralArms = 6;
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.42)'; // Violet color
        ctx.lineWidth = 1.5;

        for (let s = 0; s < spiralArms; s++) {
          const phiOffset = (s * Math.PI * 2) / spiralArms;

          // North pole spiral
          ctx.beginPath();
          let first = true;
          for (let t = 0; t <= 1.02; t += 0.02) {
            const pz = sphereRadius * t;
            const r_env = sphereRadius * 0.45 * Math.sin(t * Math.PI);
            const phi = phiOffset + t * Math.PI * 4.0;
            const px = r_env * Math.cos(phi);
            const py = r_env * Math.sin(phi);

            const pt = project3D(px, py, pz, width, height, pitch, localYaw);
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
          ctx.stroke();

          // South pole spiral
          ctx.beginPath();
          first = true;
          for (let t = 0; t <= 1.02; t += 0.02) {
            const pz = -sphereRadius * t;
            const r_env = sphereRadius * 0.45 * Math.sin(t * Math.PI);
            const phi = phiOffset - t * Math.PI * 4.0;
            const px = r_env * Math.cos(phi);
            const py = r_env * Math.sin(phi);

            const pt = project3D(px, py, pz, width, height, pitch, localYaw);
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
          ctx.stroke();
        }
      } else {
        // Poloidal lines
        for (let w = 0; w < 16; w++) {
          const phi = (w * Math.PI * 2) / 16;
          const { id: closestId, cosVal: cosDiff } = getClosestActiveElement(phi);
          const currentHighlightRGB = ELEMENT_RGBS[closestId] || [255, 255, 255];
          
          // Asymmetric scale factor if normal, symmetric if void/light
          const s_phi = (isVoid || isLight) ? 1.0 : (1.0 + 0.5 * cosDiff);
          const scaleFactor = (sphereRadius * torusScale) * (s_phi / (isVoid || isLight ? 1.0 : 1.5));

          let strokeStyle = 'rgba(255, 255, 255, 0.15)';
          let lineWidth = 0.8;
          if (isVoid) {
            strokeStyle = 'rgba(168, 85, 247, 0.48)'; // Violet
            lineWidth = 1.4;
          } else if (isLight) {
            strokeStyle = 'rgba(245, 158, 11, 0.52)'; // Golden Gold
            lineWidth = 1.7;
          } else if (activeField) {
            const blend = cosDiff;
            const r = Math.round(150 + (currentHighlightRGB[0] - 150) * blend);
            const g = Math.round(150 + (currentHighlightRGB[1] - 150) * blend);
            const b = Math.round(150 + (currentHighlightRGB[2] - 150) * blend);
            strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + 0.55 * blend})`;
            lineWidth = 1.8;
          } else if (cosDiff > 0.3) {
            const blend = cosDiff;
            const r = Math.round(255 + (highlightRGB[0] - 255) * blend);
            const g = Math.round(255 + (highlightRGB[1] - 255) * blend);
            const b = Math.round(255 + (highlightRGB[2] - 255) * blend);
            strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.25 + 0.45 * blend})`;
            lineWidth = 1.8;
          }

          ctx.beginPath();
          let first = true;
          for (let theta = -Math.PI; theta <= Math.PI + 0.05; theta += 0.08) {
            const r_minor = scaleFactor * (1 + Math.cos(theta));
            const tx = r_minor * Math.cos(phi);
            const ty = r_minor * Math.sin(phi);
            const tz = scaleFactor * Math.sin(theta);

            const pt = project3D(tx, ty, tz, width, height, pitch, localYaw);
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }

        // Toroidal lines
        for (let t = 1; t < 7; t++) {
          const theta = -Math.PI / 2 + (t * Math.PI) / 8;
          let lastPt: { x: number; y: number } | null = null;
          
          for (let phi = 0; phi <= Math.PI * 2 + 0.05; phi += 0.05) {
            const { id: closestId, cosVal: cosDiff } = getClosestActiveElement(phi);
            const currentHighlightRGB = ELEMENT_RGBS[closestId] || [255, 255, 255];
            
            const s_phi = (isVoid || isLight) ? 1.0 : (1.0 + 0.5 * cosDiff);
            const scaleFactor = (sphereRadius * torusScale) * (s_phi / (isVoid || isLight ? 1.0 : 1.5));
            const r_minor = scaleFactor * (1 + Math.cos(theta));
            const tx = r_minor * Math.cos(phi);
            const ty = r_minor * Math.sin(phi);
            const tz = scaleFactor * Math.sin(theta);

            const pt = project3D(tx, ty, tz, width, height, pitch, localYaw);
            
            let strokeStyle = 'rgba(255, 255, 255, 0.12)';
            let lineWidth = 1.0;
            
            if (isVoid) {
              strokeStyle = 'rgba(168, 85, 247, 0.22)';
            } else if (isLight) {
              strokeStyle = 'rgba(245, 158, 11, 0.24)';
            } else if (activeField) {
              const blend = cosDiff;
              const r = Math.round(150 + (currentHighlightRGB[0] - 150) * blend);
              const g = Math.round(150 + (currentHighlightRGB[1] - 150) * blend);
              const b = Math.round(150 + (currentHighlightRGB[2] - 150) * blend);
              strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.1 + 0.25 * blend})`;
              lineWidth = 1.2;
            } else {
              const singleCos = Math.cos(phi - phiSelected);
              if (singleCos > 0) {
                const blend = singleCos;
                const r = Math.round(255 + (highlightRGB[0] - 255) * blend);
                const g = Math.round(255 + (highlightRGB[1] - 255) * blend);
                const b = Math.round(255 + (highlightRGB[2] - 255) * blend);
                strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.12 + 0.15 * blend})`;
                lineWidth = 1.2;
              }
            }

            if (lastPt) {
              ctx.beginPath();
              ctx.moveTo(lastPt.x, lastPt.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.strokeStyle = strokeStyle;
              ctx.lineWidth = lineWidth;
              ctx.stroke();
            }
            
            lastPt = pt;
          }
        }
      }

      // Draw connections from central torus to all 8 outer nodes in Void Mode
      if (isVoid) {
        nodes.forEach((node) => {
          const ptNode = project3D(sphereRadius * Math.cos(node.angle), sphereRadius * Math.sin(node.angle), 0, width, height, pitch, localYaw);
          const ptCenterTorus = project3D(sphereRadius * 0.28 * Math.cos(node.angle), sphereRadius * 0.28 * Math.sin(node.angle), 0, width, height, pitch, localYaw);
          
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.32)';
          ctx.lineWidth = 1.0;
          ctx.moveTo(ptCenterTorus.x, ptCenterTorus.y);
          ctx.lineTo(ptNode.x, ptNode.y);
          ctx.stroke();
        });
      }

      // 5. Draw 8 Nodes in Equatorial Plane
      const updatedScreenCoords = new Map<ElementType, { x: number; y: number; radius: number }>();
      
      nodes.forEach((node) => {
        const el = elements.find(e => e.id === node.id);
        if (!el) return;

        const radiusDist = sphereRadius;
        const nx = radiusDist * Math.cos(node.angle);
        const ny = radiusDist * Math.sin(node.angle);
        const nz = 0;

        const pt = project3D(nx, ny, nz, width, height, pitch, localYaw);
        
        // Data-driven active node detection
        const isElementActive = el.amplitude > 0.1 && node.isActive;
        const baseSize = isElementActive ? 10 : 6;
        const nodeRadius = baseSize * pt.scale;

        updatedScreenCoords.set(node.id, { x: pt.x, y: pt.y, radius: nodeRadius });

        // Connection radial line from center to node (skip in void mode since drawn above, unless active)
        if (!isVoid || isElementActive) {
          ctx.beginPath();
          ctx.strokeStyle = isElementActive 
            ? el.color 
            : 'rgba(255, 255, 255, 0.06)';
          ctx.lineWidth = isElementActive ? 1.5 : 0.8;
          const centerPt = project3D(0, 0, 0, width, height, pitch, localYaw);
          ctx.moveTo(centerPt.x, centerPt.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        }

        if (isElementActive) {
          // Glow layer for active elements
          const nodeGlow = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, nodeRadius * 3);
          nodeGlow.addColorStop(0, el.color);
          nodeGlow.addColorStop(0.3, el.glowColor.replace(/[\d.]+\)$/, '0.35)'));
          nodeGlow.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.fillStyle = nodeGlow;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, nodeRadius * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node Core Solid Circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, nodeRadius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = isElementActive ? el.color : '#556172';
        ctx.fill();
        ctx.strokeStyle = isElementActive ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = isElementActive ? 2 : 1;
        ctx.stroke();
      });

      nodeScreenCoordsRef.current = updatedScreenCoords;

      // 6. Update and Draw Torus Particles
      const particles = particlesRef.current;
      const count = particles.length;

      for (let i = 0; i < count; i++) {
        const p = particles[i];

        // Particle speed along poloidal loop
        p.theta += p.speed;

        // Wrap poloidal flow around
        if (p.theta > Math.PI) {
          p.theta = -Math.PI;
          p.phi = Math.random() * Math.PI * 2;
          p.age = 0;
        }

        p.age++;
        if (p.age > p.lifeSpan) {
          Object.assign(p, generateRandomParticle());
          p.age = 0;
        }

        let px = 0, py = 0, pz = 0;
        let r = 255, g = 255, b = 255;
        let alpha = p.alpha;
        let size = p.size;

        if (isSpecial) {
          // Special Mode: spiral vortex from center to poles
          const t = Math.abs(p.theta) / Math.PI; // 0 to 1
          const isNorth = p.theta > 0;
          pz = sphereRadius * t * (isNorth ? 1 : -1);
          
          const r_env = sphereRadius * 0.45 * Math.sin(t * Math.PI);
          const winding = t * Math.PI * 4.0 * (isNorth ? 1 : -1);
          const phi = p.phi + winding;
          px = r_env * Math.cos(phi);
          py = r_env * Math.sin(phi);

          // Violet to white-indigo spiral color
          const blend = t;
          r = Math.round(139 + (217 - 139) * blend);
          g = Math.round(92 + (70 - 92) * blend);
          b = Math.round(246 + (239 - 246) * blend);
        } else {
          // Toroidal coordinates - use active fields closest element
          const { id: closestId, cosVal: cosDiff } = getClosestActiveElement(p.phi);
          const currentHighlightRGB = ELEMENT_RGBS[closestId] || [255, 255, 255];

          const s_phi = (isVoid || isLight) ? 1.0 : (1.0 + 0.5 * cosDiff);
          const scaleFactor = (sphereRadius * torusScale) * (s_phi / (isVoid || isLight ? 1.0 : 1.5));

          const r_minor = scaleFactor * (1 + Math.cos(p.theta));
          px = r_minor * Math.cos(p.phi);
          py = r_minor * Math.sin(p.phi);
          pz = scaleFactor * Math.sin(p.theta);

          const t_norm = 1.0 - Math.abs(p.theta) / Math.PI;

          if (isVoid) {
            // Intense violet void particles
            r = Math.round(147 + (168 - 147) * t_norm);
            g = Math.round(51 + (85 - 51) * t_norm);
            b = Math.round(234 + (247 - 234) * t_norm);
            alpha = (0.24 + 0.52 * t_norm);
            size = p.size * (0.8 + 0.5 * t_norm);
          } else if (isLight) {
            // Bright gold light particles
            r = Math.round(251 + (245 - 251) * t_norm);
            g = Math.round(191 + (158 - 191) * t_norm);
            b = Math.round(36 + (11 - 36) * t_norm);
            alpha = (0.28 + 0.56 * t_norm);
            size = p.size * (1.1 + 0.9 * t_norm);
          } else if (activeField) {
            // Symmetrical multi-element active fields particles
            const blend = t_norm * cosDiff;
            r = Math.round(255 + (currentHighlightRGB[0] - 255) * blend);
            g = Math.round(255 + (currentHighlightRGB[1] - 255) * blend);
            b = Math.round(255 + (currentHighlightRGB[2] - 255) * blend);
            alpha = (0.22 + 0.65 * blend);
            size = p.size * (1.1 + 1.4 * blend);
          } else if (cosDiff > 0) {
            const blend = t_norm * cosDiff;
            r = Math.round(255 + (highlightRGB[0] - 255) * blend);
            g = Math.round(255 + (highlightRGB[1] - 255) * blend);
            b = Math.round(255 + (highlightRGB[2] - 255) * blend);
            alpha = (0.2 + 0.6 * blend);
            size = p.size * (1.0 + 1.2 * blend);
          } else {
            alpha = 0.12;
            size = p.size * 0.55;
          }
        }

        // Project
        const pt = project3D(px, py, pz, width, height, pitch, localYaw);
        let finalSize = size * pt.scale;
        let finalAlpha = alpha * pt.scale;

        if (p.age < 15) finalAlpha *= p.age / 15;
        else if (p.age > p.lifeSpan - 15) finalAlpha *= (p.lifeSpan - p.age) / 15;

        // Render point
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.4, finalSize), 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw center core glow
      const centerPt = project3D(0, 0, 0, width, height, pitch, localYaw);
      const centerGlow = ctx.createRadialGradient(centerPt.x, centerPt.y, 2, centerPt.x, centerPt.y, isVoid ? 12 : (isLight ? 25 : 20));
      
      if (isVoid) {
        centerGlow.addColorStop(0, '#c084fc');
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (isLight) {
        centerGlow.addColorStop(0, '#fbbf24');
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      } else if (selectedElement) {
        centerGlow.addColorStop(0, selectedElement.color);
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        centerGlow.addColorStop(0, '#ffffff');
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      }
      
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, isVoid ? 12 : (isLight ? 25 : 20), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, elements, nodes, selectedElementId, autoRotate, isDraggingCamera, draggedNodeId, visualMode]);

  // Handle Mouse/Touch Interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    mousePosRef.current = { x: mouseX, y: mouseY };

    // 1. Check if we clicked on any Node on the equatorial disc
    let clickedNodeId: ElementType | null = null;
    nodeScreenCoordsRef.current.forEach((coord, id) => {
      const dist = Math.hypot(coord.x - mouseX, coord.y - mouseY);
      if (dist <= coord.radius + 15) {
        clickedNodeId = id;
      }
    });

    if (clickedNodeId) {
      setDraggedNodeId(clickedNodeId);
      onSelectElement(clickedNodeId);
    } else {
      // 2. Otherwise, dragging camera
      setIsDraggingCamera(true);
      dragStartRef.current = {
        x: mouseX,
        y: mouseY,
        yaw: yawRef.current,
        pitch: pitchRef.current,
      };
      onClearViewAnglePreset();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggedNodeId) {
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      
      const rawDistance = Math.hypot(dx, dy);
      const sphereRadius = Math.max(120, Math.min(dimensions.width, dimensions.height) * 0.30);

      let targetRatio = rawDistance / sphereRadius;
      targetRatio = Math.max(0.15, Math.min(1.2, targetRatio));

      const newDistance = Math.max(0.2, Math.min(1.0, targetRatio));
      
      const targetNode = nodes.find(n => n.id === draggedNodeId);
      if (targetNode) {
        const amplitude = (newDistance - 0.2) / 0.8;
        const el = elements.find(e => e.id === draggedNodeId);
        if (el) {
          const freqOffset = (newDistance - 0.6) * 200;
          const tunedFreq = Math.max(el.baseFrequency * 0.4, Math.min(el.baseFrequency * 2.2, el.baseFrequency + freqOffset));

          onNodeChange(draggedNodeId, {
            distance: newDistance,
            amplitude: Math.max(0, Math.min(1, amplitude)),
            frequency: Math.round(tunedFreq)
          });
        }
      }
    } else if (isDraggingCamera) {
      const dx = mouseX - dragStartRef.current.x;
      const dy = mouseY - dragStartRef.current.y;

      const sensitivity = 0.007;
      const nextYaw = dragStartRef.current.yaw - dx * sensitivity;
      const nextPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, dragStartRef.current.pitch + dy * sensitivity));
      
      yawRef.current = nextYaw;
      targetYawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      targetPitchRef.current = nextPitch;
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCamera(false);
    setDraggedNodeId(null);
  };

  // Touch triggers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    mousePosRef.current = { x: mouseX, y: mouseY };

    let clickedNodeId: ElementType | null = null;
    nodeScreenCoordsRef.current.forEach((coord, id) => {
      const dist = Math.hypot(coord.x - mouseX, coord.y - mouseY);
      if (dist <= coord.radius + 20) {
        clickedNodeId = id;
      }
    });

    if (clickedNodeId) {
      setDraggedNodeId(clickedNodeId);
      onSelectElement(clickedNodeId);
    } else {
      setIsDraggingCamera(true);
      dragStartRef.current = {
        x: mouseX,
        y: mouseY,
        yaw: yawRef.current,
        pitch: pitchRef.current,
      };
      onClearViewAnglePreset();
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    if (draggedNodeId) {
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      const rawDistance = Math.hypot(dx, dy);
      const sphereRadius = Math.max(120, Math.min(dimensions.width, dimensions.height) * 0.30);

      let targetRatio = rawDistance / sphereRadius;
      targetRatio = Math.max(0.15, Math.min(1.2, targetRatio));
      const newDistance = Math.max(0.2, Math.min(1.0, targetRatio));
      const targetNode = nodes.find(n => n.id === draggedNodeId);

      if (targetNode) {
        const amplitude = (newDistance - 0.2) / 0.8;
        const el = elements.find(e => e.id === draggedNodeId);
        if (el) {
          const freqOffset = (newDistance - 0.6) * 200;
          const tunedFreq = Math.max(el.baseFrequency * 0.4, Math.min(el.baseFrequency * 2.2, el.baseFrequency + freqOffset));

          onNodeChange(draggedNodeId, {
            distance: newDistance,
            amplitude: Math.max(0, Math.min(1, amplitude)),
            frequency: Math.round(tunedFreq)
          });
        }
      }
    } else if (isDraggingCamera) {
      const dx = mouseX - dragStartRef.current.x;
      const dy = mouseY - dragStartRef.current.y;
      const sensitivity = 0.009;
      const nextYaw = dragStartRef.current.yaw - dx * sensitivity;
      const nextPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, dragStartRef.current.pitch + dy * sensitivity));

      yawRef.current = nextYaw;
      targetYawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      targetPitchRef.current = nextPitch;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      <canvas
        id="cymatic-3d-canvas"
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        className="block transition-all duration-100 outline-none"
      />
    </div>
  );
}
