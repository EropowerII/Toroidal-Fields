import { ElementType, ElementConfig } from '../types';

export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: Map<ElementType, {
    osc: OscillatorNode | null;
    noise?: AudioWorkletNode | ScriptProcessorNode | null;
    gain: GainNode;
    modulator?: OscillatorNode | null;
    modGain?: GainNode | null;
  }> = new Map();
  private isEnabled: boolean = false;

  constructor() {
    // Lazy initialization on user interaction
  }

  private init() {
    if (this.ctx) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.08, this.ctx.currentTime); // keep overall volume low and pleasant
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser:", e);
    }
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (enabled) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } else {
      this.stopAll();
    }
  }

  public setMasterVolume(volume: number) {
    this.init();
    if (this.masterGain && this.ctx) {
      // Clamp volume between 0 and 1
      const v = Math.max(0, Math.min(1, volume)) * 0.15; // scalar for safety
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    }
  }

  public updateElementSound(config: ElementConfig, active: boolean) {
    if (!this.isEnabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    // Check if we have an active voice
    let voice = this.oscillators.get(config.id);

    if (!active) {
      // Fade out if active
      if (voice) {
        voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      }
      return;
    }

    // Initialize voice if it doesn't exist
    if (!voice) {
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      gainNode.connect(this.masterGain);

      voice = {
        osc: null,
        gain: gainNode,
      };
      this.oscillators.set(config.id, voice);
    }

    // Set volume level based on amplitude
    const targetVolume = config.amplitude * (config.type === 'major' ? 0.6 : 0.4);
    voice.gain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.1);

    // Build or update oscillator configuration based on element properties
    this.reconfigureVoice(config, voice);
  }

  private reconfigureVoice(config: ElementConfig, voice: any) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Dispose old osc if any
    const cleanupOscs = () => {
      if (voice.osc) {
        try { voice.osc.stop(); voice.osc.disconnect(); } catch (e) {}
        voice.osc = null;
      }
      if (voice.modulator) {
        try { voice.modulator.stop(); voice.modulator.disconnect(); } catch (e) {}
        voice.modulator = null;
      }
      if (voice.modGain) {
        try { voice.modGain.disconnect(); } catch (e) {}
        voice.modGain = null;
      }
      if (voice.noise) {
        try { voice.noise.disconnect(); } catch (e) {}
        voice.noise = null;
      }
    };

    const freq = config.frequency;

    // We build different synthesis structures for each element
    switch (config.id) {
      case 'fire': {
        // High frequency, slightly crackling with wave distortion
        if (!voice.osc) {
          cleanupOscs();
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(voice.gain);
          osc.start();
          voice.osc = osc;

          // Add a subtle high-frequency crackle LFO
          const lfo = this.ctx.createOscillator();
          const lfoGain = this.ctx.createGain();
          lfo.type = 'square';
          lfo.frequency.setValueAtTime(12, now); // crackle rate
          lfoGain.gain.setValueAtTime(freq * 0.15, now); // frequency crackle depth
          
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          lfo.start();
          voice.modulator = lfo;
          voice.modGain = lfoGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq, now, 0.1);
          if (voice.modGain) {
            voice.modGain.gain.setTargetAtTime(freq * 0.15, now, 0.1);
          }
        }
        break;
      }

      case 'air': {
        // Soft sine with tremolo (amplitude modulation) representing wind
        if (!voice.osc) {
          cleanupOscs();
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          
          // Tremolo
          const tremolo = this.ctx.createOscillator();
          const tremoloGain = this.ctx.createGain();
          tremolo.type = 'sine';
          tremolo.frequency.setValueAtTime(4 + Math.random() * 2, now); // 4-6Hz gusting
          tremoloGain.gain.setValueAtTime(0.3, now); // 30% tremolo depth
          
          tremolo.connect(tremoloGain);
          // Connect to the main voice gain node's gain parameter
          tremoloGain.connect(voice.gain.gain);
          
          osc.connect(voice.gain);
          osc.start();
          tremolo.start();

          voice.osc = osc;
          voice.modulator = tremolo;
          voice.modGain = tremoloGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq, now, 0.15);
        }
        break;
      }

      case 'water': {
        // Smooth sine with a slow chorus-like pitch sweep (LFO)
        if (!voice.osc) {
          cleanupOscs();
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          const lfo = this.ctx.createOscillator();
          const lfoGain = this.ctx.createGain();
          lfo.type = 'sine';
          lfo.frequency.setValueAtTime(0.8, now); // slow fluid cycle
          lfoGain.gain.setValueAtTime(10, now); // 10Hz swing

          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          
          osc.connect(voice.gain);
          osc.start();
          lfo.start();

          voice.osc = osc;
          voice.modulator = lfo;
          voice.modGain = lfoGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq, now, 0.2);
        }
        break;
      }

      case 'earth': {
        // Deep square sub-bass with a low-pass resonance feel
        if (!voice.osc) {
          cleanupOscs();
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle'; // triangle is warmer for sub-bass
          osc.frequency.setValueAtTime(freq * 0.5, now); // 1 octave down for gravity
          
          // Add subtle harmonics via an overlapping weak square wave
          const sub = this.ctx.createOscillator();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(freq * 1.5, now); // perfect fifth harmonic
          
          const subGain = this.ctx.createGain();
          subGain.gain.setValueAtTime(0.2, now);
          sub.connect(subGain);
          subGain.connect(voice.gain);

          osc.connect(voice.gain);
          osc.start();
          sub.start();

          voice.osc = osc;
          voice.modulator = sub;
          voice.modGain = subGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq * 0.5, now, 0.1);
          if (voice.modulator) {
            voice.modulator.frequency.setTargetAtTime(freq * 1.5, now, 0.1);
          }
        }
        break;
      }

      // MINOR ELEMENTS: Complex FM / RM Interactions
      case 'lightning': {
        // FM Synthesis: Fire (sawtooth modulation) into Air (sine carrier)
        // High tension, electrifying crackle
        if (!voice.osc) {
          cleanupOscs();
          const carrier = this.ctx.createOscillator();
          carrier.type = 'sine';
          carrier.frequency.setValueAtTime(freq, now);

          const modulator = this.ctx.createOscillator();
          modulator.type = 'sawtooth';
          // Modulator frequency is set to the Fire parent frequency, or 2x carrier
          modulator.frequency.setValueAtTime(freq * 1.414, now); // metallic inharmonic ratio

          const modGain = this.ctx.createGain();
          // Modulation depth is controlled by config.modulationDepth
          const depth = config.modulationDepth * freq * 3;
          modGain.gain.setValueAtTime(depth, now);

          modulator.connect(modGain);
          modGain.connect(carrier.frequency);

          carrier.connect(voice.gain);
          carrier.start();
          modulator.start();

          voice.osc = carrier;
          voice.modulator = modulator;
          voice.modGain = modGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq, now, 0.1);
          voice.modulator.frequency.setTargetAtTime(freq * 1.414, now, 0.1);
          const depth = config.modulationDepth * freq * 3;
          voice.modGain.gain.setTargetAtTime(depth, now, 0.1);
        }
        break;
      }

      case 'ice': {
        // Ring Modulation: Air (sine) multiplied by Water (sine)
        // Cold, crystalline, bell-like ring
        if (!voice.osc) {
          cleanupOscs();
          const carrier = this.ctx.createOscillator();
          carrier.type = 'sine';
          carrier.frequency.setValueAtTime(freq, now);

          const modulator = this.ctx.createOscillator();
          modulator.type = 'sine';
          modulator.frequency.setValueAtTime(freq * 1.5, now); // perfect fifth for clean ring

          const ringGain = this.ctx.createGain();
          ringGain.gain.setValueAtTime(config.modulationDepth * 0.5, now);

          // In standard Web Audio, we can multiply signals using a GainNode where the gain parameter is connected to the modulator
          const multiplier = this.ctx.createGain();
          multiplier.gain.setValueAtTime(0, now); // start at 0

          carrier.connect(multiplier);
          modulator.connect(ringGain);
          ringGain.connect(multiplier.gain); // modulator controls gain of carrier!
          
          multiplier.connect(voice.gain);
          
          carrier.start();
          modulator.start();

          voice.osc = carrier;
          voice.modulator = modulator;
          voice.modGain = ringGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq, now, 0.1);
          voice.modulator.frequency.setTargetAtTime(freq * 1.5, now, 0.1);
          voice.modGain.gain.setTargetAtTime(config.modulationDepth * 0.5, now, 0.1);
        }
        break;
      }

      case 'life': {
        // Golden ratio chord (Frequencies in φ = 1.618 ratio)
        // Rich, vibrant, breathing feel
        if (!voice.osc) {
          cleanupOscs();
          const base = this.ctx.createOscillator();
          base.type = 'triangle';
          base.frequency.setValueAtTime(freq, now);

          const harmonic = this.ctx.createOscillator();
          harmonic.type = 'sine';
          harmonic.frequency.setValueAtTime(freq * 1.618, now); // Golden Ratio!

          const harmGain = this.ctx.createGain();
          harmGain.gain.setValueAtTime(config.modulationDepth * 0.4, now);
          harmonic.connect(harmGain);
          harmGain.connect(voice.gain);

          // Add a slow swell to make it "breathe"
          const swell = this.ctx.createOscillator();
          const swellGain = this.ctx.createGain();
          swell.type = 'sine';
          swell.frequency.setValueAtTime(0.25, now); // 4-second breath cycle
          swellGain.gain.setValueAtTime(0.2, now); // 20% volume swell

          swell.connect(swellGain);
          swellGain.connect(voice.gain.gain); // modulate overall voice gain

          base.connect(voice.gain);
          base.start();
          harmonic.start();
          swell.start();

          voice.osc = base;
          voice.modulator = harmonic;
          voice.modGain = harmGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq, now, 0.1);
          if (voice.modulator) {
            voice.modulator.frequency.setTargetAtTime(freq * 1.618, now, 0.1);
          }
          if (voice.modGain) {
            voice.modGain.gain.setTargetAtTime(config.modulationDepth * 0.4, now, 0.1);
          }
        }
        break;
      }

      case 'seismic': {
        // Sub-bass square wave with heavy low frequency rate modulation
        // Tectonic rumbles and pulses
        if (!voice.osc) {
          cleanupOscs();
          const carrier = this.ctx.createOscillator();
          carrier.type = 'sawtooth';
          carrier.frequency.setValueAtTime(freq * 0.5, now); // deep

          // Low frequency tremolo rate that speeds up with modulation depth
          const pulser = this.ctx.createOscillator();
          pulser.type = 'sine';
          pulser.frequency.setValueAtTime(1 + config.modulationDepth * 8, now); // 1Hz - 9Hz pulse rate

          const pulseGain = this.ctx.createGain();
          pulseGain.gain.setValueAtTime(freq * 0.2, now); // deep frequency rumble

          pulser.connect(pulseGain);
          pulseGain.connect(carrier.frequency);

          // Also low-pass filter to make it dark and rumbly
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(200 + config.modulationDepth * 300, now);
          filter.Q.setValueAtTime(4, now);

          carrier.connect(filter);
          filter.connect(voice.gain);

          carrier.start();
          pulser.start();

          voice.osc = carrier;
          voice.modulator = pulser;
          voice.modGain = pulseGain;
        } else {
          voice.osc.frequency.setTargetAtTime(freq * 0.5, now, 0.1);
          voice.modulator.frequency.setTargetAtTime(1 + config.modulationDepth * 8, now, 0.1);
          voice.modGain.gain.setTargetAtTime(freq * 0.2, now, 0.1);
        }
        break;
      }
    }
  }

  private stopAll() {
    this.oscillators.forEach((voice) => {
      try {
        voice.gain.gain.setValueAtTime(0, this.ctx ? this.ctx.currentTime : 0);
      } catch (e) {}
    });
  }

  public stopVoice(id: ElementType) {
    const voice = this.oscillators.get(id);
    if (voice && this.ctx) {
      voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }
}
