/**
 * 背景氛围音：Web Audio API 程序生成（无音频文件）。
 *  - 「细雨」：循环白噪声 → 低通滤波 → 缓慢增益起伏，模拟雨声
 *  - 「安静垫音」：正弦/三角波叠加成柔和和弦，各声部带缓慢 LFO 呼吸感
 * 单例管理 AudioContext；iOS Safari 要求用户手势后启动，
 * 因此 play() 必须在点击事件里调用（内部会自动 resume）。
 */

export type AmbientKind = 'rain' | 'pad';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let currentKind: AmbientKind | null = null;
let volume = 0.5;
/** 当前音景创建的节点，停止时统一清理 */
let nodes: Array<AudioNode | OscillatorNode | AudioBufferSourceNode> = [];
let sources: Array<OscillatorNode | AudioBufferSourceNode> = [];

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** 生成循环用的白噪声 Buffer */
function createNoiseBuffer(c: AudioContext): AudioBuffer {
  const seconds = 2;
  const buffer = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function buildRain(c: AudioContext) {
  const noise = c.createBufferSource();
  noise.buffer = createNoiseBuffer(c);
  noise.loop = true;

  // 低通滤波压掉刺耳高频，留下沙沙的雨声
  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 900;
  lowpass.Q.value = 0.5;

  const gain = c.createGain();
  gain.gain.value = 0.9;

  // 缓慢的增益起伏，模拟雨势变化
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.25;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);

  noise.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(master!);

  noise.start();
  lfo.start();
  sources.push(noise, lfo);
  nodes.push(lowpass, gain, lfoGain);
}

function buildPad(c: AudioContext) {
  // C 大调 add9 和弦的柔和垫音（C3/G3/E4/D4），低声部正弦、高声部三角
  const voices: Array<{ freq: number; type: OscillatorType; level: number; lfoHz: number }> = [
    { freq: 130.81, type: 'sine', level: 0.5, lfoHz: 0.05 },
    { freq: 196.0, type: 'sine', level: 0.32, lfoHz: 0.07 },
    { freq: 329.63, type: 'triangle', level: 0.16, lfoHz: 0.09 },
    { freq: 293.66, type: 'triangle', level: 0.12, lfoHz: 0.11 },
  ];

  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1200;
  lowpass.connect(master!);
  nodes.push(lowpass);

  for (const v of voices) {
    const osc = c.createOscillator();
    osc.type = v.type;
    osc.frequency.value = v.freq;

    const gain = c.createGain();
    gain.gain.value = v.level;

    // 每个声部一个缓慢 LFO，制造呼吸般的音量起伏
    const lfo = c.createOscillator();
    lfo.frequency.value = v.lfoHz;
    const lfoGain = c.createGain();
    lfoGain.gain.value = v.level * 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    gain.connect(lowpass);

    osc.start();
    lfo.start();
    sources.push(osc, lfo);
    nodes.push(gain, lfoGain);
  }
}

function teardown() {
  for (const s of sources) {
    try {
      s.stop();
    } catch {
      /* 已停止的节点忽略 */
    }
    s.disconnect();
  }
  for (const n of nodes) n.disconnect();
  sources = [];
  nodes = [];
  currentKind = null;
}

/** 播放指定音景；重复点同一音景则停止（开关语义）。返回是否在播放。 */
export function toggleAmbient(kind: AmbientKind): boolean {
  if (currentKind === kind) {
    stopAmbient();
    return false;
  }
  const c = ensureContext();
  // iOS Safari：AudioContext 需在用户手势中 resume
  if (c.state === 'suspended') void c.resume();
  teardown();
  if (kind === 'rain') buildRain(c);
  else buildPad(c);
  currentKind = kind;
  return true;
}

export function stopAmbient() {
  if (!ctx) return;
  teardown();
}

export function setAmbientVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

export function getAmbientVolume(): number {
  return volume;
}

export function getAmbientKind(): AmbientKind | null {
  return currentKind;
}

/** 计时结束的轻柔提示音：两声下行和弦音，指数衰减 */
export function playChime() {
  const c = ensureContext();
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime;
  // E5 → C5 两个柔和的钟声
  for (const [i, freq] of [659.25, 523.25].entries()) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = c.createGain();
    const start = t0 + i * 0.7;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35 * volume + 0.1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + 2.4);
  }
}
