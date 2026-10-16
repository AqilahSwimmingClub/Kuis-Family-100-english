import { describe, expect, it } from 'vitest'
import { audioHarness } from './audio-test-utils'

describe('shared game show audio', () => {
  it('adopts an existing legacy mute before any entry point can autoplay', async () => {
    const h = audioHarness(undefined, '{"settings":{"sound":false}}')
    expect(h.api.getSettings()).toEqual({ enabled: false, volume: 65, profile: 'game-show' })
    expect(JSON.parse(h.values.get('family100.audio.v1')!)).toMatchObject({ enabled: false })
    h.emit('pointerdown', { isTrusted: true })
    expect(await h.api.unlock()).toBe(false)
    expect(h.contexts).toHaveLength(0)
  })

  it('preserves an explicit new audio preference over a legacy mute', () => {
    const h = audioHarness('{"enabled":true,"volume":42,"profile":"normal"}', '{"settings":{"sound":false}}')
    expect(h.api.getSettings()).toEqual({ enabled: true, volume: 42, profile: 'normal' })
  })

  it('keeps safe defaults when the legacy session is malformed', () => {
    expect(audioHarness(undefined, '{broken').api.getSettings()).toEqual({ enabled: true, volume: 65, profile: 'game-show' })
  })

  it('loads safe defaults without creating audio or autoplaying', async () => {
    const h = audioHarness()
    expect(h.api).toBeDefined()
    expect(h.api.getSettings()).toEqual({ enabled: true, volume: 65, profile: 'game-show' })
    expect(await h.api.play('opening')).toBe(false)
    expect(h.contexts).toHaveLength(0)
    h.emit('pointerdown', { isTrusted: false })
    expect(h.contexts).toHaveLength(0)
  })

  it('validates stored values, clamps volume, persists and notifies safely', () => {
    const h = audioHarness('{"enabled":"yes","volume":999,"profile":"invalid"}')
    expect(h.api.getSettings()).toEqual({ enabled: true, volume: 100, profile: 'game-show' })
    const updates: unknown[] = []
    const unsubscribe = h.api.subscribe(settings => updates.push(settings))
    h.api.setSettings({ enabled: false, volume: -5, profile: 'normal' })
    expect(JSON.parse(h.values.get('family100.audio.v1')!)).toEqual({ enabled: false, volume: 0, profile: 'normal' })
    expect(updates).toEqual([{ enabled: false, volume: 0, profile: 'normal' }])
    unsubscribe()
    h.blockStorage()
    expect(() => h.api.setSettings({ volume: 70 })).not.toThrow()
    expect(updates).toHaveLength(1)
    expect(audioHarness('{broken').api.getSettings().volume).toBe(65)
  })

  it('installs once and plays intro only after the first trusted interaction', async () => {
    const h = audioHarness()
    const api = h.api
    const listenerCount = h.listeners.get('pointerdown')?.length
    h.evaluate()
    expect(h.api).toBe(api)
    expect(h.listeners.get('pointerdown')).toHaveLength(listenerCount!)
    h.emit('pointerdown', { isTrusted: true })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts).toHaveLength(1)
    const count = h.contexts[0].sources.length
    expect(count).toBeGreaterThan(4)
    h.emit('keydown', { isTrusted: true, key: 'Enter' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts[0].sources).toHaveLength(count)
  })

  it('awaits resumed audio and retries an interruption without recreating context', async () => {
    const h = audioHarness()
    expect(await h.api.unlock()).toBe(true)
    const context = h.contexts[0]
    context.state = 'interrupted'
    context.resumeFailure = true
    expect(await h.api.play('correct')).toBe(false)
    expect(context.sources).toHaveLength(0)
    context.resumeFailure = false
    expect(await h.api.play('correct')).toBe(true)
    expect(context.resumeCount).toBe(3)
    expect(h.contexts).toHaveLength(1)
  })

  it('cancels a cue whose asynchronous resume finishes after mute', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const context = h.contexts[0]
    context.state = 'suspended'
    context.deferResume = true
    const playing = h.api.play('winner')
    h.api.setSettings({ enabled: false })
    context.pendingResume!()
    expect(await playing).toBe(false)
    expect(context.sources).toHaveLength(0)
  })

  it('deduplicates logical event IDs while allowing repeated ordinary actions', async () => {
    const h = audioHarness()
    await h.api.unlock()
    expect(await h.api.play('correct', { id: 'reveal-1', points: 40 })).toBe(true)
    const count = h.contexts[0].sources.length
    expect(await h.api.play('correct', { id: 'reveal-1', points: 40 })).toBe(false)
    expect(h.contexts[0].sources).toHaveLength(count)
    expect(await h.api.play('wrong')).toBe(true)
    expect(await h.api.play('wrong')).toBe(true)
  })

  it('keeps low priority ticks out of fanfares and fades preempted scenes', async () => {
    const h = audioHarness()
    await h.api.unlock()
    await h.api.play('winner')
    const context = h.contexts[0]
    const winnerSources = [...context.sources]
    expect(await h.api.play('countdown')).toBe(false)
    expect(await h.api.play('click')).toBe(false)
    expect(context.sources).toHaveLength(winnerSources.length)
    expect(await h.api.play('wrong')).toBe(true)
    expect(winnerSources.every(source => source.stopped! <= context.currentTime + .06)).toBe(true)
    context.advance(.1)
    expect(winnerSources.every(source => source.disconnected)).toBe(true)
  })

  it('cleans every source and stops scheduled audio when hidden or volume is zero', async () => {
    const h = audioHarness()
    await h.api.unlock()
    await h.api.play('opening')
    const context = h.contexts[0]
    expect(context.compressors).toHaveLength(1)
    expect(context.filters.length).toBeGreaterThan(0)
    context.advance(8)
    expect(context.sources.every(source => source.ended && source.disconnected)).toBe(true)
    await h.api.play('winner')
    h.api.setSettings({ volume: 0 })
    context.advance(.1)
    expect(context.sources.every(source => source.disconnected)).toBe(true)
    h.api.setSettings({ volume: 65 })
    await h.api.play('correct')
    h.doc.hidden = true
    h.emit('visibilitychange')
    context.advance(.1)
    expect(context.sources.every(source => source.disconnected)).toBe(true)
    expect(await h.api.play('winner')).toBe(false)
  })

  it('only recreates a closed context on a new explicit unlock', async () => {
    const h = audioHarness()
    await h.api.unlock()
    h.contexts[0].state = 'closed'
    expect(await h.api.play('correct')).toBe(false)
    expect(h.contexts).toHaveLength(1)
    expect(await h.api.unlock()).toBe(true)
    expect(h.contexts).toHaveLength(2)
    expect(await h.api.play('correct')).toBe(true)
  })

  it('plays a richer composite correct scene for high points and a simpler normal profile', async () => {
    const h = audioHarness()
    await h.api.unlock()
    await h.api.play('correct', { points: 5 })
    const context = h.contexts[0]
    const regularCount = context.sources.length
    await h.api.play('correct', { points: 35 })
    expect(context.sources.length - regularCount).toBeGreaterThan(regularCount)
    const richCount = context.sources.length
    h.api.setSettings({ profile: 'normal' })
    await h.api.play('correct', { points: 35 })
    expect(context.sources.length - richCount).toBeLessThan(regularCount)
  })

  it('lets an explicit first-action cue take precedence over the automatic intro', async () => {
    const h = audioHarness()
    h.emit('pointerdown', { isTrusted: true, type: 'pointerdown' })
    expect(await h.api.play('wrong')).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 0))
    // A later intro would add a full fanfare and cancel the wrong cue.
    expect(h.contexts[0].sources).toHaveLength(2)
    expect(h.contexts[0].sources.every(source => !source.disconnected)).toBe(true)
  })

  it('adds a soft click only when the completed click had no explicit audio', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const button = {
      disabled: false,
      getAttribute: () => null,
      matches: () => false,
      closest: (selector: string) => selector === '[data-audio-silent]' ? null : button,
    }
    h.emit('click', { isTrusted: true, target: button })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts[0].sources).toHaveLength(1)
    h.emit('click', { isTrusted: true, target: button })
    await h.api.play('wrong')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts[0].sources).toHaveLength(3)
  })

  it('keeps disabled fieldset buttons and audio settings controls silent', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const disabledButton = {
      disabled: false,
      getAttribute: () => null,
      matches: (selector: string) => selector === ':disabled',
      closest: (selector: string) => selector === '[data-audio-silent]' ? null : disabledButton,
    }
    const silentButton = {
      disabled: false,
      getAttribute: () => null,
      matches: () => false,
      closest: () => silentButton,
    }
    h.emit('click', { isTrusted: true, target: disabledButton })
    h.emit('click', { isTrusted: true, target: silentButton })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts[0].sources).toHaveLength(0)
  })

  it('bounds polyphony under rapid high-point events and keeps the engine usable', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const context = h.contexts[0]
    for (let index = 0; index < 80; index++) {
      await h.api.play('correct', { points: 45 })
      context.advance(.006)
      expect(context.sources.filter(source => !source.disconnected).length).toBeLessThanOrEqual(64)
    }
    context.advance(5)
    expect(context.sources.every(source => source.disconnected)).toBe(true)
    expect(await h.api.play('winner')).toBe(true)
  })

  it('evicts old deduplication IDs and does not reserve an ID for failed playback', async () => {
    const h = audioHarness()
    expect(await h.api.play('click', { id: 'retry-after-gesture' })).toBe(false)
    await h.api.unlock()
    expect(await h.api.play('click', { id: 'retry-after-gesture' })).toBe(true)
    for (let index = 0; index < 260; index++) await h.api.play('click', { id: `event-${index}` })
    expect(await h.api.play('click', { id: 'retry-after-gesture' })).toBe(true)
  })

  it('keeps the interaction intro shorter than the full opening fanfare', async () => {
    const intro = audioHarness()
    const opening = audioHarness()
    await intro.api.unlock()
    await opening.api.unlock()
    await intro.api.play('intro')
    await opening.api.play('opening')
    const introEnd = Math.max(...intro.contexts[0].sources.map(source => source.stopped!))
    const openingEnd = Math.max(...opening.contexts[0].sources.map(source => source.stopped!))
    expect(introEnd).toBeLessThan(openingEnd * .7)
  })

  it('gives a successful steal a stronger victory flourish than a regular answer', async () => {
    const correct = audioHarness()
    const steal = audioHarness()
    await correct.api.unlock()
    await steal.api.unlock()
    await correct.api.play('correct', { points: 5 })
    await steal.api.play('steal-success', { points: 5 })
    expect(steal.contexts[0].sources.length).toBeGreaterThan(correct.contexts[0].sources.length)
    expect(Math.max(...steal.contexts[0].sources.map(source => source.stopped!)))
      .toBeGreaterThan(Math.max(...correct.contexts[0].sources.map(source => source.stopped!)))
  })

  it('adds a gentle final turn chime within the question scene', async () => {
    const h = audioHarness()
    await h.api.unlock()
    await h.api.play('question')
    expect(h.contexts[0].sources.some(source => source.started! >= .35 && source.frequency.events.some(event => event.value === 880))).toBe(true)
  })

  it('updates subscribers from storage events and ignores unrelated or malformed values', () => {
    const h = audioHarness()
    const updates: unknown[] = []
    h.api.subscribe(settings => updates.push(settings))
    h.emit('storage', { key: 'unrelated', newValue: '{"volume":0}' })
    h.emit('storage', { key: 'family100.audio.v1', newValue: '{broken' })
    expect(updates).toHaveLength(0)
    h.emit('storage', { key: 'family100.audio.v1', newValue: '{"enabled":false,"volume":40,"profile":"normal"}' })
    expect(h.api.getSettings()).toEqual({ enabled: false, volume: 40, profile: 'normal' })
    expect(updates).toHaveLength(1)
  })

  it('preserves the first interaction intro when a keyboard click only requests soft feedback', async () => {
    const h = audioHarness()
    h.emit('keydown', { isTrusted: true, type: 'keydown', key: 'Enter' })
    await h.api.play('click')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts[0].sources.length).toBeGreaterThan(1)
  })

  it('disconnects interrupted sources immediately so resuming cannot replay a canceled tail', async () => {
    const h = audioHarness()
    await h.api.unlock()
    await h.api.play('wrong')
    const context = h.contexts[0]
    context.advance(.03)
    context.state = 'interrupted'
    h.api.stop()
    expect(context.sources.every(source => source.disconnected)).toBe(true)
    expect(context.sources.every(source => source.stopped! <= context.currentTime)).toBe(true)
    expect(await h.api.unlock()).toBe(true)
  })

  it('waits until native-style click dispatch finishes before deciding on soft feedback', async () => {
    const h = audioHarness()
    await h.api.unlock()
    const button = {
      disabled: false,
      getAttribute: () => null,
      matches: () => false,
      closest: (selector: string) => selector === '[data-audio-silent]' ? null : button,
    }
    h.emit('click', { isTrusted: true, target: button })
    // Native event dispatch can run microtasks between capture and target listeners.
    await Promise.resolve()
    await h.api.play('wrong')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts[0].sources).toHaveLength(2)
  })

  it('ignores focus navigation keys so a later pointer gesture can activate audio', async () => {
    const h = audioHarness()
    h.emit('keydown', { isTrusted: true, type: 'keydown', key: 'Tab' })
    h.emit('keydown', { isTrusted: true, type: 'keydown', key: 'Escape' })
    expect(h.contexts).toHaveLength(0)
    h.emit('pointerdown', { isTrusted: true, type: 'pointerdown' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(h.contexts).toHaveLength(1)
    expect(h.contexts[0].sources.length).toBeGreaterThan(0)
  })
})
