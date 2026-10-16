import { describe, expect, it } from 'vitest'
import { audioHarness } from './audio-test-utils'

const expectedNames = [
  ['intro', 'Intro aplikasi'], ['opening', 'Mulai permainan'], ['question', 'Soal berikutnya'],
  ['correct', 'Jawaban benar'], ['wrong', 'Jawaban salah'], ['reveal', 'Buka jawaban'],
  ['score', 'Tambah poin'], ['celebration', 'Bonus / poin tinggi'], ['steal', 'Final Steal dimulai'],
  ['steal-success', 'Final Steal berhasil'], ['steal-fail', 'Final Steal gagal'],
  ['countdown', 'Countdown 5 detik'], ['timeout', 'Waktu habis'], ['turn', 'Pergantian giliran'],
  ['discussion', 'Pembahasan'], ['winner', 'Pengumuman pemenang'], ['click', 'Tombol biasa'],
]

describe('individual sound previews', () => {
  it('names all 17 distinct effects without creating audio and protects the shared catalog', () => {
    const h = audioHarness()
    const effects = h.api.getEffects()
    expect(effects.map(effect => [effect.id, effect.label])).toEqual(expectedNames)
    expect(effects.every(effect => effect.description.trim().length > 10)).toBe(true)
    effects[0].label = 'Replaced'
    effects.pop()
    expect(h.api.getEffects().map(effect => [effect.id, effect.label])).toEqual(expectedNames)
    expect(h.contexts).toHaveLength(0)
  })

  it.each(['normal', 'game-show'] as const)('synthesizes 17 different audible source plans in the %s profile', async profile => {
    const h = audioHarness()
    h.api.setSettings({ profile })
    const plans = []
    for (const [name] of expectedNames) {
      const previousCount = h.contexts[0]?.sources.length ?? 0
      expect(await h.api.preview(name)).toBe(true)
      const sources = h.contexts[0].sources.slice(previousCount)
      expect(sources.length).toBeGreaterThan(0)
      // Frequency, waveform and timing define the actual scheduled sound, not merely its ID.
      plans.push(JSON.stringify(sources.map(source => ({
        waveform: source.buffer ? 'noise' : source.type,
        pitch: source.frequency.events,
        started: source.started,
        stopped: source.stopped,
        envelope: source.connections.map(node => node.gain.events),
      }))))
    }
    expect(new Set(plans).size).toBe(17)
  })

  it.each(['click', 'countdown'])('lets a %s preview interrupt a long fanfare', async name => {
    const h = audioHarness()
    expect(await h.api.preview('winner')).toBe(true)
    const context = h.contexts[0]
    const oldSources = [...context.sources]
    context.advance(.1)
    expect(await h.api.preview(name)).toBe(true)
    const newSources = context.sources.slice(oldSources.length)
    expect(newSources).toHaveLength(1)
    expect(oldSources.every(source => source.stopped! <= context.currentTime + .04)).toBe(true)
    context.advance(.041)
    expect(oldSources.every(source => source.disconnected)).toBe(true)
    expect(newSources[0].disconnected).toBe(false)
  })

  it('only plays the latest preview when rapid taps share a suspended context resume', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const context = h.contexts[0]
    context.state = 'suspended'
    context.deferResume = true
    const stale = h.api.preview('winner')
    const latest = h.api.preview('click')
    context.pendingResume!()
    expect(await stale).toBe(false)
    expect(await latest).toBe(true)
    expect(context.sources).toHaveLength(1)
    expect(context.sources[0].frequency.events[0].value).toBe(760)
    expect(context.resumeCount).toBe(2)
  })

  it('cancels a pending preview on mute and can recover on a later gesture', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const context = h.contexts[0]
    context.state = 'interrupted'
    context.deferResume = true
    const pending = h.api.preview('opening')
    h.api.setSettings({ enabled: false })
    context.pendingResume!()
    expect(await pending).toBe(false)
    expect(context.sources).toHaveLength(0)
    h.api.setSettings({ enabled: true })
    expect(await h.api.preview('reveal')).toBe(true)
  })

  it('silently handles a rejected resume then retries the selected effect', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const context = h.contexts[0]
    context.state = 'suspended'
    context.resumeFailure = true
    expect(await h.api.preview('wrong')).toBe(false)
    expect(context.sources).toHaveLength(0)
    context.resumeFailure = false
    expect(await h.api.preview('wrong')).toBe(true)
  })

  it('does not create a context for muted, zero-volume or invalid previews', async () => {
    const h = audioHarness()
    expect(await h.api.preview('not-an-effect')).toBe(false)
    h.api.setSettings({ enabled: false })
    expect(await h.api.preview('correct')).toBe(false)
    h.api.setSettings({ enabled: true, volume: 0 })
    expect(await h.api.preview('correct')).toBe(false)
    expect(h.contexts).toHaveLength(0)
  })

  it('lets the existing sound test replace a pending gallery preview', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const context = h.contexts[0]
    context.state = 'suspended'
    context.deferResume = true
    const stale = h.api.preview('winner')
    const latest = h.api.test()
    context.pendingResume!()
    expect(await stale).toBe(false)
    expect(await latest).toBe(true)
    expect(context.sources.some(source => source.frequency.events.some(event => event.value === 1046.5))).toBe(true)
    expect(context.sources.some(source => source.started! >= .48)).toBe(true)
  })

  it.each(['correct', 'steal-success'])('adds earned-point coins and a high-point celebration to Normal %s events', async name => {
    const h = audioHarness()
    h.api.setSettings({ profile: 'normal' })
    await h.api.unlock()
    const plans = []
    for (const points of [0, 5, 35]) {
      const previousCount = h.contexts[0].sources.length
      expect(await h.api.play(name, { points })).toBe(true)
      plans.push(h.contexts[0].sources.slice(previousCount))
    }
    expect(plans[0].some(source => source.frequency.events.some(event => event.value === 1318.51))).toBe(false)
    expect(plans[1].some(source => source.frequency.events.some(event => event.value === 1318.51))).toBe(true)
    expect(plans[2].length).toBeGreaterThan(plans[1].length)
    const celebrationAt = name === 'steal-success' ? .8 : .48
    expect(plans[2].some(source => source.started! >= celebrationAt && source.type === 'triangle')).toBe(true)
  })
})
