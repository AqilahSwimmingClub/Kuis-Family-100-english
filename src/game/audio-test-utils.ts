import { existsSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { resolve } from 'node:path'

export type AudioSettings = { enabled: boolean; volume: number; profile: 'normal' | 'game-show' }
export type AudioApi = {
  getSettings(): AudioSettings
  setSettings(value: Partial<AudioSettings>): AudioSettings
  play(name: string, options?: { id?: string; points?: number }): Promise<boolean>
  unlock(): Promise<boolean>
  stop(): void
  test(): Promise<boolean>
  subscribe(listener: (settings: AudioSettings) => void): () => void
}

class Parameter {
  value = 1
  events: { value: number; time: number; kind: string }[] = []
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time, kind: 'set' }) }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time, kind: 'linear' }) }
  exponentialRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ value, time, kind: 'exponential' }) }
  cancelScheduledValues(time: number) { this.events = this.events.filter(event => event.time < time) }
  cancelAndHoldAtTime(time: number) { this.events.push({ value: this.value, time, kind: 'hold' }) }
}

export class FakeNode {
  gain = new Parameter()
  frequency = new Parameter()
  Q = new Parameter()
  threshold = new Parameter()
  knee = new Parameter()
  ratio = new Parameter()
  attack = new Parameter()
  release = new Parameter()
  playbackRate = new Parameter()
  type = 'sine'
  buffer: unknown = null
  connections: FakeNode[] = []
  disconnected = false
  started: number | undefined
  stopped: number | undefined
  ended = false
  onended: (() => void) | null = null
  connect(node: FakeNode) { this.connections.push(node); return node }
  disconnect() { this.disconnected = true; this.connections = [] }
  start(time: number) { this.started = time }
  stop(time = 0) { this.stopped = time }
  finish() { if (!this.ended) { this.ended = true; this.onended?.() } }
}

export class FakeAudioContext {
  currentTime = 0
  state: AudioContextState | 'interrupted' = 'suspended'
  destination = new FakeNode()
  sources: FakeNode[] = []
  gains: FakeNode[] = []
  filters: FakeNode[] = []
  compressors: FakeNode[] = []
  resumeCount = 0
  resumeFailure = false
  pendingResume: (() => void) | undefined
  deferResume = false
  sampleRate = 48000
  createOscillator() { const source = new FakeNode(); this.sources.push(source); return source }
  createBufferSource() { const source = new FakeNode(); this.sources.push(source); return source }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node }
  createBiquadFilter() { const node = new FakeNode(); this.filters.push(node); return node }
  createDynamicsCompressor() { const node = new FakeNode(); this.compressors.push(node); return node }
  createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size) } }
  async resume() {
    this.resumeCount++
    if (this.resumeFailure) throw new Error('gesture required')
    if (this.deferResume) await new Promise<void>(resolve => { this.pendingResume = resolve })
    this.state = 'running'
  }
  advance(seconds: number) {
    this.currentTime += seconds
    this.sources.filter(source => source.stopped !== undefined && source.stopped <= this.currentTime).forEach(source => source.finish())
  }
}

export function audioHarness(stored?: string, legacy?: string) {
  const listeners = new Map<string, ((event: Record<string, unknown>) => void)[]>()
  const contexts: FakeAudioContext[] = []
  const values = new Map(stored === undefined ? [] : [['family100.audio.v1', stored]])
  if (legacy !== undefined) values.set('family100.session.v1', legacy)
  let storageThrows = false
  const doc = {
    hidden: false,
    addEventListener(name: string, listener: (event: Record<string, unknown>) => void) {
      listeners.set(name, [...(listeners.get(name) ?? []), listener])
    },
  }
  const win = {
    document: doc,
    AudioContext: class extends FakeAudioContext { constructor() { super(); contexts.push(this) } },
    localStorage: {
      getItem(key: string) { if (storageThrows) throw new Error('blocked'); return values.get(key) ?? null },
      setItem(key: string, value: string) { if (storageThrows) throw new Error('blocked'); values.set(key, value) },
    },
    addEventListener: doc.addEventListener,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    family100Audio: undefined as AudioApi | undefined,
  }
  const path = resolve(process.cwd(), 'public/audio/game-show-audio.js')
  const source = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const evaluate = () => runInNewContext(source, { window: win })
  evaluate()
  return {
    api: win.family100Audio!, contexts, values, doc, listeners, evaluate,
    blockStorage() { storageThrows = true },
    emit(name: string, event: Record<string, unknown> = {}) {
      for (const listener of listeners.get(name) ?? []) listener(event)
    },
  }
}
