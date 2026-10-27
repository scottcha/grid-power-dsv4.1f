type SoundName =
  | 'click'
  | 'select'
  | 'build'
  | 'claim'
  | 'research'
  | 'survey'
  | 'endTurn'
  | 'coin'
  | 'error'
  | 'start'
  | 'victory'
  | 'defeat';

const MUTE_KEY = 'gridpower.muted';

class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceNodes: {
    osc: OscillatorNode;
    lfo: OscillatorNode;
    pad: OscillatorNode;
    gain: GainNode;
    padGain: GainNode;
  } | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Storage unavailable: mute still applies for the session.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + dur);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  private noise(dur: number, gain: number, freq = 900, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(this.master);
    src.start(now);
  }

  play(name: SoundName): void {
    this.init();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'click':
        this.tone(620, 0.06, 'sine', 0.08, -80);
        break;
      case 'select':
        this.tone(880, 0.07, 'triangle', 0.05, -140);
        break;
      case 'build':
        this.noise(0.18, 0.16, 420);
        this.tone(160, 0.22, 'sawtooth', 0.09, -50);
        this.tone(520, 0.25, 'sine', 0.06, 120, 0.05);
        break;
      case 'claim':
        this.tone(430, 0.12, 'triangle', 0.07, 90);
        this.tone(645, 0.16, 'sine', 0.05, 40, 0.04);
        break;
      case 'research':
        this.tone(720, 0.18, 'sine', 0.06, 240);
        this.tone(1080, 0.24, 'sine', 0.04, 120, 0.06);
        break;
      case 'survey':
        this.tone(320, 0.3, 'sine', 0.05, 520);
        this.noise(0.2, 0.05, 2400);
        break;
      case 'endTurn':
        this.tone(240, 0.4, 'sine', 0.08, 60);
        this.tone(360, 0.5, 'triangle', 0.05, 90, 0.05);
        this.noise(0.25, 0.04, 600, 0.1);
        break;
      case 'coin':
        this.tone(1320, 0.09, 'sine', 0.05, 120);
        this.tone(1760, 0.16, 'sine', 0.04, 80, 0.05);
        break;
      case 'error':
        this.tone(150, 0.22, 'square', 0.05, -40);
        break;
      case 'start':
        this.tone(220, 0.5, 'triangle', 0.07, 220);
        this.tone(330, 0.6, 'sine', 0.05, 180, 0.08);
        this.tone(660, 0.8, 'sine', 0.035, 120, 0.18);
        break;
      case 'victory':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.07, 0, i * 0.12));
        break;
      case 'defeat':
        [330, 294, 247, 196].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.07, 0, i * 0.14));
        break;
      default:
        break;
    }
  }

  startAmbience(): void {
    this.init();
    if (!this.ctx || !this.master || this.ambienceNodes) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.012;
    gain.gain.value = 0.028;
    lfo.connect(lfoGain).connect(gain.gain);
    osc.connect(gain).connect(this.master);
    osc.start();
    lfo.start();
    const pad = this.ctx.createOscillator();
    const padGain = this.ctx.createGain();
    pad.type = 'triangle';
    pad.frequency.value = 110;
    padGain.gain.value = 0.008;
    pad.connect(padGain).connect(this.master);
    pad.start();
    this.ambienceNodes = { osc, lfo, pad, gain, padGain };
  }

  stopAmbience(): void {
    if (!this.ambienceNodes) return;
    const { osc, lfo, pad, gain, padGain } = this.ambienceNodes;
    try {
      osc.stop();
      lfo.stop();
      pad.stop();
      gain.disconnect();
      padGain.disconnect();
    } catch {
      // Already stopped.
    }
    this.ambienceNodes = null;
  }
}

export const sound = new SoundBoard();
