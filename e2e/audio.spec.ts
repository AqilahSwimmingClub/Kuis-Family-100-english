import { expect, test, type Page } from '@playwright/test'

type AudioSettings = { enabled: boolean; volume: number; profile: 'normal' | 'game-show' }
type AudioEngine = {
  getSettings: () => AudioSettings
  setSettings: (settings: Partial<AudioSettings>) => AudioSettings
  play: (name: string, options?: { id?: string; points?: number }) => Promise<boolean>
  stop: () => void
}
type AudioProbe = {
  contexts: AudioContext[]
  currentPeak: number
  maxPeak: number
  samples: number
  sourceStarts: number
  reset: () => void
}
type AudioWindow = Window & {
  family100Audio: AudioEngine
  __audioProbe: AudioProbe
  __playedAudio: string[]
  webkitAudioContext?: typeof AudioContext
}

// Every constructor and node below delegates to the browser's real Web Audio
// implementation. The analyser sits in the audible graph, after the master gain.
// It observes actual PCM, so a play-call counter cannot make these checks pass.
async function observeRealAudio(page: Page) {
  await page.addInitScript(() => {
    const audioWindow = window as unknown as AudioWindow
    const NativeAudioContext = window.AudioContext
    const nativeConnect = AudioNode.prototype.connect
    const analysers = new WeakMap<BaseAudioContext, AnalyserNode>()
    const probe: AudioProbe = {
      contexts: [], currentPeak: 0, maxPeak: 0, samples: 0, sourceStarts: 0,
      reset() { this.currentPeak = 0; this.maxPeak = 0; this.samples = 0; this.sourceStarts = 0 },
    }
    audioWindow.__audioProbe = probe
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      const destination = args[0]
      if (destination === this.context.destination) {
        let analyser = analysers.get(this.context)
        if (!analyser) {
          analyser = this.context.createAnalyser()
          analyser.fftSize = 2048
          analysers.set(this.context, analyser)
          Reflect.apply(nativeConnect, analyser, [this.context.destination])
        }
        Reflect.apply(nativeConnect, this, [analyser, args[1] ?? 0])
        return destination
      }
      return Reflect.apply(nativeConnect, this, args)
    } as AudioNode['connect']
    const ObservedAudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext
        const observeSource = <T extends AudioScheduledSourceNode>(source: T): T => {
          const nativeStart = source.start
          source.start = function (this: AudioScheduledSourceNode, ...startArgs: unknown[]) {
            probe.sourceStarts++
            return Reflect.apply(nativeStart, this, startArgs)
          }
          return source
        }
        const createOscillator = context.createOscillator.bind(context)
        const createBufferSource = context.createBufferSource.bind(context)
        context.createOscillator = () => observeSource(createOscillator())
        context.createBufferSource = () => observeSource(createBufferSource())
        probe.contexts.push(context)
        return context
      },
    })
    window.AudioContext = ObservedAudioContext
    if (audioWindow.webkitAudioContext) audioWindow.webkitAudioContext = ObservedAudioContext
    const data = new Float32Array(2048)
    const sample = () => {
      let peak = 0
      for (const context of probe.contexts) {
        const analyser = analysers.get(context)
        if (!analyser) continue
        analyser.getFloatTimeDomainData(data)
        for (const value of data) peak = Math.max(peak, Math.abs(value))
        probe.samples += data.length
      }
      probe.currentPeak = peak
      probe.maxPeak = Math.max(probe.maxPeak, peak)
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

async function audioStats(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as AudioWindow).__audioProbe
    return {
      contexts: probe.contexts.length,
      states: probe.contexts.map(context => context.state),
      peak: probe.currentPeak,
      maxPeak: probe.maxPeak,
      samples: probe.samples,
      sourceStarts: probe.sourceStarts,
    }
  })
}

async function resetProbe(page: Page) {
  await page.evaluate(() => (window as unknown as AudioWindow).__audioProbe.reset())
}

async function openAudioSettings(page: Page) {
  await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function expectAudible(page: Page) {
  await expect.poll(async () => (await audioStats(page)).states).toEqual(['running'])
  await expect.poll(async () => (await audioStats(page)).maxPeak).toBeGreaterThan(0.0001)
  const stats = await audioStats(page)
  expect(stats.samples).toBeGreaterThan(0)
  expect(stats.contexts).toBe(1)
  expect(stats.states).toEqual(['running'])
  expect(stats.maxPeak).toBeLessThan(1)
}

async function expectSilence(page: Page) {
  // Let the analyser's previous 2048-sample window expire before measuring.
  await page.waitForTimeout(120)
  await resetProbe(page)
  await page.waitForTimeout(250)
  expect((await audioStats(page)).maxPeak).toBeLessThan(0.000001)
}

async function logSuccessfulCues(page: Page) {
  await page.evaluate(() => {
    const audioWindow = window as unknown as AudioWindow
    const original = audioWindow.family100Audio.play.bind(audioWindow.family100Audio)
    audioWindow.__playedAudio = []
    audioWindow.family100Audio.play = async (name, options) => {
      const played = await original(name, options)
      if (played) audioWindow.__playedAudio.push(name)
      return played
    }
  })
}

async function cueCount(page: Page, name: string) {
  return page.evaluate(cue => (window as unknown as AudioWindow).__playedAudio.filter(item => item === cue).length, name)
}

async function configureTimer(page: Page, seconds: 0 | 10) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('combobox', { name: 'Timer diskusi', exact: true }).selectOption(String(seconds))
  await page.getByRole('button', { name: 'Simpan pengaturan', exact: true }).click()
}

async function startEnglishGame(page: Page) {
  await page.getByRole('button', { name: 'START GAME', exact: true }).click()
  await page.getByRole('button', { name: 'MULAI PERTANDINGAN', exact: true }).click()
}

test('audio defaults and preferences persist between the homepage and English Challenge', async ({ page }) => {
  await observeRealAudio(page)
  await page.goto('/')
  expect((await audioStats(page)).contexts).toBe(0)
  let dialog = await openAudioSettings(page)
  await expect(dialog.getByLabel('Efek suara', { exact: true })).toBeChecked()
  await expect(dialog.getByLabel('Volume utama', { exact: true })).toHaveValue('65')
  await expect(dialog.getByLabel('Profil suara', { exact: true })).toHaveValue('game-show')
  await dialog.getByLabel('Efek suara', { exact: true }).uncheck()
  await dialog.getByLabel('Volume utama', { exact: true }).fill('37')
  await dialog.getByLabel('Profil suara', { exact: true }).selectOption('normal')
  await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()

  for (const path of ['/?mode=english', '/']) {
    await page.goto(path)
    dialog = await openAudioSettings(page)
    await expect(dialog.getByLabel('Efek suara', { exact: true })).not.toBeChecked()
    await expect(dialog.getByLabel('Volume utama', { exact: true })).toHaveValue('37')
    await expect(dialog.getByLabel('Profil suara', { exact: true })).toHaveValue('normal')
    await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()
    await page.reload()
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('family100.audio.v1') || 'null'))
    expect(saved).toMatchObject({ enabled: false, volume: 37, profile: 'normal' })
  }
})

for (const path of ['/', '/?mode=english']) {
  test(`sound test renders real PCM and mute and zero volume silence it on ${path}`, async ({ page }) => {
    await observeRealAudio(page)
    await page.goto(path)
    expect((await audioStats(page)).contexts).toBe(0)
    const dialog = await openAudioSettings(page)
    await resetProbe(page)
    await dialog.getByRole('button', { name: 'Tes Suara', exact: true }).click()
    await expectAudible(page)

    await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.play('winner', { id: 'mute-during-play' }))
    await dialog.getByLabel('Efek suara', { exact: true }).uncheck()
    const muted = await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.play('correct', { id: 'muted-answer', points: 40 }))
    expect(muted).toBe(false)
    await expectSilence(page)

    await dialog.getByLabel('Volume utama', { exact: true }).fill('0')
    await dialog.getByLabel('Efek suara', { exact: true }).check()
    await resetProbe(page)
    await expect(dialog.getByRole('button', { name: 'Tes Suara', exact: true })).toBeDisabled()
    const zeroVolume = await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.play('correct', { id: 'zero-volume-answer', points: 40 }))
    expect(zeroVolume).toBe(false)
    await expectSilence(page)
  })

  test(`a trusted sound-test gesture resumes a genuinely suspended context on ${path}`, async ({ page }) => {
    await observeRealAudio(page)
    await page.goto(path)
    const dialog = await openAudioSettings(page)
    await dialog.getByRole('button', { name: 'Tes Suara', exact: true }).click()
    await expectAudible(page)
    await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.stop())
    await page.waitForTimeout(120)
    await page.evaluate(() => (window as unknown as AudioWindow).__audioProbe.contexts[0].suspend())
    expect((await audioStats(page)).states).toEqual(['suspended'])
    await resetProbe(page)
    await dialog.getByRole('button', { name: 'Tes Suara', exact: true }).click()
    await expectAudible(page)
    expect((await audioStats(page)).sourceStarts).toBeGreaterThan(0)
  })
}

test('the master volume slider changes the gain of real browser output', async ({ page }) => {
  await observeRealAudio(page)
  await page.goto('/')
  const dialog = await openAudioSettings(page)
  await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.stop())
  await page.waitForTimeout(120)
  const peaks: number[] = []
  for (const volume of ['100', '25']) {
    await dialog.getByLabel('Volume utama', { exact: true }).fill(volume)
    await resetProbe(page)
    await dialog.getByRole('button', { name: 'Tes Suara', exact: true }).click()
    await expectAudible(page)
    await page.waitForTimeout(1300)
    peaks.push((await audioStats(page)).maxPeak)
  }
  expect(peaks[1]).toBeGreaterThan(0.0001)
  expect(peaks[1]).toBeLessThan(peaks[0] * 0.5)
})

test('every game-show cue produces real non-clipping samples through the browser master output', async ({ page }) => {
  test.setTimeout(45_000)
  await observeRealAudio(page)
  await page.goto('/')
  const dialog = await openAudioSettings(page)
  await dialog.getByLabel('Volume utama', { exact: true }).fill('100')
  await dialog.getByRole('button', { name: 'Tes Suara', exact: true }).click()
  await expectAudible(page)
  await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.stop())
  const cues = ['intro', 'opening', 'question', 'correct', 'wrong', 'reveal', 'score', 'celebration', 'steal', 'steal-success', 'steal-fail', 'countdown', 'timeout', 'turn', 'discussion', 'winner', 'click']
  for (const cue of cues) {
    await page.waitForTimeout(100)
    await resetProbe(page)
    const played = await page.evaluate(name => (window as unknown as AudioWindow).family100Audio.play(name, { id: `real-output-${name}`, points: 40 }), cue)
    expect(played, cue).toBe(true)
    await expectAudible(page)
    if (cue === 'correct' || cue === 'steal-success') {
      await page.waitForTimeout(cue === 'steal-success' ? 1000 : 650)
      expect((await audioStats(page)).maxPeak, `${cue} initial layers`).toBeLessThan(1)
      await resetProbe(page)
      await expectAudible(page)
      await page.waitForTimeout(850)
    } else {
      await page.waitForTimeout(['intro', 'opening', 'winner'].includes(cue) ? 1900 : 750)
    }
    expect((await audioStats(page)).maxPeak, `${cue} complete envelope`).toBeLessThan(1)
    await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.stop())
  }
})

test('a native click with an explicit cue does not add an automatic click voice', async ({ page }) => {
  await observeRealAudio(page)
  await page.goto('/')
  const dialog = await openAudioSettings(page)
  await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()
  await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.stop())
  await page.waitForTimeout(120)
  await resetProbe(page)
  await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.play('wrong', { id: 'direct-native-baseline' }))
  await expectAudible(page)
  const baselineVoices = (await audioStats(page)).sourceStarts
  expect(baselineVoices).toBeGreaterThan(0)
  await page.evaluate(() => {
    const engine = (window as unknown as AudioWindow).family100Audio
    engine.stop()
    const button = document.createElement('button')
    button.textContent = 'Native explicit audio cue'
    button.style.cssText = 'position:fixed;top:80px;left:20px;z-index:10000;padding:16px'
    button.addEventListener('click', () => { void engine.play('wrong', { id: 'trusted-native-button' }) })
    document.body.append(button)
  })
  await page.waitForTimeout(120)
  await resetProbe(page)
  await page.getByRole('button', { name: 'Native explicit audio cue', exact: true }).click()
  await expectAudible(page)
  await page.waitForTimeout(150)
  expect((await audioStats(page)).sourceStarts).toBe(baselineVoices)
})

test('English answer, question, steal and winner cues follow successful actions exactly once', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('/?mode=english')
  await configureTimer(page, 0)
  await logSuccessfulCues(page)
  await startEnglishGame(page)
  await expect.poll(() => cueCount(page, 'opening')).toBe(1)
  expect(await cueCount(page, 'question')).toBe(0)
  expect(await cueCount(page, 'wrong')).toBe(0)
  await page.getByRole('button', { name: 'Buka jawaban 1', exact: true }).click()
  await expect(page.getByTestId('team-score-0').getByText('40', { exact: true })).toBeVisible()
  await expect.poll(() => cueCount(page, 'correct')).toBe(1)
  await expect(page.getByRole('button', { name: 'REVEAL ANSWER', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Mode proyektor', exact: true }).click()
  await page.getByRole('button', { name: 'Mode normal', exact: true }).click()
  const dialog = await openAudioSettings(page)
  await dialog.getByLabel('Volume utama', { exact: true }).fill('51')
  await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()
  expect(await cueCount(page, 'correct')).toBe(1)
  expect(await cueCount(page, 'opening')).toBe(1)
  expect(await cueCount(page, 'question')).toBe(0)
  expect(await cueCount(page, 'wrong')).toBe(0)

  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'WRONG', exact: true }).click()
  await expect.poll(() => cueCount(page, 'wrong')).toBe(3)
  await page.getByLabel('Tim perebut', { exact: true }).selectOption('1')
  await page.getByRole('button', { name: 'STEAL', exact: true }).click()
  await expect.poll(() => cueCount(page, 'steal')).toBe(1)
  await page.getByRole('button', { name: 'Buka jawaban 2', exact: true }).click()
  await expect(page.getByTestId('team-score-1').getByText('30', { exact: true })).toBeVisible()
  await expect.poll(() => cueCount(page, 'steal-success')).toBe(1)
  expect(await cueCount(page, 'correct')).toBe(1)

  await page.getByRole('button', { name: 'RESET ROUND', exact: true }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'WRONG', exact: true }).click()
  await page.getByRole('button', { name: 'STEAL', exact: true }).click()
  await page.getByRole('button', { name: 'WRONG', exact: true }).click()
  await expect.poll(() => cueCount(page, 'steal-fail')).toBe(1)
  await expect(page.getByTestId('team-score-1').getByText('0', { exact: true })).toBeVisible()

  const questionCount = await cueCount(page, 'question')
  await page.getByRole('button', { name: 'NEXT QUESTION', exact: true }).click()
  await expect.poll(() => cueCount(page, 'question')).toBe(questionCount + 1)
  await page.getByRole('button', { name: 'Matikan suara', exact: true }).click()
  const correctCount = await cueCount(page, 'correct')
  await page.getByRole('button', { name: 'Buka jawaban 1', exact: true }).click()
  await expect(page.getByTestId('team-score-1').getByText('40', { exact: true })).toBeVisible()
  expect(await cueCount(page, 'correct')).toBe(correctCount)
  await page.getByRole('button', { name: 'Aktifkan suara', exact: true }).click()
  await page.getByText('Koreksi skor, kelompok & navigasi', { exact: true }).click()
  await page.getByRole('button', { name: 'END GAME', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ENGLISH CHAMPION!', exact: true })).toBeVisible()
  await expect.poll(() => cueCount(page, 'winner')).toBe(1)
  await page.getByRole('button', { name: 'Kembali', exact: true }).click()
  await page.getByRole('button', { name: 'CONTINUE GAME', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ENGLISH CHAMPION!', exact: true })).toBeVisible()
  expect(await cueCount(page, 'winner')).toBe(1)
})

test('English countdown and timeout never invent a wrong answer or repeat after expiry', async ({ page }) => {
  await page.goto('/?mode=english')
  await configureTimer(page, 10)
  await logSuccessfulCues(page)
  await startEnglishGame(page)
  await expect(page.getByText('Waktu habis! Tekan timer untuk melanjutkan.', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => cueCount(page, 'timeout')).toBe(1)
  expect(await cueCount(page, 'countdown')).toBe(5)
  expect(await cueCount(page, 'wrong')).toBe(0)
  await page.waitForTimeout(1200)
  expect(await cueCount(page, 'timeout')).toBe(1)
  expect(await cueCount(page, 'countdown')).toBe(5)
  for (let i = 0; i < 5; i++) await expect(page.getByTestId(`team-score-${i}`).getByText('0', { exact: true })).toBeVisible()
})

test('Escape preserves unsaved game settings when closing the nested sound dialog', async ({ page }) => {
  await page.goto('/?mode=english')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const gameSettings = page.locator('dialog.modal[open]')
  await gameSettings.getByRole('combobox', { name: 'Timer diskusi', exact: true }).selectOption('0')
  const trigger = gameSettings.getByRole('button', { name: 'Pengaturan Suara', exact: true })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })).toHaveCount(0)
  await expect(gameSettings).toBeVisible()
  await expect(gameSettings.getByRole('combobox', { name: 'Timer diskusi', exact: true })).toHaveValue('0')
  await expect(trigger).toBeFocused()
})

test('a saved legacy mute is respected before interaction on every entry point', async ({ page }) => {
  await observeRealAudio(page)
  await page.goto('/?mode=english')
  await startEnglishGame(page)
  await page.evaluate(() => {
    const legacy = JSON.parse(localStorage.getItem('family100.session.v1')!)
    legacy.settings.sound = false
    legacy.game.settings.sound = false
    localStorage.setItem('family100.session.v1', JSON.stringify(legacy))
    localStorage.removeItem('family100.audio.v1')
  })
  for (const path of ['/', '/game-center/', '/?mode=english']) {
    await page.goto(path)
    expect(await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.getSettings().enabled)).toBe(false)
    expect((await audioStats(page)).contexts).toBe(0)
    await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
    expect((await audioStats(page)).contexts).toBe(0)
  }
  await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.setSettings({ enabled: true }))
  await page.goto('/')
  expect(await page.evaluate(() => (window as unknown as AudioWindow).family100Audio.getSettings().enabled)).toBe(true)
})
