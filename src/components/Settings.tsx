import type { Settings as SettingsType, Team } from '../game/schemas'
import { } from './Shared'
import { TEAM_COLORS } from '../data/constants'
export function TeamEditor({ teams, onChange }: { teams: Team[]; onChange: (teams: Team[]) => void }) {
  return <div className="team-editor">{teams.map((team, i) => <div className="team-edit" key={i} style={{ borderColor: TEAM_COLORS[i] }}><span style={{ color: TEAM_COLORS[i] }}>KELOMPOK {i + 1}</span><label>Nama tim<input maxLength={40} value={team.name} onChange={e => onChange(teams.map((t, j) => j === i ? { ...t, name: e.target.value } : t))} /></label><label>Anggota<select value={team.members} onChange={e => onChange(teams.map((t, j) => j === i ? { ...t, members: Number(e.target.value) } : t))}><option value={6}>6 siswa</option><option value={7}>7 siswa</option></select></label></div>)}</div>
}
export function SettingsEditor({ value, onChange }: { value: SettingsType; onChange: (settings: SettingsType) => void }) {
  return <div className="settings-grid"><label className="setting">Timer diskusi<select value={value.timer} onChange={e => onChange({ ...value, timer: Number(e.target.value) as SettingsType['timer'] })}>{[0, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n ? `${n} detik` : 'Tanpa batas waktu'}</option>)}</select></label>{([['steal', 'Kesempatan STEAL', 'Satu kesempatan bagi tim lain setelah tiga kesalahan.'], ['translation', 'Terjemahan Indonesia', 'Tampilkan bantuan bahasa di bawah pertanyaan.']] as const).map(([key, label, desc]) => <label className="setting toggle" key={key}><div><strong>{label}</strong><small>{desc}</small></div><input type="checkbox" checked={value[key]} onChange={e => onChange({ ...value, [key]: e.target.checked })} /></label>)}</div>
}
