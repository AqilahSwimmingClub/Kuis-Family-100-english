import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { QuestionBankSchema, QuestionSchema, type Question } from '../game/schemas'
import { download } from '../game/storage'
import { Back, Modal } from './Shared'
import { CHAPTERS } from '../data/constants'
export function QuestionBank({ bank, onChange, onBack }: { bank: Question[]; onChange: (bank: Question[]) => void; onBack: () => void }) {
  const [editing, setEditing] = useState<Question | null>(null)
  const [originalId, setOriginalId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const edit = (q?: Question) => { setError(''); setOriginalId(q?.id ?? null); setEditing(q ? structuredClone(q) : { id: `custom-${Date.now()}`, chapter: 1, en: '', idn: '', answers: [40, 30, 20, 10].map(points => ({ text: '', points })), explanation: '', competency: '' }) }
  async function importBank(file?: File) {
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('Maksimal 2 MB.')
      const bank = QuestionBankSchema.parse(JSON.parse(await file.text()))
      if (confirm(`Ganti bank dengan ${bank.length} soal? Game aktif tetap menggunakan salinannya.`)) onChange(bank)
      setError('')
    } catch { setError('Bank tidak valid. Periksa ID unik, 4–6 jawaban dan total 100 poin. Maksimal 2 MB.') }
  }
  const save = () => {
    const result = QuestionSchema.safeParse(editing)
    if (!result.success) { setError(result.error.issues.map(i => i.message).join(' ')); return }
    const bankNext = originalId ? bank.map(q => q.id === originalId ? result.data : q) : [...bank, result.data]
    const valid = QuestionBankSchema.safeParse(bankNext)
    if (!valid.success) { setError('ID soal harus unik; bank maksimal 100 soal.'); return }
    onChange(valid.data); setEditing(null); setError('')
  }
  const move = (id: string, delta: number) => { const next = [...bank], index = next.findIndex(q => q.id === id); if (index + delta < 0 || index + delta >= bank.length) return; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next) }
  return <section className="page"><Back onClick={onBack} /><div className="page-heading"><div><p className="eyebrow">RUANG GURU</p><h1>Question Bank<span className="dot">.</span></h1><p>{bank.length} soal</p></div><div className="actions"><button className="button" onClick={() => download('family100-question-bank.json', JSON.stringify(bank, null, 2))}><Download size={16} /> Ekspor JSON</button><button className="button" onClick={() => input.current?.click()}><Upload size={16} /> Impor JSON</button><button className="button primary" onClick={() => edit()}><Plus size={16} /> Tambah soal</button></div></div><input ref={input} className="sr-only" type="file" accept="application/json,.json" aria-label="Impor bank soal" onChange={e => { void importBank(e.target.files?.[0]); e.target.value = '' }} />
    <p className="muted">Bobot permainan edukasi, bukan hasil survei. Perubahan bank berlaku untuk game baru. Gunakan panah untuk mengatur urutan; game memerlukan jumlah soal kelipatan 5.</p>
    {error && <p role="alert" className="notice error">{error}</p>}<div className="tabs">{['Semua bab', ...CHAPTERS].map((name, i) => <button key={name} className={filter === i ? 'selected' : ''} onClick={() => setFilter(i)}>{name}</button>)}</div>
    <div className="question-list">{bank.filter(q => !filter || q.chapter === filter).map(q => <article className="question-row" key={q.id}><span className="chapter-number">{bank.indexOf(q) + 1}</span><div className="grow"><small>BAB {q.chapter} · {q.competency}</small><h3>{q.en}</h3><p>{q.idn}</p><div className="answer-chips">{q.answers.map(a => <span key={a.text}>{a.text} <b>{a.points}</b></span>)}</div><p className="muted">{q.explanation}</p></div><div className="row-actions"><button aria-label={`Pindah naik ${q.id}`} className="icon-button" disabled={bank.indexOf(q) === 0} onClick={() => move(q.id, -1)}><ArrowUp size={17} /></button><button aria-label={`Pindah turun ${q.id}`} className="icon-button" disabled={bank.indexOf(q) === bank.length - 1} onClick={() => move(q.id, 1)}><ArrowDown size={17} /></button><button aria-label={`Edit soal ${q.id}`} className="icon-button" onClick={() => edit(q)}><Pencil size={17} /></button><button aria-label={`Hapus soal ${q.id}`} className="icon-button danger-text" disabled={bank.length === 1} onClick={() => { if (confirm('Hapus soal ini dari bank?')) onChange(bank.filter(x => x.id !== q.id)) }}><Trash2 size={17} /></button></div></article>)}</div>
    {editing && <Modal title={originalId ? 'Edit soal' : 'Tambah soal'} onClose={() => { setEditing(null); setError('') }}><div className="form-grid"><label>ID unik<input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} /></label><label>Bab<select value={editing.chapter} onChange={e => setEditing({ ...editing, chapter: Number(e.target.value) as 1 | 2 | 3 })}>{CHAPTERS.map((c, i) => <option key={c} value={i + 1}>{i + 1}. {c}</option>)}</select></label></div><label>Pertanyaan Inggris<textarea value={editing.en} onChange={e => setEditing({ ...editing, en: e.target.value })} /></label><label>Terjemahan Indonesia<textarea value={editing.idn} onChange={e => setEditing({ ...editing, idn: e.target.value })} /></label><label>Kompetensi<input value={editing.competency} onChange={e => setEditing({ ...editing, competency: e.target.value })} /></label><label>Penjelasan refleksi<textarea value={editing.explanation} onChange={e => setEditing({ ...editing, explanation: e.target.value })} /></label><h3>Jawaban · total {editing.answers.reduce((n, a) => n + a.points, 0)}/100</h3>{editing.answers.map((a, i) => <div className="answer-edit" key={i}><label>Jawaban {i + 1}<input value={a.text} onChange={e => setEditing({ ...editing, answers: editing.answers.map((x, j) => i === j ? { ...x, text: e.target.value } : x) })} /></label><label>Poin<input type="number" min={1} max={100} value={a.points} onChange={e => setEditing({ ...editing, answers: editing.answers.map((x, j) => i === j ? { ...x, points: Number(e.target.value) } : x) })} /></label><button className="icon-button" aria-label={`Hapus jawaban ${i + 1}`} disabled={editing.answers.length <= 4} onClick={() => setEditing({ ...editing, answers: editing.answers.filter((_, j) => j !== i) })}><Trash2 size={16} /></button></div>)}<button className="button" disabled={editing.answers.length >= 6} onClick={() => setEditing({ ...editing, answers: [...editing.answers, { text: '', points: 1 }] })}>Tambah jawaban</button>{error && <p role="alert" className="notice error">{error}</p>}<div className="modal-actions"><button className="button" onClick={() => setEditing(null)}>Batal</button><button className="button primary" onClick={save}>Simpan soal</button></div></Modal>}
  </section>
}
