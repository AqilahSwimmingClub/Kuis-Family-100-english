import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { ArrowRight, BookOpen, CheckCircle2, ChevronRight, Download, HelpCircle, Home, Play, Settings2, Sparkles, Trophy, Upload, Users, X } from 'lucide-react'
import { createGame, gameReducer, type Action } from './game/engine'
import { loadSession, saveSession, parseImport, download } from './game/storage'
import { playSound, type Sound } from './game/audio'
import type { Settings, Snapshot, Team } from './game/schemas'
import { GameBoard } from './components/GameBoard'
import { QuestionBank } from './components/QuestionBank'
import { Results } from './components/Results'
import { Footer, Logo, Modal } from './components/Shared'
import { CHAPTERS, TEAM_COLORS } from './data/constants'
import { SettingsEditor, TeamEditor } from './components/Settings'

type View = 'home' | 'setup' | 'game' | 'bank' | 'results'
export default function App() {
  const [loaded] = useState(loadSession)
  const [session, setSession] = useState<Snapshot>(loaded.session)
  const [view, setView] = useState<View>('home')
  const [notice, setNotice] = useState(loaded.message)
  const [saved, setSaved] = useState(true)
  const [help, setHelp] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>(session.settings)
  const [setupTeams, setSetupTeams] = useState<Team[]>(session.teams)
  const [order, setOrder] = useState(session.bank.map(q => q.id))
  const [projector, setProjector] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const persist = useCallback((next: Snapshot) => { setSaved(saveSession(next)); setSession(next) }, [])
  const dispatch = useCallback((action: Action) => {
    if (!session.game) return
    const next = gameReducer(session.game, action)
    if (next === session.game) return
    persist({ ...session, game: next, teams: next.teams, settings: next.settings })
    const sound: Partial<Record<Action['type'], Sound>> = { reveal: 'correct', wrong: 'wrong', steal: 'steal', navigate: 'round', end: 'winner' }
    if (action.type === 'tick') {
      const remaining = next.rounds[next.current].remaining
      if (remaining === 0) playSound('timeout', next.settings.sound)
      else if (remaining <= 5) playSound('countdown', next.settings.sound)
    } else if (sound[action.type]) playSound(sound[action.type]!, next.settings.sound)
    if (action.type === 'end') { setView('results'); playSound('confetti', next.settings.sound) }
  }, [session, persist])
  useEffect(() => {
    if (view !== 'game' || !session.game || session.game.paused || session.game.finished) return
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 1000)
    return () => clearInterval(timer)
  }, [view, session.game, dispatch])
  const home = () => setView('home')
  const newGame = () => {
    if (session.game && !confirm('NEW GAME? Mulai game baru akan mengganti progres saat ini. Ekspor dahulu jika diperlukan.')) return
    setSetupTeams(structuredClone(session.teams)); setOrder(session.bank.map(q => q.id)); setView('setup')
  }
  const start = () => {
    try {
      const teams = setupTeams.map(t => ({ ...t, name: t.name.trim() }))
      const game = createGame(order.map(id => session.bank.find(q => q.id === id)!), session.settings, teams)
      persist({ ...session, game, teams }); setView('game'); setNotice(''); playSound('opening', session.settings.sound)
    } catch { setNotice('Isi nama semua tim. Jumlah soal harus kelipatan lima agar setiap tim mendapat giliran yang sama.') }
  }
  const showSettings = () => { setSettings({ ...session.settings }); setSettingsOpen(true) }
  const saveSettings = () => {
    if (session.game) {
      const game = gameReducer(session.game, { type: 'settings', settings })
      persist({ ...session, settings, game })
    } else persist({ ...session, settings })
    setSettingsOpen(false)
  }
  async function importGame(file?: File) {
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('File terlalu besar.')
      const next = parseImport(await file.text())
      if (confirm('Ganti seluruh bank, kelompok, pengaturan dan progres dengan data impor?')) { persist(next); setView('home'); setNotice('Data berhasil diimpor. Pilih CONTINUE GAME untuk melanjutkan.') }
    } catch { setNotice('Impor ditolak: data game tidak valid atau melebihi 2 MB. Progres saat ini tetap aman.') }
  }
  return <MotionConfig reducedMotion="user"><div className={`app ${projector && view === 'game' ? 'projection' : ''}`}><div className="stage-glow" aria-hidden="true" /><div className="stage-grid" aria-hidden="true" />
    {notice && <div className="notice app-notice" role="alert">{notice}<button aria-label="Tutup pemberitahuan" className="icon-button" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {!saved && <div className="notice error app-notice" role="alert">Progres berjalan di memori, tetapi penyimpanan browser gagal. Gunakan EXPORT GAME untuk cadangan.<button className="button" onClick={() => download('family100-game.json', JSON.stringify(session))}>EXPORT GAME</button></div>}
    {view === 'home' && <><nav className="home-nav"><Logo small /><span className="school-tag">SDN SATRIA JAYA 01 <span>·</span> KELAS 5</span><button className="button ghost" onClick={showSettings}><Settings2 size={17} /> Settings</button></nav><main className="home-main"><motion.div className="home-content" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}><span className="edition-pill"><span className="live-dot" /> THE CLASSROOM GAME SHOW <Sparkles size={13} /></span><div className="hero-title"><span>FAMILY</span><strong>100</strong></div><div className="hero-subtitle"><span /> ENGLISH CHALLENGE <span /></div><p className="hero-description">Think together. Speak English.<br /><b>Let your team shine.</b></p><div className="school-info">SDN SATRIA JAYA 01 <span>•</span> KELAS 5<p>KURIKULUM MERDEKA · TAHUN PELAJARAN 2026/2027</p></div><div className="home-cta"><button className="button start-button" onClick={newGame}><Play size={20} fill="currentColor" /> START GAME <ArrowRight size={20} /></button><button className="button continue-button" disabled={!session.game} onClick={() => setView(session.game?.finished ? 'results' : 'game')}>CONTINUE GAME <ChevronRight size={17} /></button></div><div className="home-secondary"><a className="button primary" href="/game-center/" style={{ textDecoration: "none" }}>GAME CENTER · 7 MAPEL · 1.091 SOAL</a><button onClick={() => setView('bank')}><BookOpen size={18} /> QUESTION BANK</button><button onClick={() => setHelp(true)}><HelpCircle size={18} /> HOW TO PLAY</button></div><div className="feature-strip"><span><Users size={16} /> 5 KELOMPOK</span><span><BookOpen size={16} /> {session.bank.length} SOAL</span><span><Trophy size={16} /> 1 ENGLISH CHAMPION</span></div></motion.div><motion.div className="hero-stage" aria-hidden="true" initial={{ opacity: 0, rotateY: -12 }} animate={{ opacity: 1, rotateY: -7 }} transition={{ duration: .8 }}><div className="spotlight left" /><div className="spotlight right" /><div className="stage-sign"><span>IT’S YOUR TIME TO</span><strong>SHINE!</strong><Sparkles size={28} /></div><div className="mini-board"><div className="mini-heading"><span className="live-dot" /> THE ANSWER IS… <b>100</b></div>{['TEAMWORK', 'CONFIDENCE', 'ENGLISH', 'FUN!'].map((t, i) => <div className={`mini-answer mini-${i}`} key={t}><span>{i + 1}</span><strong>{t}</strong><b>{[40, 30, 20, 10][i]}</b></div>)}</div><div className="stage-pedestal"><Trophy size={38} /><span>EVERY ANSWER COUNTS</span></div><div className="floating-badge badge-one">LET’S GO! ⚡</div><div className="floating-badge badge-two">YOU’VE GOT THIS ✦</div></motion.div></main><div className="chapter-strip">{CHAPTERS.map((ch, i) => <div key={ch}><span>0{i + 1}</span><div><small>CHAPTER {i + 1}</small><strong>{ch}</strong></div><CheckCircle2 size={18} /></div>)}</div><div className="data-actions no-print"><button onClick={() => download('family100-game.json', JSON.stringify(session))}><Download size={14} /> EXPORT GAME</button><button onClick={() => fileRef.current?.click()}><Upload size={14} /> IMPORT GAME DATA</button><span><span className="live-dot" /> {saved ? 'Progres tersimpan otomatis di perangkat ini' : 'Penyimpanan tidak tersedia'}</span></div></>}
    {view === 'setup' && <section className="page"><button className="button ghost" onClick={home}><Home size={16} /> Beranda</button><div className="page-heading"><div><p className="eyebrow">GET YOUR TEAMS READY</p><h1>Meet the teams<span className="dot">.</span></h1><p>Lima kelompok. Satu panggung. Semua punya kesempatan.</p></div><button className="button primary" disabled={setupTeams.some(t => !t.name.trim()) || order.length % 5 !== 0} onClick={start}>MULAI PERTANDINGAN <Play size={17} /></button></div><TeamEditor teams={setupTeams} onChange={setSetupTeams} /><div className="panel"><h2>Urutan giliran yang adil</h2><p>{order.length} ronde · {order.length % 5 === 0 ? `${order.length / 5} giliran utama per kelompok` : 'Jumlah soal harus kelipatan lima. Sesuaikan bank soal.'}</p><div className="turn-order">{order.map((id, i) => <span key={id} style={{ borderColor: TEAM_COLORS[i % 5] }}><b>{i + 1}</b> {setupTeams[i % 5].name}</span>)}</div><p className="muted">Urutan soal mengikuti Question Bank. Atur dengan tombol panah di halaman bank sebelum mulai.</p><button className="button" onClick={() => setView('bank')}><BookOpen size={16} /> Atur urutan soal</button></div></section>}
    {view === 'game' && session.game && <GameBoard game={session.game} dispatch={dispatch} onHome={home} onLeaders={() => setView('results')} projector={projector} onProjector={() => setProjector(!projector)} onSettings={showSettings} />}
    {view === 'bank' && <QuestionBank bank={session.bank} onChange={bank => persist({ ...session, bank })} onBack={home} />}
    {view === 'results' && session.game && <Results game={session.game} final={session.game.finished} onBack={() => setView(session.game?.finished ? 'home' : 'game')} />}
    <Footer /><input className="sr-only" ref={fileRef} type="file" accept="application/json,.json" aria-label="Impor data permainan" onChange={e => { void importGame(e.target.files?.[0]); e.target.value = '' }} />
    {help && <Modal title="How to play" onClose={() => setHelp(false)}><p className="muted">Permainan refleksi Bahasa Inggris · My Next Words Grade 5 · Bab 1–3</p><ol className="help-list"><li>Bentuk lima kelompok berisi 6–7 siswa. Guru mengoperasikan layar, siswa menjawab secara lisan.</li><li>Tim bergiliran berurutan selama 30 ronde; setiap tim mendapat enam giliran utama.</li><li>Diskusikan pertanyaan. Guru memilih jawaban dan penerima poin, lalu membuka jawaban yang benar. Setiap jawaban bernilai sekali.</li><li>Tekan WRONG untuk jawaban salah. Setelah tiga kesalahan, pilih tim lain untuk STEAL: hanya satu kesempatan, hanya poin jawaban tersebut.</li><li>SHOW ALL membuka jawaban tanpa poin. UNDO membatalkan aksi terakhir; RESET ROUND hanya menghapus hasil ronde aktif.</li><li>Timer dapat dimatikan. Saat waktu habis, guru menekan timer untuk melanjutkan. Poin sama berarti peringkat bersama.</li><li>Gunakan mode proyektor dan sembunyikan kontrol untuk tampilan kelas. Gunakan EXPORT GAME agar memiliki cadangan.</li></ol><p className="notice">Poin merupakan bobot permainan edukasi, bukan hasil survei sebenarnya. Guru dapat menerima padanan jawaban yang benar sesuai konteks; buka kartu yang sesuai.</p><button className="button primary" onClick={() => setHelp(false)}>Siap bermain!</button></Modal>}
    {settingsOpen && <Modal title="Game settings" onClose={() => setSettingsOpen(false)}><SettingsEditor value={settings} onChange={setSettings} /><p className="muted">Mengubah durasi timer mengulang waktu semua ronde. Skor tetap tersimpan.</p><div className="modal-actions"><button className="button" onClick={() => setSettingsOpen(false)}>Batal</button><button className="button primary" onClick={saveSettings}>Simpan pengaturan</button></div></Modal>}
  </div></MotionConfig>
}
