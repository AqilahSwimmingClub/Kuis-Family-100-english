import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '../data/questions'
import { createGame, gameReducer, scores, rankings } from './engine'
import { QuestionBankSchema, SnapshotSchema } from './schemas'
const start = () => createGame(QUESTIONS)
describe('question bank', () => {
  it('has 30 unique complete questions, ten per chapter and 100 points each', () => {
    expect(QuestionBankSchema.safeParse(QUESTIONS).success).toBe(true)
    expect(QUESTIONS).toHaveLength(30)
    expect(new Set(QUESTIONS.map(q => q.en)).size).toBe(30)
    for (const chapter of [1, 2, 3]) expect(QUESTIONS.filter(q => q.chapter === chapter)).toHaveLength(10)
    for (const q of QUESTIONS) expect(q.answers.reduce((n, a) => n + a.points, 0)).toBe(100)
  })
})
describe('game engine', () => {
  it('assigns six main rounds to each of five teams', () => {
    const game = start()
    expect([0, 1, 2, 3, 4].map(t => game.rounds.filter(r => r.mainTeam === t).length)).toEqual([6, 6, 6, 6, 6])
  })
  it('awards an answer only once even across navigation', () => {
    let game = gameReducer(start(), { type: 'reveal', answer: 0 })
    game = gameReducer(game, { type: 'reveal', answer: 0 })
    game = gameReducer(game, { type: 'navigate', index: 1 })
    game = gameReducer(game, { type: 'navigate', index: 0 })
    game = gameReducer(game, { type: 'reveal', answer: 0 })
    expect(scores(game)).toEqual([40, 0, 0, 0, 0])
  })
  it('blocks normal answers after three wrong attempts and limits steal to one correct answer', () => {
    let game = gameReducer(start(), { type: 'reveal', answer: 0 })
    for (let i = 0; i < 3; i++) game = gameReducer(game, { type: 'wrong' })
    expect(scores(gameReducer(game, { type: 'reveal', answer: 1 }))).toEqual([40, 0, 0, 0, 0])
    game = gameReducer(game, { type: 'steal', team: 1 })
    game = gameReducer(game, { type: 'reveal', answer: 1 })
    game = gameReducer(game, { type: 'reveal', answer: 2 })
    expect(scores(game)).toEqual([40, 30, 0, 0, 0])
    expect(game.rounds[0].phase).toBe('closed')
  })
  it('wrong steal closes round without removing existing scores', () => {
    let game = gameReducer(start(), { type: 'reveal', answer: 0 })
    for (let i = 0; i < 3; i++) game = gameReducer(game, { type: 'wrong' })
    game = gameReducer(game, { type: 'steal', team: 2 })
    game = gameReducer(game, { type: 'wrong' })
    expect(scores(game)).toEqual([40, 0, 0, 0, 0])
    expect(game.rounds[0].phase).toBe('closed')
  })
  it('rejects early steals, main-team steals and steals when disabled', () => {
    expect(gameReducer(start(), { type: 'steal', team: 1 }).rounds[0].phase).toBe('main')
    let game = start()
    for (let i = 0; i < 3; i++) game = gameReducer(game, { type: 'wrong' })
    expect(gameReducer(game, { type: 'steal', team: 0 }).rounds[0].phase).toBe('waiting')
    let disabled = createGame(QUESTIONS, { steal: false, timer: 20, sound: true, translation: true })
    for (let i = 0; i < 3; i++) disabled = gameReducer(disabled, { type: 'wrong' })
    expect(disabled.rounds[0].phase).toBe('closed')
  })
  it('show all is non-scoring and reset only removes credits from current round', () => {
    let game = gameReducer(start(), { type: 'reveal', answer: 0 })
    game = gameReducer(game, { type: 'navigate', index: 1 })
    game = gameReducer(game, { type: 'reveal', answer: 1 })
    game = gameReducer(game, { type: 'adjust', team: 2, delta: 5 })
    game = gameReducer(game, { type: 'showAll' })
    expect(scores(game)).toEqual([40, 30, 5, 0, 0])
    game = gameReducer(game, { type: 'resetRound' })
    expect(scores(game)).toEqual([40, 0, 5, 0, 0])
    expect(game.rounds[1].revealed).toEqual([])
  })
  it('undo restores the complete previous action including score', () => {
    const before = start()
    const game = gameReducer(gameReducer(before, { type: 'reveal', answer: 0 }), { type: 'undo' })
    expect(scores(game)).toEqual([0, 0, 0, 0, 0])
    expect(game.rounds[0]).toEqual(before.rounds[0])
  })
  it('pause blocks scoring and timer ticks; timer is bounded at zero', () => {
    let game = gameReducer(start(), { type: 'pause' })
    expect(scores(gameReducer(game, { type: 'reveal', answer: 0 }))[0]).toBe(0)
    expect(gameReducer(game, { type: 'tick' }).rounds[0].remaining).toBe(20)
    game = gameReducer(game, { type: 'pause' })
    for (let i = 0; i < 50; i++) game = gameReducer(game, { type: 'tick' })
    expect(game.rounds[0].remaining).toBe(0)
  })
  it('timer expiry requires explicit restart before awarding points', () => {
    let game = start()
    for (let i = 0; i < 20; i++) game = gameReducer(game, { type: 'tick' })
    expect(scores(gameReducer(game, { type: 'reveal', answer: 0 }))[0]).toBe(0)
    game = gameReducer(game, { type: 'restartTimer' })
    expect(scores(gameReducer(game, { type: 'reveal', answer: 0 }))[0]).toBe(40)
  })
  it('uses tied ranks instead of random winners', () => {
    let game = gameReducer(start(), { type: 'adjust', team: 0, delta: 50 })
    game = gameReducer(game, { type: 'adjust', team: 1, delta: 50 })
    expect(rankings(game).map(t => t.rank)).toEqual([1, 1, 3, 3, 3])
  })
  it('accepts valid game snapshots and rejects invalid credit recipients', () => {
    const game = start()
    const snapshot = { version: 1, bank: QUESTIONS, game, settings: game.settings, teams: game.teams }
    expect(SnapshotSchema.safeParse(snapshot).success).toBe(true)
    game.rounds[0].credits = [{ answer: 0, team: 8 }]
    expect(SnapshotSchema.safeParse(snapshot).success).toBe(false)
  })
  it('rejects duplicate answer credits and invalid round counts on import', () => {
    const game = start()
    game.rounds[0].credits = [{ answer: 0, team: 0 }, { answer: 0, team: 0 }]
    expect(SnapshotSchema.safeParse({ version: 1, bank: QUESTIONS, game, settings: game.settings, teams: game.teams }).success).toBe(false)
    game.rounds = []
    expect(SnapshotSchema.safeParse({ version: 1, bank: QUESTIONS, game, settings: game.settings, teams: game.teams }).success).toBe(false)
  })
})
it('toggling sound preserves the remaining timer', () => {
  let game = gameReducer(createGame(QUESTIONS), { type: 'tick' })
  game = gameReducer(game, { type: 'settings', settings: { ...game.settings, sound: false } })
  expect(game.rounds[0].remaining).toBe(19)
})
it('rejects imported main phase with three strikes, including undo history', () => {
  const game = createGame(QUESTIONS)
  const snapshot = { version: 1, bank: QUESTIONS, game, settings: game.settings, teams: game.teams }
  game.rounds[0].wrong = 3
  expect(SnapshotSchema.safeParse(snapshot).success).toBe(false)
  const withHistory = gameReducer(createGame(QUESTIONS), { type: 'reveal', answer: 0 })
  withHistory.history[0].rounds[0].wrong = 3
  expect(SnapshotSchema.safeParse({ ...snapshot, game: withHistory }).success).toBe(false)
})
