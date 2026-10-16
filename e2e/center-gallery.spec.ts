import { expect, test, type Page } from '@playwright/test'

const effects = [
  ['intro', 'Intro aplikasi'], ['opening', 'Mulai permainan'], ['question', 'Soal berikutnya'],
  ['correct', 'Jawaban benar'], ['wrong', 'Jawaban salah'], ['reveal', 'Buka jawaban'],
  ['score', 'Tambah poin'], ['celebration', 'Bonus / poin tinggi'], ['steal', 'Final Steal dimulai'],
  ['steal-success', 'Final Steal berhasil'], ['steal-fail', 'Final Steal gagal'],
  ['countdown', 'Countdown 5 detik'], ['timeout', 'Waktu habis'], ['turn', 'Pergantian giliran'],
  ['discussion', 'Pembahasan'], ['winner', 'Pengumuman pemenang'], ['click', 'Tombol biasa'],
] as const

type SourceRecord = { context: BaseAudioContext; stopAt: number }
type PreviewCall = { id: string; played?: boolean; previousStopped?: boolean }
type GalleryWindow = Window & {
  family100Audio: { preview: (id: string) => Promise<boolean> }
  __galleryProbe: { peak: number; sources: SourceRecord[]; calls: PreviewCall[]; finishResume?: () => Promise<void> }
}

// Observe native Web Audio output and cancellation while delegating all synthesis
// and preview behavior to the application's actual shared engine.
async function observeGalleryAudio(page: Page) {
  await page.addInitScript(() => {
    const observed = window as unknown as GalleryWindow
    const probe: GalleryWindow['__galleryProbe'] = { peak: 0, sources: [], calls: [] }
    observed.__galleryProbe = probe
    const nativeConnect = AudioNode.prototype.connect
    const analysers = new Set<AnalyserNode>()
    const byContext = new WeakMap<BaseAudioContext, AnalyserNode>()
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] === this.context.destination) {
        let analyser = byContext.get(this.context)
        if (!analyser) {
          analyser = this.context.createAnalyser()
          analyser.fftSize = 2048
          byContext.set(this.context, analyser)
          analysers.add(analyser)
          Reflect.apply(nativeConnect, analyser, [this.context.destination])
        }
        Reflect.apply(nativeConnect, this, [analyser, args[1] ?? 0])
        return args[0]
      }
      return Reflect.apply(nativeConnect, this, args)
    } as AudioNode['connect']
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext
        const observeSource = <T extends AudioScheduledSourceNode>(source: T): T => {
          const record = { context, stopAt: Infinity }
          probe.sources.push(record)
          const stop = source.stop
          source.stop = function (when = 0) { record.stopAt = when; return stop.call(this, when) }
          return source
        }
        const oscillator = context.createOscillator.bind(context)
        const buffer = context.createBufferSource.bind(context)
        context.createOscillator = () => observeSource(oscillator())
        context.createBufferSource = () => observeSource(buffer())
        return context
      },
    })
    const samples = new Float32Array(2048)
    const sample = () => {
      for (const analyser of analysers) {
        analyser.getFloatTimeDomainData(samples)
        for (const value of samples) probe.peak = Math.max(probe.peak, Math.abs(value))
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

async function openGallery(page: Page) {
  await observeGalleryAudio(page)
  await page.goto('/game-center/')
  await page.evaluate(() => {
    const observed = window as unknown as GalleryWindow
    const preview = observed.family100Audio.preview.bind(observed.family100Audio)
    observed.family100Audio.preview = async id => {
      const previous = observed.__galleryProbe.sources.slice()
      const call: PreviewCall = { id }
      observed.__galleryProbe.calls.push(call)
      const played = await preview(id)
      call.played = played
      call.previousStopped = previous.every(source => source.stopAt <= source.context.currentTime + .06)
      return played
    }
  })
  await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })
  await expect(dialog.getByRole('heading', { name: 'Galeri Efek Suara', exact: true })).toBeVisible()
  return dialog
}

test('Game Center gallery previews all 17 named effects through real audio and stops the preceding preview', async ({ page }) => {
  const dialog = await openGallery(page)
  await expect(dialog.locator('[data-audio-preview]')).toHaveCount(17)
  for (const [id, label] of effects) {
    const button = dialog.getByRole('button', { name: `Putar ${label}`, exact: true })
    await expect(button).toHaveAttribute('data-audio-preview', id)
    await button.scrollIntoViewIfNeeded()
    const size = await button.boundingBox()
    expect(size!.height).toBeGreaterThanOrEqual(44)
    expect(size!.width).toBeGreaterThanOrEqual(44)
    await page.evaluate(() => { (window as unknown as GalleryWindow).__galleryProbe.peak = 0 })
    await button.click()
    await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.calls.at(-1)))
      .toEqual({ id, played: true, previousStopped: true })
    await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.peak)).toBeGreaterThan(.0001)
    expect(await page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.peak)).toBeLessThan(1)
    await expect(dialog.locator('#audioPreviewStatus')).toContainText(label)
  }
  expect(await page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.calls.map(call => call.id)))
    .toEqual(effects.map(([id]) => id))
  expect(await page.evaluate(() => localStorage.getItem('family100.center.session.v1'))).toBeNull()
})

test('Game Center gallery respects mute, zero volume and Normal profile without losing the existing controls', async ({ page }) => {
  const dialog = await openGallery(page)
  const buttons = dialog.locator('[data-audio-preview]')
  await dialog.getByLabel('Suara aktif', { exact: true }).uncheck()
  for (const button of await buttons.all()) await expect(button).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tes Suara', exact: true })).toBeDisabled()
  await dialog.getByLabel('Suara aktif', { exact: true }).check()
  await dialog.getByLabel('Volume', { exact: true }).press('Home')
  for (const button of await buttons.all()) await expect(button).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Tes Suara', exact: true })).toBeDisabled()
  await dialog.getByLabel('Volume', { exact: true }).press('End')
  await dialog.getByLabel('Profil suara', { exact: true }).selectOption('normal')
  await dialog.getByRole('button', { name: 'Putar Jawaban benar', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.calls.at(-1)?.played)).toBe(true)
  await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
  await expect(dialog.getByLabel('Profil suara', { exact: true })).toHaveValue('normal')
  await expect(dialog.getByLabel('Volume', { exact: true })).toHaveValue('100')
  await expect(dialog.getByRole('button', { name: 'Tes Suara', exact: true })).toBeEnabled()
})

test('closing Game Center settings cancels a preview pending native AudioContext recovery', async ({ page }) => {
  const dialog = await openGallery(page)
  await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.sources.length)).toBeGreaterThan(0)
  for (const close of ['button', 'Escape']) {
    const sourceCount = await page.evaluate(async () => {
      const probe = (window as unknown as GalleryWindow).__galleryProbe
      const context = probe.sources[0].context as AudioContext
      await context.suspend()
      delete probe.finishResume
      const resume = context.resume.bind(context)
      context.resume = () => new Promise<void>(resolve => {
        probe.finishResume = async () => { context.resume = resume; await resume(); resolve() }
      })
      return probe.sources.length
    })
    await dialog.getByRole('button', { name: 'Putar Pengumuman pemenang', exact: true }).click()
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as GalleryWindow).__galleryProbe.finishResume)).toBe('function')
    if (close === 'button') await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()
    else await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await page.evaluate(async () => { await (window as unknown as GalleryWindow).__galleryProbe.finishResume!() })
    await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.calls.at(-1)?.played)).toBe(false)
    expect(await page.evaluate(() => (window as unknown as GalleryWindow).__galleryProbe.sources.length)).toBe(sourceCount)
    await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
    await expect(dialog.locator('#audioPreviewStatus')).toBeEmpty()
  }
})

test('Game Center gallery fits tablet and classroom display viewports with reachable controls', async ({ page }) => {
  const dialog = await openGallery(page)
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }]) {
    await page.setViewportSize(viewport)
    await dialog.getByRole('button', { name: 'Putar Tombol biasa', exact: true }).scrollIntoViewIfNeeded()
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.height).toBeLessThanOrEqual(viewport.height)
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await expect(dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true })).toBeVisible()
  }
})
