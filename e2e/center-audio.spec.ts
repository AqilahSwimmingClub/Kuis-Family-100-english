import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

type Question = { id: string; type: string; answers?: { text: string; points: number }[] }
const questions: Question[] = JSON.parse(Array.from({ length: 8 }, (_, index) =>
  readFileSync(`public/game-center/data/bank-part-${String(index + 1).padStart(2, '0')}.txt`, 'utf8'),
).join('\n')).questions
const question = questions.find(item => item.type === 'family100' && (item.answers?.length ?? 0) >= 3)!
const savedKey = 'family100.center.session.v1'
const saved = {
  version: 1, ids: [question.id, questions.find(item => item.id !== question.id)!.id], index: 0,
  teams: [{ name: 'Tim Satu', score: 0, opportunities: 0 }, { name: 'Tim Dua', score: 0, opportunities: 0 }],
  round: { revealed: [], wrong: 0, stealUsed: false, points: [] },
  mode: 'Refleksi Pembelajaran', finished: false,
}

// Observe the shared API while still delegating every call to the real browser audio engine.
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    type AudioCall = { name: string; id?: string; points?: number; played?: boolean }
    type AudioApi = { play: (name: string, options?: { id?: string; points?: number }) => unknown; stop: () => unknown; test: () => unknown }
    const observed = window as typeof window & {
      family100Audio?: AudioApi; audioCalls: AudioCall[]; audioStops: number; audioTests: boolean[]
    }
    observed.audioCalls = []
    observed.audioStops = 0
    observed.audioTests = []
    let api: AudioApi | undefined
    Object.defineProperty(window, 'family100Audio', {
      configurable: true,
      get: () => api,
      set: (value: AudioApi) => {
        api = value
        const play = value.play.bind(value), stop = value.stop.bind(value), testSound = value.test.bind(value)
        value.play = (name, options) => {
          const call: AudioCall = { name, ...options }
          observed.audioCalls.push(call)
          const result = play(name, options)
          void Promise.resolve(result).then(played => { call.played = played === true })
          return result
        }
        value.stop = () => { observed.audioStops++; return stop() }
        value.test = () => {
          const result = testSound()
          void Promise.resolve(result).then(played => { observed.audioTests.push(played === true) })
          return result
        }
      },
    })
  })
}

async function calls(page: Page) {
  return page.evaluate(() => (window as typeof window & { audioCalls: { name: string; id?: string; points?: number; played?: boolean }[] }).audioCalls)
}

async function resume(page: Page, overrides = {}) {
  await observeAudio(page)
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)) },
    { key: savedKey, value: { ...saved, ...overrides } })
  await page.goto('/game-center/?resume=1')
  await expect(page.locator('#game')).toBeVisible()
}

test('sound settings are accessible, persistent, and mute stops current audio', async ({ page }) => {
  await observeAudio(page)
  await page.goto('/game-center/')
  await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Pengaturan Suara', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Suara aktif', { exact: true })).toBeChecked()
  await expect(dialog.getByLabel('Volume', { exact: true })).toHaveValue('65')
  await expect(dialog.getByLabel('Profil suara', { exact: true })).toHaveValue('game-show')
  await dialog.getByLabel('Volume', { exact: true }).press('Home')
  for (let volume = 0; volume < 32; volume++) await page.keyboard.press('ArrowRight')
  await dialog.getByLabel('Profil suara', { exact: true }).selectOption('normal')
  await dialog.getByLabel('Suara aktif', { exact: true }).uncheck()
  expect(await page.evaluate(() => (window as typeof window & { audioStops: number }).audioStops)).toBeGreaterThan(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('family100.audio.v1')!)))
    .toMatchObject({ enabled: false, volume: 32, profile: 'normal' })
  await page.reload()
  await page.getByRole('button', { name: 'Pengaturan Suara', exact: true }).click()
  await expect(dialog.getByLabel('Suara aktif', { exact: true })).not.toBeChecked()
  await expect(dialog.getByLabel('Volume', { exact: true })).toHaveValue('32')
  await expect(dialog.getByLabel('Profil suara', { exact: true })).toHaveValue('normal')
  await dialog.getByLabel('Suara aktif', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Tes Suara', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as typeof window & { audioTests: boolean[] }).audioTests)).toEqual([true])
  await dialog.getByRole('button', { name: 'Tutup pengaturan suara', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

test('manual reveal and valid awards sound once while mismatched and duplicate answers stay silent', async ({ page }) => {
  await resume(page)
  expect((await calls(page)).filter(call => call.name !== 'click')).toEqual([])
  await page.locator('#guess').fill('jawaban-yang-tidak-cocok')
  await page.locator('#check').click()
  expect((await calls(page)).some(call => ['wrong', 'steal-fail', 'correct'].includes(call.name))).toBe(false)
  await page.locator('#manual').click()
  expect((await calls(page)).filter(call => call.name === 'reveal')).toHaveLength(1)
  await page.locator('#key [data-award="0"]').click()
  await expect(page.locator('#scores .score').first()).toContainText(`${question.answers![0].points}`)
  await expect(page.locator('#scores .score').first()).toHaveClass(/score-up/)
  await page.locator('#guess').fill(question.answers![0].text)
  await page.locator('#check').click()
  const correct = (await calls(page)).filter(call => call.name === 'correct')
  expect(correct).toHaveLength(1)
  expect(correct[0]).toMatchObject({ points: question.answers![0].points, id: expect.any(String), played: true })
  expect((await calls(page)).filter(call => ['score', 'celebration'].includes(call.name))).toHaveLength(0)
})

test('steal cues resolve once without changing later allowed awards or teacher wrong controls', async ({ page }) => {
  await resume(page)
  await page.locator('#steal').click()
  await page.locator('#manual').click()
  await page.locator('#key [data-award="0"]').click()
  await page.locator('#manual').click()
  await page.locator('#key [data-award="1"]').click()
  await page.locator('#wrong').click()
  const names = (await calls(page)).map(call => call.name)
  expect(names.filter(name => name === 'steal')).toHaveLength(1)
  expect(names.filter(name => name === 'steal-success')).toHaveLength(1)
  expect(names.filter(name => name === 'correct')).toHaveLength(1)
  expect(names.filter(name => name === 'wrong')).toHaveLength(1)
  expect(names).not.toContain('steal-fail')
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).teams[0].score, savedKey))
    .toBe(question.answers![0].points + question.answers![1].points)
})

test('teacher-confirmed steal failure flashes and subsequent wrong answers use the ordinary cue', async ({ page }) => {
  await resume(page)
  await page.locator('#steal').click()
  await page.locator('#guess').fill('jawaban-yang-tidak-cocok')
  await page.locator('#check').click()
  expect((await calls(page)).filter(call => call.name === 'steal-fail')).toHaveLength(0)
  await page.locator('#wrong').click()
  await expect(page.locator('#board')).toHaveClass(/wrong-flash/)
  await page.locator('#wrong').click()
  expect((await calls(page)).filter(call => call.name === 'steal-fail')).toHaveLength(1)
  expect((await calls(page)).filter(call => call.name === 'wrong')).toHaveLength(1)
  await page.locator('#teamSelect').selectOption('1')
  await page.locator('#discussion').click()
  expect((await calls(page)).filter(call => call.name === 'turn')).toHaveLength(1)
  expect((await calls(page)).filter(call => call.name === 'discussion')).toHaveLength(1)
})

for (const outcome of ['success', 'failure'] as const) {
  test(`pending steal ${outcome} survives setup and resume, then stays resolved after reload`, async ({ page }) => {
    await resume(page)
    await page.locator('#steal').click()
    await page.locator('#back').click()
    await page.locator('#resume').click()
    if (outcome === 'success') {
      await page.locator('#manual').click()
      await page.locator('#key [data-award="0"]').click()
    } else await page.locator('#wrong').click()
    expect((await calls(page)).filter(call => call.name === `steal-${outcome === 'success' ? 'success' : 'fail'}`)).toHaveLength(1)
    expect((await calls(page)).filter(call => ['correct', 'wrong'].includes(call.name))).toHaveLength(0)

    await page.reload()
    await expect(page.locator('#game')).toBeVisible()
    await page.locator('#manual').click()
    await page.locator(`#key [data-award="${outcome === 'success' ? 1 : 0}"]`).click()
    expect((await calls(page)).filter(call => call.name === 'correct')).toHaveLength(1)
    expect((await calls(page)).filter(call => ['steal-success', 'steal-fail'].includes(call.name))).toHaveLength(0)
  })
}

test('import preserves a pending steal audio outcome from a new backup', async ({ page }) => {
  await observeAudio(page)
  await page.goto('/game-center/')
  await expect(page.locator('#setup')).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await page.locator('#import').setInputFiles({
    name: 'pending-steal.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...saved, round: { ...saved.round, stealUsed: true, audioStealResolved: false } })),
  })
  await expect(page.locator('#game')).toBeVisible()
  await page.locator('#manual').click()
  await page.locator('#key [data-award="0"]').click()
  expect((await calls(page)).filter(call => call.name === 'steal-success')).toHaveLength(1)
  expect((await calls(page)).filter(call => call.name === 'correct')).toHaveLength(0)
})

test('a pending steal survives reload before its first answer', async ({ page }) => {
  await resume(page)
  await page.locator('#steal').click()
  await page.reload()
  await expect(page.locator('#game')).toBeVisible()
  await page.locator('#manual').click()
  await page.locator('#key [data-award="0"]').click()
  expect((await calls(page)).filter(call => call.name === 'steal-success')).toHaveLength(1)
  expect((await calls(page)).filter(call => call.name === 'correct')).toHaveLength(0)
})

test('legacy used steals without audio metadata continue with ordinary award feedback', async ({ page }) => {
  await resume(page, { round: { ...saved.round, stealUsed: true } })
  await page.locator('#manual').click()
  await page.locator('#key [data-award="0"]').click()
  expect((await calls(page)).filter(call => call.name === 'correct')).toHaveLength(1)
  expect((await calls(page)).filter(call => call.name === 'steal-success')).toHaveLength(0)
})

test('question transitions and a new finish sound once, and restoring results stays silent', async ({ page }) => {
  await resume(page)
  await page.locator('#next').click()
  expect((await calls(page)).filter(call => call.name === 'question')).toHaveLength(1)
  await page.locator('#next').click()
  await expect(page.locator('#done')).toBeVisible()
  expect((await calls(page)).filter(call => call.name === 'winner')).toHaveLength(1)
  await expect(page.locator('#confetti i').first()).toBeAttached()
  await page.reload()
  await expect(page.locator('#done')).toBeVisible()
  expect((await calls(page)).filter(call => call.name === 'winner')).toHaveLength(0)
  await expect(page.locator('#confetti i')).toHaveCount(0)
})

test('start plays opening only after interaction and reduced motion skips confetti', async ({ page }) => {
  await observeAudio(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/game-center/')
  expect((await calls(page)).filter(call => call.name !== 'click')).toEqual([])
  await page.locator('#count').selectOption('5')
  await page.locator('#start').click()
  expect((await calls(page)).filter(call => call.name === 'opening')).toHaveLength(1)
  for (let index = 0; index < 5; index++) await page.locator('#next').click()
  await expect(page.locator('#done')).toBeVisible()
  expect((await calls(page)).filter(call => call.name === 'winner')).toHaveLength(1)
  await expect(page.locator('#confetti i')).toHaveCount(0)
})
