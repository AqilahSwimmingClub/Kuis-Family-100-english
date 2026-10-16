import { expect, test, type Page } from '@playwright/test'
import type { AudioEngine } from '../src/game/audio'

const effects = [
  ['intro', 'Intro aplikasi'], ['opening', 'Mulai permainan'], ['question', 'Soal berikutnya'],
  ['correct', 'Jawaban benar'], ['wrong', 'Jawaban salah'], ['reveal', 'Buka jawaban'],
  ['score', 'Tambah poin'], ['celebration', 'Bonus / poin tinggi'], ['steal', 'Final Steal dimulai'],
  ['steal-success', 'Final Steal berhasil'], ['steal-fail', 'Final Steal gagal'],
  ['countdown', 'Countdown 5 detik'], ['timeout', 'Waktu habis'], ['turn', 'Pergantian giliran'],
  ['discussion', 'Pembahasan'], ['winner', 'Pengumuman pemenang'], ['click', 'Tombol biasa'],
]

type GalleryProbe = {
  contexts: AudioContext[]
  peak: number
  started: number
  previews: { id: string; played: boolean }[]
}
type GalleryWindow = Window & { galleryProbe: GalleryProbe; family100Audio: AudioEngine }

// Observe native sources and PCM at the actual output, without substituting audio.
async function observeGalleryAudio(page: Page) {
  await page.addInitScript(() => {
    const observed = window as unknown as GalleryWindow
    const probe: GalleryProbe = { contexts: [], peak: 0, started: 0, previews: [] }
    observed.galleryProbe = probe
    const connect = AudioNode.prototype.connect
    const analysers: AnalyserNode[] = []
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] === this.context.destination) {
        const analyser = this.context.createAnalyser()
        analyser.fftSize = 1024
        analysers.push(analyser)
        Reflect.apply(connect, analyser, [this.context.destination])
        Reflect.apply(connect, this, [analyser, args[1] ?? 0])
        return args[0]
      }
      return Reflect.apply(connect, this, args)
    } as AudioNode['connect']
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext
        probe.contexts.push(context)
        const observe = <T extends AudioScheduledSourceNode>(node: T) => {
          const start = node.start
          node.start = function (this: AudioScheduledSourceNode, ...values: unknown[]) {
            probe.started++
            return Reflect.apply(start, this, values)
          }
          return node
        }
        const oscillator = context.createOscillator.bind(context)
        const buffer = context.createBufferSource.bind(context)
        context.createOscillator = () => observe(oscillator())
        context.createBufferSource = () => observe(buffer())
        return context
      },
    })
    const samples = new Float32Array(1024)
    window.setInterval(() => {
      for (const analyser of analysers) {
        analyser.getFloatTimeDomainData(samples)
        for (const value of samples) probe.peak = Math.max(probe.peak, Math.abs(value))
      }
    }, 4)
  })
}

for (const route of ['/', '/?mode=english']) {
  test(`all 17 named gallery buttons emit their own real audio on ${route}`, async ({ page }) => {
    test.setTimeout(60000)
    await observeGalleryAudio(page)
    await page.goto(route)
    expect(await page.evaluate(() => (window as unknown as GalleryWindow).galleryProbe.contexts.length)).toBe(0)
    await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })
    await expect(dialog.getByRole('heading', { name: 'Galeri Efek Suara' })).toBeVisible()
    await expect(dialog.locator('[data-audio-preview]')).toHaveCount(17)
    await expect(dialog.getByRole('button', { name: 'Tes Suara', exact: true })).toBeEnabled()
    await page.evaluate(() => {
      const observed = window as unknown as GalleryWindow
      const engine = observed.family100Audio
      const preview = engine.preview.bind(engine)
      engine.preview = async id => {
        const played = await preview(id)
        observed.galleryProbe.previews.push({ id, played })
        return played
      }
    })
    for (const profile of ['normal', 'game-show']) {
      await dialog.getByLabel('Profil suara', { exact: true }).selectOption(profile)
      for (const [id, label] of effects) {
        await page.evaluate(() => (window as unknown as GalleryWindow).family100Audio.stop())
        await page.waitForTimeout(100)
        await page.evaluate(() => {
          const probe = (window as unknown as GalleryWindow).galleryProbe
          probe.peak = 0
          probe.started = 0
        })
        const button = dialog.getByRole('button', { name: `Putar ${label}`, exact: true })
        await expect(button).toHaveAttribute('data-audio-preview', id)
        await button.click()
        await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).galleryProbe.previews.at(-1))).toEqual({ id, played: true })
        await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).galleryProbe.peak), { message: `${profile}: ${label} produces PCM` }).toBeGreaterThan(.0001)
        const probe = await page.evaluate(() => {
          const value = (window as unknown as GalleryWindow).galleryProbe
          return { peak: value.peak, started: value.started, contexts: value.contexts.length }
        })
        expect(probe.started).toBeGreaterThan(0)
        expect(probe.contexts).toBe(1)
        expect(probe.peak).toBeLessThan(1)
        const box = await button.boundingBox()
        expect(box!.width).toBeGreaterThanOrEqual(44)
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
    }
    expect(await page.evaluate(() => (window as unknown as GalleryWindow).galleryProbe.previews.length)).toBe(34)
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await dialog.getByRole('checkbox', { name: 'Efek suara', exact: true }).uncheck()
    for (const button of await dialog.locator('[data-audio-preview]').all()) await expect(button).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Tes Suara', exact: true })).toBeDisabled()
    await dialog.getByRole('checkbox', { name: 'Efek suara', exact: true }).check()
    await dialog.getByRole('slider', { name: 'Volume utama', exact: true }).fill('0')
    for (const button of await dialog.locator('[data-audio-preview]').all()) await expect(button).toBeDisabled()
    await dialog.getByRole('slider', { name: 'Volume utama', exact: true }).fill('65')
    await dialog.getByRole('button', { name: 'Putar Jawaban benar', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => (window as unknown as GalleryWindow).galleryProbe.previews.at(-1))).toEqual({ id: 'correct', played: true })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })
}

test('sound gallery fits tablet and classroom display viewports', async ({ page }) => {
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })
    await expect(dialog.locator('[data-audio-preview]')).toHaveCount(17)
    const bounds = await dialog.boundingBox()
    expect(Math.abs(bounds!.x - (viewport.width - bounds!.width) / 2)).toBeLessThan(1)
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height)
    const button = dialog.getByRole('button', { name: 'Putar Tombol biasa', exact: true })
    await button.scrollIntoViewIfNeeded()
    await expect(button).toBeInViewport()
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.keyboard.press('Escape')
  }
})
