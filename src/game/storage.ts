import { QUESTIONS } from '../data/questions'
import { DEFAULT_SETTINGS, DEFAULT_TEAMS, SnapshotSchema, type Game, type Snapshot } from './schemas'
import { rankings } from './engine'
export const STORAGE_KEY = 'family100.session.v1'
const BACKUP_KEY = `${STORAGE_KEY}.backup`
export function freshSession(): Snapshot {
  return { version: 1, bank: structuredClone(QUESTIONS), teams: structuredClone(DEFAULT_TEAMS), settings: { ...DEFAULT_SETTINGS }, game: null }
}
export function parseImport(raw: string): Snapshot {
  if (raw.length > 2_000_000) throw new Error('File melebihi batas 2 MB.')
  return SnapshotSchema.parse(JSON.parse(raw))
}
export function loadSession(): { session: Snapshot; message: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { session: freshSession(), message: '' }
    try { return { session: parseImport(raw), message: '' } }
    catch {
      const backup = localStorage.getItem(BACKUP_KEY)
      if (backup) return { session: parseImport(backup), message: 'Data utama tidak valid. Permainan dipulihkan dari cadangan terakhir.' }
      return { session: freshSession(), message: 'Data tersimpan tidak valid. Bank bawaan dipulihkan; impor cadangan Anda jika tersedia.' }
    }
  } catch { return { session: freshSession(), message: 'Penyimpanan tidak dapat dibaca. Gunakan ekspor JSON untuk menyimpan progres.' } }
}
export function saveSession(session: Snapshot): boolean {
  try {
    const raw = JSON.stringify(SnapshotSchema.parse(session))
    const previous = localStorage.getItem(STORAGE_KEY)
    if (previous) { try { parseImport(previous); localStorage.setItem(BACKUP_KEY, previous) } catch { /* Keep last valid backup. */ } }
    localStorage.setItem(STORAGE_KEY, raw)
    return true
  } catch { return false }
}
export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function csvResults(game: Game) {
  const escape = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`
  return '\uFEFF' + [['Peringkat', 'Kelompok', 'Skor', 'Ronde dimainkan'], ...rankings(game).map(t => [t.rank, t.name, t.score, t.rounds])].map(row => row.map(escape).join(',')).join('\r\n')
}
