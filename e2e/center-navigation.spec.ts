import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

type BankQuestion = { id: string; subject: string; type: string; question: string; answers?: { text: string }[] }
const questions: BankQuestion[] = JSON.parse(Array.from({ length: 8 }, (_, index) =>
  readFileSync(`public/game-center/data/bank-part-${String(index + 1).padStart(2, '0')}.txt`, 'utf8'),
).join('\n')).questions
const subjects = [...new Set(questions.map(question => question.subject))]
const savedKey = 'family100.center.session.v1'
const validSaved = {
  version: 1, ids: questions.slice(0, 5).map(question => question.id), index: 0,
  teams: [{ name: 'Tim Satu', score: 10, opportunities: 1 }, { name: 'Tim Dua', score: 0, opportunities: 0 }],
  round: { revealed: [], wrong: 0, stealUsed: false, points: [] },
  mode: 'Refleksi Pembelajaran', finished: false,
}

for (const subject of subjects) {
  test(`subject link selects only ${subject}`, async ({ page }) => {
    await page.goto(`/game-center/?subject=${encodeURIComponent(subject)}`)
    await expect(page.locator('#subjects input:checked')).toHaveCount(1)
    await expect(page.locator('#subjects input:checked')).toHaveAttribute('data-sub', subject)
    await expect(page.locator('#total')).toContainText(`${questions.filter(question => question.subject === subject).length} soal`)
    await page.locator('#start').click()
    await expect(page.locator('#subjectLabel')).toContainText(subject)
  })
}

test('unknown subject keeps the normal default', async ({ page }) => {
  await page.goto('/game-center/?subject=unknown-subject')
  await expect(page.locator('#subjects input:checked')).toHaveCount(1)
  await expect(page.locator('#subjects input:checked')).toHaveAttribute('data-sub', subjects[0])
})

test('resume URL restores the saved question and scores automatically', async ({ page }) => {
  await page.goto('/game-center/')
  await page.locator('#start').click()
  await page.locator('#manual').click()
  await page.locator('#key [data-award]').first().click()
  const scores = await page.locator('#scores').innerText()
  await page.locator('#next').click()
  const question = await page.locator('#question').innerText()
  await page.goto('/game-center/?resume=1')
  await expect(page.locator('#game')).toBeVisible()
  await expect(page.locator('#round')).toContainText('PERTANYAAN 2 / 30')
  await expect(page.locator('#question')).toHaveText(question)
  await expect(page.locator('#scores')).toHaveText(scores, { useInnerText: true })
})

const unavailableSaves: [string, string | null][] = [
  ['missing save', null], ['invalid JSON', '{broken'], ['empty object', '{}'],
  ['empty questions', '{"version":1,"ids":[],"teams":[]}'],
  ['unknown question', JSON.stringify({ ...validSaved, ids: ['unknown-question'] })],
  ['out of range index', JSON.stringify({ ...validSaved, index: 100 })],
  ['invalid team', JSON.stringify({ ...validSaved, teams: [null, validSaved.teams[1]] })],
  ['missing round', JSON.stringify({ ...validSaved, round: null })],
  ['invalid round arrays', JSON.stringify({ ...validSaved, round: { ...validSaved.round, revealed: null } })],
  ['invalid round points', JSON.stringify({ ...validSaved, round: { ...validSaved.round, points: [{ team: 999, points: 10 }] } })],
]
for (const [name, saved] of unavailableSaves) {
  test(`resume URL safely shows setup for ${name}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(({ key, value }) => {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }, { key: savedKey, value: saved })
    await page.goto('/game-center/?resume=1')
    await expect(page.locator('#setup')).toBeVisible()
    await expect(page.locator('#resume')).toBeDisabled()
    await expect(page.locator('#error')).toBeHidden()
    expect(errors).toEqual([])
  })
}

test('resume URL displays results for a completed saved game', async ({ page }) => {
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)),
    { key: savedKey, saved: { ...validSaved, finished: true } })
  await page.goto('/game-center/?resume=1')
  await expect(page.locator('#done')).toBeVisible()
  await expect(page.locator('#finalScores')).toContainText('Tim Satu — 10')
})

test('bank URL displays real questions and lets teachers reveal an answer', async ({ page }) => {
  await page.goto('/game-center/?view=bank')
  await expect(page.getByRole('heading', { name: 'Bank Soal Kelas 5', exact: true })).toBeVisible()
  await expect(page.locator('#bankCount')).toContainText('1091')
  const card = page.locator('.bank-card').first()
  await expect(card.getByRole('heading')).toHaveText(questions[0].question)
  await expect(card).toContainText(questions[0].id)
  await expect(card.locator('details')).not.toHaveAttribute('open', '')
  await card.getByText('Lihat jawaban dan pembahasan', { exact: true }).click()
  await expect(card.locator('details')).toContainText(questions[0].answers![0].text)
  await page.getByRole('button', { name: 'Ke pengaturan permainan', exact: true }).click()
  await expect(page.locator('#setup')).toBeVisible()
  await page.locator('#start').click()
  await expect(page.locator('#game')).toBeVisible()
})

test('bank search and subject/type filters browse the source questions', async ({ page }) => {
  await page.goto('/game-center/?view=bank')
  await page.getByRole('combobox', { name: 'Mata pelajaran', exact: true }).selectOption('Matematika')
  await page.getByRole('combobox', { name: 'Jenis soal', exact: true }).selectOption('short_answer')
  const filtered = questions.filter(question => question.subject === 'Matematika' && question.type === 'short_answer')
  await expect(page.locator('#bankCount')).toContainText(`${filtered.length} dari 1091`)
  await expect(page.locator('.bank-card').first().getByRole('heading')).toHaveText(filtered[0].question)
  await page.getByLabel('Cari soal', { exact: true }).fill(filtered[0].id)
  await expect(page.locator('.bank-card')).toHaveCount(1)
  await expect(page.locator('.bank-card').getByRole('heading')).toHaveText(filtered[0].question)
  await page.getByLabel('Cari soal', { exact: true }).fill('soal-yang-tidak-ada-12345')
  await expect(page.locator('#bankCount')).toContainText('0 dari 1091')
  await expect(page.locator('#bankResults')).toContainText('Tidak ada soal yang cocok')
})

test('bank pagination reaches additional questions', async ({ page }) => {
  await page.goto('/game-center/?view=bank')
  await expect(page.locator('.bank-card')).toHaveCount(25)
  await expect(page.getByRole('button', { name: 'Halaman sebelumnya', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Halaman berikutnya', exact: true }).click()
  await expect(page.locator('.bank-card').first().getByRole('heading')).toHaveText(questions[25].question)
  await page.getByRole('button', { name: 'Halaman sebelumnya', exact: true }).click()
  await expect(page.locator('.bank-card').first().getByRole('heading')).toHaveText(questions[0].question)
})

test('center header links to the homepage and retained English game', async ({ page }) => {
  await page.goto('/game-center/')
  await expect(page.getByRole('link', { name: 'Beranda', exact: true })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'English Challenge', exact: true })).toHaveAttribute('href', '/?mode=english')
})
