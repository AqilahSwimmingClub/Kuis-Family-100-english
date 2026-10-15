import { beforeEach, expect, it } from 'vitest'
import { loadSession, saveSession, freshSession, parseImport, csvResults, STORAGE_KEY } from './storage'
import { createGame, gameReducer, scores } from './engine'
beforeEach(() => localStorage.clear())
it('persists a scored game and restores it after refresh', () => {
  const session = freshSession()
  session.game = gameReducer(createGame(session.bank), { type: 'reveal', answer: 0 })
  expect(saveSession(session)).toBe(true)
  expect(loadSession().session.game?.rounds[0].credits).toEqual([{ answer: 0, team: 0 }])
})
it('recovers a corrupt primary from a validated backup', () => {
  const session = freshSession()
  saveSession(session); saveSession(session)
  localStorage.setItem(STORAGE_KEY, '{broken')
  const restored = loadSession()
  expect(restored.session.bank).toHaveLength(30)
  expect(restored.message).toMatch(/cadangan/)
})
it('rejects malformed imports without modifying saved progress', () => {
  saveSession(freshSession())
  const before = localStorage.getItem(STORAGE_KEY)
  expect(() => parseImport('{"version":2}')).toThrow()
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})
it('neutralizes spreadsheet formulas and escapes quotes in CSV', () => {
  const session = freshSession()
  session.teams[0].name = '=SUM(1,2)'
  const game = createGame(session.bank, session.settings, session.teams)
  expect(csvResults(game)).toContain('"\'=SUM(1,2)"')
})
it('a complete game and subsequent corrections remain exportable and reloadable', () => {
  const session = freshSession()
  let game = createGame(session.bank, { ...session.settings, timer: 0 })
  for (let i = 0; i < 30; i++) {
    game = gameReducer(game, { type: 'navigate', index: i })
    for (let answer = 0; answer < 4; answer++) game = gameReducer(game, { type: 'reveal', answer })
  }
  for (let i = 0; i < 30; i++) game = gameReducer(game, { type: 'pause' })
  expect(scores(game)).toEqual([600, 600, 600, 600, 600])
  session.game = game
  session.settings = game.settings
  const exported = JSON.stringify(session)
  expect(exported.length).toBeLessThan(2_000_000)
  expect(parseImport(exported).game?.rounds[29].credits).toHaveLength(4)
  expect(saveSession(session)).toBe(true)
  expect(loadSession().session.game?.rounds[29].credits).toHaveLength(4)
})
