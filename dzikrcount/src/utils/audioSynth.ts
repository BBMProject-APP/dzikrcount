// Web Audio API engine for ambient synthesis and sacred play support
class AudioSynthEngine {
  private ctx: AudioContext | null = null;
  
  // Ambient nodes
  private rainNode: AudioNode | null = null;
  private rainGain: GainNode | null = null;
  
  private streamNode: AudioNode | null = null;
  private streamGain: GainNode | null = null;
  
  private droneNodes: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;

  // Track state
  private isInitialized = false;

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  public resume() {
    this.initContext();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Generate pink-like noise for rain
  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("No context");
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; // estimate volume compensation
      b6 = white * 0.115926;
    }
    return noiseBuffer;
  }

  public setRainVolume(volume: number) {
    this.resume();
    if (!this.ctx) return;

    if (!this.rainGain) {
      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.rainGain.connect(this.ctx.destination);
    }

    this.rainGain.gain.linearRampToValueAtTime(volume * 0.15, this.ctx.currentTime + 0.2);

    if (volume > 0 && !this.rainNode) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.createNoiseBuffer();
        source.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

        source.connect(filter);
        filter.connect(this.rainGain);
        source.start();
        this.rainNode = source;
      } catch (e) {
        console.error("Rain synthesis error", e);
      }
    }
  }

  public setStreamVolume(volume: number) {
    this.resume();
    if (!this.ctx) return;

    if (!this.streamGain) {
      this.streamGain = this.ctx.createGain();
      this.streamGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.streamGain.connect(this.ctx.destination);
    }

    this.streamGain.gain.linearRampToValueAtTime(volume * 0.2, this.ctx.currentTime + 0.2);

    if (volume > 0 && !this.streamNode) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.createNoiseBuffer();
        source.loop = true;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.setValueAtTime(400, this.ctx.currentTime);
        bandpass.Q.setValueAtTime(2.0, this.ctx.currentTime);

        // Low frequency modulator to represent stream bubbling
        const lfo = this.ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.setValueAtTime(1.5, this.ctx.currentTime);

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(150, this.ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(bandpass.frequency);
        lfo.start();

        source.connect(bandpass);
        bandpass.connect(this.streamGain);
        source.start();
        this.streamNode = source;
      } catch (e) {
        console.error("Stream synthesis error", e);
      }
    }
  }

  public setDroneVolume(volume: number) {
    this.resume();
    if (!this.ctx) return;

    if (!this.droneGain) {
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.droneGain.connect(this.ctx.destination);
    }

    this.droneGain.gain.linearRampToValueAtTime(volume * 0.08, this.ctx.currentTime + 0.3);

    if (volume > 0 && this.droneNodes.length === 0) {
      try {
        // Build a warm Sufi vocal drone chord (Root, Fifth, Octave)
        const freqs = [110.0, 165.0, 220.0]; // A2, E3, A3 warm harmonics
        freqs.forEach((f) => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          osc.type = "triangle"; // soft warm tone
          osc.frequency.setValueAtTime(f, this.ctx.currentTime);

          // Subtle frequency detune
          osc.detune.setValueAtTime((Math.random() * 10) - 5, this.ctx.currentTime);

          const lowpass = this.ctx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.setValueAtTime(320, this.ctx.currentTime);

          osc.connect(lowpass);
          if (this.droneGain) {
            lowpass.connect(this.droneGain);
          }
          osc.start();
          this.droneNodes.push(osc);
        });
      } catch (e) {
        console.error("Drone synthesis error", e);
      }
    }
  }

  // Synthesizes a calming wooden block / bead tap sound
  public playBeadClick(freqMultiplier = 1.0) {
    this.resume();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(550 * freqMultiplier, this.ctx.currentTime);
      // Exponential frequency decay to mimic impact
      osc.frequency.exponentialRampToValueAtTime(100 * freqMultiplier, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {
      console.error("Click click sound error", e);
    }
  }

  // Dual-tone crisp notification chime
  public playNotificationChime() {
    this.resume();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5 note
      osc1.frequency.setValueAtTime(1046.50, now + 0.1); // C6 note (arpeggio chime)

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, now + 0.1); // E6 note

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.1);

      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.error("Notification chime sound error", e);
    }
  }

  // Tibetan Bell completion sound
  public playCompletionBell() {
    this.resume();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const oscHarmonic = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(680, this.ctx.currentTime);

      oscHarmonic.type = "sine";
      oscHarmonic.frequency.setValueAtTime(1360, this.ctx.currentTime); // Perfect octave

      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.0);

      osc.connect(gain);
      oscHarmonic.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      oscHarmonic.start();
      osc.stop(this.ctx.currentTime + 2.1);
      oscHarmonic.stop(this.ctx.currentTime + 2.1);
    } catch (e) {
      console.error("Bell sound error", e);
    }
  }

  public stopAll() {
    // Shutdown all sounds and sources
    try {
      if (this.rainNode) {
        (this.rainNode as any).stop();
        this.rainNode = null;
      }
      if (this.streamNode) {
        (this.streamNode as any).stop();
        this.streamNode = null;
      }
      this.droneNodes.forEach(node => node.stop());
      this.droneNodes = [];

      if (this.rainGain) this.rainGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.streamGain) this.streamGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.droneGain) this.droneGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    } catch (e) {
      console.error("Stop all sound synthesis error", e);
    }
  }
}

export const audioSynth = new AudioSynthEngine();
