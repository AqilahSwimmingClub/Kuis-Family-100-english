import { DEFAULT_SETTINGS, DEFAULT_TEAMS, GameSchema, type GameHistory, type Game, type Question, type Round, type Settings, type Team } from './schemas'
export type Action =
  | { type: 'reveal'; answer: number } | { type: 'wrong' } | { type: 'steal'; team: number }
  | { type: 'navigate'; index: number } | { type: 'recipient'; team: number }
  | { type: 'adjust'; team: number; delta: number } | { type: 'teams'; teams: Team[] }
  | { type: 'settings'; settings: Settings }
  | { type: 'undo' | 'showAll' | 'resetRound' | 'pause' | 'tick' | 'restartTimer' | 'end' }
function newRound(index: number, timer: number): Round {
  return { mainTeam: index % 5, recipient: index % 5, revealed: [], credits: [], wrong: 0, phase: 'main', stealTeam: null, remaining: timer, visited: index === 0 }
}
export function createGame(questions: Question[], settings = DEFAULT_SETTINGS, teams = DEFAULT_TEAMS): Game {
  return GameSchema.parse({ questions: structuredClone(questions), settings: { ...settings }, teams: structuredClone(teams), rounds: questions.map((_, i) => newRound(i, settings.timer)), current: 0, adjustments: [0, 0, 0, 0, 0], paused: false, finished: false, history: [] })
}
function base(game: Game): GameHistory {
  const { history, questions, ...rest } = game
  void history; void questions
  return structuredClone(rest)
}
export function gameReducer(game: Game, action: Action): Game {
  if (action.type === 'undo') {
    const previous = game.history.at(-1)
    return previous ? { ...structuredClone(previous), questions: game.questions, history: game.history.slice(0, -1) } : game
  }
  const next = structuredClone(game)
  const r = next.rounds[next.current]
  const q = next.questions[next.current]
  const validTeam = (t: number) => Number.isInteger(t) && t >= 0 && t < 5
  const scoring = !game.paused && !game.finished && (game.settings.timer === 0 || r.remaining > 0)
  switch (action.type) {
    case 'reveal': {
      if (!scoring || (r.phase !== 'main' && r.phase !== 'steal') || !Number.isInteger(action.answer) || !q.answers[action.answer] || r.revealed.includes(action.answer)) return game
      const recipient = r.phase === 'steal' ? r.stealTeam! : r.recipient
      r.revealed.push(action.answer)
      r.credits.push({ answer: action.answer, team: recipient })
      if (r.phase === 'steal' || r.revealed.length === q.answers.length) r.phase = 'closed'
      break
    }
    case 'wrong':
      if (!scoring || (r.phase !== 'main' && r.phase !== 'steal')) return game
      if (r.phase === 'steal') r.phase = 'closed'
      else { r.wrong = Math.min(3, r.wrong + 1); if (r.wrong === 3) r.phase = next.settings.steal ? 'waiting' : 'closed' }
      break
    case 'steal':
      if (game.paused || game.finished || !next.settings.steal || r.phase !== 'waiting' || !validTeam(action.team) || action.team === r.mainTeam) return game
      r.phase = 'steal'; r.stealTeam = action.team; r.remaining = next.settings.timer
      break
    case 'navigate':
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= next.questions.length || next.finished || action.index === next.current) return game
      next.current = action.index; next.rounds[action.index].visited = true; next.paused = false
      break
    case 'recipient':
      if (!validTeam(action.team) || r.phase !== 'main') return game
      r.recipient = action.team; break
    case 'showAll':
      if (game.paused || game.finished) return game
      r.revealed = q.answers.map((_, i) => i); r.phase = 'closed'; break
    case 'resetRound':
      if (game.finished) return game
      next.rounds[next.current] = { ...newRound(next.current, next.settings.timer), visited: true }; next.paused = false; break
    case 'adjust':
      if (!validTeam(action.team) || !Number.isSafeInteger(action.delta) || Math.abs(next.adjustments[action.team] + action.delta) > 100000) return game
      next.adjustments[action.team] += action.delta; break
    case 'teams':
      next.teams = structuredClone(action.teams); break
    case 'settings':
      if (next.settings.timer !== action.settings.timer) {
        for (const round of next.rounds) round.remaining = action.settings.timer
      }
      next.settings = { ...action.settings }
      if (!action.settings.steal && ['waiting', 'steal'].includes(r.phase)) r.phase = 'closed'
      break
    case 'pause':
      if (next.finished) return game
      next.paused = !next.paused; break
    case 'tick':
      if (next.paused || next.finished || next.settings.timer === 0 || r.remaining <= 0 || !['main', 'steal'].includes(r.phase)) return game
      r.remaining -= 1
      return next
    case 'restartTimer':
      if (next.finished || !['main', 'steal'].includes(r.phase)) return game
      r.remaining = next.settings.timer; break
    case 'end': next.finished = true; next.paused = false; break
  }
  next.history = [...game.history, base(game)].slice(-30)
  // Bound undo storage even for large custom banks; question data is immutable and not duplicated.
  while (next.history.length > 1 && JSON.stringify(next.history).length > 300_000) next.history.shift()
  return next
}
export function scores(game: Game): number[] {
  const totals = [...game.adjustments]
  game.rounds.forEach((round, i) => round.credits.forEach(c => { totals[c.team] += game.questions[i].answers[c.answer].points }))
  return totals
}
export function rankings(game: Game) {
  const totals = scores(game)
  const sorted = game.teams.map((t, i) => ({ ...t, index: i, score: totals[i], rounds: game.rounds.filter(r => r.mainTeam === i && r.visited).length })).sort((a, b) => b.score - a.score || a.index - b.index)
  return sorted.map(t => ({ ...t, rank: 1 + sorted.filter(other => other.score > t.score).length }))
}
