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
}

export default function CymaticsVisualizer({
  elements,
  nodes,
  onNodeChange,
  selectedElementId,
  onSelectElement,
  autoRotate,
}: CymaticsVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Camera angles (radians)
  const pitchRef = useRef<number>(-0.4); // tilt
  const yawRef = useRef<number>(0.6);    // spin
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
    // theta goes from -PI to PI (poloidal flow loop)
    // phi goes from 0 to 2PI (toroidal sector)
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
        // Simple cymatic wave modulation:
        // We use harmonic ratio for toroidal lobes and frequency for polar ripples
        const wave = Math.cos(el.harmonicRatio * phi + el.phase) * Math.sin(el.frequency * 0.02 * theta);
        
        if (el.type === 'minor') {
          // Minor elements are complex waves (multiplicative interaction between parents)
          // Wave folder modulation style:
          const parentFreqDiff = Math.abs(el.baseFrequency - (el.frequency));
          const waveComplex = Math.sin(el.harmonicRatio * phi * 1.5) * Math.cos((el.frequency * 0.03) * theta + Math.sin(parentFreqDiff * 0.05 * theta));
          modulation += el.amplitude * waveComplex * (1 + el.modulationDepth * 0.8);
        } else {
          modulation += el.amplitude * wave * 0.6;
        }
        totalAmp += el.amplitude;
      }
    }

    // Stabilize bounds
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
        yawRef.current += 0.003;
      }

      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const localYaw = yaw;

      // Update HUD elements directly in DOM to avoid React re-renders
      const coordsEl = document.getElementById('hud-coordinates');
      if (coordsEl) {
        coordsEl.textContent = `YAW: ${yaw.toFixed(2)} rad | PITCH: ${pitch.toFixed(2)} rad`;
      }

      const { width, height } = dimensions;
      ctx.clearRect(0, 0, width, height);

      // Dark background with radial gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height) / 2);
      bgGrad.addColorStop(0, '#07090e');
      bgGrad.addColorStop(1, '#020305');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'screen';

      const sphereRadius = 220; // The bounding sphere radius

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

      // Find selected node and angle
      const selectedNodeObj = nodes.find(n => n.id === selectedElementId);
      const phiSelected = selectedNodeObj ? selectedNodeObj.angle : 0;
      const selectedElement = elements.find(e => e.id === selectedElementId);
      const highlightRGB = ELEMENT_RGBS[selectedElementId] || [255, 255, 255];

      // 4. Draw Torus Shape Wireframe with major radius 0 (Horn Torus)
      // Skewed towards the active selected element. Only selected element is highlighted.
      // Poloidal lines (wrapping through center)
      for (let w = 0; w < 16; w++) {
        const phi = (w * Math.PI * 2) / 16;
        const cosDiff = Math.cos(phi - phiSelected);
        
        // Asymmetric scale factor
        const s_phi = 1.0 + 0.5 * cosDiff;
        const scaleFactor = (sphereRadius / 2) * (s_phi / 1.5);

        // Highlight line if on the active selected element side
        let strokeStyle = 'rgba(255, 255, 255, 0.15)';
        let lineWidth = 0.8;
        if (cosDiff > 0.3) {
          const blend = cosDiff; // max is 1.0
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

      // Toroidal lines (circles running parallel to equator)
      for (let t = 1; t < 7; t++) {
        const theta = -Math.PI / 2 + (t * Math.PI) / 8;
        ctx.beginPath();
        let first = true;
        for (let phi = 0; phi <= Math.PI * 2 + 0.05; phi += 0.05) {
          const cosDiff = Math.cos(phi - phiSelected);
          const s_phi = 1.0 + 0.5 * cosDiff;
          const scaleFactor = (sphereRadius / 2) * (s_phi / 1.5);
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // 5. Draw 8 Nodes in Equatorial Plane
      const updatedScreenCoords = new Map<ElementType, { x: number; y: number; radius: number }>();
      
      nodes.forEach((node) => {
        const el = elements.find(e => e.id === node.id);
        if (!el) return;

        // Sequence nodes exactly touching the sphere boundary
        const radiusDist = sphereRadius;
        const nx = radiusDist * Math.cos(node.angle);
        const ny = radiusDist * Math.sin(node.angle);
        const nz = 0;

        const pt = project3D(nx, ny, nz, width, height, pitch, localYaw);
        
        const isSelected = selectedElementId === node.id;
        const baseSize = isSelected ? 10 : 6;
        const nodeRadius = baseSize * pt.scale;

        // Save projected screen coordinates for click detection
        updatedScreenCoords.set(node.id, { x: pt.x, y: pt.y, radius: nodeRadius });

        // Connection radial line from center to node
        ctx.beginPath();
        ctx.strokeStyle = isSelected 
          ? el.color 
          : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = isSelected ? 1.5 : 0.8;
        const centerPt = project3D(0, 0, 0, width, height, pitch, localYaw);
        ctx.moveTo(centerPt.x, centerPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        if (isSelected) {
          // Glow layer for selected element
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
        ctx.fillStyle = isSelected ? el.color : '#556172';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Node label
        if (isSelected) {
          ctx.font = 'bold 12px ui-monospace, monospace';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            `${el.name.toUpperCase()} (${Math.round(el.frequency)}Hz)`, 
            pt.x, 
            pt.y - nodeRadius - 5
          );
        } else {
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(el.name, pt.x, pt.y - nodeRadius - 4);
        }
      });

      nodeScreenCoordsRef.current = updatedScreenCoords;

      // 6. Update and Draw Torus Particles
      // Particle flow curve out to active node and back, with color intensifying
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
          // Recycle
          Object.assign(p, generateRandomParticle());
          p.age = 0;
        }

        // Calculate positions on Horn Torus
        const cosDiff = Math.cos(p.phi - phiSelected);
        const s_phi = 1.0 + 0.5 * cosDiff;
        const scaleFactor = (sphereRadius / 2) * (s_phi / 1.5);

        const r_minor = scaleFactor * (1 + Math.cos(p.theta));
        const px = r_minor * Math.cos(p.phi);
        const py = r_minor * Math.sin(p.phi);
        const pz = scaleFactor * Math.sin(p.theta);

        // Project
        const pt = project3D(px, py, pz, width, height, pitch, localYaw);

        // Compute normalized factor: 0 at center (p.theta = -PI or PI), 1 at outer equator (p.theta = 0)
        const t_norm = 1.0 - Math.abs(p.theta) / Math.PI;

        let r = 255, g = 255, b = 255;
        let alpha = p.alpha;
        let size = p.size * pt.scale;

        if (cosDiff > 0) {
          // Particles on active element side: color intensifies to element highlight color
          const blend = t_norm * cosDiff;
          r = Math.round(255 + (highlightRGB[0] - 255) * blend);
          g = Math.round(255 + (highlightRGB[1] - 255) * blend);
          b = Math.round(255 + (highlightRGB[2] - 255) * blend);
          alpha = (0.2 + 0.6 * blend) * pt.scale;
          size = p.size * pt.scale * (1.0 + 1.2 * blend);
        } else {
          // Particles on opposite side: less intensity, stays white, never touches sphere
          alpha = 0.12 * pt.scale;
          size = p.size * pt.scale * 0.55;
        }

        // Fade out slightly near lifespan limits
        if (p.age < 15) alpha *= p.age / 15;
        else if (p.age > p.lifeSpan - 15) alpha *= (p.lifeSpan - p.age) / 15;

        // Render point
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.4, size), 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw active element glow in center
      if (selectedElement) {
        const centerPt = project3D(0, 0, 0, width, height, pitch, localYaw);
        const centerGlow = ctx.createRadialGradient(centerPt.x, centerPt.y, 2, centerPt.x, centerPt.y, 20);
        
        centerGlow.addColorStop(0, selectedElement.color);
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = centerGlow;
        ctx.beginPath();
        ctx.arc(centerPt.x, centerPt.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, elements, nodes, selectedElementId, autoRotate, isDraggingCamera, draggedNodeId]);

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
      if (dist <= coord.radius + 15) { // generous hit boundary
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
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggedNodeId) {
      // Dragging node radially/angularly!
      // Translate 2D mouse pos back to equatorial plane vector relative to center
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      
      // Calculate delta from center in screen space
      const dx = mouseX - centerX;
      const dy = mouseY - centerY;
      
      // Compute raw radial drag using projection adjustments
      // We want to approximate the distance on the 3D plane
      const rawDistance = Math.hypot(dx, dy);
      const sphereRadius = 220;

      // Adjust ratio of distance from center based on projection bounds
      // Raw distance in pixels relative to center / ~220px sphere bound
      let targetRatio = rawDistance / 220;
      targetRatio = Math.max(0.15, Math.min(1.2, targetRatio));

      // Map ratio to:
      // - Node distance (amplitude): 0.2 to 1.1
      const newDistance = Math.max(0.2, Math.min(1.0, targetRatio));
      
      // Compute angular position based on screen angle, modified by camera yaw/pitch
      // To keep tuning simple and satisfying:
      // - Radial distance scales AMPLITUDE
      // - Dragging further/closer updates frequency offsets
      const targetNode = nodes.find(n => n.id === draggedNodeId);
      if (targetNode) {
        // Amplitude is tied to node distance
        // Outer edge = 100% amplitude. Center = 20% amplitude.
        const amplitude = (newDistance - 0.2) / 0.8;
        
        // Update frequency: we can allow frequency tuning by dragging.
        // Let's offset the frequency within a reasonable range (e.g. ±150Hz from base)
        const el = elements.find(e => e.id === draggedNodeId);
        if (el) {
          // Adjust frequency offset: drag distance modifies frequency multiplier slightly
          const freqOffset = (newDistance - 0.6) * 200; // up to +/- 100Hz
          const tunedFreq = Math.max(el.baseFrequency * 0.4, Math.min(el.baseFrequency * 2.2, el.baseFrequency + freqOffset));

          onNodeChange(draggedNodeId, {
            distance: newDistance,
            amplitude: Math.max(0, Math.min(1, amplitude)),
            frequency: Math.round(tunedFreq)
          });
        }
      }
    } else if (isDraggingCamera) {
      // Rotate camera
      const dx = mouseX - dragStartRef.current.x;
      const dy = mouseY - dragStartRef.current.y;

      // Sensitivity
      const sensitivity = 0.007;
      yawRef.current = dragStartRef.current.yaw - dx * sensitivity;
      pitchRef.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, dragStartRef.current.pitch + dy * sensitivity));
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
      if (dist <= coord.radius + 20) { // slightly larger hit bound for touch
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

      let targetRatio = rawDistance / 220;
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
      yawRef.current = dragStartRef.current.yaw - dx * sensitivity;
      pitchRef.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, dragStartRef.current.pitch + dy * sensitivity));
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      {/* Visual background ambient details */}
      <div className="absolute top-4 left-4 font-mono text-[10px] text-slate-500 pointer-events-none select-none flex flex-col gap-1">
        <div>COSMIC COORDINATES ACTIVE</div>
        <div id="hud-coordinates">YAW: {yawRef.current.toFixed(2)} rad | PITCH: {pitchRef.current.toFixed(2)} rad</div>
        <div>STANDING WAVE HARMONICS ACTIVE</div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-none text-right font-mono text-[10px] text-slate-500">
        <div>HORN TORUS: R=0</div>
        <div>PARTICLES: {particlesRef.current.length}</div>
        <div>FPS: 60 (LOCKED)</div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center pointer-events-none select-none">
        <p className="text-[11px] font-mono text-slate-400 bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-800/40 shadow-xl">
          🖱️ Drag background to Rotate Camera | 🔮 Drag colored nodes to Tune Resonance
        </p>
      </div>

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
