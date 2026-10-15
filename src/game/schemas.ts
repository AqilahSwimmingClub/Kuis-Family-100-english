import { z } from 'zod'
const text = z.string().trim().min(1).max(500)
export const QuestionSchema = z.object({
  id: z.string().trim().min(1).max(80), chapter: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  en: text, idn: text, answers: z.array(z.object({ text, points: z.number().int().min(1).max(100) })).min(4).max(6),
  explanation: text, competency: text,
}).superRefine((q, ctx) => {
  if (q.answers.reduce((n, a) => n + a.points, 0) !== 100) ctx.addIssue({ code: 'custom', message: 'Total poin harus 100.' })
  if (new Set(q.answers.map(a => a.text.toLowerCase())).size !== q.answers.length) ctx.addIssue({ code: 'custom', message: 'Jawaban tidak boleh duplikat.' })
})
export const QuestionBankSchema = z.array(QuestionSchema).min(1).max(100).superRefine((qs, ctx) => {
  if (new Set(qs.map(q => q.id)).size !== qs.length) ctx.addIssue({ code: 'custom', message: 'ID soal harus unik.' })
})
export const SettingsSchema = z.object({ steal: z.boolean(), timer: z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]), sound: z.boolean(), translation: z.boolean() })
export const TeamSchema = z.object({ name: z.string().trim().min(1).max(40), members: z.number().int().min(6).max(7) })
const teamIndex = z.number().int().min(0).max(4)
export const RoundSchema = z.object({
  mainTeam: teamIndex, recipient: teamIndex, revealed: z.array(z.number().int().min(0).max(5)).max(6),
  credits: z.array(z.object({ answer: z.number().int().min(0).max(5), team: teamIndex })).max(6),
  wrong: z.number().int().min(0).max(3), phase: z.enum(['main', 'waiting', 'steal', 'closed']),
  stealTeam: teamIndex.nullable(), remaining: z.number().int().min(0).max(30), visited: z.boolean(),
})
const CoreShape = {
  teams: z.array(TeamSchema).length(5), settings: SettingsSchema,
  rounds: z.array(RoundSchema).min(1).max(100), current: z.number().int().min(0).max(99),
  adjustments: z.array(z.number().int().min(-100000).max(100000)).length(5), paused: z.boolean(), finished: z.boolean(),
}
const HistorySchema = z.object(CoreShape)
const BaseGameSchema = z.object({ questions: QuestionBankSchema, ...CoreShape }).superRefine((g, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: 'custom', message })
  if (g.questions.length % 5 !== 0) bad('Jumlah soal permainan harus kelipatan lima.')
  if (g.current >= g.questions.length || g.rounds.length !== g.questions.length) bad('Ronde tidak sesuai bank soal.')
  g.rounds.forEach((r, i) => {
    const q = g.questions[i]
    if (!q) return
    if (r.mainTeam !== i % 5) bad('Distribusi giliran tidak valid.')
    if (new Set(r.revealed).size !== r.revealed.length || r.revealed.some(a => a >= q.answers.length)) bad('Jawaban terbuka tidak valid.')
    if (new Set(r.credits.map(c => c.answer)).size !== r.credits.length || r.credits.some(c => c.answer >= q.answers.length || !r.revealed.includes(c.answer))) bad('Kredit jawaban tidak valid.')
    if (r.stealTeam === r.mainTeam || (r.phase === 'steal' && (r.stealTeam === null || r.wrong !== 3))) bad('Tim steal tidak valid.')
    if ((r.phase === 'main' && r.wrong >= 3) || (r.phase === 'waiting' && (r.wrong !== 3 || !g.settings.steal))) bad('Status kesempatan tidak valid.')
    if (r.remaining > g.settings.timer) bad('Waktu tidak valid.')
  })
})
export const GameSchema = BaseGameSchema.extend({ history: z.array(HistorySchema).max(100) }).superRefine((game, ctx) => {
  for (const previous of game.history) {
    if (!BaseGameSchema.safeParse({ ...previous, questions: game.questions }).success) ctx.addIssue({ code: 'custom', message: 'Riwayat undo tidak valid.' })
  }
})
export const SnapshotSchema = z.object({ version: z.literal(1), bank: QuestionBankSchema, teams: z.array(TeamSchema).length(5), settings: SettingsSchema, game: GameSchema.nullable() })
export type Question = z.infer<typeof QuestionSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type Team = z.infer<typeof TeamSchema>
export type Round = z.infer<typeof RoundSchema>
export type GameHistory = z.infer<typeof HistorySchema>
export type Game = z.infer<typeof GameSchema>
export type Snapshot = z.infer<typeof SnapshotSchema>
export const DEFAULT_SETTINGS: Settings = { steal: true, timer: 20, sound: true, translation: true }
export const DEFAULT_TEAMS: Team[] = Array.from({ length: 5 }, (_, i) => ({ name: `TEAM ${i + 1}`, members: i < 2 ? 7 : 6 }))
